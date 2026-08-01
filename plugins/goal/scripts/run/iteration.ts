// One iteration handed to the implementer. The section travels as text and the plan's path
// never does — handing that path over is what made a real run read the plan in another
// checkout, take its parent as the repository root, and write the whole iteration into the
// wrong tree with a correct cwd throughout. HEAD before and after tells a committed implementer
// apart from one that wrote nothing, and only a moved tree is handed to the gate for a verdict.

import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

import { iterationSection } from '../gate/plan.ts';
import { REFUSED } from './preflight.ts';
import type { Reporter } from './report.ts';
import type { Lock } from './lock.ts';

export const LANDED = 0;
export const HALTED = 1;
export const PAUSED = 3;

const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

type ToolUseBlock = { type: string; name?: string; input?: { file_path?: string; command?: string } };
type StreamEvent = { type?: string; session_id?: string; message?: { content?: ToolUseBlock[] } };

// The implementer answers in stream-json, so each tool use it performs is rendered as one line
// as it happens, and the session_id every event carries is handed to the reporter to record
// beside the run rather than read once at the end.
const narrate = (stdout: string, reporter: Reporter): void => {
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') {
      continue;
    }

    let event: StreamEvent;

    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      continue;
    }

    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_use' && block.name) {
        const target = block.input?.file_path ?? block.input?.command;
        reporter.say(`RUN implementer: ${block.name}${target ? ` ${target}` : ''}`);
      }
    }

    if (event.session_id) {
      reporter.session?.(event.session_id);
    }
  }
};

const brief = (iteration: string, cwd: string, branch: string, section: string): string => `Implement iteration ${iteration} of a plan somebody else locked.

You are working in ${cwd}, on branch ${branch}. Every path
you read or write lives inside that tree.

The iteration, verbatim from the plan. Its goal, the files to touch, the business rules it
covers, every decision bullet and its gate block.

--- iteration ---
${section}
--- end ---

Work test-first, and show the RED: the gate sets your implementation aside and requires gate1 to
fail without it, so a test that passes either way halts the slice.

Load the project convention skills before writing anything.

You do not commit, do not push, do not stage, do not tick a checkbox and do not edit the plan.
The gate does all of that, after it has verified.`;

export const runIteration = (
  plan: string,
  source: string,
  iteration: string,
  hash: string,
  gate: string,
  reporter: Reporter,
  lock: Lock,
): void => {
  reporter.say(`RUN iteration ${iteration} of ${basename(plan)}, in ${process.cwd()}`);

  if (!lock.acquire()) {
    reporter.stop(`another run holds this plan. Wait for it, or free it with: ${gate} unlock ${plan}`, REFUSED);
  }

  const section = iterationSection(source, iteration).join('\n');

  if (section.trim() === '') {
    reporter.stop(`iteration ${iteration} has no section in the plan, so there is nothing to implement`, REFUSED);
  }

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
  const headBefore = git('rev-parse', 'HEAD').stdout.trim();

  // A quota window is not a failure, so it is not diagnosed like one: it is detected from the
  // shape of a failed call, slept through, and retried against the same iteration — bounded, so
  // a window that never reopens still ends in a pause rather than a run spinning until the
  // machine is switched off.
  const quotaSleep = process.env.GOAL_RUN_QUOTA_SLEEP ?? '1800';
  const quotaMax = Number(process.env.GOAL_RUN_QUOTA_MAX_RETRIES ?? '3');
  let attempt = 1;

  for (;;) {
    reporter.say(`RUN handing iteration ${iteration} to the implementer`);

    const implemented = spawnSync(
      'claude',
      [
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

    if ((implemented.status ?? 1) === 0) {
      break;
    }

    const output = `${implemented.stdout}${implemented.stderr}`;

    if (!/usage limit|rate.limit|rate_limit_error/i.test(output)) {
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
    reporter.say(`RUN the implementer looks quota-exhausted, sleeping ${quotaSleep}s before relaunching iteration ${iteration} (attempt ${attempt} of ${quotaMax})`);
    spawnSync('sleep', [quotaSleep]);
  }

  const headAfter = git('rev-parse', 'HEAD').stdout.trim();
  const touched = git('status', '--porcelain').stdout;

  if (headAfter !== headBefore) {
    reporter.stop(
      `the implementer committed on its own, which only the gate may do. HEAD moved from ${headBefore} to ${headAfter}. Nothing was gate-verified: review that commit before relaunching.`,
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

  const verdict = spawnSync(`${gate} commit ${quote(plan)} ${quote(iteration)} ${quote(hash)}`, {
    shell: true,
    encoding: 'utf8',
  });
  const gateExit = verdict.status ?? 1;

  if (gateExit === 0) {
    lock.release();
    reporter.say(`RUN iteration ${iteration} landed, gate-verified`);

    return;
  }

  if (gateExit !== 1) {
    reporter.say(`STOP the gate could not be run (exit ${gateExit}), so no verdict exists. The tree holds whatever the implementer wrote and nothing was committed.`);
    process.exit(PAUSED);
  }

  lock.release();
  reporter.say(`STOP iteration ${iteration} was refused by the gate. Nothing was committed, and the tree is left exactly as the implementer left it.`);
  process.exit(HALTED);
};
