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

test('R1, R2, R9: the first lock creates the lock directory and nothing beside the plan, a second lock is refused', () => {
  const root = join(tmpDir('gate-locks-root-'), 'fresh', 'locks');
  const plan = planFile();
  const before = readdirSync(join(plan, '..'));
  const { run: path } = lockPaths(plan, root);

  assert.equal(gate('lock', plan, { GOAL_LOCK_ROOT: root }).status, 0);
  assert.equal(readFileSync(join(path, 'plan'), 'utf8'), realpathSync(plan));
  assert.deepEqual(readdirSync(join(plan, '..')), before);

  const second = gate('lock', plan, { GOAL_LOCK_ROOT: root });

  assert.equal(second.status, 1);
  assert.match(second.stdout + second.stderr, new RegExp(`${path}[\\s\\S]*goal-gate\\.ts unlock ${plan}`));
});

test('R4, R5, R10: a lock belongs to the plan file, whatever its spelling, its name or $TMPDIR', () => {
  const root = tmpDir('gate-locks-root-');
  const plan = planFile();
  const link = join(tmpDir('gate-locks-link-'), 'alias.md');
  symlinkSync(plan, link);

  assert.notEqual(lockPaths(planFile(), root).run, lockPaths(plan, root).run);
  assert.equal(lockPaths(relative(process.cwd(), plan), root).run, lockPaths(plan, root).run);
  assert.equal(lockPaths(link, root).run, lockPaths(plan, root).run);
  assert.equal(lockRoot({ TMPDIR: '/elsewhere' }), `/tmp/goal-locks-${String(process.getuid?.())}`);
});

test('R6, R7: an old lock blocks, unlock releases every lock, and unlock with nothing held succeeds', () => {
  const root = tmpDir('gate-locks-root-');
  const plan = planFile();
  const paths = lockPaths(plan, root);
  mkdirSync(paths.oldRun);

  const refused = gate('lock', plan, { GOAL_LOCK_ROOT: root });

  assert.equal(refused.status, 1);
  assert.match(refused.stdout + refused.stderr, new RegExp(`${plan}\\.run\\.lock[\\s\\S]*goal-gate\\.ts unlock ${plan}`));
  assert.equal(existsSync(paths.run), false);

  mkdirSync(paths.oldTick);
  mkdirSync(paths.run);
  mkdirSync(paths.tick);

  assert.equal(gate('unlock', plan, { GOAL_LOCK_ROOT: root }).status, 0);
  assert.deepEqual([paths.run, paths.tick, paths.oldRun, paths.oldTick].filter((path) => existsSync(path)), []);
  assert.equal(gate('unlock', plan, { GOAL_LOCK_ROOT: root }).status, 0);
});

test('R15: a relative GOAL_LOCK_ROOT refuses lock with exit 2, naming the variable', () => {
  const result = gate('lock', planFile(), { GOAL_LOCK_ROOT: 'relative/locks' });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /GOAL_LOCK_ROOT/);
});

test('R2, R5, R6: a launch is refused for a lock held under another spelling of the plan, or an old lock', () => {
  const fixture = repo();
  const root = tmpDir('gate-locks-root-');
  const alias = join(tmpDir('gate-locks-link-'), 'demo-spec.md');
  symlinkSync(fixture.plan, alias);
  mkdirSync(lockPaths(fixture.plan, root).run, { recursive: true });

  const refused = run(fixture, [alias, '1'], { GOAL_LOCK_ROOT: root });

  assert.notEqual(refused.code, 0, refused.output);
  assert.match(refused.output, new RegExp(`another run holds this plan: ${lockPaths(fixture.plan, root).run}`));
  assert.match(refused.output, / unlock /);

  mkdirSync(`${fixture.plan}.tick.lock`);
  const old = run(fixture, [fixture.plan, '1'], { GOAL_LOCK_ROOT: tmpDir('gate-locks-root-') });

  assert.match(old.output, new RegExp(`another run holds this plan: ${fixture.plan}\\.tick\\.lock`));
  assert.ok(!existsSync(fixture.claudeLog));
});

test('R8: a refused launch leaves no lock', () => {
  const fixture = repo();
  const root = tmpDir('gate-locks-root-');

  writeFileSync(join(fixture.dir, 'dirty.txt'), 'x\n');

  const refused = run(fixture, [fixture.plan, '1'], { GOAL_LOCK_ROOT: root });

  assert.notEqual(refused.code, 0, refused.output);
  assert.equal(existsSync(lockPaths(fixture.plan, root).run), false);
  assert.equal(existsSync(`${fixture.plan}.run.lock`), false);
});
