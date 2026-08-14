// One iteration handed to the implementer. The section travels as text and the plan's path
// never does — handing that path over is what made a real run read the plan in another
// checkout, take its parent as the repository root, and write the whole iteration into the
// wrong tree with a correct cwd throughout. HEAD before and after tells a committed implementer
// apart from one that wrote nothing, and only a moved tree is handed to the gate for a verdict.

import { basename, join } from 'node:path';

import { command } from '../adapters/command.ts';
import type { GateAdapter } from '../adapters/gate.ts';
import { git } from '../adapters/git.ts';
import { ceiling } from '../gate/bounded.ts';
import { iterationSection } from '../gate/plan.ts';
import { detectTamper } from '../core/tamper.ts';
import { HALTED, PAUSED, REFUSED } from '../core/verdict.ts';
import { brief } from './brief.ts';
import { changedGitDirPaths, changedRefs, snapshotGitDir, snapshotRefs } from './gitwatch.ts';
import { narrate, tokensLine } from './narrate.ts';
import { claudeBinaryMtime, claudeBinaryPath, postmortem } from './postmortem.ts';
import { blockedNote, type Publisher } from './publish.ts';
import { burstBackoffSeconds, classifyFailure, shutdownBackoffSeconds, shutdownMaxRetries, sleepInSlices } from './quota.ts';
import type { Reporter } from './report.ts';

export { HALTED, PAUSED } from '../core/verdict.ts';

// A SIGINT that lands while a spawnSync call blocks the process is queued by the OS, not
// delivered: Node only runs the registered handler on a turn of the event loop, and a bare
// spawnSync never gives it one. Awaited right after each call this loop cannot make responsive
// on its own, so a queued signal's own exit (lock.ts's handler, releasing the lock before it)
// gets first refusal at deciding this process's fate, ahead of whatever this loop was about to
// do next.
const yieldToLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export const runIteration = async (
  plan: string,
  source: string,
  iteration: string,
  hash: string,
  ticked: string,
  gate: GateAdapter,
  dir: string,
  reporter: Reporter,
  publisher: Publisher,
): Promise<void> => {
  reporter.say(`RUN iteration ${iteration} of ${basename(plan)}, in ${process.cwd()}`);

  const section = iterationSection(source, iteration).join('\n');

  if (section.trim() === '') {
    reporter.stop(`iteration ${iteration} has no section in the plan, so there is nothing to implement:${blockedNote(publisher)}`, REFUSED);
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

    const binaryBefore = claudeBinaryMtime(claudeBinaryPath());
    const implementerStart = Date.now();
    const implemented = command.run(
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
      { encoding: 'utf8', env: { ...process.env, DISABLE_AUTOUPDATER: '1' } },
    );

    await yieldToLoop();

    const extraction = narrate(implemented.stdout, reporter);
    reporter.say(`RUN stage=implementer duration_ms=${Date.now() - implementerStart} exit=${implemented.status ?? 1}`);

    const tokens = tokensLine('implementer', extraction);

    if (tokens) {
      reporter.say(tokens);
    }

    if ((implemented.status ?? 1) === 0) {
      break;
    }

    const output = `${implemented.stdout}${implemented.stderr}`;
    postmortem(reporter, dir, attempt, process.cwd(), implemented.status ?? 1, implemented.stdout, implemented.stderr, binaryBefore);
    const quotaClass = classifyFailure(implemented.status ?? 1, output);

    if (quotaClass === null) {
      reporter.stop(
        `the implementer exited ${implemented.status}. The tree holds whatever it wrote and no gate has judged it: review it before relaunching.${blockedNote(publisher)}`,
        PAUSED,
      );
    }

    const maxRetries = quotaClass === 'shutdown' ? shutdownMaxRetries() : quotaMax;
    if (attempt >= maxRetries) {
      reporter.stop(
        `the quota still looks exhausted after ${attempt} attempt(s) on iteration ${iteration}. Pausing rather than spinning through a window that is not reopening: relaunch resumes here.${blockedNote(publisher)}`,
        PAUSED,
      );
    }

    attempt += 1;

    if (quotaClass === 'shutdown') {
      const seconds = shutdownBackoffSeconds();
      reporter.say(`RUN the implementer exited 143 (shutdown), backing off ${seconds}s before relaunching iteration ${iteration} (attempt ${attempt} of ${maxRetries})`);
      command.run('sleep', [String(seconds)]);
    } else if (quotaClass === 'burst') {
      const seconds = burstBackoffSeconds(attempt - 1);
      reporter.say(`RUN the implementer hit a burst rate limit, backing off ${seconds}s before relaunching iteration ${iteration} (attempt ${attempt} of ${maxRetries})`);
      command.run('sleep', [String(seconds)]);
    } else {
      reporter.say(`RUN the implementer looks quota-exhausted, sleeping ${quotaSleep}s before relaunching iteration ${iteration} (attempt ${attempt} of ${maxRetries})`);
      sleepInSlices(Number(quotaSleep), (remaining) => reporter.say(`RUN quota sleep continues, ${remaining}s remaining`));
    }
  }

  // Read exactly once, after the loop settles: every fact detectTamper decides over comes from
  // this one pass, rather than a fresh git call per case it might report.
  const refChanges = changedRefs(refsBefore);
  const after = {
    head: git('rev-parse', 'HEAD').stdout.trim(),
    gitDirChanges: changedGitDirPaths(gitDirBefore),
    remoteRefChanges: refChanges.filter((ref) => ref.startsWith('refs/remotes/')),
    otherRefChanges: refChanges.filter((ref) => !ref.startsWith('refs/remotes/')),
  };
  const before = { head: headBefore, gitDirChanges: [], remoteRefChanges: [], otherRefChanges: [] };
  const tamper = detectTamper(before, after);

  if (!tamper.ok) {
    reporter.stop(`${tamper.error}${blockedNote(publisher)}`, PAUSED);
  }

  const touched = git('status', '--porcelain').stdout;

  if (touched.trim() === '') {
    reporter.stop(
      `the implementer wrote nothing in this tree, so no verdict was asked for. The usual cause is a path that left the tree: look for the work in another checkout before assuming it does not exist.${blockedNote(publisher)}`,
      PAUSED,
    );
  }

  reporter.say('RUN the tree moved, asking the gate for a verdict');

  const gateStart = Date.now();
  const verdict = gate.commit(plan, iteration, hash, ticked, join(dir, '.run.jsonl'));
  const gateExit = verdict.status;

  await yieldToLoop();

  reporter.record(`${verdict.stdout}${verdict.stderr}`);
  reporter.say(`RUN stage=gate duration_ms=${Date.now() - gateStart} exit=${gateExit}`);

  if (gateExit === 0) {
    reporter.say(`RUN iteration ${iteration} landed, gate-verified`);

    return;
  }

  if (gateExit !== 1) {
    reporter.say(`STOP the gate could not be run (exit ${gateExit}), so no verdict exists. The tree holds whatever the implementer wrote and nothing was committed.${blockedNote(publisher)}`);
    process.exit(PAUSED);
  }

  reporter.say(`STOP iteration ${iteration} was refused by the gate. Nothing was committed, and the gate's reasoning is in ${join(dir, '.run.log')}. The tree is left exactly as the implementer left it.${blockedNote(publisher)}`);
  process.exit(HALTED);
};
