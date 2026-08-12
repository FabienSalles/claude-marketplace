import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, repo, run } from './support/goal-run-harness.ts';
import { burstBackoffSeconds, classifyFailure, classifyQuotaFailure, shutdownBackoffSeconds, shutdownMaxRetries, sleepInSlices } from '../src/run/quota.ts';

// One line per argv entry (see the fake `claude` binary), and the agent name is a whole
// argument on its own line, once per call — a reliable count of how many times the
// implementer, specifically, was invoked.
const implementerCalls = (claudeLog: string) =>
  (readFileSync(claudeLog, 'utf8').match(/^goal:goal-run-implementer$/gm) ?? []).length;

// R16 — a quota-shaped failure is not a real error: the script sleeps, relaunches the same
// iteration against exactly what the last attempt left behind, and lands once the window
// reopens. The implementer is called twice for the one iteration.
test('a quota-shaped failure sleeps and relaunches the same iteration until it lands', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_QUOTA_UNTIL: '1',
    FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_RUN_QUOTA_SLEEP: '0',
  });

  assert.equal(code, 0, output);
  assert.match(output, /quota/i, output);
  assert.equal(implementerCalls(fixture.claudeLog), 2, `expected exactly two implementer calls:\n${readFileSync(fixture.claudeLog, 'utf8')}`);
});

// R17 — a burst rate limit does not wait on GOAL_RUN_QUOTA_SLEEP: it backs off in seconds and
// relaunches, so a burst that clears immediately costs seconds, not the long sleep the last run
// spent on an already-cleared condition.
test('a burst 429 backs off in seconds and relaunches, ignoring a large GOAL_RUN_QUOTA_SLEEP', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_QUOTA_UNTIL: '1',
    FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
    FAKE_CLAUDE_QUOTA_MESSAGE: 'HTTP 429 Too Many Requests',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_RUN_QUOTA_SLEEP: '999999',
  });

  assert.equal(code, 0, output);
  assert.match(output, /burst|429/i, output);
  assert.equal(implementerCalls(fixture.claudeLog), 2, `expected exactly two implementer calls:\n${readFileSync(fixture.claudeLog, 'utf8')}`);
});

// R16 — the retry is bounded: a quota that never reopens must not spin the run forever. It
// pauses (a clean boundary a relaunch resumes) rather than halting like a gate refusal.
test('a quota that never reopens pauses the run after a bounded number of relaunches, not forever', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_QUOTA_UNTIL: '999',
    FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
    GOAL_RUN_QUOTA_SLEEP: '0',
    GOAL_RUN_QUOTA_MAX_RETRIES: '2',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /quota/i, output);
  assert.equal(implementerCalls(fixture.claudeLog), 2, `expected exactly two implementer calls (bounded):\n${readFileSync(fixture.claudeLog, 'utf8')}`);
});

// R16 hole — the quota retry bound defaults to 3 when GOAL_RUN_QUOTA_MAX_RETRIES is unset, the
// same boundary shutdownMaxRetries() pins for the shutdown class.
test('a quota that never reopens pauses after the default bound of 3 relaunches, with no override', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_QUOTA_UNTIL: '999',
    FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
    GOAL_RUN_QUOTA_SLEEP: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /quota/i, output);
  assert.equal(implementerCalls(fixture.claudeLog), 3, `expected exactly three implementer calls (default bound):\n${readFileSync(fixture.claudeLog, 'utf8')}`);
});

// R16 — an ordinary failure (no quota shape in the output) must not be swallowed into a retry:
// it pauses immediately, on the first call, the way it always has.
test('a failure with no quota shape pauses immediately, without a retry', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_EXIT: '1',
    GOAL_RUN_QUOTA_SLEEP: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.equal(implementerCalls(fixture.claudeLog), 1, `expected exactly one implementer call:\n${readFileSync(fixture.claudeLog, 'utf8')}`);
});

