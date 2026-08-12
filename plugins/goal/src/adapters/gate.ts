// The runner's one seam onto a verdict, in two implementations. In-process is the default: it
// calls the same gate/* modules goal-gate.ts dispatches to, rereading the plan off disk on every
// call, exactly as a freshly spawned CLI would. Spawn+scrape is used when `GOAL_GATE` names a
// command to drive instead.

import { spawnSync } from 'node:child_process';

import { HaltError, MisuseError, haltText, release, unwrap, type Say } from '../gate/halt.ts';
import { blockOf, lockedHash, readPlan } from '../gate/plan.ts';
import { commitAndTick, runLock } from '../gate/scope.ts';
import { dodCheck, secretScan } from '../gate/ship.ts';
import { monotonicityCheck } from '../gate/ticked.ts';
import { check, verify } from '../gate/verbs.ts';
import { quote } from '../run/shell.ts';

export type GateResult = { status: number; stdout: string; stderr: string };

export type GateAdapter = {
  check: (plan: string, iteration: string) => GateResult;
  commit: (plan: string, iteration: string, hash: string, ticked: string, jsonl?: string) => GateResult;
  dod: (plan: string, hash?: string) => GateResult;
  scan: () => GateResult;
  lock: (plan: string) => GateResult;
  unlock: (plan: string) => GateResult;
};

export const gateAdapterOf = (gate: string | GateAdapter): GateAdapter => (typeof gate === 'string' ? spawnGateAdapter(gate) : gate);

// -- spawn+scrape: the channel a run has always driven, unchanged behind GOAL_GATE -------------

const shell = (command: string, env?: Record<string, string>): GateResult => {
  const result = spawnSync(command, { shell: true, encoding: 'utf8', ...(env ? { env: { ...process.env, ...env } } : {}) });

  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
};

export const spawnGateAdapter = (gate: string): GateAdapter => ({
  check: (plan, iteration) => shell(`${gate} check ${quote(plan)} ${quote(iteration)}`),
  commit: (plan, iteration, hash, ticked, jsonl) =>
    shell(`${gate} commit ${quote(plan)} ${quote(iteration)} ${quote(hash)} ${quote(ticked)}`, jsonl ? { GOAL_RUN_JSONL: jsonl } : undefined),
  dod: (plan, hash) => shell(`${gate} dod ${quote(plan)}${hash !== undefined ? ` ${quote(hash)}` : ''}`),
  scan: () => shell(`${gate} scan`),
  lock: (plan) => shell(`${gate} lock ${quote(plan)}`),
  unlock: (plan) => shell(`${gate} unlock ${quote(plan)}`),
});

// -- in-process: the default, calling straight into the gate's own modules ---------------------

// A verb streams progress through `say`, returns its final line, or throws its refusal; whatever
// happens, release() drains the locks it took, the way the process exit of a spawned gate would.
const rendered = (run: (say: Say) => string): GateResult => {
  let streamed = '';

  try {
    const tail = run((chunk) => {
      streamed += chunk;
    });

    return { status: 0, stdout: streamed + tail, stderr: '' };
  } catch (error) {
    if (error instanceof HaltError) {
      return { status: 1, stdout: streamed + haltText(error), stderr: '' };
    }

    if (error instanceof MisuseError) {
      return { status: 2, stdout: streamed, stderr: `${error.message}\n` };
    }

    throw error;
  } finally {
    release();
  }
};

const withEnv = (key: string, value: string | undefined, run: () => GateResult): GateResult => {
  if (value === undefined) {
    return run();
  }

  const previous = process.env[key];
  process.env[key] = value;

  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
};

export const inProcessGateAdapter = (): GateAdapter => ({
  check: (plan, iteration) => rendered(() => check(plan, iteration)),

  commit: (plan, iteration, hash, ticked, jsonl) =>
    withEnv('GOAL_RUN_JSONL', jsonl, () =>
      rendered((say) => {
        const source = readPlan(plan);

        lockedHash(plan, source, `iteration ${iteration}`, hash);

        const declared = blockOf(source, iteration);
        const { paths, incidental, changed } = verify(source, iteration, declared, say);

        unwrap(monotonicityCheck(source, iteration, ticked));

        return commitAndTick(plan, source, iteration, declared, paths, changed, incidental);
      }),
    ),

  dod: (plan, hash) =>
    rendered(() => {
      const source = readPlan(plan);

      lockedHash(plan, source, 'the Definition of Done replay', hash);

      return dodCheck(source);
    }),

  scan: () => rendered(() => secretScan()),

  lock: (plan) => rendered(() => runLock('lock', plan)),
  unlock: (plan) => rendered(() => runLock('unlock', plan)),
});
