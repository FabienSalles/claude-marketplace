import { test } from 'node:test';
import assert from 'node:assert/strict';

import { repo, run } from './support/goal-run-harness.ts';

// R1 — the CLI contract is what makes a plan resumable by hand and a bad invocation refused
// rather than half-started: no plan, an unreadable plan, or a non-numeric iteration must all be
// refused before anything is attempted, on either runner.
test('it refuses when no plan is named', () => {
  const fixture = repo();

  const { code, output } = run(fixture, []);

  assert.equal(code, 2, output);
  assert.match(output, /usage/i, output);
});

test('it refuses when the plan is not readable', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [`${fixture.dir}/no-such-plan.md`]);

  assert.equal(code, 2, output);
  assert.match(output, /not readable/i, output);
});

test('it refuses when the iteration is not a number', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, 'one']);

  assert.equal(code, 2, output);
  assert.match(output, /must be a number/i, output);
});
