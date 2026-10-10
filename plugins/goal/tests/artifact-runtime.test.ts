import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { git, repo, run, RUN_NODE } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';

test('an absent root writes new records under .goal/runs without moving an explicit old plan', () => {
  const fixture = repo();
  const original = readFileSync(fixture.plan, 'utf8');
  mkdirSync(join(fixture.dir, '.goal', 'plans'), { recursive: true });
  writeFileSync(join(fixture.dir, '.goal', 'plans', 'demo-spec.md'), '# Spec: decoy\n');
  git(fixture.dir, 'add', '.goal/plans/demo-spec.md');
  git(fixture.dir, 'commit', '-qm', 'prepare coexisting plan');

  const result = run(fixture, [fixture.plan, '1'], { GOAL_ROOT_PATH: undefined });

  assert.ok(existsSync(join(fixture.dir, '.goal', 'runs', 'demo')), result.output);
  assert.equal(existsSync(join(fixture.dir, '.claude', 'goal-runs')), false);
  assert.equal(readFileSync(fixture.plan, 'utf8'), original);
});

for (const source of ['process', 'local', 'project'] as const) {
  test(`${source} root selection uses only that project's chosen record destination`, () => {
    const fixture = repo();
    writeFileSync(join(fixture.dir, '.env'), 'GOAL_ROOT_PATH="project root"\n');
    if (source !== 'project') writeFileSync(join(fixture.dir, '.env.local'), 'GOAL_ROOT_PATH="local root"\n');
    writeFileSync(join(fixture.dir, '.gitignore'), '.claude/\nfake-bin/\n*-args.txt\n.env*\nproject root/runs/\nlocal root/runs/\nprocess root/runs/\n');
    git(fixture.dir, 'add', '.gitignore');
    git(fixture.dir, 'commit', '-qm', 'prepare fixture');
    const root = `${source} root`;

    const result = run(fixture, [fixture.plan, '1'], { GOAL_ROOT_PATH: source === 'process' ? root : undefined });

    assert.ok(existsSync(join(fixture.dir, root, 'runs', 'demo')), result.output);
    assert.equal(existsSync(join(fixture.dir, '.claude', 'goal-runs')), false);
    assert.equal(result.code, 3, result.output);
  });
}

test('an absolute external root with spaces is used without an ignore rule', () => {
  const fixture = repo();
  const root = join(tmpDir('artifact-external-'), 'root with spaces');

  const result = run(fixture, [fixture.plan, '1'], { GOAL_ROOT_PATH: root });

  assert.equal(result.code, 3, result.output);
  assert.ok(existsSync(join(root, 'runs', 'demo')), result.output);
  assert.equal(existsSync(join(fixture.dir, '.goal')), false);
});

test('an empty selected root fails instead of falling back or invoking an agent', () => {
  const fixture = repo();

  const result = run(fixture, [fixture.plan, '1'], { GOAL_ROOT_PATH: '' });

  assert.equal(result.code, 2, result.output);
  assert.match(result.output, /GOAL_ROOT_PATH.*empty/);
  assert.equal(existsSync(fixture.claudeLog), false);
  assert.equal(existsSync(join(fixture.dir, '.goal')), false);
});

test('records inside the repository require their own exclusion, not an entire-root exclusion', () => {
  const fixture = repo();

  const result = run(fixture, [fixture.plan, '1'], { GOAL_ROOT_PATH: 'tracked-goal' });

  assert.equal(result.code, 2, result.output);
  assert.match(result.output, /tracked-goal\/runs/);
  assert.equal(existsSync(fixture.claudeLog), false);
});

test('two projects choose different roots without sharing records', () => {
  const first = repo();
  const second = repo();
  const secondRoot = tmpDir('second-project-records-');

  run(first, [first.plan, '1'], { GOAL_ROOT_PATH: undefined });
  assert.equal(existsSync(join(second.dir, '.goal')), false);
  run(second, [second.plan, '1'], { GOAL_ROOT_PATH: secondRoot });

  assert.equal(readdirSync(join(first.dir, '.goal', 'runs', 'demo')).length, 1);
  assert.equal(readdirSync(join(secondRoot, 'runs', 'demo')).length, 1);
  assert.equal(existsSync(join(second.dir, '.goal')), false);
});

test('a launch from a subdirectory still refuses unignored records inside the Git root', () => {
  const fixture = repo();
  mkdirSync(join(fixture.dir, 'nested'));

  const result = spawnSync('node', [RUN_NODE, fixture.plan, '1'], {
    cwd: join(fixture.dir, 'nested'), encoding: 'utf8',
    env: { ...process.env, PATH: `${fixture.bin}:${process.env.PATH ?? ''}`, GOAL_ROOT_PATH: 'visible', GOAL_GATE: join(fixture.bin, 'fake-gate') },
  });

  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stdout, /visible\/runs is visible to git/);
  assert.equal(existsSync(fixture.claudeLog), false);
});

test('a missing explicit plan is refused without selecting another plan', () => {
  const fixture = repo();
  mkdirSync(join(fixture.dir, '.goal', 'plans'), { recursive: true });
  writeFileSync(join(fixture.dir, '.goal', 'plans', 'missing-spec.md'), readFileSync(fixture.plan));
  const missing = join(fixture.dir, '.claude', 'plans', 'missing-spec.md');

  const result = run(fixture, [missing, '1'], { GOAL_ROOT_PATH: undefined });

  assert.equal(result.code, 2, result.output);
  assert.ok(result.output.includes(missing), result.output);
  assert.equal(existsSync(fixture.claudeLog), false);
});

test('a root change during iteration 1 leaves iteration 2 and closing links at A, then a new launch uses B', () => {
  const fixture = repo();
  writeFileSync(join(fixture.dir, '.env.local'), 'GOAL_ROOT_PATH=A\n');
  writeFileSync(join(fixture.dir, '.gitignore'), '.claude/\nfake-bin/\n*-args.txt\n.env.local\nA/runs/\nB/runs/\n');
  git(fixture.dir, 'add', '.gitignore');
  git(fixture.dir, 'commit', '-qm', 'prepare root exclusions');
  const script = join(fixture.bin, 'change-root');
  writeFileSync(script, "printf 'GOAL_ROOT_PATH=B\\n' > .env.local\n");

  const first = run(fixture, [fixture.plan], {
    GOAL_ROOT_PATH: undefined,
    FAKE_CLAUDE_EXEC: script,
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMITS: '1',
  });

  assert.equal(first.code, 0, first.output);
  assert.match(first.output, /RUN iteration 2/);
  assert.equal(existsSync(join(fixture.dir, 'B', 'runs')), false);
  assert.equal(readdirSync(join(fixture.dir, 'A', 'runs', 'demo')).length, 1);
  assert.match(readFileSync(fixture.claudeLog, 'utf8'), /A\/runs\/demo/);
  assert.doesNotMatch(readFileSync(fixture.claudeLog, 'utf8'), /B\/runs\/demo/);

  git(fixture.dir, 'add', 'a.txt');
  git(fixture.dir, 'commit', '-qm', 'settle fixture closing writes');

  const second = run(fixture, [fixture.plan, '1'], { GOAL_ROOT_PATH: undefined });

  assert.equal(second.code, 3, second.output);
  assert.equal(readdirSync(join(fixture.dir, 'B', 'runs', 'demo')).length, 1);
  assert.equal(readdirSync(join(fixture.dir, 'A', 'runs', 'demo')).length, 1);
});
