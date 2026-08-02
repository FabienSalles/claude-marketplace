import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const VALID_GATE = [
  'test_files=tests/a.test.ts',
  'impl_files=src/a.ts',
  'max_diff=100',
  'commit_msg=feat(a): do a thing',
  'gate1=true',
];

const planWith = (gateLines: string[], ticked = false): string =>
  [
    '## Functional iterations',
    '',
    '### Iteration 1 — A slice',
    `- [${ticked ? 'x' : ' '}] Not done yet`,
    '',
    '```gate',
    ...gateLines,
    '```',
    '',
  ].join('\n');

const writePlan = (content: string): string => {
  const path = join(tmpDir('goal-gate-'), 'spec.md');
  writeFileSync(path, content);

  return path;
};

const runGate = (args: string[], cwd?: string): { code: number; output: string } => {
  const run = spawnSync('node', [GATE, ...args], { encoding: 'utf8', ...(cwd === undefined ? {} : { cwd }) });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

const check = (plan: string, ...rest: string[]) => runGate(['check', plan, '1', ...rest]);

const hashOf = (plan: string): string => {
  const { output } = check(plan);
  const line = output.split('\n').find((l) => l.startsWith('plan_hash='));
  assert.ok(line, `no plan_hash in output:\n${output}`);

  return line.slice('plan_hash='.length);
};

test('a well-formed iteration is runnable and its plan hash is reported', () => {
  const plan = writePlan(planWith(VALID_GATE));

  const { code, output } = check(plan);

  assert.equal(code, 0, output);
  assert.match(output, /^plan_hash=[0-9a-f]{64}$/m);
});

test('an iteration with nothing to test is runnable', () => {
  const plan = writePlan(
    planWith(['test_files=', 'impl_files=docs/a.md', 'commit_msg=docs(a): write', 'gate1=true']),
  );

  const { code, output } = check(plan);

  assert.equal(code, 0, output);
});

// R1 — a gate block declaring a key it may not set is refused
for (const smuggled of ['spec_hash=deadbeef', 'dod1=true', 'ship=false', 'iteration_files=src/a.ts']) {
  const key = smuggled.split('=')[0] ?? '';

  test(`a gate block smuggling ${key} is refused`, () => {
    const plan = writePlan(planWith([...VALID_GATE, smuggled]));

    const { code, output } = check(plan);

    assert.equal(code, 1, output);
    assert.match(output, new RegExp(key));
  });
}

// R2 — an iteration missing gate1, impl_files or commit_msg is refused
for (const missing of ['gate1', 'impl_files', 'commit_msg']) {
  test(`an iteration declaring no ${missing} is refused`, () => {
    const plan = writePlan(planWith(VALID_GATE.filter((line) => !line.startsWith(`${missing}=`))));

    const { code, output } = check(plan);

    assert.equal(code, 1, output);
    assert.match(output, new RegExp(missing));
  });

  test(`an iteration declaring an empty ${missing} is refused`, () => {
    const plan = writePlan(
      planWith(VALID_GATE.map((line) => (line.startsWith(`${missing}=`) ? `${missing}=` : line))),
    );

    const { code, output } = check(plan);

    assert.equal(code, 1, output);
  });
}

test('an iteration whose section holds no gate block is refused, and the global DoD block is not borrowed', () => {
  const plan = writePlan(
    [
      '### Iteration 1 — A slice',
      '- [ ] Not done yet',
      '',
      '## Definition of Done',
      '',
      '```gate',
      'dod1=true',
      '```',
      '',
    ].join('\n'),
  );

  const { code, output } = check(plan);

  assert.equal(code, 1, output);
});

test('an iteration the plan does not contain is refused', () => {
  const plan = writePlan(planWith(VALID_GATE));

  const { code, output } = runGate(['check', plan, '7']);

  assert.equal(code, 1, output);
});

// R3 — the plan's normalized hash is constant for a run; any other edit halts
test('ticking an iteration leaves the plan hash untouched', () => {
  const plan = writePlan(planWith(VALID_GATE));
  const before = hashOf(plan);

  writeFileSync(plan, planWith(VALID_GATE, true));

  assert.equal(hashOf(plan), before);
});

test('a plan matching the hash it was locked with is runnable', () => {
  const plan = writePlan(planWith(VALID_GATE));

  const { code, output } = check(plan, hashOf(plan));

  assert.equal(code, 0, output);
});

test('a plan edited beyond ticking no longer matches the hash it was locked with', () => {
  const plan = writePlan(planWith(VALID_GATE));
  const locked = hashOf(plan);

  writeFileSync(plan, `${planWith(VALID_GATE)}\nrewritten contract\n`);
  const { code, output } = check(plan, locked);

  assert.equal(code, 1, output);
  assert.match(output, new RegExp(locked));
});

test('no argument exits 2 rather than reporting a bad plan', () => {
  const { code } = runGate([]);

  assert.equal(code, 2);
});

test('an unreadable plan exits 2 rather than reporting a bad plan', () => {
  const { code } = runGate(['check', join(tmpdir(), 'goal-gate-absent-plan.md'), '1']);

  assert.equal(code, 2);
});

// R3 — the plan is read by absolute path, so the gate judges the tree it stands in and not
// the one it was launched from. This is what lets a run live in a directory that has no
// `.claude/` of its own.
test('the gate judges the directory it stands in, not the one beside it', () => {
  const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });
  const main = tmpDir('goal-gate-standing-');

  git(main, 'init', '-q');
  git(main, 'config', 'user.email', 'gate@example.com');
  git(main, 'config', 'user.name', 'Gate');
  mkdirSync(join(main, 'src'));
  writeFileSync(join(main, 'src', 'a.ts'), 'export const a = 1;\n');
  git(main, 'add', '-A');
  git(main, 'commit', '-qm', 'init');

  const beside = join(main, 'beside');
  git(main, 'worktree', 'add', '-q', beside, '-b', 'feature/beside');
  writeFileSync(join(beside, 'src', 'a.ts'), 'export const a = 2;\n');

  const plan = writePlan(
    planWith([
      'test_files=',
      'impl_files=src/a.ts',
      'max_diff=100',
      'commit_msg=feat(a): do a thing',
      'gate1=grep -q "a = 2" src/a.ts',
    ]),
  );

  const inside = runGate(['verify', plan, '1'], beside);
  const outside = runGate(['verify', plan, '1'], main);

  assert.equal(inside.code, 0, inside.output);
  assert.equal(outside.code, 1, outside.output);
});
