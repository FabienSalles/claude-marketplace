import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, repo, run } from './support/goal-run-harness.ts';

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
