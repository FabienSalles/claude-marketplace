import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PLAN, git, repo, run } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';
import { REFUSED } from '../src/run/preflight.ts';

// R1 — every remote the preflight compares against is fetched by name in this run, and a fetch
// that fails stops the run, naming the remote, before any "caught up" line.

test('it refuses, naming the remote, when the declared remote cannot be fetched', () => {
  const fixture = repo();
  git(fixture.dir, 'remote', 'set-url', 'origin', join(fixture.dir, 'no-such-remote.git'));

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.equal(code, REFUSED, output);
  assert.match(output, /STOP .*fetch.* origin/s, output);
  assert.ok(!/caught up/.test(output), output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses, naming the declared fork, when the fork cannot be fetched', () => {
  const planText = PLAN.replace('Remote: origin\n', 'Remote: fork\n');
  const fixture = repo({ planText, staleBase: { remote: 'fork', branch: 'main' } });
  git(fixture.dir, 'remote', 'set-url', 'fork', join(fixture.dir, 'no-such-fork.git'));

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.equal(code, REFUSED, output);
  assert.match(output, /STOP .*fetch.* fork/s, output);
  assert.ok(!/caught up/.test(output), output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it compares the branch against the declared fork as fetched in this run, not as last seen', () => {
  const planText = PLAN.replace('Remote: origin\n', 'Remote: fork\n');
  const fixture = repo({ planText, staleBase: { remote: 'fork', branch: 'main' } });
  const forkUrl = git(fixture.dir, 'remote', 'get-url', 'fork').stdout.trim();
  const clone = tmpDir('goal-run-fresh-');

  git(fixture.dir, 'clone', '-q', forkUrl, clone);
  git(clone, 'config', 'user.email', 'fresh@example.com');
  git(clone, 'config', 'user.name', 'Fresh');
  writeFileSync(join(clone, 'fresh.txt'), 'fresh\n');
  git(clone, 'add', '-A');
  git(clone, 'commit', '-qm', 'fresher commit');
  git(clone, 'push', '-q', 'origin', 'main');

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the branch is behind fork\/main:\n.*fresher commit/s, output);
});

test('it fetches every remote before printing that the branch is caught up', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1']);

  const fetched = output.indexOf('RUN preflight: fetched origin');
  const caughtUp = output.indexOf('RUN preflight: branch is caught up with');

  assert.ok(fetched >= 0, output);
  assert.ok(caughtUp > fetched, output);
});
