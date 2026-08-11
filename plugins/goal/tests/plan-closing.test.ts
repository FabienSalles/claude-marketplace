import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// rule: the planner routes to the chosen run mode
//
// /goal:next's Phase 5 already leads a gateable commit+pr run with the /goal:supervise
// line; /goal:plan's own closing kept the manual per-iteration loop as its only ending,
// unconditionally, even when the routing table above it had already picked
// /goal:supervise first. That left a surviving sibling of the correction /goal:next
// received.
test('the plan closing leads with /goal:supervise, not the manual loop, when every iteration is gateable under commit+pr', () => {
  const plan = readFileSync(
    join(import.meta.dirname, '..', 'skills', 'plan', 'SKILL.md'),
    'utf8',
  );

  const phase5 = plan.slice(plan.indexOf('## Phase 5 — Hand off to Session 2'));
  assert.match(
    phase5,
    /commit\+pr`\s+with every iteration gateable.{0,200}close with the `\/goal:supervise`\s+line instead of the manual loop/is,
    phase5,
  );
});

// rule: the planner routes to the chosen run mode
test('the manual closing (clipboard offer + per-iteration loop) stays as the fallback', () => {
  const plan = readFileSync(
    join(import.meta.dirname, '..', 'skills', 'plan', 'SKILL.md'),
    'utf8',
  );

  const phase5 = plan.slice(plan.indexOf('## Phase 5 — Hand off to Session 2'));
  assert.match(phase5, /Then run \*\*`\/goal:next`\*\*/, phase5);
  assert.match(phase5, /Repeat until the spec has no unchecked iterations left/, phase5);
});

// rule: no "do not print the per-iteration block" order survives in Phase 5
test('Phase 5 no longer orders the per-iteration /goal block withheld, and instead agrees with the closing that it is emitted below the /goal:supervise line as the fallback', () => {
  const plan = readFileSync(
    join(import.meta.dirname, '..', 'skills', 'plan', 'SKILL.md'),
    'utf8',
  );

  const phase5 = plan.slice(plan.indexOf('## Phase 5 — Hand off to Session 2'));
  assert.doesNotMatch(phase5, /do not print the full per-iteration/);
  assert.match(
    phase5,
    /emitted below the `\/goal:supervise` line as the fallback/,
    phase5,
  );
});
