// One iteration handed to the implementer. The section travels as text and the plan's path
// never does — handing that path over is what made a real run read the plan in another
// checkout, take its parent as the repository root, and write the whole iteration into the
// wrong tree with a correct cwd throughout. HEAD before and after tells a committed implementer
// apart from one that wrote nothing, and only a moved tree is handed to the gate for a verdict.

import { basename, join } from 'node:path';

import { clock } from '../adapters/clock.ts';
import type { GateAdapter } from '../adapters/gate.ts';
import { git } from '../adapters/git.ts';
import { iterationSection } from '../gate/plan.ts';
import { rulesContext } from '../core/plan.ts';
import { settingValue } from '../core/settings.ts';
import type { AgentSessions } from '../ports.ts';
import { classifyRefChanges, detectTamper, unnoted } from '../core/tamper.ts';
import { HALTED, PAUSED, REFUSED } from '../core/verdict.ts';
import { brief } from './brief.ts';
import { changedGitDirPaths, refChanges, snapshotGitDir, snapshotRefs } from './gitwatch.ts';
import { endOf, tokensLine } from './narrate.ts';
import { remoteNote, type Publisher } from './publish.ts';
import { burstBackoffSeconds, shutdownBackoffSeconds, waitInSlices } from './quota.ts';
import { interrupt } from './lock.ts';
import type { Reporter } from './report.ts';

export { HALTED, PAUSED } from '../core/verdict.ts';

