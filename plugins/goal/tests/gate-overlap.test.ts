import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const planWith = (gateLines: string[]): string =>
  ['### Iteration 1 — A slice', '- [ ] Not done yet', '', '```gate', ...gateLines, '```', ''].join('\n');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const fixture = (gateLines: string[]): { repo: string; plan: string } => {
  const repo = tmpDir('goal-gate-overlap-');
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
  writeFileSync(plan, planWith(gateLines));

  return { repo, plan };
};

const runGate = (repo: string, ...args: string[]): { code: number; output: string } => {
  const run = spawnSync('node', [GATE, ...args], { cwd: repo, encoding: 'utf8' });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

const OVERLAPPING = [
  'test_files=tests/a.test.ts',
  'impl_files=tests/a.test.ts',
  'commit_msg=feat(a): do a thing',
  'gate1=true',
];

for (const verb of ['check', 'verify', 'commit', 'bite']) {
  test(`${verb} halts an iteration whose impl_files covers its test_files`, () => {
    const { repo, plan } = fixture(OVERLAPPING);

    const { code, output } = runGate(repo, verb, plan, '1');

    assert.equal(code, 1, output);
    assert.match(output, /HALT/);
    assert.match(output, /covers its own test_files/);
  });
}

test('the halt names the overlapping pair and the fix, excluding the tests', () => {
  const { repo, plan } = fixture([
    'test_files=tests/a.test.ts',
    'impl_files=src/a.ts tests/a.test.ts',
    'commit_msg=feat(a): do a thing',
    'gate1=true',
  ]);

  const { code, output } = runGate(repo, 'check', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /tests\/a\.test\.ts covers tests\/a\.test\.ts/);
  assert.match(output, /Declare impl_files as: src\/a\.ts/);
  assert.doesNotMatch(output.split('Declare impl_files as:')[1] ?? '', /tests\/a\.test\.ts/);
});

test('a trailing-slash impl_files subtree covering a test_files path is refused too', () => {
  const { repo, plan } = fixture([
    'test_files=tests/a.test.ts',
    'impl_files=tests/',
    'commit_msg=feat(a): do a thing',
    'gate1=true',
  ]);

  const { code, output } = runGate(repo, 'check', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /tests\/ covers tests\/a\.test\.ts/);
});

test('an iteration with empty test_files is exempt from the overlap check', () => {
  const { repo, plan } = fixture([
    'test_files=',
    'impl_files=src/a.ts',
    'commit_msg=feat(a): do a thing',
    'gate1=true',
  ]);

  const { code, output } = runGate(repo, 'check', plan, '1');

  assert.equal(code, 0, output);
});

test('non-overlapping impl_files and test_files pass the check verb', () => {
  const { repo, plan } = fixture([
    'test_files=tests/a.test.ts',
    'impl_files=src/a.ts',
    'commit_msg=feat(a): do a thing',
    'gate1=true',
  ]);

  const { code, output } = runGate(repo, 'check', plan, '1');

  assert.equal(code, 0, output);
});
