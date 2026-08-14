import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { RUN_NODE, lockOf, repo, run } from './support/goal-run-harness.ts';

// R1 — the lock is the gate's, and a run that keeps it after dying blocks every later launch on
// a plan nobody is working on. Documented recovery is prose; a trap is a mechanism.
test('it releases the lock on the way out, whatever the outcome', () => {
  for (const [claim, env] of [
    ['the iteration lands', { FAKE_CLAUDE_WRITES: 'a.txt' }],
    ['the gate refuses', { FAKE_CLAUDE_WRITES: 'a.txt', FAKE_GATE_COMMIT_EXIT: '1' }],
    ['the implementer wrote nothing', {}],
  ] as const) {
    const fixture = repo();

    run(fixture, [fixture.plan, '1'], { ...env, ...(env.FAKE_CLAUDE_WRITES ? { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') } : {}) });

    assert.ok(!existsSync(lockOf(fixture)), `the lock survived when ${claim}`);
  }
});

// A crash is not an exit path anyone writes, which is exactly why it is the one that leaked the
// lock on a real run. SIGTERM is what Orca sends when the developer stops a run.
test('it releases the lock when the run is killed mid-implementation', () => {
  const fixture = repo();

  spawnSync(
    'bash',
    ['-c', `node "${RUN_NODE}" "${fixture.plan}" 1 & pid=$!; sleep 1; kill -TERM $pid; wait $pid`],
    {
      cwd: fixture.dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        GOAL_GATE: join(fixture.bin, 'fake-gate'),
        FAKE_CLAUDE_SLEEPS: '2',
      },
    },
  );

  assert.ok(!existsSync(lockOf(fixture)), 'the lock survived a killed run');
});

// R7 — SIGINT is what a developer at the keyboard sends, distinct from SIGTERM above, and lock.ts
// maps it to exit 130 (128+2, the POSIX shape a caller greps for) rather than letting a bare
// signal death report something else. Driven straight at createLock() via a fixture, not through
// a full run: goal-run.ts's own retry path calls process.exit() synchronously the moment an
// implementer attempt fails, which races and starves the signal handler before it is ever
// dispatched — a race the lock module itself, idling on nothing but a timer, does not have.
test('SIGINT releases the lock createLock() holds and exits 130', () => {
  const fixture = repo();
  const gate = join(fixture.bin, 'fake-gate');
  const script = resolve(import.meta.dirname, 'fixtures', 'sigint-lock.ts');

  const result = spawnSync(
    'bash',
    ['-c', `node "${script}" "${gate}" "${fixture.plan}" & pid=$!; sleep 0.5; kill -INT $pid; wait $pid; echo $?`],
    { cwd: fixture.dir, encoding: 'utf8' },
  );

  assert.ok(!existsSync(lockOf(fixture)), 'the lock survived a SIGINT');
  assert.match(result.stdout, /^130$/m, `SIGINT did not exit 130:\n${result.stdout}`);
});

// P7 — the real path, not the isolated fixture above: goal-run.ts itself, mid-implementation,
// sent the same SIGINT a developer's Ctrl+C sends. A signal that arrives while the implementer's
// spawnSync is blocked is queued rather than delivered, so the exit code this reports is decided
// by whatever runs first once that call returns — process.exit(PAUSED) from the retry loop's own
// failure handling used to win that race every time; 130 has to win it now.
test('SIGINT sent to goal-run.ts mid-implementation exits 130 and releases the lock', () => {
  const fixture = repo();

  const result = spawnSync(
    'bash',
    ['-c', `node "${RUN_NODE}" "${fixture.plan}" 1 & pid=$!; sleep 1; kill -INT $pid; wait $pid; echo EXIT:$?`],
    {
      cwd: fixture.dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        GOAL_GATE: join(fixture.bin, 'fake-gate'),
        FAKE_CLAUDE_SLEEPS: '2',
      },
    },
  );

  assert.ok(!existsSync(lockOf(fixture)), 'the lock survived a SIGINT mid-implementation');
  assert.match(result.stdout, /^EXIT:130$/m, `SIGINT mid-implementation did not exit 130:\n${result.stdout}`);
});