// A SIGINT that lands while a synchronous call blocks the process is queued by the OS, not
// delivered: Node only runs the registered handler on a turn of the event loop. Awaited right
// after the gate's synchronous call, so a queued signal's own exit gets first refusal at
// deciding this process's fate, ahead of whatever this loop was about to do next.
const yieldToLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export const runIteration = async (
  plan: string,
  source: string,
  iteration: string,
  hash: string,
  ticked: string,
  gate: GateAdapter,
  agents: AgentSessions,
  dir: string,
  reporter: Reporter,
  publisher: Publisher,
  noted: Set<string>,
): Promise<void> => {
  reporter.say(`RUN iteration ${iteration} of ${basename(plan)}, in ${process.cwd()}`);

  const section = iterationSection(source, iteration).join('\n');

  if (section.trim() === '') {
    reporter.stop(`iteration ${iteration} has no section in the plan, so there is nothing to implement:${remoteNote(publisher)}`, REFUSED);
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

  const readTamper = () => {
    const { changes, carriesWork } = refChanges(refsBefore, branch);
    const { pausing, noted: notes } = classifyRefChanges(changes, carriesWork);

    const gitDir = changedGitDirPaths(gitDirBefore);

    for (const note of unnoted([...notes, ...gitDir.notes], noted)) {
      reporter.say(note.line);
    }

    const after = {
      head: git('rev-parse', 'HEAD').stdout.trim(),
      gitDirChanges: gitDir.attributable,
      sharedGitDirChanges: gitDir.shared,
      remoteRefChanges: pausing.filter((ref) => ref.startsWith('refs/remotes/')),
      otherRefChanges: pausing.filter((ref) => !ref.startsWith('refs/remotes/')),
    };

    return detectTamper({ head: headBefore, gitDirChanges: [], remoteRefChanges: [], otherRefChanges: [] }, after);
  };

  // A quota window is not a failure, so it is not diagnosed like one: the adapter reports its
  // class from the shape of a failed call, and the runner slept through, and retried against the same iteration — bounded, so
  // a window that never reopens still ends in a pause rather than a run spinning until the
  // machine is switched off.
  const quotaSleep = String(settingValue('GOAL_RUN_QUOTA_SLEEP', process.env));
  const quotaMax = settingValue('GOAL_RUN_QUOTA_MAX_RETRIES', process.env);
  let attempt = 1;
  const history: string[] = [];

  for (;;) {
    interrupt.exitIfRequested();
    reporter.say(`RUN handing iteration ${iteration} to the implementer`);

    const outPath = join(dir, `implementer-attempt-${attempt}.out`);
    const errPath = join(dir, `implementer-attempt-${attempt}.err`);
    const report = await interrupt.guard(async () => {
      const launched = await agents.launch(
        'implementer',
        brief(iteration, process.cwd(), branch, section, rulesContext(source)),
        { outPath, errPath, onTool: (line) => reporter.say(line), onSession: (id) => reporter.session?.(id) },
        interrupt.signal(),
      );

      await yieldToLoop();

      return launched;
    });

    reporter.say(`RUN stage=implementer duration_ms=${report.durationMs} ${endOf(report.end)}`);

    const tokens = tokensLine('implementer', report.consumption);

    if (tokens !== undefined && tokens !== '') {
      reporter.say(tokens);
    }

    const tamper = readTamper();

    if (!tamper.ok) {
      reporter.stop(`${tamper.error}${remoteNote(publisher)}`, PAUSED);
    }

    await yieldToLoop();
    interrupt.exitIfRequested();

    const quotaClass = report.outcome.class;

    if (quotaClass === 'success') {
      break;
    }

    const signal = report.end.signal;
    const cause = signal === null ? `exit code ${report.end.status ?? 1}` : `signal ${signal}`;
    reporter.say(`RUN the implementer failed on iteration ${iteration}: ${cause}, after ${Math.round(report.durationMs / 1000)}s`);

    agents.postmortem?.(report, (line) => reporter.say(line), { attempt, cwd: process.cwd(), dir });

    if (quotaClass !== 'exhausted' && quotaClass !== 'burst' && quotaClass !== 'signal') {
      reporter.stop(
        `the implementer exited ${report.end.status ?? 1} and ended unrecognised:${report.outcome.quote === '' ? 'no final result and no stderr' : report.outcome.quote}. The tree holds whatever it wrote and no gate has judged it: review it before relaunching.${remoteNote(publisher)}`,
        PAUSED,
      );
    }

    history.push(`attempt ${attempt}: ${quotaClass}`);

    if (attempt >= quotaMax) {
      reporter.stop(
        `iteration ${iteration} is not converging: paused after ${attempt} attempt(s), the ceiling GOAL_RUN_QUOTA_MAX_RETRIES=${quotaMax}: ${history.join(', ')}. Pausing rather than relaunching it again: relaunch resumes here.${remoteNote(publisher)}`,
        PAUSED,
      );
    }

    attempt += 1;

    if (quotaClass === 'signal') {
      const seconds = shutdownBackoffSeconds();
      reporter.say(`RUN the implementer exited 143 (shutdown), backing off ${seconds}s before relaunching iteration ${iteration} (attempt ${attempt} of ${quotaMax})`);
      await interrupt.guard(() => clock.sleep(seconds, interrupt.signal()));
    } else if (quotaClass === 'burst') {
      const seconds = burstBackoffSeconds(attempt - 1);
      reporter.say(`RUN the implementer hit a burst rate limit, backing off ${seconds}s before relaunching iteration ${iteration} (attempt ${attempt} of ${quotaMax})`);
      await interrupt.guard(() => clock.sleep(seconds, interrupt.signal()));
    } else {
      reporter.say(`RUN the implementer looks quota-exhausted, sleeping ${quotaSleep}s before relaunching iteration ${iteration} (attempt ${attempt} of ${quotaMax})`);
      await interrupt.guard(() => waitInSlices(Number(quotaSleep), (remaining) => reporter.say(`RUN quota sleep continues, ${remaining}s remaining`), interrupt.signal()));
    }
  }

  const touched = git('status', '--porcelain').stdout;

  if (touched.trim() === '') {
    reporter.stop(
      `the implementer wrote nothing in this tree, so no verdict was asked for. The usual cause is a path that left the tree: look for the work in another checkout before assuming it does not exist.${remoteNote(publisher)}`,
      PAUSED,
    );
  }

  reporter.say('RUN the tree moved, asking the gate for a verdict');

  const gateStart = clock.now();
  const verdict = gate.commit(plan, iteration, hash, ticked, join(dir, '.run.jsonl'));
  const gateExit = verdict.status;

  await yieldToLoop();

  reporter.record(`${verdict.stdout}${verdict.stderr}`);
  reporter.say(`RUN stage=gate duration_ms=${clock.now() - gateStart} exit=${gateExit}`);

  if (gateExit === 0) {
    reporter.say(`RUN iteration ${iteration} landed, gate-verified`);

    return;
  }

  if (gateExit !== 1) {
    reporter.say(`STOP the gate could not be run (exit ${gateExit}), so no verdict exists. The tree holds whatever the implementer wrote and nothing was committed.${remoteNote(publisher)}`);
    process.exit(PAUSED);
  }

  reporter.say(`STOP iteration ${iteration} was refused by the gate. Nothing was committed, and the gate's reasoning is in ${join(dir, '.run.log')}. The tree is left exactly as the implementer left it.${remoteNote(publisher)}`);
  process.exit(HALTED);
};
