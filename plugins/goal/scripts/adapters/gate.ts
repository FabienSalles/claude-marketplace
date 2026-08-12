// The runner's one seam onto a verdict, in two implementations. In-process is the default: it
// calls straight into the same gate/* modules goal-gate.ts itself dispatches to, rereading the
// plan off disk on every call, exactly as a freshly spawned CLI would. Spawn+scrape is what a run
// has always done, kept intact, and used only when `GOAL_GATE` names a command to drive instead.
//
// Both answer the same shape a `spawnSync` call already returns: a status, and stdout/stderr
// captured rather than inherited — a subprocess's are captured the same way, through its own pipe.

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

import type { Result } from '../core/result.ts';
import type { Halt } from '../core/verdict.ts';
import { biteCheck } from '../gate/bite.ts';
import { budgetCheck, removalCheck } from '../gate/bounds.ts';
import { determinismCheck, runGates } from '../gate/commands.ts';
import { regressionWall, resolvabilityCheck } from '../gate/cross-iteration.ts';
import { halt as printHalt, heldLocks, restorers } from '../gate/halt.ts';
import { blockOf, declaredPaths, incidentalPaths, lockedHash, readPlan } from '../gate/plan.ts';
import { commitAndTick, runLock, scopeCheck } from '../gate/scope.ts';
import { dodCheck, secretScan } from '../gate/ship.ts';
import { monotonicityCheck, tickedSet } from '../gate/ticked.ts';
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

// -- spawn+scrape: the channel a run has always driven, unchanged behind GOAL_GATE -------------

const shell = (command: string, env?: Record<string, string>): GateResult => {
  const result = spawnSync(command, { shell: true, encoding: 'utf8', ...(env ? { env: { ...process.env, ...env } } : {}) });

  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
};

// The permanent, additive seam: every caller that already held a raw gate command — a fixture, a
// unit test driving close()/createPublisher()/createLock() directly — keeps working unchanged,
// resolved into the spawn+scrape channel it always meant.
export const gateAdapterOf = (gate: string | GateAdapter): GateAdapter => (typeof gate === 'string' ? spawnGateAdapter(gate) : gate);

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

// Every call the spawned channel would make from a fresh process, replayed inside this long-lived
// one instead: `process.exit` — what halt()/misuse() use as their only exit — is intercepted
// rather than left to take the runner down with it, and stdout/stderr are captured rather than
// printed, the way a subprocess's own pipe already captures them without echoing to this one's.
const EXIT = Symbol('gate-exit');

const captured = (run: () => void): GateResult => {
  let status = 0;
  let stdout = '';
  let stderr = '';

  const realExit = process.exit;
  const realOut = process.stdout.write.bind(process.stdout);
  const realErr = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: string) => {
    stdout += chunk;

    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => {
    stderr += chunk;

    return true;
  }) as typeof process.stderr.write;
  process.exit = ((code?: number) => {
    status = code ?? 0;
    throw { [EXIT]: true };
  }) as typeof process.exit;

  try {
    run();
  } catch (error) {
    if (typeof error !== 'object' || error === null || !(EXIT in error)) {
      throw error;
    }
  } finally {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
    process.exit = realExit;

    // A spawned process starts every call with neither of these held. Draining them here, on
    // every call, keeps a tick lock or a bite backup scoped to the single verdict that took it,
    // the way the process exit that would otherwise release them scopes it in the spawned channel.
    restorers.splice(0).forEach((restore) => restore());
    heldLocks.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true }));
  }

  return { status, stdout, stderr };
};

const unwrap = <T>(result: Result<T, Halt>): T => (result.ok ? result.value : printHalt(result.error.reason, result.error.detail));

// Mirrors goal-gate.ts's own `verify()` exactly: the order there is the contract, and this reads
// it rather than a second copy that only happens to agree with it today.
const verify = (source: string, iteration: string, declared: Map<string, string>) => {
  const paths = declaredPaths(declared);
  const incidental = incidentalPaths(source);
  const changed = unwrap(scopeCheck(paths, iteration, incidental));

  unwrap(budgetCheck(declared, paths, iteration));
  unwrap(removalCheck(source, paths, iteration));
  unwrap(resolvabilityCheck(source, iteration));

  const passed = unwrap(runGates(declared, iteration));

  unwrap(determinismCheck(declared, iteration));
  unwrap(regressionWall(source, iteration, declared));
  biteCheck(declared, iteration, changed);

  return { paths, incidental, changed, passed };
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
  check: (plan, iteration) =>
    captured(() => {
      const source = readPlan(plan);
      const hash = lockedHash(plan, source, `iteration ${iteration}`, undefined);
      const declared = blockOf(source, iteration);
      const commands = [...declared.keys()].filter((key) => key.startsWith('gate')).length;

      process.stdout.write(
        `OK: iteration ${iteration} is runnable (${commands} acceptance command(s)).\nplan_hash=${hash}\nticked=${tickedSet(source)}\n`,
      );
    }),

  commit: (plan, iteration, hash, ticked, jsonl) =>
    withEnv('GOAL_RUN_JSONL', jsonl, () =>
      captured(() => {
        const source = readPlan(plan);
        lockedHash(plan, source, `iteration ${iteration}`, hash);
        const declared = blockOf(source, iteration);
        const { paths, incidental, changed } = verify(source, iteration, declared);

        unwrap(monotonicityCheck(source, iteration, ticked));
        commitAndTick(plan, source, iteration, declared, paths, changed, incidental);
      }),
    ),

  dod: (plan, hash) =>
    captured(() => {
      const source = readPlan(plan);
      lockedHash(plan, source, 'the Definition of Done replay', hash);
      dodCheck(source);
    }),

  scan: () => captured(() => secretScan()),

  lock: (plan) => captured(() => runLock('lock', plan)),
  unlock: (plan) => captured(() => runLock('unlock', plan)),
});
