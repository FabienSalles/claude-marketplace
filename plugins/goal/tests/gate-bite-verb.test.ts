import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const BITING = 'grep -q "a = 2" src/a.ts';

const GATE_BLOCK = [
  'test_files=tests/a.test.ts',
  'impl_files=src/a.ts',
  'commit_msg=feat(a): do a thing',
  `gate1=${BITING}`,
];

const withGate1 = (command: string): string[] => [
  ...GATE_BLOCK.filter((line) => !line.startsWith('gate1=')),
  `gate1=${command}`,
];

const planWith = (gateLines: string[]): string =>
  ['### Iteration 1 — A slice', '- [ ] Not done yet', '', '```gate', ...gateLines, '```', ''].join('\n');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const fixture = (gateLines: string[] = GATE_BLOCK): { repo: string; plan: string } => {
  const repo = tmpDir('goal-gate-bite-verb-');
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

const touchDeclared = (repo: string): void => {
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2;\n');
};

// The sanctioned RED check: an implementer runs it directly, without going through `verify`'s
// whole pipeline, to prove gate1 fails with the implementation set aside.
test('bite reports OK and exits 0 when gate1 fails without the implementation', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'bite', plan, '1');

  assert.equal(code, 0, output);
  assert.match(output, /fails without/);
});

test('bite halts when gate1 passes without the implementation', () => {
  const { repo, plan } = fixture(withGate1('true'));
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'bite', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /without/);
});

test('bite restores the implementation by overwrite once it is done', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);

  const { code } = runGate(repo, 'bite', plan, '1');

  assert.equal(code, 0);
  assert.equal(readFileSync(join(repo, 'src', 'a.ts'), 'utf8'), 'export const a = 2;\n');
  assert.equal(git(repo, 'status', '--porcelain', '-uall').stdout, ' M src/a.ts\n');
});

test('bite does not commit or tick the box it just checked', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);

  runGate(repo, 'bite', plan, '1');

  assert.match(readFileSync(plan, 'utf8'), /- \[ \] Not done yet/);
  assert.equal(git(repo, 'log', '--oneline').stdout.trim().split('\n').length, 1);
});
