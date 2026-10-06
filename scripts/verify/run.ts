import { constants } from 'node:os';

import { OPT_IN } from './groups.ts';
import type { Check, Execute, Outcome, Probe, Requirement, Write } from './ports.ts';

export const selectChecks = (checks: readonly Check[], groups: readonly string[]): readonly Check[] => {
  const known = new Set(checks.map((check) => check.group));
  const unknown = groups.filter((group) => !known.has(group));

  if (unknown.length > 0) {
    throw new Error(`unknown group: ${unknown.join(', ')}`);
  }

  return groups.length === 0
    ? checks.filter((check) => !OPT_IN.includes(check.group))
    : checks.filter((check) => groups.includes(check.group));
};

const SEQUENTIAL = '--sequential';

type Mode = { readonly groups: readonly string[]; readonly concurrency: number };

export const modeOf = (argv: readonly string[], cores: number): Mode => ({
  groups: argv.filter((arg) => arg !== SEQUENTIAL),
  concurrency: argv.includes(SEQUENTIAL) ? 1 : Math.max(1, Math.ceil(cores / 2)),
});

export const interruptible = (): AbortSignal => {
  const controller = new AbortController();

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => controller.abort(signal));
  }

  return controller.signal;
};

const LABEL = { passed: 'passed', failed: 'failed', 'not-reproduced': 'not reproduced' } as const;

type Result = { readonly check: Check; readonly outcome: Outcome; readonly seconds: number };

const line = ({ check, outcome, seconds }: Result): string =>
  `${LABEL[outcome.status]}  ${check.name}${outcome.status === 'not-reproduced' ? ` (${outcome.detail})` : ''}  (${seconds.toFixed(1)} s)`;

export type Verification = {
  readonly prepare: Check;
  readonly checks: readonly Check[];
  readonly groups: readonly string[];
  readonly concurrency: number;
  readonly execute: Execute;
  readonly write: Write;
  readonly abort?: AbortSignal;
  readonly clock?: () => number;
  readonly probe?: Probe;
  readonly gaps?: readonly string[];
  readonly uncommitted?: readonly string[];
  readonly notes?: readonly string[];
};

export const runVerify = async ({
  prepare,
  checks,
  groups,
  concurrency,
  execute,
  write,
  abort = new AbortController().signal,
  clock = () => performance.now(),
  probe = () => undefined,
  gaps = [],
  uncommitted = [],
  notes = [],
}: Verification): Promise<number> => {
  let selected: readonly Check[];

  try {
    selected = selectChecks(checks, groups);
  } catch (error) {
    write(`${error instanceof Error ? error.message : String(error)}\n`);

    return 2;
  }

  const probed = new Map<Requirement, string | undefined>();
  const missing = (requirement: Requirement): string | undefined => {
    if (!probed.has(requirement)) {
      probed.set(requirement, probe(requirement));
    }

    return probed.get(requirement);
  };
  const results = new Map<Check, Result>();

  const measure = async (check: Check): Promise<void> => {
    // Without this yield, a synchronous inline check's duration would include the start of every other check.
    await new Promise((resume) => setImmediate(resume));

    const absent = check.requirements.flatMap((requirement) => missing(requirement) ?? []);
    const start = clock();
    const executed = async (): Promise<Outcome> => {
      try {
        return await execute(check, abort);
      } catch (error) {
        return { status: 'failed', detail: `threw: ${error instanceof Error ? error.message : String(error)}` };
      }
    };
    const outcome: Outcome = absent.length > 0 ? { status: 'failed', detail: `missing: ${absent.join(', ')}` } : await executed();

    results.set(check, { check, outcome, seconds: (clock() - start) / 1000 });

    if (outcome.status === 'failed' && outcome.detail !== '') {
      write(`--- ${check.name}\n${outcome.detail.trimEnd()}\n`);
    }
  };

  const pool = async (batch: readonly Check[], width: number): Promise<void> => {
    let next = 0;
    const worker = async (): Promise<void> => {
      for (let check = batch[next]; check !== undefined && !abort.aborted; check = batch[next]) {
        next += 1;
        await measure(check);
      }
    };

    await Promise.all(Array.from({ length: Math.min(width, batch.length) }, worker));
  };

  await pool([prepare], 1);

  const prepared = results.get(prepare)?.outcome.status !== 'failed';

  if (prepared) {
    await pool(selected.filter((check) => check.exclusive !== true), concurrency);
    await pool(selected.filter((check) => check.exclusive === true), 1);
  }

  const ran = [prepare, ...selected].flatMap((check) => results.get(check) ?? []);
  const failed = ran.filter(({ outcome }) => outcome.status === 'failed').length;

  write('\n');

  for (const result of ran) {
    write(`${line(result)}\n`);
  }

  for (const path of uncommitted) {
    write(`uncommitted work judged as it is: ${path}\n`);
  }

  for (const note of notes) {
    write(`${note}\n`);
  }

  if (abort.aborted) {
    const signal: NodeJS.Signals = typeof abort.reason === 'string' ? (abort.reason as NodeJS.Signals) : 'SIGTERM';

    write(`interrupted by ${signal}: ${selected.length + 1 - ran.length} check(s) not run, no verdict\n`);

    return 128 + constants.signals[signal];
  }

  if (prepared) {
    write(failed === 0 ? 'green: every check passed or was not reproduced\n' : `red: ${failed} check(s) failed\n`);
  } else {
    write(`red: ${prepare.name} failed: ${selected.length} check(s) not run\n`);
  }

  for (const gap of gaps) {
    write(`not reproduced on this Mac: ${gap}\n`);
  }

  return failed === 0 ? 0 : 1;
};
