import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import { declaredTests } from './frozen.ts';

export type Timed = { readonly name: string; readonly seconds: number };

const RESULT_LINE = /^[✔✖﹣] (.*) \((\d+(?:\.\d+)?)(ms|s)\)(?: # .*)?$/;

export const parseTests = (output: string): readonly Timed[] =>
  output.split('\n').flatMap((line) => {
    const match = RESULT_LINE.exec(line);

    if (match === null) {
      return [];
    }

    const value = Number(match[2]);

    return [{ name: match[1] ?? '', seconds: match[3] === 'ms' ? value / 1000 : value }];
  });

export const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

export const medianByName = (runs: readonly (readonly Timed[])[]): readonly Timed[] => {
  const byName = new Map<string, number[][]>();

  for (const [index, run] of runs.entries()) {
    const perRun = new Map<string, number>();

    for (const { name, seconds } of run) {
      perRun.set(name, (perRun.get(name) ?? 0) + seconds);
    }

    for (const [name, seconds] of perRun) {
      const rows = byName.get(name) ?? runs.map(() => []);

      rows[index]?.push(seconds);
      byName.set(name, rows);
    }
  }

  return [...byName].map(([name, rows]) => ({
    name,
    seconds: median(rows.flatMap((row) => row)),
  }));
};

const declaredPattern = (name: string): RegExp =>
  new RegExp(
    `^${name
      .split(/\$\{[^}]*\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
  );

export const perFile = (
  tests: readonly Timed[],
  declared: readonly { readonly file: string; readonly name: string }[],
): readonly Timed[] => {
  const patterns = declared.map(({ file, name }) => ({ file, pattern: declaredPattern(name) }));
  const totals = new Map<string, number>();

  for (const { name, seconds } of tests) {
    const file = patterns.find(({ pattern }) => pattern.test(name))?.file ?? '(undeclared)';

    totals.set(file, (totals.get(file) ?? 0) + seconds);
  }

  return [...totals].map(([name, seconds]) => ({ name, seconds }));
};

export type Ceilings = {
  readonly wall?: number;
  readonly file?: number;
  readonly test?: number;
};

const over = (kind: string, timed: readonly Timed[], ceiling: number | undefined): readonly string[] =>
  ceiling === undefined
    ? []
    : timed
        .filter(({ seconds }) => seconds > ceiling)
        .sort((a, b) => b.seconds - a.seconds)
        .map(({ name, seconds }) => `${kind} over ${ceiling}s: ${name} took ${seconds.toFixed(2)}s`);

export const offenders = (
  wall: number,
  files: readonly Timed[],
  tests: readonly Timed[],
  ceilings: Ceilings,
): readonly string[] => [
  ...over('wall', [{ name: 'the suite', seconds: wall }], ceilings.wall),
  ...over('file', files, ceilings.file),
  ...over('test', tests, ceilings.test),
];

const RUN_SH = resolve(import.meta.dirname, '..', 'run.sh');

type Sample = { readonly wall: number; readonly output: string; readonly green: boolean };

const sample = (env: NodeJS.ProcessEnv): Sample => {
  const start = performance.now();
  const result = spawnSync('bash', [RUN_SH], { encoding: 'utf8', env, maxBuffer: 1 << 28 });

  return {
    wall: (performance.now() - start) / 1000,
    output: `${result.stdout}${result.stderr}`,
    green: result.status === 0,
  };
};

const seconds = (value: string | undefined, flag: string): number => {
  const parsed = Number(value);

  if (value === undefined || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} needs a positive number of seconds`);
  }

  return parsed;
};

const main = (argv: readonly string[]): number => {
  const options = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 2) {
    options.set(argv[index] ?? '', argv[index + 1] ?? '');
  }

  const unknown = [...options.keys()].filter(
    (flag) => !['--runs', '--wall', '--file', '--test', '--only'].includes(flag),
  );

  if (unknown.length > 0) {
    process.stderr.write(`unknown option ${unknown.join(', ')}; usage: budget.ts [--runs N] [--wall S] [--file S] [--test S] [--only <file>]\n`);

    return 2;
  }

  const runs = options.has('--runs') ? seconds(options.get('--runs'), '--runs') : 3;
  const ceilings: Ceilings = {
    ...(options.has('--wall') && { wall: seconds(options.get('--wall'), '--wall') }),
    ...(options.has('--file') && { file: seconds(options.get('--file'), '--file') }),
    ...(options.has('--test') && { test: seconds(options.get('--test'), '--test') }),
  };
  const testsDir = resolve(import.meta.dirname, '..');
  const only = options.get('--only');
  const env: NodeJS.ProcessEnv = { ...process.env };
  const scratch = only === undefined ? undefined : mkdtempSync(join(tmpdir(), 'budget-only-'));

  if (scratch !== undefined && only !== undefined) {
    symlinkSync(resolve(testsDir, basename(only)), join(scratch, basename(only)));
    env['GOAL_TESTS_ROOT'] = scratch;
  }

  try {
    const samples = Array.from({ length: runs }, () => sample(env));
    const red = samples.findIndex(({ green }) => !green);

    if (red !== -1) {
      process.stderr.write(`${samples[red]?.output ?? ''}\nHALT: run ${red + 1} of ${runs} was not green, so its timings mean nothing.\n`);

      return 1;
    }

    const declared = declaredTests(testsDir);
    const tests = medianByName(samples.map(({ output }) => parseTests(output)));
    const files = perFile(tests, declared);
    const wall = median(samples.map((entry) => entry.wall));
    const slowestFile = [...files].sort((a, b) => b.seconds - a.seconds)[0];
    const slowestTest = [...tests].sort((a, b) => b.seconds - a.seconds)[0];

    process.stdout.write(`wall (median of ${runs}): ${wall.toFixed(2)}s\n`);
    process.stdout.write(`slowest file: ${slowestFile?.name ?? 'none'} ${(slowestFile?.seconds ?? 0).toFixed(2)}s\n`);
    process.stdout.write(`slowest test: ${slowestTest?.name ?? 'none'} ${(slowestTest?.seconds ?? 0).toFixed(2)}s\n`);

    const failures = offenders(wall, files, tests, ceilings);

    if (failures.length > 0) {
      process.stderr.write(`${failures.join('\n')}\nHALT: ${failures.length} budget ceiling(s) exceeded.\n`);

      return 1;
    }

    return 0;
  } finally {
    if (scratch !== undefined) {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
};

if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }
}
