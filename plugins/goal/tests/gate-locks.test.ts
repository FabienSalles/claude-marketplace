import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { repo, run } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';
import { lockPaths, lockRoot } from '../src/gate/locks.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const gate = (verb: string, plan: string, env: Record<string, string> = {}, ...rest: string[]) =>
  spawnSync(process.execPath, [GATE, verb, plan, ...rest], { encoding: 'utf8', env: { ...process.env, ...env } });

const planFile = (dir = tmpDir('gate-locks-plan-')): string => {
  const plan = join(dir, 'demo.md');
  writeFileSync(plan, '# Spec: demo\n');

  return plan;
};

test('R1: a lock is taken in the lock directory and nothing appears beside the plan', () => {
  const root = tmpDir('gate-locks-root-');
  const plan = planFile();
  const before = readdirSync(join(plan, '..'));

  assert.equal(gate('lock', plan, { GOAL_LOCK_ROOT: root }).status, 0);

  const { run: path } = lockPaths(plan, root);

  assert.ok(existsSync(path));
  assert.equal(readFileSync(join(path, 'plan'), 'utf8'), realpathSync(plan));
  assert.deepEqual(readdirSync(join(plan, '..')), before);
});

test('R2: a second lock on a held plan is refused, naming the held lock and the unlock command', () => {
  const root = tmpDir('gate-locks-root-');
  const plan = planFile();

  assert.equal(gate('lock', plan, { GOAL_LOCK_ROOT: root }).status, 0);

  const second = gate('lock', plan, { GOAL_LOCK_ROOT: root });

  assert.equal(second.status, 1);
  assert.match(second.stdout + second.stderr, new RegExp(`${lockPaths(plan, root).run}[\\s\\S]*goal-gate\\.ts unlock ${plan}`));
});

test('R4: two plan files sharing a file name in two directories hold their locks at the same time', () => {
  const root = tmpDir('gate-locks-root-');
  const [one, two] = [planFile(), planFile()] as [string, string];

  assert.equal(gate('lock', one, { GOAL_LOCK_ROOT: root }).status, 0);
  assert.equal(gate('lock', two, { GOAL_LOCK_ROOT: root }).status, 0);
});

test('R5: a plan reached through a relative path or a symlink maps to the same lock', () => {
  const root = tmpDir('gate-locks-root-');
  const plan = planFile();
  const link = join(tmpDir('gate-locks-link-'), 'alias.md');
  symlinkSync(plan, link);

  assert.equal(gate('lock', plan, { GOAL_LOCK_ROOT: root }).status, 0);
  assert.equal(gate('lock', relative(process.cwd(), plan), { GOAL_LOCK_ROOT: root }).status, 1);
  assert.equal(lockPaths(link, root).run.replace(/alias/, 'demo'), lockPaths(plan, root).run);
});

test('R6: an old lock beside the plan refuses a lock and a commit, naming the old path', () => {
  const root = tmpDir('gate-locks-root-');
  const plan = planFile();
  mkdirSync(`${plan}.run.lock`);

  const refused = gate('lock', plan, { GOAL_LOCK_ROOT: root });

  assert.equal(refused.status, 1);
  assert.match(refused.stdout + refused.stderr, new RegExp(`${plan}\\.run\\.lock[\\s\\S]*goal-gate\\.ts unlock ${plan}`));
  assert.equal(existsSync(lockPaths(plan, root).run), false);

  const tickPlan = planFile();
  mkdirSync(`${tickPlan}.tick.lock`);

  assert.equal(gate('lock', tickPlan, { GOAL_LOCK_ROOT: root }).status, 1);
});

