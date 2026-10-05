import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { PLAN, repo, run } from './support/goal-run-harness.ts';
import { REFUSED } from '../src/run/preflight.ts';

// R2, R3, R4 — on a github.com fork the branch is also caught up with its parent, an unreadable
// parent refuses with the case named, and a fork-ness gh cannot tell warns or refuses by policy.

const FORK = { FAKE_GH_FORK_PARENT: 'up/demo' };

test('it refuses a fork branch behind its parent, listing the parent commits it lacks', () => {
  const fixture = repo({ github: { parent: 'ahead' } });

  const { code, output } = run(fixture, [fixture.plan, '1'], FORK);

  assert.equal(code, REFUSED, output);
  assert.match(output, /STOP the branch is behind upstream\/main:\n.*parent commit/s, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it certifies a fork branch caught up with its parent only after fetching the parent', () => {
  const fixture = repo({ github: { parent: 'level' } });

  const { output } = run(fixture, [fixture.plan, '1'], FORK);

  const fetched = output.indexOf('RUN preflight: fetched upstream');
  const caughtUp = output.indexOf('RUN preflight: branch is caught up with upstream/main');

  assert.ok(fetched >= 0, output);
  assert.ok(caughtUp > fetched, output);
});

test('it checks the parent branch named by PR base', () => {
  const fixture = repo({ github: { parent: 'level' }, prBase: 'nope' });

  const { code, output } = run(fixture, [fixture.plan, '1'], FORK);

  assert.equal(code, REFUSED, output);
  assert.match(output, /STOP upstream, the parent of this fork, has no branch nope.*PR base/s, output);
});

test('it leaves a github.com remote that is not a fork alone', () => {
  const fixture = repo({ github: {} });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, REFUSED, output);
  assert.ok(!/upstream|parent/.test(output), output);
});

test('it refuses a fork whose parent no local remote points at', () => {
  const fixture = repo({ github: { parent: 'no-remote' } });

  const { code, output } = run(fixture, [fixture.plan, '1'], FORK);

  assert.equal(code, REFUSED, output);
  assert.match(output, /STOP up\/demo is the parent of this fork, and no local remote points at it.*git remote add/s, output);
});

test('it refuses a fork whose parent cannot be fetched', () => {
  const fixture = repo({ github: { parent: 'unfetchable' } });

  const { code, output } = run(fixture, [fixture.plan, '1'], FORK);

  assert.equal(code, REFUSED, output);
  assert.match(output, /STOP .*could not fetch upstream/s, output);
});

test('it warns and continues under commit when gh cannot tell whether the remote is a fork', () => {
  const fixture = repo({ github: { parent: 'level' } });

  const { code, output } = run(fixture, [fixture.plan, '1'], { ...FORK, FAKE_GH_REPO_VIEW_EXIT: '1' });

  assert.notEqual(code, REFUSED, output);
  assert.match(output, /RUN preflight: warning — .*parent was not checked/s, output);
  assert.ok(existsSync(fixture.claudeLog), 'the warning stopped the run reaching the implementer');
});

test('it refuses under commit+pr when gh cannot tell whether the remote is a fork', () => {
  const planText = PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n');
  const fixture = repo({ github: { parent: 'level' }, planText });

  const { code, output } = run(fixture, [fixture.plan, '1'], { ...FORK, FAKE_GH_REPO_VIEW_EXIT: '1' });

  assert.equal(code, REFUSED, output);
  assert.match(output, /STOP .*gh auth login/s, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it does not ask gh about a remote that is not on github.com', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1'], { FAKE_GH_REPO_VIEW_EXIT: '1' });

  assert.ok(!/parent was not checked|gh auth login/.test(output), output);
});
