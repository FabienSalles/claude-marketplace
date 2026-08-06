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

const planWith = (gateLines: string[]): string =>
  [
    '### Iteration 1 — A slice',
    '- [ ] Not done yet',
    '',
    '```gate',
    ...gateLines,
    '```',
    '',
  ].join('\n');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const fixture = (gateLines: string[] = GATE_BLOCK): { repo: string; plan: string } => {
  const repo = tmpDir('goal-gate-repo-');
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'gate@example.com');
  git(repo, 'config', 'user.name', 'Gate');
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'tests'));
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'tests', 'a.test.ts'), 'export const t = 1;\n');
  writeFileSync(join(repo, 'other.ts'), 'export const other = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'init');

  const plan = join(tmpDir('goal-gate-plan-'), 'spec.md');
  writeFileSync(plan, planWith(gateLines));

  return { repo, plan };
};

const runGate = (repo: string, ...args: string[]): { code: number; output: string } => {
  const run = spawnSync('node', [GATE, ...args], { cwd: repo, encoding: 'utf8' });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

const touchDeclared = (repo: string): void => {
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2;\n');
};

// R3b — a gate block declaring the same key twice is refused
test('a gate block declaring the same key twice is refused', () => {
  const { repo, plan } = fixture([...GATE_BLOCK, 'gate1=false']);

  const { code, output } = runGate(repo, 'check', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /gate1/);
});

test('an iteration whose only changes are declared passes verify', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

// R4 — a tracked file changed but not declared halts the iteration
test('a tracked file changed but not declared halts the iteration', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);
  writeFileSync(join(repo, 'other.ts'), 'export const other = 2;\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /other\.ts/);
});

// R5 — an untracked, undeclared file halts the iteration, whatever its porcelain code
for (const [label, intentToAdd] of [
  ['untracked', false],
  ['intent-to-add', true],
] as const) {
  test(`an undeclared ${label} file halts the iteration`, () => {
    const { repo, plan } = fixture();
    touchDeclared(repo);
    writeFileSync(join(repo, 'parasite.log'), 'noise\n');

    if (intentToAdd) {
      git(repo, 'add', '-N', 'parasite.log');
      assert.match(git(repo, 'status', '--porcelain').stdout, /^ A parasite\.log$/m);
    }

    const { code, output } = runGate(repo, 'verify', plan, '1');

    assert.equal(code, 1, output);
    assert.match(output, /parasite\.log/);
  });
}

test('an iteration declaring a gitignored path halts', () => {
  const { repo, plan } = fixture([
    'test_files=',
    'impl_files=build/out.ts',
    'commit_msg=feat(a): build a thing',
    'gate1=true',
  ]);
  writeFileSync(join(repo, '.gitignore'), 'build/\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'ignore build');
  mkdirSync(join(repo, 'build'));
  writeFileSync(join(repo, 'build', 'out.ts'), 'export const out = 1;\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /build\/out\.ts/);
});

// R4 — git reports a non-ASCII path octal-escaped and quoted (`"src/caf\303\251.ts"`), which read
// literally is a path the plan never declared and an iteration that can never pass.
test('a declared non-ASCII path is not read as a scope leak', () => {
  const { repo, plan } = fixture([
    'test_files=',
    'impl_files=src/café.ts',
    'commit_msg=feat(a): add a café',
    'gate1=true',
  ]);
  writeFileSync(join(repo, 'src', 'café.ts'), 'export const cafe = 1;\n');
  git(repo, 'add', '-N', 'src/café.ts');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

// R4 — a rename is two paths, and the one it left behind is a change too: the NUL-separated
// status writes it as a record of its own, right after the path it moved to.
test('the path a rename left behind is a change the iteration has to declare', () => {
  const { repo, plan } = fixture([
    'test_files=',
    'impl_files=src/b.ts',
    'commit_msg=feat(a): move a to b',
    'gate1=true',
  ]);
  git(repo, 'mv', 'src/a.ts', 'src/b.ts');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /Scope leak/);
  assert.match(output, /src\/a\.ts/);
});

// R6 — at most one writer to the plan file at any instant
test('a run lock is exclusive, and unlock hands it back', () => {
  const { repo, plan } = fixture();

  assert.equal(runGate(repo, 'lock', plan).code, 0);
  assert.equal(runGate(repo, 'lock', plan).code, 1);
  assert.equal(runGate(repo, 'unlock', plan).code, 0);
  assert.equal(runGate(repo, 'lock', plan).code, 0);
});

test('a commit is refused while another writer holds the tick lock', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);
  mkdirSync(`${plan}.tick.lock`);

  const { code, output } = runGate(repo, 'commit', plan, '1');

  assert.equal(code, 1, output);
  assert.equal(git(repo, 'log', '-1', '--pretty=%s').stdout.trim(), 'init');
});

// R7 — commit and tick happen only after every check passed, in that order
test('a failing acceptance command leaves no commit and no tick', () => {
  const { repo, plan } = fixture([
    ...GATE_BLOCK.filter((line) => !line.startsWith('gate1=')),
    'gate1=false',
  ]);
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'commit', plan, '1');

  assert.equal(code, 1, output);
  assert.equal(git(repo, 'log', '-1', '--pretty=%s').stdout.trim(), 'init');
  assert.match(readFileSync(plan, 'utf8'), /^- \[ \]/m);
});

test('a scope leak leaves no commit and no tick', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);
  writeFileSync(join(repo, 'other.ts'), 'export const other = 2;\n');

  const { code } = runGate(repo, 'commit', plan, '1');

  assert.equal(code, 1);
  assert.equal(git(repo, 'log', '-1', '--pretty=%s').stdout.trim(), 'init');
  assert.match(readFileSync(plan, 'utf8'), /^- \[ \]/m);
});

test('a passing iteration is committed under its message, then ticked', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'commit', plan, '1');

  assert.equal(code, 0, output);
  assert.equal(git(repo, 'log', '-1', '--pretty=%s').stdout.trim(), 'feat(a): do a thing');
  assert.deepEqual(
    git(repo, 'show', '--name-only', '--pretty=', 'HEAD').stdout.trim().split('\n'),
    ['src/a.ts'],
  );
  assert.match(readFileSync(plan, 'utf8'), /^- \[x\]/m);
  assert.equal(existsSync(`${plan}.tick.lock`), false);
  assert.equal(git(repo, 'status', '--porcelain').stdout, '');
});

test('an already ticked iteration is not committed twice', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);
  writeFileSync(plan, readFileSync(plan, 'utf8').replace('- [ ]', '- [x]'));

  const { code, output } = runGate(repo, 'commit', plan, '1');

  assert.equal(code, 1, output);
  assert.equal(git(repo, 'log', '-1', '--pretty=%s').stdout.trim(), 'init');
});