test('R7: unlock releases the new lock and the old ones, and succeeds with nothing held', () => {
  const root = tmpDir('gate-locks-root-');
  const plan = planFile();

  assert.equal(gate('unlock', plan, { GOAL_LOCK_ROOT: root }).status, 0);

  mkdirSync(`${plan}.run.lock`);
  mkdirSync(`${plan}.tick.lock`);

  assert.equal(gate('unlock', plan, { GOAL_LOCK_ROOT: root }).status, 0);
  assert.equal(existsSync(`${plan}.run.lock`) || existsSync(`${plan}.tick.lock`), false);
  assert.equal(gate('lock', plan, { GOAL_LOCK_ROOT: root }).status, 0);
  assert.equal(gate('unlock', plan, { GOAL_LOCK_ROOT: root }).status, 0);
  assert.equal(existsSync(lockPaths(plan, root).run), false);
});

test('R9: a lock directory that does not exist yet is created by the first lock', () => {
  const root = join(tmpDir('gate-locks-root-'), 'fresh', 'locks');
  const plan = planFile();

  assert.equal(gate('lock', plan, { GOAL_LOCK_ROOT: root }).status, 0);
  assert.ok(existsSync(lockPaths(plan, root).run));
});

test('R10: another $TMPDIR does not move the lock directory', () => {
  const plan = planFile();
  const root = tmpDir('gate-locks-root-');

  assert.equal(gate('lock', plan, { GOAL_LOCK_ROOT: root, TMPDIR: tmpDir('gate-locks-tmp-') }).status, 0);
  assert.equal(gate('lock', plan, { GOAL_LOCK_ROOT: root, TMPDIR: tmpDir('gate-locks-tmp-') }).status, 1);
  assert.equal(lockRoot({ TMPDIR: '/elsewhere' }), `/tmp/goal-locks-${String(process.getuid?.())}`);
});

test('R15: an empty or relative GOAL_LOCK_ROOT refuses lock with exit 2, naming the variable', () => {
  const plan = planFile();

  for (const value of ['', 'relative/locks']) {
    const result = gate('lock', plan, { GOAL_LOCK_ROOT: value });

    assert.equal(result.status, 2, value);
    assert.match(result.stderr, /GOAL_LOCK_ROOT/);
  }
});

test('R2, R5, R6: a launch is refused for a held lock, however the plan is spelled, or an old lock', () => {
  const fixture = repo();
  const root = tmpDir('gate-locks-root-');
  const env = { GOAL_LOCK_ROOT: root };
  const alias = join(tmpDir('gate-locks-link-'), 'demo-spec.md');
  symlinkSync(fixture.plan, alias);
  mkdirSync(lockPaths(fixture.plan, root).run, { recursive: true });

  for (const spelling of [fixture.plan, alias]) {
    const refused = run(fixture, [spelling, '1'], env);

    assert.notEqual(refused.code, 0, refused.output);
    assert.match(refused.output, new RegExp(`another run holds this plan: ${lockPaths(fixture.plan, root).run}`));
    assert.match(refused.output, / unlock /);
  }

  mkdirSync(`${fixture.plan}.tick.lock`);
  const old = run(fixture, [fixture.plan, '1'], { GOAL_LOCK_ROOT: tmpDir('gate-locks-root-') });

  assert.match(old.output, new RegExp(`another run holds this plan: ${fixture.plan}\\.tick\\.lock`));
  assert.ok(!existsSync(fixture.claudeLog));
});

test('R8, R15: a refused launch leaves no lock, and a relative GOAL_LOCK_ROOT refuses it with exit 2', () => {
  const fixture = repo();
  const root = tmpDir('gate-locks-root-');

  writeFileSync(join(fixture.dir, 'dirty.txt'), 'x\n');

  const refused = run(fixture, [fixture.plan, '1'], { GOAL_LOCK_ROOT: root });

  assert.notEqual(refused.code, 0, refused.output);
  assert.equal(existsSync(lockPaths(fixture.plan, root).run), false);
  assert.equal(existsSync(`${fixture.plan}.run.lock`), false);

  const relativeRoot = run(fixture, [fixture.plan, '1'], { GOAL_LOCK_ROOT: 'locks' });

  assert.equal(relativeRoot.code, 2, relativeRoot.output);
  assert.match(relativeRoot.output, /GOAL_LOCK_ROOT/);
});
