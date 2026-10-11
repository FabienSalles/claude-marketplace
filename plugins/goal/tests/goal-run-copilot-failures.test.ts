import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { git, PAUSED, repo, run } from './support/goal-run-harness.ts';

const COPILOT = { GOAL_RUN_IMPLEMENTER: 'copilot', FAKE_GATE_COMMITS: '1', GOAL_RUN_BURST_CAP: '1' };

const failing = (fixture: { dir: string }, name: string, fails = 99) => ({
  ...COPILOT,
  FAKE_COPILOT_FAILS: String(fails),
  FAKE_COPILOT_FAIL_FIXTURE: name,
  FAKE_COPILOT_WRITES: join(fixture.dir, 'a.txt'),
});

const calls = (fixture: { dir: string }): number => Number(readFileSync(join(fixture.dir, 'fake-bin', 'copilot-calls'), 'utf8'));

// R11, I6 — the pause names the quota, the partial work and the steps; the dirty tree is refused; after the stash Claude resumes.
test('an exhausted Copilot quota pauses with the steps, and the relaunch on Claude starts from the same iteration', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], failing(fixture, 'synthetic-exhausted'));

  assert.equal(code, PAUSED, output);
  assert.match(output, /Copilot quota/);
  assert.match(output, /unjudged partial work from iteration 1/);
  assert.match(output, /git stash push --include-untracked/);
  assert.match(output, /GOAL_RUN_IMPLEMENTER unset/);
  assert.doesNotMatch(output, /quota-exhausted, sleeping/);
  assert.doesNotMatch(output, /asking the gate for a verdict/);
  assert.equal(calls(fixture), 1);
  assert.equal(git(fixture.dir, 'rev-list', '--count', 'HEAD').stdout.trim(), '1');

  const dirty = run(fixture, [fixture.plan, '1'], { FAKE_GATE_COMMITS: '1', FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.notEqual(dirty.code, 0, dirty.output);
  assert.match(dirty.output, /not clean/);

  git(fixture.dir, 'stash', 'push', '--include-untracked');

  const resumed = run(fixture, [fixture.plan, '1'], { FAKE_GATE_COMMITS: '1', FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(resumed.code, 0, resumed.output);
  assert.match(resumed.output, /RUN iteration 1 of/);
  assert.match(resumed.output, /^RUN implementer provider=claude/m);
  assert.equal(calls(fixture), 1);
});

// R12, I3 — a burst is retried with Copilot after a backoff.
test('a rate-limited Copilot iteration is relaunched with Copilot and lands', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], failing(fixture, 'synthetic-burst', 1));

  assert.equal(code, 0, output);
  assert.match(output, /hit a burst rate limit, backing off 1s before relaunching iteration 1 \(attempt 2 of 3\)/);
  assert.equal(calls(fixture), 2);
  assert.doesNotMatch(output, /provider=claude/);
  assert.equal(existsSync(join(fixture.dir, 'claude-args.txt')) && /goal-run-implementer/.test(readFileSync(join(fixture.dir, 'claude-args.txt'), 'utf8')), false);
});

test('a rate limit that never clears pauses with the quota steps once the attempts are spent', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { ...failing(fixture, 'synthetic-burst'), GOAL_RUN_QUOTA_MAX_RETRIES: '2' });

  assert.equal(code, PAUSED, output);
  assert.equal(calls(fixture), 2);
  assert.match(output, /Copilot quota/);
  assert.match(output, /git stash push --include-untracked/);
  assert.doesNotMatch(output, /not converging/);
});

// R13 — the generic pause, nothing committed.
test('an unrecognised Copilot failure pauses with the generic review message', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], failing(fixture, 'synthetic-unrecognised'));

  assert.equal(code, PAUSED, output);
  assert.match(output, /the implementer exited 1 and ended unrecognised:The model stopped answering\./);
  assert.match(output, /review it before relaunching/);
  assert.equal(calls(fixture), 1);
  assert.equal(git(fixture.dir, 'rev-list', '--count', 'HEAD').stdout.trim(), '1');
});
