import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PLAN, repo, run } from './support/goal-run-harness.ts';

// PLAN's own Iteration 2 declares no gate block, since no existing preflight test ever reaches
// it: sweeping every declared iteration now requires one, so it is given the smallest valid block.
const PLAN2 = PLAN.replace(
  '- **Goal:** write b.txt\n',
  '- **Goal:** write b.txt\n\n```gate\ntest_files=t2.txt\nimpl_files=b.txt\nmax_diff=50\ncommit_msg=feat: b\ngate1=true\n```\n',
);

// R10 — a fence quoted as a template or example in the plan's prose, outside any iteration
// section and outside the Definition of Done, is not an executable block: its gate2 failing on
// the untouched tree must not refuse the run.
test('a ```gate fence quoted in prose is not swept, even when its gate2 would fail', () => {
  const planText = [
    '# Spec: demo',
    '',
    'Policy: commit',
    'Remote: origin',
    '',
    'An iteration gate block looks like this:',
    '',
    '```gate',
    'gate2=false',
    '```',
    '',
    PLAN2.split('\n').slice(2).join('\n'),
  ].join('\n');
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.ok(existsSync(fixture.claudeLog), 'the run refused on a fence the plan only quoted as an example');
});

// R10 — every iteration's gate block is still swept, ticked or not, so a plan already carrying
// a broken later iteration still refuses at preflight the way it did before this change.
test('a ticked iteration\'s gate2 is still swept', () => {
  const planText = PLAN2.replace('gate1=true\n```\n', 'gate1=true\ngate2=false\n```\n').replace(
    '- [ ] Not done yet\n- **Goal:** write b.txt',
    '- [x] Done\n- **Goal:** write b.txt',
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the base is not green: `false` exited 1/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'a swept ticked iteration was skipped');
});

// R10 — the Definition of Done, located the way `gate/ship.ts:17` locates it, is still swept.
test('the Definition of Done block is still swept', () => {
  const planText = PLAN2.replace(
    '### Iteration 1',
    '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1',
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the base is not green: `false` exited 1/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'the Definition of Done block was skipped');
});
