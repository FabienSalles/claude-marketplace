import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { signalWhenHeld } from './support/await-state.ts';
import { RUN_NODE, lockOf, logOf, repo } from './support/goal-run-harness.ts';

const interrupted = async (
  envOf: (fixture: ReturnType<typeof repo>) => Record<string, string>,
  marker: (fixture: ReturnType<typeof repo>) => string,
  state: string,
  signal: NodeJS.Signals,
) => {
  const fixture = repo();
  const claudeLog = join(fixture.dir, 'launches.log');
  const { code, output } = await signalWhenHeld(
    'node',
    [RUN_NODE, fixture.plan, '1'],
    {
      cwd: fixture.dir,
      env: {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        GOAL_GATE: join(fixture.bin, 'fake-gate'),
        FAKE_CLAUDE_LAUNCH_LOG: claudeLog,
        ...envOf(fixture),
      },
    },
    { state, markers: [marker(fixture)], signal, deadlineMs: 10000 },
  );
  const launches = existsSync(claudeLog) ? readFileSync(claudeLog, 'utf8').trim().split('\n').filter((line) => line !== '').length : 0;

  return { code, fixture, output, launches, lockHeld: existsSync(lockOf(fixture)) };
};

// R6 — a running session ends within seconds of the interrupt, the tamper read still runs, and
// the exit code is the signal's.
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
] as const) {
  test(`${signal} sent to the runner mid-session ends it with ${code} after the tamper read, with no new session`, async () => {
    const result = await interrupted(
      (fixture) => ({ FAKE_CLAUDE_MARKER: join(fixture.dir, 'session.marker'), GOAL_RUN_SHUTDOWN_BACKOFF: '60' }),
      (fixture) => join(fixture.dir, 'session.marker'),
      'the implementer session running',
      signal,
    );

    assert.equal(result.code, code, result.output);
    assert.equal(result.launches, 1, 'a new session was started');
    assert.match(readFileSync(logOf(result.fixture), 'utf8'), /stage=implementer/, 'the session was not read before stopping');
    assert.ok(!result.lockHeld, 'the lock survived');
  });
}

// R6 — a quota wait is not slept through.
test('SIGTERM sent to the runner during a quota wait ends it with 143 at once, with no new session', async () => {
  const result = await interrupted(
    (fixture) => ({ FAKE_CLAUDE_QUOTA_UNTIL: '1', FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota.count'), GOAL_RUN_QUOTA_SLEEP: '3600' }),
    (fixture) => join(fixture.dir, 'quota.count'),
    'the first attempt ended quota-shaped',
    'SIGTERM',
  );

  assert.equal(result.code, 143, result.output);
  assert.equal(result.launches, 1, 'a new session was started');
  assert.ok(!result.lockHeld, 'the lock survived');
});
