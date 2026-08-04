import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const GATE_BLOCK = [
  'test_files=tests/a.test.ts',
  'impl_files=src/a.ts',
  'max_diff=100',
  'commit_msg=feat(a): do a thing',
  'gate1=grep -q "a = 2" src/a.ts',
];

const slice = (...lines: string[]): readonly string[] => [
  ...GATE_BLOCK.filter((line) => !lines.some((entry) => entry.startsWith(line.split('=')[0] ?? ''))),
  ...lines,
];

type Slice = { readonly ticked: boolean; readonly lines: readonly string[] };

const planWith = (slices: readonly Slice[]): string =>
  slices
    .flatMap(({ ticked, lines }, index) => [
      `### Iteration ${index + 1} — A slice`,
      `- [${ticked ? 'x' : ' '}] Not done yet`,
      '',
      '```gate',
      ...lines,
      '```',
      '',
    ])
    .join('\n');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const fixture = (slices: readonly Slice[]): { repo: string; plan: string } => {
  const repo = tmpDir('goal-gate-events-repo-');
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'gate@example.com');
  git(repo, 'config', 'user.name', 'Gate');
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'tests'));
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'tests', 'a.test.ts'), 'export const t = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'init');

  const plan = join(tmpDir('goal-gate-events-plan-'), 'spec.md');
  writeFileSync(plan, planWith(slices));

  return { repo, plan };
};

const touchDeclared = (repo: string): void => {
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2;\n');
};

const events = (path: string): Array<{ event: string; key?: string; command?: string; duration_ms?: number; exit?: number }> =>
  existsSync(path)
    ? readFileSync(path, 'utf8')
        .trim()
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line))
    : [];

// The stream is the runner's bookkeeping, never the verdict's hostage: a GOAL_RUN_JSONL whose
// directory does not exist (a leaked or stale path) must not crash the gate — the ENOENT that
// killed nested gates inside the suite on 2026-08-04, first run under the instrumented runner.
test('a gate handed an unwritable GOAL_RUN_JSONL still judges instead of crashing', () => {
  const { repo, plan } = fixture([{ ticked: false, lines: GATE_BLOCK }]);
  touchDeclared(repo);

  const run = spawnSync('node', [GATE, 'commit', plan, '1'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GOAL_RUN_JSONL: join('missing-dir', 'nowhere', 'run.jsonl') },
  });

  assert.equal(run.status ?? -1, 0, `${run.stdout}${run.stderr}`);
});

// R — the gate appends one event per executed command to GOAL_RUN_JSONL when the runner names
// one: gate1, each of the DETERMINISM_RUNS, and the bite check.
test('a commit run with GOAL_RUN_JSONL set appends an event for gate1, each determinism run, and the bite check', () => {
  const { repo, plan } = fixture([{ ticked: false, lines: GATE_BLOCK }]);
  touchDeclared(repo);
  const jsonl = join(tmpDir('goal-gate-events-out-'), 'run.jsonl');

  const run = spawnSync('node', [GATE, 'commit', plan, '1'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GOAL_RUN_JSONL: jsonl },
  });

  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);

  const lines = events(jsonl);
  const keys = lines.map((line) => line.key);

  assert.deepEqual(keys, ['gate1', 'determinism2', 'determinism3', 'bite']);

  for (const line of lines) {
    assert.equal(line.event, 'gate-command');
    assert.equal(line.command, 'grep -q "a = 2" src/a.ts');
    assert.equal(typeof line.duration_ms, 'number');
  }

  // gate1, run and replayed twice by the determinism check, passes; the bite check runs it a
  // fourth time with the implementation set aside, where it must fail.
  assert.deepEqual(lines.map((line) => line.exit), [0, 0, 0, 1]);
});

// R — a gate run outside the runner, with GOAL_RUN_JSONL unset, writes nothing: every standalone
// gate use stays exactly as before.
test('a commit run with GOAL_RUN_JSONL unset writes no event file at all', () => {
  const { repo, plan } = fixture([{ ticked: false, lines: GATE_BLOCK }]);
  touchDeclared(repo);
  const jsonl = join(tmpDir('goal-gate-events-out-'), 'run.jsonl');

  const env = { ...process.env };
  delete env.GOAL_RUN_JSONL;

  const run = spawnSync('node', [GATE, 'commit', plan, '1'], { cwd: repo, encoding: 'utf8', env });

  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(existsSync(jsonl), false);
});

// R — each command the regression wall replays for an earlier checked iteration is appended too,
// labelled apart from the slice's own gateN so the two are never confused on the same stream.
test('a replayed wall command is appended as its own event, apart from the slice’s own gateN', () => {
  const { repo, plan } = fixture([
    { ticked: true, lines: slice('gate1=test -f src/legacy.ts') },
    { ticked: false, lines: slice('impl_files=src/a.ts src/legacy.ts') },
  ]);
  writeFileSync(join(repo, 'src', 'legacy.ts'), 'export const legacy = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'add legacy');
  touchDeclared(repo);
  const jsonl = join(tmpDir('goal-gate-events-out-'), 'run.jsonl');

  const run = spawnSync('node', [GATE, 'commit', plan, '2'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GOAL_RUN_JSONL: jsonl },
  });

  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);

  const keys = events(jsonl).map((line) => line.key);

  assert.ok(keys.includes('wall:gate1'), keys.join(' '));
  assert.equal(keys.filter((key) => key === 'gate1').length, 1);
});
