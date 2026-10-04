import type { Check, Execute, Outcome, Probe, Write } from './ports.ts';

export const selectChecks = (checks: readonly Check[], groups: readonly string[]): readonly Check[] => {
  const known = new Set(checks.map((check) => check.group));
  const unknown = groups.filter((group) => !known.has(group));

  if (unknown.length > 0) {
    throw new Error(`unknown group: ${unknown.join(', ')}`);
  }

  return groups.length === 0 ? checks : checks.filter((check) => groups.includes(check.group));
};

const LABEL = { passed: 'passed', failed: 'failed', 'not-reproduced': 'not reproduced' } as const;

const line = (check: Check, outcome: Outcome): string =>
  `${LABEL[outcome.status]}  ${check.name}${outcome.status === 'not-reproduced' ? ` (${outcome.detail})` : ''}`;

export type Verification = {
  readonly prepare: Check;
  readonly checks: readonly Check[];
  readonly groups: readonly string[];
  readonly execute: Execute;
  readonly write: Write;
  readonly probe?: Probe;
  readonly gaps?: readonly string[];
  readonly uncommitted?: readonly string[];
};

export const runVerify = ({ prepare, checks, groups, execute, write, probe = () => undefined, gaps = [], uncommitted = [] }: Verification): number => {
  let selected: readonly Check[];

  try {
    selected = selectChecks(checks, groups);
  } catch (error) {
    write(`${error instanceof Error ? error.message : String(error)}\n`);

    return 2;
  }

  const results = [prepare, ...selected].map((check) => {
    const missing = check.requirements.flatMap((requirement) => probe(requirement) ?? []);
    const outcome: Outcome =
      missing.length > 0 ? { status: 'failed', detail: `missing: ${missing.join(', ')}` } : execute(check);

    if (outcome.status === 'failed' && outcome.detail !== '') {
      write(`--- ${check.name}\n${outcome.detail.trimEnd()}\n`);
    }

    return { check, outcome };
  });

  const failed = results.filter(({ outcome }) => outcome.status === 'failed').length;

  write('\n');

  for (const { check, outcome } of results) {
    write(`${line(check, outcome)}\n`);
  }

  for (const path of uncommitted) {
    write(`uncommitted work judged as it is: ${path}\n`);
  }

  write(failed === 0 ? 'green: every check passed or was not reproduced\n' : `red: ${failed} check(s) failed\n`);

  for (const gap of gaps) {
    write(`not reproduced on this Mac: ${gap}\n`);
  }

  return failed === 0 ? 0 : 1;
};
