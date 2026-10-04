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

const GUIDANCE = /Definition of Done holds only invariants/;

const PLAN_GATE2_SHARED = PLAN2.replace('gate1=true\n```\n', 'gate1=true\ngate2=false\n```\n');

// R1 — a lone dod1 refusal names the Definition of Done line.
test('a lone dod1 refusal names the dod1 line', () => {
  const planText = PLAN2.replace(
    '### Iteration 1',
    '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1',
  );
  const fixture = repo({ planText });

  const { output } = run(fixture, [fixture.plan, '1']);

  assert.match(output, /declared by: the plan's Definition of Done dod1\n/, output);
  assert.match(output, GUIDANCE, output);
});

// R1, R3 — a lone gate2 refusal names its iteration line and no guidance.
test('a lone gate2 refusal names Iteration 1 gate2 without guidance', () => {
  const fixture = repo({ planText: PLAN_GATE2_SHARED });

  const { output } = run(fixture, [fixture.plan, '1']);

  assert.match(output, /declared by: Iteration \d+ gate2\n/, output);
  assert.doesNotMatch(output, GUIDANCE, output);
});

// R2 — a shared command names the iteration first, then the Definition of Done.
test('a command shared by gate2 and dod1 names both, iteration first', () => {
  const planText = PLAN_GATE2_SHARED.replace(
    '### Iteration 1',
    '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1',
  );
  const fixture = repo({ planText });

  const { output } = run(fixture, [fixture.plan, '1']);

  assert.match(output, /declared by: Iteration \d+ gate2, the plan's Definition of Done dod1\n/, output);
  assert.match(output, GUIDANCE, output);
});

// R2, R3 — a gate2 shared by two iterations names both, without guidance.
test('a gate2 shared by two iterations names both', () => {
  const planText = PLAN2.replace('gate1=true\n```\n', 'gate1=true\ngate2=false\n```\n').replace(
    'gate1=true\n```\n',
    'gate1=true\ngate2=false\n```\n',
  );
  const fixture = repo({ planText });

  const { output } = run(fixture, [fixture.plan, '1']);

  assert.match(output, /declared by: Iteration \d+ gate2, Iteration \d+ gate2\n/, output);
  assert.doesNotMatch(output, GUIDANCE, output);
});

// R4 — a gate1 with the same command is never named.
test('a gate1 sharing the command is not named', () => {
  const planText = PLAN2.replace('gate1=true\n```\n', 'gate1=false\ngate2=false\n```\n');
  const fixture = repo({ planText });

  const { output } = run(fixture, [fixture.plan, '1']);

  assert.match(output, /declared by: Iteration \d+ gate2\n/, output);
  assert.doesNotMatch(output, /gate1/, output);
});
