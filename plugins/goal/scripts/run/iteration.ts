// One iteration handed to the implementer. The section travels as text and the plan's path
// never does — handing that path over is what made a real run read the plan in another
// checkout, take its parent as the repository root, and write the whole iteration into the
// wrong tree with a correct cwd throughout. HEAD before and after tells a committed implementer
// apart from one that wrote nothing, and only a moved tree is handed to the gate for a verdict.

import { spawnSync } from 'node:child_process';
import { basename, join } from 'node:path';

import { ceiling } from '../gate/bounded.ts';
import { iterationSection } from '../gate/plan.ts';
import { brief } from './brief.ts';
import { changedGitDirPaths, changedRefs, snapshotGitDir, snapshotRefs } from './gitwatch.ts';
import { narrate } from './narrate.ts';
import { REFUSED } from './preflight.ts';
import { burstBackoffSeconds, classifyQuotaFailure, sleepInSlices } from './quota.ts';
import type { Reporter } from './report.ts';
import { git, quote } from './shell.ts';

export const LANDED = 0;
export const HALTED = 1;
export const PAUSED = 3;

export const runIteration = (
  plan: string,
  source: string,
  iteration: string,
  hash: string,
  ticked: string,
  gate: string,
  dir: string,
  reporter: Reporter,
): void => {
  reporter.say(`RUN iteration ${iteration} of ${basename(plan)}, in ${process.cwd()}`);

  const section = iterationSection(source, iteration).join('\n');

  if (section.trim() === '') {
    reporter.stop(`iteration ${iteration} has no section in the plan, so there is nothing to implement`, REFUSED);
  }

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
  const headBefore = git('rev-parse', 'HEAD').stdout.trim();

  // Taken once, before the retry loop, beside headBefore: a tamper on attempt 1 must still show
  // up after a quota failure sends the same iteration to attempt 2, so a fresh snapshot per
  // attempt (which would use attempt 1's tamper as its own baseline) is not an option.
  const gitDirBefore = snapshotGitDir();

  // Brackets the implementer only: the runner itself pushes in publish.ts under `commit+pr`,
  // outside this call, so lifting the snapshot into a wider loop would catch its own push.
  const refsBefore = snapshotRefs();

  // A quota window is not a failure, so it is not diagnosed like one: it is detected from the
  // shape of a failed call, slept through, and retried against the same iteration — bounded, so
  // a window that never reopens still ends in a pause rather than a run spinning until the
  // machine is switched off.
  const quotaSleep = process.env.GOAL_RUN_QUOTA_SLEEP ?? '1800';
  const quotaMax = Number(process.env.GOAL_RUN_QUOTA_MAX_RETRIES ?? '3');
  let attempt = 1;

  for (;;) {
    reporter.say(`RUN handing iteration ${iteration} to the implementer`);

    const implementerStart = Date.now();
    const implemented = spawnSync(
      '/bin/sh',
      [
        '-c',
        `${ceiling()}\nexec "$@"`,
        'sh',
        'claude',
        '-p',
        '--agent',
        'goal:goal-run-implementer',
        '--permission-mode',
        'auto',
        '--output-format',
        'stream-json',
        '--verbose',
        brief(iteration, process.cwd(), branch, section),
      ],
      { encoding: 'utf8' },
    );

    narrate(implemented.stdout, reporter);
    reporter.say(`RUN stage=implementer duration_ms=${Date.now() - implementerStart} exit=${implemented.status ?? 1}`);

    if ((implemented.status ?? 1) === 0) {
      break;
    }

    const output = `${implemented.stdout}${implemented.stderr}`;
    const quotaClass = classifyQuotaFailure(output);

    if (quotaClass === null) {
      reporter.stop(
        `the implementer exited ${implemented.status}. The tree holds whatever it wrote and no gate has judged it: review it before relaunching.`,
        PAUSED,
      );
    }

    if (attempt >= quotaMax) {
      reporter.stop(
        `the quota still looks exhausted after ${attempt} attempt(s) on iteration ${iteration}. Pausing rather than spinning through a window that is not reopening: relaunch resumes here.`,
        PAUSED,
      );
    }

    attempt += 1;

    if (quotaClass === 'burst') {
      const seconds = burstBackoffSeconds(attempt - 1);
      reporter.say(`RUN the implementer hit a burst rate limit, backing off ${seconds}s before relaunching iteration ${iteration} (attempt ${attempt} of ${quotaMax})`);
      spawnSync('sleep', [String(seconds)]);
    } else {
      reporter.say(`RUN the implementer looks quota-exhausted, sleeping ${quotaSleep}s before relaunching iteration ${iteration} (attempt ${attempt} of ${quotaMax})`);
      sleepInSlices(Number(quotaSleep), (remaining) => reporter.say(`RUN quota sleep continues, ${remaining}s remaining`));
    }
  }

  const headAfter = git('rev-parse', 'HEAD').stdout.trim();
  const touched = git('status', '--porcelain').stdout;

  if (headAfter !== headBefore) {
    reporter.stop(
      `the implementer committed on its own, which only the gate may do. HEAD moved from ${headBefore} to ${headAfter}. Nothing was gate-verified: review that commit before relaunching.`,
      PAUSED,
    );
  }

  // Checked before the empty-tree case below: an implementer that writes only into `.git/`
  // leaves `git status` empty, so this has to run first or the diagnosis reads as "wrote
  // nothing" rather than naming the git directory itself as the artifact.
  const gitDirChanges = changedGitDirPaths(gitDirBefore);

  if (gitDirChanges.length > 0) {
    reporter.stop(
      `the implementer changed the git directory: ${gitDirChanges.join(', ')}. \`git status\` will not show this: the artifact is still in .git/, not in the tree. Review it before relaunching.`,
      PAUSED,
    );
  }

  const refChanges = changedRefs(refsBefore);
  const remoteRefChanges = refChanges.filter((ref) => ref.startsWith('refs/remotes/'));

  if (remoteRefChanges.length > 0) {
    reporter.stop(
      `the implementer pushed: ${remoteRefChanges.join(', ')} moved. Only the gate may publish. Review it before relaunching.`,
      PAUSED,
    );
  }

  const otherRefChanges = refChanges.filter((ref) => !ref.startsWith('refs/remotes/'));

  if (otherRefChanges.length > 0) {
    reporter.stop(
      `the implementer moved ${otherRefChanges.join(', ')}. \`git status\` will not show this: review it before relaunching.`,
      PAUSED,
    );
  }

  if (touched.trim() === '') {
    reporter.stop(
      'the implementer wrote nothing in this tree, so no verdict was asked for. The usual cause is a path that left the tree: look for the work in another checkout before assuming it does not exist.',
      PAUSED,
    );
  }

  reporter.say('RUN the tree moved, asking the gate for a verdict');

  const gateStart = Date.now();
  const verdict = spawnSync(`${gate} commit ${quote(plan)} ${quote(iteration)} ${quote(hash)} ${quote(ticked)}`, {
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, GOAL_RUN_JSONL: join(dir, '.run.jsonl') },
  });
  const gateExit = verdict.status ?? 1;

  reporter.record(`${verdict.stdout}${verdict.stderr}`);
  reporter.say(`RUN stage=gate duration_ms=${Date.now() - gateStart} exit=${gateExit}`);

  if (gateExit === 0) {
    reporter.say(`RUN iteration ${iteration} landed, gate-verified`);

    return;
  }

  if (gateExit !== 1) {
    reporter.say(`STOP the gate could not be run (exit ${gateExit}), so no verdict exists. The tree holds whatever the implementer wrote and nothing was committed.`);
    process.exit(PAUSED);
  }

  reporter.say(`STOP iteration ${iteration} was refused by the gate. Nothing was committed, and the gate's reasoning is in ${join(dir, '.run.log')}. The tree is left exactly as the implementer left it.`);
  process.exit(HALTED);
};
