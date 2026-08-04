import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, repo, run } from './support/goal-run-harness.ts';
import { burstBackoffSeconds, classifyQuotaFailure, sleepInSlices } from '../scripts/run/quota.ts';

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
