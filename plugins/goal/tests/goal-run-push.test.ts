import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { PAUSED, PLAN, repo, run } from './support/goal-run-harness.ts';

const PLAN_PR = PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n');

// R6 (I2) — a push from this checkout moves the local remote-tracking ref, which is exactly the
// side effect `git for-each-ref refs/remotes` catches. Only the gate may publish, so the run has
// to halt and name the ref rather than let a self-published implementer through unnoticed.
test('the implementer pushing halts the run, naming the moved ref', () => {
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
test('a push on the first attempt survives a quota failure and retry', () => {
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

// A blocked publication is named in the run's own terminal line, sourced from the publisher's
// own `blocked` state, not left in an earlier RUN line a developer skimming straight to the
// bottom of the log would never reach.
test("a blocked publication is named in the run's terminal line", () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_SCAN_EXIT: '1',
  });

  assert.equal(code, 0, output);
  const lastLine = output.trim().split('\n').pop() ?? '';
  assert.match(lastLine, /^STOP/, output);
  assert.match(lastLine, /blocked/i, output);
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
