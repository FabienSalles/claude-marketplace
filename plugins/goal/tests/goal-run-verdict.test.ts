import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { HASH, PAUSED, lockOf, repo, run } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';
import { HALTED } from '../src/run/iteration.ts';

// R2 — the hash is published by `check` and carried to `commit`. Recomputing it there would bless
// a plan that moved between the two calls, which is the one thing the hash exists to catch.
test('it carries the hash check published into the commit call', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.match(readFileSync(fixture.gateLog, 'utf8'), new RegExp(`^${HASH}$`, 'm'));
});

// R6 — an implementer that wrote nothing is not the same event as work the gate rejected, and
// reporting it as a refusal tells someone asleep their work was judged when it never existed.
test('an implementer that wrote nothing is reported as such, and no verdict is asked for', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /wrote nothing/i, output);
  assert.ok(!readFileSync(fixture.gateLog, 'utf8').includes('commit'), 'the gate was asked to commit nothing');
});

// R6 / hole H2 — an implementer that commits also leaves a clean tree, so a check reading only
// `git status` calls it "wrote nothing" about work that is right there in HEAD. Comparing HEAD
// before and after is what tells the two apart.
test('an implementer that committed is not mistaken for one that wrote nothing', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_COMMITS: '1',
  });

  assert.notEqual(code, 0);
  assert.match(output, /committed/i, output);
  assert.ok(!/wrote nothing/i.test(output), `the diagnosis is wrong:\n${output}`);
});

// R7 — the gate exits 0 for a pass and 1 for a halt. Anything else means it never really ran, and
// calling that a refusal reports a verdict that was never reached.
test('a gate that could not run is not reported as a refusal', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '2',
  });

  assert.notEqual(code, 0);
  assert.match(output, /could not be run/i, output);
  assert.ok(!/refus/i.test(output), `a non-verdict was reported as a refusal:\n${output}`);
});

test('a gate that refuses the work halts the run and says so', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '1',
  });

  assert.notEqual(code, 0);
  assert.match(output, /refused/i, output);
});

// R2 — a gate refusal exits exactly 1 (HALTED), not merely non-zero: the run's own exit code
// mapping is a contract a supervisor reads, and any other non-zero value would misclassify it.
test('a gate that refuses the work exits exactly 1', () => {
  const fixture = repo();

  const { code } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '1',
  });

  assert.equal(code, HALTED);
});

// R7 — the gate command is interpolated unquoted into five `shell: true` strings, so a checkout
// under a directory holding a space is split by the shell and every iteration is refused over a
// gate that never ran. The real gate is used here: the fixture's own one is named by GOAL_GATE,
// which is the path this default never takes.
test('a gate installed under a path holding a space still runs', () => {
  const fixture = repo();
  const installed = tmpDir('goal run install ');
  const scripts = join(installed, 'scripts');
  cpSync(resolve(import.meta.dirname, '..', 'scripts'), scripts, { recursive: true });
  cpSync(resolve(import.meta.dirname, '..', 'src'), join(installed, 'src'), { recursive: true });

  const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${fixture.bin}:${process.env.PATH ?? ''}` };
  delete env.GOAL_GATE;

  const result = spawnSync('node', [join(scripts, 'goal-run.ts'), fixture.plan, '1'], {
    cwd: fixture.dir,
    encoding: 'utf8',
    env,
  });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, PAUSED, output);
  assert.match(output, /wrote nothing/i, output);
});

// The plan is read before the lock is taken, so a run that cannot be started leaves nothing to
// clean up — and the refusal names the tree rather than a lock the developer now has to free.
test('a plan the gate refuses to check never reaches an implementer', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_CHECK_EXIT: '1' });

  assert.notEqual(code, 0);
  assert.ok(!existsSync(fixture.claudeLog), `an implementer ran on an unrunnable iteration:\n${output}`);
  assert.ok(!existsSync(lockOf(fixture)), 'a lock was left behind by a run that never started');
});
