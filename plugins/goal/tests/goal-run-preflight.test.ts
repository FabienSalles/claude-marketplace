import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PLAN, lockOf, repo, run } from './support/goal-run-harness.ts';

// R8 — the twelve preflight conditions run before the lock is taken, as refusals rather than
// warnings, and word for word the same message goal-run.sh would give. A run that would have
// burned a night on a red base, a stale branch or an absent remote refuses in seconds instead.

test('it refuses when the plan declares no Policy line', () => {
  const fixture = repo({ planText: PLAN.replace('Policy: commit\n', '') });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the plan declares no Policy line/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the plan is Policy: manual', () => {
  const fixture = repo({ planText: PLAN.replace('Policy: commit', 'Policy: manual') });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(
    output,
    /STOP Policy is manual, so nothing may be committed and there is nothing to run unattended\. Change the Policy line in the spec, or run the manual loop with \/goal and \/goal:next\./,
    output,
  );
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the plan declares no Remote line', () => {
  const fixture = repo({ planText: PLAN.replace('Remote: origin\n', '') });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the plan declares no Remote line/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the checkout stands on the wrong branch', () => {
  const fixture = repo({ branch: null });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the checkout stands on main, not feature\/demo \(or feature\/demo-\.\.\.\)/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the tree carries uncommitted work', () => {
  const fixture = repo();
  writeFileSync(join(fixture.dir, 'stray.txt'), 'oops\n');

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the tree is not clean:\n\?\? stray\.txt/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test("it refuses when the plan's own directory is visible to git", () => {
  const fixture = repo({ trackPlan: true });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(
    output,
    /STOP the plan's directory is visible to git: .*plans\. Ignore it, untracking any spec already committed\./,
    output,
  );
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses a cleanup iteration (a Trigger line) sitting inside a feature plan', () => {
  const planText = PLAN.replace(
    '### Iteration 2 — the second one\n- [ ] Not done yet',
    '### Iteration 2 — the second one\n- [ ] Not done yet\n- **Trigger:** flag at 100% for 7 days',
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(
    output,
    /STOP the plan carries a cleanup iteration \(a Trigger: line\) inside a feature plan\. Move it out with \/goal:run-issue, or run the \*-cleanup-spec\.md plan directly\./,
    output,
  );
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('a Trigger line is left alone in a *-cleanup-spec.md plan', () => {
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

test('it refuses when another run already holds the plan', () => {
  const fixture = repo();
  mkdirSync(lockOf(fixture));

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, new RegExp(`STOP another run holds this plan: ${lockOf(fixture)}\\. Wait for it, or free it with:`), output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the base is already red', () => {
  const planText = PLAN.replace(
    '### Iteration 1',
    '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1',
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the base is not green: `false` exited 1 before this run wrote a line:/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when a later gate in the sweep (gate2..N) fails on the untouched tree', () => {
  const planText = PLAN.replace('gate1=true\n', 'gate1=true\ngate2=false\n');
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the base is not green: `false` exited 1 before this run wrote a line:/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('the base sweep is skipped while the Bootstrap iteration is still unchecked', () => {
  const planText = PLAN.replace(
    'Policy: commit\n',
    'Policy: commit\nBootstrap: 1\n',
  ).replace('### Iteration 1', '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1');
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.match(output, /RUN base sweep skipped: Bootstrap iteration 1 is not built yet/, output);
  assert.ok(existsSync(fixture.claudeLog), 'the run never reached the implementer under an exempted sweep');
});

test('it refuses when the branch is behind the base it forked from', () => {
  const fixture = repo({ staleOrigin: true });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the branch is behind origin\/main:\n.*ahead commit\n\nFetch and rebase before relaunching\./s, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});