// R18 — exit 143 (SIGTERM, the shape of a self-update or platform shutdown) is a distinct class
// from a quota window: it relaunches on its own fixed, short backoff, bounded by
// GOAL_RUN_SHUTDOWN_MAX_RETRIES, never the GOAL_RUN_QUOTA_SLEEP a quota-shaped failure waits out.
test('an implementer that keeps exiting 143 relaunches on a short fixed backoff, bounded, never the quota sleep', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_EXIT: '143',
    GOAL_RUN_SHUTDOWN_MAX_RETRIES: '2',
    GOAL_RUN_QUOTA_SLEEP: '999999',
    GOAL_RUN_SHUTDOWN_BACKOFF: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /143/, output);
  assert.match(output, /shutdown/i, output);
  assert.doesNotMatch(output, /quota sleep continues/i, output);
  assert.equal(implementerCalls(fixture.claudeLog), 2, `expected exactly two implementer calls (bounded):\n${readFileSync(fixture.claudeLog, 'utf8')}`);
});

// R6 (I5) — the shutdown backoff is an injectable seam: GOAL_RUN_SHUTDOWN_BACKOFF=0 relaunches
// with no measurable wait, so a suite exercising the shutdown-retry path stops paying the
// default 5s per attempt.
test('GOAL_RUN_SHUTDOWN_BACKOFF=0 relaunches with no measurable wait', () => {
  const fixture = repo();
  const start = Date.now();

  const { code } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_EXIT: '143',
    GOAL_RUN_SHUTDOWN_MAX_RETRIES: '2',
    GOAL_RUN_SHUTDOWN_BACKOFF: '0',
  });

  const elapsedMs = Date.now() - start;

  assert.equal(code, PAUSED);
  assert.ok(elapsedMs < 3000, `expected no measurable wait, took ${elapsedMs}ms`);
});

// R6 (I5) — shutdownBackoffSeconds() defaults to the same 5s the constant used to pin, and
// GOAL_RUN_SHUTDOWN_BACKOFF overrides it.
test('shutdownBackoffSeconds defaults to 5 and honours GOAL_RUN_SHUTDOWN_BACKOFF', () => {
  const previous = process.env.GOAL_RUN_SHUTDOWN_BACKOFF;
  delete process.env.GOAL_RUN_SHUTDOWN_BACKOFF;

  assert.equal(shutdownBackoffSeconds(), 5);

  process.env.GOAL_RUN_SHUTDOWN_BACKOFF = '2';
  assert.equal(shutdownBackoffSeconds(), 2);

  if (previous === undefined) {
    delete process.env.GOAL_RUN_SHUTDOWN_BACKOFF;
  } else {
    process.env.GOAL_RUN_SHUTDOWN_BACKOFF = previous;
  }
});

// R6 (I5) — burstBackoffSeconds' cap defaults to the same 8 it used to hardcode, and
// GOAL_RUN_BURST_CAP overrides it.
test('burstBackoffSeconds caps at 8 by default and honours GOAL_RUN_BURST_CAP', () => {
  const previous = process.env.GOAL_RUN_BURST_CAP;
  delete process.env.GOAL_RUN_BURST_CAP;

  assert.equal(burstBackoffSeconds(10), 8);

  process.env.GOAL_RUN_BURST_CAP = '3';
  assert.equal(burstBackoffSeconds(10), 3);

  if (previous === undefined) {
    delete process.env.GOAL_RUN_BURST_CAP;
  } else {
    process.env.GOAL_RUN_BURST_CAP = previous;
  }
});

// R18 — exit 143 is classified as `shutdown` before the quota regex ever runs against the
// output, so a 143 alongside quota-shaped text still reads as `shutdown`, and any other exit
// code still falls through to `classifyQuotaFailure` exactly as before.
test('exit 143 classifies as shutdown regardless of output, bypassing quota classification', () => {
  assert.equal(classifyFailure(143, 'Claude AI usage limit reached|1735689600'), 'shutdown');
  assert.equal(classifyFailure(143, 'HTTP 429 Too Many Requests'), 'shutdown');
  assert.equal(classifyFailure(143, 'nothing quota-shaped here'), 'shutdown');
  assert.equal(classifyFailure(1, 'Claude AI usage limit reached|1735689600'), 'exhausted');
  assert.equal(classifyFailure(1, 'nothing quota-shaped here'), null);
});

