import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAUSED, repo, run } from './support/goal-run-harness.ts';

// The push-detection check lives in goal-run.ts only; goal-run.sh is frozen and never gained it.
// Skipped rather than failed when the suite falls back to bash.
const NODE_ONLY = process.env.GOAL_RUN_IMPL !== 'node' ? 'this check ported to goal-run.ts only, not goal-run.sh yet' : false;

// R6 (I2) — a push from this checkout moves the local remote-tracking ref, which is exactly the
// side effect `git for-each-ref refs/remotes` catches. Only the gate may publish, so the run has
// to halt and name the ref rather than let a self-published implementer through unnoticed.
test('the implementer pushing halts the run, naming the moved ref', { skip: NODE_ONLY }, () => {
  const fixture = repo({ remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_PUSHES: '1',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /pushed/i, output);
  assert.match(output, /refs\/remotes\/origin\//, output);
});

// R6 (I8) — the snapshot is taken once, before the quota-retry loop, same as the git-directory
// guard: a push on attempt 1 must still be caught after a quota failure sends the same iteration
// to attempt 2, so a fresh snapshot per attempt (which would use attempt 1's push as its own
// baseline) is not an option.
test('a push on the first attempt survives a quota failure and retry', { skip: NODE_ONLY }, () => {
  const fixture = repo({ remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_QUOTA_UNTIL: '1',
    FAKE_CLAUDE_QUOTA_COUNTER: `${fixture.dir}/quota-counter`,
    FAKE_CLAUDE_PUSHES: '1',
    GOAL_RUN_QUOTA_SLEEP: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /pushed/i, output);
});

// The false-positive side: an ordinary run that never pushes still lands past this check, even
// with a real remote configured.
test('an ordinary run that never pushes is not stopped by this check', () => {
  const fixture = repo({ remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: `${fixture.dir}/a.txt`,
  });

  assert.equal(code, 0, output);
  assert.doesNotMatch(output, /pushed/i, output);
});
