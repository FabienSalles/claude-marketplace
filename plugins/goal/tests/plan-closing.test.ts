import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// rule: the planner routes to the chosen run mode
test('the plan closing leads with /goal:supervise, not the manual loop, when every iteration is gateable under commit+pr', () => {
  const plan = readFileSync(
    join(import.meta.dirname, '..', 'skills', 'plan', 'SKILL.md'),
    'utf8',
  );

  const phase5 = plan.slice(plan.indexOf('## Phase 5 — Hand off to Session 2'));
  assert.match(
    phase5,
    /commit\+pr`\s+with every iteration gateable.{0,200}close with the `\/goal:supervise`\s+line and nothing else/is,
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

// rule: under commit+pr with every iteration gateable, the per-iteration block is withheld
test('Phase 5 orders the per-iteration /goal block withheld under commit+pr when every iteration is gateable, and its routing table agrees with the closing', () => {
  const plan = readFileSync(
    join(import.meta.dirname, '..', 'skills', 'plan', 'SKILL.md'),
    'utf8',
  );

  const phase5 = plan.slice(plan.indexOf('## Phase 5 — Hand off to Session 2'));
  assert.doesNotMatch(phase5, /emitted below the `\/goal:supervise` line as the fallback/);
  assert.match(
    phase5,
    /do not build the per-iteration `\/goal`\s+block and do not print it/,
    phase5,
  );
  assert.match(
    phase5,
    /\| `commit\+pr` \| all gateable \| the \*\*`\/goal:supervise <plan path>` line only\*\* — no per-iteration block \|/,
    phase5,
  );
});
