import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
  const repo = tmpDir('goal-gate-bite-');
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

const backups = (repo: string): string[] =>
  readdirSync(join(repo, '.git')).filter((entry) => entry.startsWith('goal-bite-'));

// R8 — tests that pass without this iteration's implementation halt it
test('an acceptance command that passes without the implementation halts the iteration', () => {
  const { repo, plan } = fixture(withGate1('true'));
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.match(output, /without/);
});

test('an acceptance command that fails without the implementation passes the gate', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

test('a supporting command green without the implementation does not halt the iteration', () => {
  const { repo, plan } = fixture([...GATE_BLOCK, 'gate2=true']);
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

test('an implementation that is a whole new file is set aside as well', () => {
  const { repo, plan } = fixture([
    'test_files=tests/a.test.ts',
    'impl_files=src/b.ts',
    'commit_msg=feat(b): add b',
    'gate1=test -f src/b.ts',
  ]);
  writeFileSync(join(repo, 'src', 'b.ts'), 'export const b = 1;\n');
  git(repo, 'add', '-N', 'src/b.ts');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
  assert.equal(readFileSync(join(repo, 'src', 'b.ts'), 'utf8'), 'export const b = 1;\n');
  assert.equal(git(repo, 'status', '--porcelain', '-uall').stdout, ' A src/b.ts\n');
});

// `git stash create` refuses an index holding an intent-to-add entry, and the git-add-empty
// hook puts one there for every file the executor creates.
test('a tracked implementation is restored even beside an intent-to-add file', () => {
  const { repo, plan } = fixture([
    'test_files=tests/a.test.ts tests/b.test.ts',
    'impl_files=src/a.ts',
    'commit_msg=feat(a): do a thing',
    `gate1=${BITING}`,
  ]);
  touchDeclared(repo);
  writeFileSync(join(repo, 'tests', 'b.test.ts'), 'export const b = 1;\n');
  git(repo, 'add', '-N', 'tests/b.test.ts');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
  assert.equal(readFileSync(join(repo, 'src', 'a.ts'), 'utf8'), 'export const a = 2;\n');
});

test('an iteration declaring no test_files is not bitten, and the skip is said out loud', () => {
  const { repo, plan } = fixture([
    'test_files=',
    'impl_files=src/a.ts',
    'commit_msg=feat(a): do a thing',
    'gate1=true',
  ]);
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
  assert.match(output, /SKIP/);
});

// R9 — no harness-created backup survives a gate invocation, on any exit path
for (const [label, command, expected] of [
  ['halting', 'true', 1],
  ['passing', BITING, 0],
] as const) {
  test(`a ${label} bite check leaves no backup behind and puts the tree back`, () => {
    const { repo, plan } = fixture(withGate1(command));
    touchDeclared(repo);
    const status = git(repo, 'status', '--porcelain', '-uall').stdout;

    const { code, output } = runGate(repo, 'verify', plan, '1');

    assert.equal(code, expected, output);
    assert.deepEqual(backups(repo), []);
    assert.equal(git(repo, 'status', '--porcelain', '-uall').stdout, status);
    assert.equal(readFileSync(join(repo, 'src', 'a.ts'), 'utf8'), 'export const a = 2;\n');
  });
}

// R9 — the window is the one moment the implementation exists nowhere but the backup directory,
// so where that directory is has to be on stdout before the acceptance command is spawned.
test('the bite check says where the implementation is set aside before running the command', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'bite', plan, '1');

  assert.equal(code, 0, output);
  assert.match(output, /BACKUP: .*goal-bite-/, output);
});

// R9 — node fires no 'exit' on a default-disposition INT or TERM, so a signal during the window
// used to leave the tree holding HEAD's blob and the work in a directory nothing ever named.
test('a bite check signalled mid-window still puts the implementation back', () => {
  const { repo, plan } = fixture(withGate1('sleep 4'));
  touchDeclared(repo);

  spawnSync(
    'bash',
    ['-c', `node "${GATE}" bite "${plan}" 1 & pid=$!; sleep 1.5; kill -TERM $pid; wait $pid`],
    { cwd: repo, encoding: 'utf8' },
  );

  assert.equal(readFileSync(join(repo, 'src', 'a.ts'), 'utf8'), 'export const a = 2;\n');
  assert.deepEqual(backups(repo), []);
});

test('an implementation rewritten during the window is restored by overwrite, not merged', () => {
  const { repo, plan } = fixture(withGate1(`${BITING} || echo broken > src/a.ts`));
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1, output);
  assert.equal(readFileSync(join(repo, 'src', 'a.ts'), 'utf8'), 'export const a = 2;\n');
});
