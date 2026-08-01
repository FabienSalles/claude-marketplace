import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PLAN, lockOf, pendingInNode, repo, run } from './support/goal-run-harness.ts';

// R8 — the twelve preflight conditions run before the lock is taken, as refusals rather than
// warnings. A run that would have burned a night on a red base, a stale branch or an absent
// remote refuses in seconds instead.

test('it refuses when the plan declares no Policy line', { skip: pendingInNode }, () => {
  const fixture = repo({ planText: PLAN.replace('Policy: commit\n', '') });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /Policy/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the plan is Policy: manual', { skip: pendingInNode }, () => {
  const fixture = repo({ planText: PLAN.replace('Policy: commit', 'Policy: manual') });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /manual/i, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the plan declares no Remote line', { skip: pendingInNode }, () => {
  const fixture = repo({ planText: PLAN.replace('Remote: origin\n', '') });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /Remote/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the checkout stands on the wrong branch', { skip: pendingInNode }, () => {
  const fixture = repo({ branch: null });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /feature\/demo/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the tree carries uncommitted work', { skip: pendingInNode }, () => {
  const fixture = repo();
  writeFileSync(join(fixture.dir, 'stray.txt'), 'oops\n');

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /not clean/i, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test("it refuses when the plan's own directory is visible to git", { skip: pendingInNode }, () => {
  const fixture = repo({ trackPlan: true });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /visible to git/i, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses a cleanup iteration (a Trigger line) sitting inside a feature plan', { skip: pendingInNode }, () => {
  const planText = PLAN.replace(
    '### Iteration 2 — the second one\n- [ ] Not done yet',
    '### Iteration 2 — the second one\n- [ ] Not done yet\n- **Trigger:** flag at 100% for 7 days',
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /Trigger/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('a Trigger line is left alone in a *-cleanup-spec.md plan', { skip: pendingInNode }, () => {
  const planText = PLAN.replace(
    '### Iteration 2 — the second one\n- [ ] Not done yet',
    '### Iteration 2 — the second one\n- [ ] Not done yet\n- **Trigger:** flag at 100% for 7 days',
  );
  const fixture = repo({ planText, planFile: 'demo-cleanup-spec.md' });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.ok(existsSync(fixture.claudeLog), 'the cleanup plan never reached an implementer');
});

test('it refuses when another run already holds the plan', { skip: pendingInNode }, () => {
  const fixture = repo();
  mkdirSync(lockOf(fixture));

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /holds this plan/i, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the base is already red', { skip: pendingInNode }, () => {
  const planText = PLAN.replace(
    '### Iteration 1',
    '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1',
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /not green/i, output);
  assert.match(output, /dod1=false|`false`/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when a later gate in the sweep (gate2..N) fails on the untouched tree', { skip: pendingInNode }, () => {
  const planText = PLAN.replace('gate1=true\n', 'gate1=true\ngate2=false\n');
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /not green/i, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('the base sweep is skipped while the Bootstrap iteration is still unchecked', { skip: pendingInNode }, () => {
  const planText = PLAN.replace(
    'Policy: commit\n',
    'Policy: commit\nBootstrap: 1\n',
  ).replace('### Iteration 1', '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1');
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.ok(existsSync(fixture.claudeLog), 'the run never reached the implementer under an exempted sweep');
});

test('it refuses when the branch is behind the base it forked from', { skip: pendingInNode }, () => {
  const fixture = repo({ staleOrigin: true });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /behind/i, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});