// R18 — the shutdown retry bound defaults to 5 and honours GOAL_RUN_SHUTDOWN_MAX_RETRIES, the
// same shape as the quota bound's own env override.
test('the shutdown retry bound defaults to 5 and honours GOAL_RUN_SHUTDOWN_MAX_RETRIES', () => {
  const previous = process.env.GOAL_RUN_SHUTDOWN_MAX_RETRIES;
  delete process.env.GOAL_RUN_SHUTDOWN_MAX_RETRIES;

  assert.equal(shutdownMaxRetries(), 5);

  process.env.GOAL_RUN_SHUTDOWN_MAX_RETRIES = '2';
  assert.equal(shutdownMaxRetries(), 2);

  if (previous === undefined) {
    delete process.env.GOAL_RUN_SHUTDOWN_MAX_RETRIES;
  } else {
    process.env.GOAL_RUN_SHUTDOWN_MAX_RETRIES = previous;
  }
});

// R18 — self-update disabled: the claude spawn env carries DISABLE_AUTOUPDATER so an update
// under way is never what an implementer call's exit 143 turns out to mean.
test('the claude spawn env disables the autoupdater', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.match(readFileSync(fixture.claudeLog, 'utf8'), /^env DISABLE_AUTOUPDATER=1$/m, output);
});

// R17 — the two shapes are distinct, escaped classes: a bare 429 or the literal
// `rate_limit_error` is a burst, an explicit usage-limit message is an exhausted window, and
// unrelated text (including a number that merely contains "429") is neither.
test('classifies a burst 429 apart from an exhausted usage-limit window', () => {
  assert.equal(classifyQuotaFailure('HTTP 429 Too Many Requests'), 'burst');
  assert.equal(classifyQuotaFailure('{"error":{"type":"rate_limit_error"}}'), 'burst');
  assert.equal(classifyQuotaFailure('Claude AI usage limit reached|1735689600'), 'exhausted');
  assert.equal(classifyQuotaFailure('article 14290 was not found'), null);
  assert.equal(classifyQuotaFailure('the rate exceeds the limit today'), null);
  assert.equal(classifyQuotaFailure('nothing quota-shaped here'), null);
});

// R17 — an explicit usage-limit message wins even alongside a 429, because only it takes the
// long sleep.
test('an explicit usage-limit message is exhausted even when a 429 also appears', () => {
  assert.equal(classifyQuotaFailure('429: Claude AI usage limit reached'), 'exhausted');
});

// R17 — a burst backs off in seconds, capped, and it is not GOAL_RUN_QUOTA_SLEEP: it grows with
// the attempt but never explodes into the long sleep's territory.
test('a burst backs off in seconds, capped, independently of GOAL_RUN_QUOTA_SLEEP', () => {
  assert.equal(burstBackoffSeconds(1), 1);
  assert.equal(burstBackoffSeconds(2), 2);
  assert.equal(burstBackoffSeconds(3), 4);
  assert.equal(burstBackoffSeconds(10), 8);
});

// R17 — the long sleep is a loop of short slices, not one spawnSync('sleep', [totalSeconds])
// whose return value is discarded: interrupting the wait is then a property of the loop, and
// each slice is reported before it runs.
test('a long sleep runs as a loop of short slices, each one reported', () => {
  const seen: number[] = [];
  const start = Date.now();

  sleepInSlices(0.6, (remaining) => seen.push(remaining), 0.3);

  const elapsedMs = Date.now() - start;

  assert.equal(seen.length, 2);
  assert.equal(seen[0], 0.6);
  assert.ok(elapsedMs >= 500, `expected at least ~600ms of real sleep, got ${elapsedMs}ms`);
});

// R16 — the implementer's own brief now says the tree it receives may already hold an
// interrupted attempt, because relaunching after a quota exists. Meaningless before this
// iteration, which is why the sentence lands here rather than at the implementer's birth.
test("the implementer's brief warns the tree may already hold an interrupted attempt", () => {
  const implementer = readFileSync(
    join(import.meta.dirname, '..', 'agents', 'goal-run-implementer.md'),
    'utf8',
  );

  assert.match(implementer, /interrupted attempt/i, implementer);
});
