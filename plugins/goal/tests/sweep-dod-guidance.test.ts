import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PLAN, repo, run } from './support/goal-run-harness.ts';

const PLAN2 = PLAN.replace(
  '- **Goal:** write b.txt\n',
  '- **Goal:** write b.txt\n\n```gate\ntest_files=t2.txt\nimpl_files=b.txt\nmax_diff=50\ncommit_msg=feat: b\ngate1=true\n```\n',
);

const REFUSAL = 'STOP the base is not green: `false` exited 1 before this run wrote a line:';

// R4 — a failing dodN line names where a final-state target belongs, after the unchanged refusal.
test('a dodN refusal appends the gate1 alternative after the refusal sentence', () => {
  const planText = PLAN2.replace(
    '### Iteration 1',
    '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1',
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.ok(output.includes(REFUSAL), output);
  assert.match(output, /Definition of Done[^\n]*invariant[^\n]*gate1/i, output);
});

// R4 — a failing gateN line is refused without the dod guidance.
test('a gate2 refusal carries no dod guidance', () => {
  const planText = PLAN2.replace('gate1=true\n```\n', 'gate1=true\ngate2=false\n```\n');
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.ok(output.includes(REFUSAL), output);
  assert.doesNotMatch(output, /Definition of Done/, output);
});
