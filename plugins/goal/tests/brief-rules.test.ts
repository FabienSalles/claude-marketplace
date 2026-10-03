import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brief } from '../src/run/brief.ts';
import { rulesContext } from '../src/core/plan.ts';

const plan = [
  '# Plan',
  '',
  '## Business rules',
  '',
  '- **R2** the brief carries the rule text',
  '',
  '## Technical decisions',
  '',
  '- D1 keep it in place',
  '',
  '## Iteration 1',
  '',
  '- [ ] Not done yet',
].join('\n');

// R2 — an iteration names a rule by identifier, and the identifier means nothing without its text.
test('the brief carries the rules and decisions sections after the iteration', () => {
  const text = brief('1', '/tmp', 'main', 'SECTION', rulesContext(plan));

  assert.match(text, /\*\*R2\*\* the brief carries the rule text/);
  assert.match(text, /D1 keep it in place/);
  assert.ok(text.indexOf('SECTION') < text.indexOf('R2'), 'the rules come after the iteration');
  assert.ok(!text.includes('Iteration 1'), 'only the two sections travel');
});

// R2 — a plan with neither section yields the brief it yields today.
test('a plan with neither section yields the brief it yields today', () => {
  const bare = '# Plan\n\n## Iteration 1\n\n- [ ] Not done yet\n';

  assert.equal(rulesContext(bare), '');
  assert.equal(brief('1', '/tmp', 'main', 'SECTION', rulesContext(bare)), brief('1', '/tmp', 'main', 'SECTION'));
});

test('a plan with rules but no technical decisions carries the rules alone', () => {
  const text = rulesContext('## Business rules\n\n- **R1** x\n\n## Iteration 1\n');

  assert.match(text, /R1/);
  assert.ok(!text.includes('Technical decisions'));
});
