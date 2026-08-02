import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const ALLOW = ['Delivery mode: allow-bc-break'];
const REFUSE = ['Delivery mode: no-bc-break'];

const GATE_BLOCK = [
  'test_files=tests/a.test.ts',
  'impl_files=src/a.ts',
  'max_diff=100',
  'commit_msg=feat(a): do a thing',
  'gate1=grep -q "a = 2" src/a.ts',
];

const withKey = (key: string, value: string): string[] => [
  ...GATE_BLOCK.filter((line) => !line.startsWith(`${key}=`)),
  `${key}=${value}`,
];

const planWith = (gateLines: string[], header: readonly string[]): string =>
  [
    ...header,
    '',
    '### Iteration 1 — A slice',
    '- [ ] Not done yet',
    '',
    '```gate',
    ...gateLines,
    '```',
    '',
  ].join('\n');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const fixture = (
  gateLines: string[] = GATE_BLOCK,
  header: readonly string[] = ALLOW,
): { repo: string; plan: string } => {
  const repo = tmpDir('goal-gate-bounds-');
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'gate@example.com');
  git(repo, 'config', 'user.name', 'Gate');
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'tests'));
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'tests', 'a.test.ts'), 'export const t = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'init');

  const plan = join(tmpDir('goal-gate-plan-'), 'spec.md');
  writeFileSync(plan, planWith(gateLines, header));

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

// R10 — a slice exceeding its declared diff budget halts
test('a slice whose diff exceeds its declared budget halts', () => {
  const { repo, plan } = fixture(withKey('max_diff', '1'));
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /budget/);
});

test('a slice inside its declared budget passes', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

// `git diff --numstat` with no revision misses a staged deletion entirely, so the budget
// is measured against HEAD.
test('a staged deletion counts against the budget', () => {
  const { repo, plan } = fixture([
    'test_files=',
    'impl_files=src/a.ts',
    'max_diff=0',
    'commit_msg=feat(a): drop a',
    'gate1=true',
  ]);
  git(repo, 'rm', '-q', 'src/a.ts');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /budget/);
});

test('a budget that is not a number is refused', () => {
  const { repo, plan } = fixture(withKey('max_diff', 'about four hundred'));
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /max_diff/);
});

test('a slice declaring no budget is not bounded', () => {
  const { repo, plan } = fixture(GATE_BLOCK.filter((line) => !line.startsWith('max_diff=')));
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

// R11 — under no-bc-break, deleting or renaming a pre-existing file halts
for (const [label, header] of [
  ['declares no-bc-break', REFUSE],
  ['declares no delivery mode at all', []],
] as const) {
  test(`a staged deletion halts on a plan that ${label}`, () => {
    const { repo, plan } = fixture(
      ['test_files=', 'impl_files=src/a.ts', 'max_diff=100', 'commit_msg=feat(a): drop a', 'gate1=true'],
      header,
    );
    git(repo, 'rm', '-q', 'src/a.ts');

    const { code, output } = runGate(repo, 'verify', plan, '1');

    assert.equal(code, 1, output);
    assert.match(output, /src\/a\.ts/);
  });
}

test('a rename halts under no-bc-break', () => {
  const { repo, plan } = fixture(
    [
      'test_files=',
      'impl_files=src/a.ts src/b.ts',
      'max_diff=100',
      'commit_msg=feat(a): rename a',
      'gate1=true',
    ],
    REFUSE,
  );
  git(repo, 'mv', 'src/a.ts', 'src/b.ts');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /src\/b\.ts/);
});

test('the same deletion passes under allow-bc-break', () => {
  const { repo, plan } = fixture([
    'test_files=',
    'impl_files=src/a.ts',
    'max_diff=100',
    'commit_msg=feat(a): drop a',
    'gate1=true',
  ]);
  git(repo, 'rm', '-q', 'src/a.ts');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

// R12 — a slice test that does not pass N times in a row halts
test('the acceptance command runs three times on a green slice', () => {
  const runs = tally();
  const { repo, plan } = fixture([
    'test_files=',
    'impl_files=src/a.ts',
    'max_diff=100',
    'commit_msg=feat(a): do a thing',
    `gate1=echo run >> ${runs}`,
  ]);
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
  assert.equal(counted(runs), 3);
});

test('a command that fails on its second run halts, naming the run', () => {
  const runs = tally();
  const { repo, plan } = fixture(
    withKey('gate1', `echo run >> ${runs}; [ "$(wc -l < ${runs})" -ne 2 ]`),
  );
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /Run 2 of 3/);
});

test('the bite window spawns the acceptance command once beyond the three runs', () => {
  const runs = tally();
  const { repo, plan } = fixture(withKey('gate1', `echo run >> ${runs}; grep -q "a = 2" src/a.ts`));
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
  assert.equal(counted(runs), 4);
});
