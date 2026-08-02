import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const SLICE = [
  'test_files=tests/a.test.ts',
  'impl_files=src/a.ts',
  'max_diff=100',
  'commit_msg=feat(a): do a thing',
  'gate1=grep -q "a = 2" src/a.ts',
];

const slice = (...lines: string[]): readonly string[] => [
  ...SLICE.filter((line) => !lines.some((entry) => entry.startsWith(line.split('=')[0] ?? ''))),
  ...lines,
];

type Slice = { readonly ticked: boolean; readonly lines: readonly string[] };

const planWith = (slices: readonly Slice[]): string =>
  [
    'Delivery mode: allow-bc-break',
    '',
    ...slices.flatMap(({ ticked, lines }, index) => [
      `### Iteration ${index + 1} — A slice`,
      `- [${ticked ? 'x' : ' '}] Not done yet`,
      '',
      '```gate',
      ...lines,
      '```',
      '',
    ]),
  ].join('\n');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const fixture = (slices: readonly Slice[]): { repo: string; plan: string } => {
  const repo = tmpDir('goal-gate-cross-');
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'gate@example.com');
  git(repo, 'config', 'user.name', 'Gate');
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'tests'));
  mkdirSync(join(repo, 'deep'));
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'src', 'legacy.ts'), 'export const legacy = 1;\n');
  writeFileSync(join(repo, 'tests', 'a.test.ts'), 'export const t = 1;\n');
  writeFileSync(join(repo, 'deep', 'b.ts'), 'export const b = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'init');

  const plan = join(tmpDir('goal-gate-plan-'), 'spec.md');
  writeFileSync(plan, planWith(slices));

  return { repo, plan };
};

const runGate = (repo: string, ...args: string[]): { code: number; output: string } => {
  const run = spawnSync('node', [GATE, ...args], { cwd: repo, encoding: 'utf8' });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

const touchDeclared = (repo: string): void => {
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2;\n');
};

const tally = (): string => join(tmpDir('goal-gate-runs-'), 'runs');

const counted = (path: string): number =>
  existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter((line) => line !== '').length : 0;

// R13 — a command that passed before this slice and fails now halts this slice
test('a command an earlier checked iteration passed on halts the slice that breaks it', () => {
  const { repo, plan } = fixture([
    { ticked: true, lines: slice('gate1=test -f src/legacy.ts') },
    { ticked: false, lines: slice('impl_files=src/a.ts src/legacy.ts') },
  ]);
  touchDeclared(repo);
  git(repo, 'rm', '-q', 'src/legacy.ts');

  const { code, output } = runGate(repo, 'verify', plan, '2');

  assert.equal(code, 1, output);
  assert.match(output, /iteration 1/);
  assert.match(output, /idempotent/);
});

test('a command declared by two checked iterations is replayed once', () => {
  const runs = tally();
  const { repo, plan } = fixture([
    { ticked: true, lines: slice(`gate1=echo run >> ${runs}`) },
    { ticked: true, lines: slice(`gate1=echo run >> ${runs}`) },
    { ticked: false, lines: SLICE },
  ]);
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '3');

  assert.equal(code, 0, output);
  assert.equal(counted(runs), 1);
});

test('the slice being verified does not replay its own command', () => {
  const runs = tally();
  const command = `echo run >> ${runs}; grep -q "a = 2" src/a.ts`;
  const { repo, plan } = fixture([
    { ticked: true, lines: slice(`gate1=${command}`) },
    { ticked: false, lines: slice(`gate1=${command}`) },
  ]);
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '2');

  assert.equal(code, 0, output);
  assert.equal(counted(runs), 4);
});

test('an earlier iteration nobody has checked yet is not replayed', () => {
  const { repo, plan } = fixture([
    { ticked: false, lines: slice('gate1=false') },
    { ticked: false, lines: SLICE },
  ]);
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '2');

  assert.equal(code, 0, output);
});

// R14 — a path declared by an unchecked iteration that is no longer resolvable halts,
// before the commit
test("a later iteration's declared directory renamed away halts before the commit", () => {
  const { repo, plan } = fixture([
    { ticked: false, lines: slice('impl_files=src/a.ts deep/b.ts moved/b.ts') },
    { ticked: false, lines: slice('impl_files=deep/b.ts') },
  ]);
  touchDeclared(repo);
  git(repo, 'mv', 'deep', 'moved');

  const { code, output } = runGate(repo, 'commit', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /iteration 2: deep\/b\.ts/);
  assert.equal(git(repo, 'log', '-1', '--pretty=%s').stdout.trim(), 'init');
  assert.match(readFileSync(plan, 'utf8'), /^- \[ \]/m);
});

test('a slice whose own deletion empties a declared directory is not judged by it', () => {
  const { repo, plan } = fixture([{ ticked: false, lines: slice('impl_files=src/a.ts deep/b.ts') }]);
  touchDeclared(repo);
  git(repo, 'rm', '-q', 'deep/b.ts');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

for (const [label, declared] of [
  ['a directory this run has not created yet', 'workflows/loop.js'],
  ['a file not written yet inside an existing directory', 'src/later.ts'],
  ['a subtree that exists', 'src/'],
] as const) {
  test(`a later iteration declaring ${label} is resolvable`, () => {
    const { repo, plan } = fixture([
      { ticked: false, lines: SLICE },
      { ticked: false, lines: slice(`impl_files=${declared}`) },
    ]);
    touchDeclared(repo);

    const { code, output } = runGate(repo, 'verify', plan, '1');

    assert.equal(code, 0, output);
  });
}
