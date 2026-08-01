import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DENY_SETUP, denyOf, repo, run } from './support/goal-run-harness.ts';

// R9 — `git commit`, `git push` and `git add` are denied to the implementer by a settings rule,
// installed by goal-deny-setup.sh, and goal-run.sh's preflight refuses to start when that rule
// is absent.

test('goal-deny-setup.sh installs a deny rule covering commit, push and add', () => {
  const fixture = repo({ deny: false });

  const result = spawnSync('bash', [DENY_SETUP, fixture.dir], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  const rules: string[] = JSON.parse(readFileSync(denyOf(fixture), 'utf8')).permissions.deny;
  for (const verb of ['commit', 'push', 'add']) {
    assert.ok(rules.some((rule) => rule.includes(`git ${verb}`)), `no rule denies git ${verb}: ${rules}`);
  }
});

test('goal-deny-setup.sh is idempotent: a second run changes nothing', () => {
  const fixture = repo({ deny: false });

  spawnSync('bash', [DENY_SETUP, fixture.dir], { encoding: 'utf8' });
  const first = readFileSync(denyOf(fixture), 'utf8');
  spawnSync('bash', [DENY_SETUP, fixture.dir], { encoding: 'utf8' });
  const second = readFileSync(denyOf(fixture), 'utf8');

  assert.equal(second, first, 'a second run changed the settings file');
});

test('goal-deny-setup.sh preserves whatever permissions.deny already held', () => {
  const fixture = repo({ deny: false });
  mkdirSync(join(fixture.dir, '.claude'), { recursive: true });
  writeFileSync(denyOf(fixture), JSON.stringify({ permissions: { deny: ['Read(**/.env)'] } }));

  spawnSync('bash', [DENY_SETUP, fixture.dir], { encoding: 'utf8' });

  const rules: string[] = JSON.parse(readFileSync(denyOf(fixture), 'utf8')).permissions.deny;
  assert.ok(rules.includes('Read(**/.env)'), `an existing rule was dropped: ${rules}`);
});

test('goal-run.sh refuses to start when the deny rule is absent', () => {
  const fixture = repo({ deny: false });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /deny/i, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned though the deny rule is absent');
});

test('goal-run.sh refuses when the deny rule covers only some of commit, push and add', () => {
  const fixture = repo({ deny: 'partial' });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /deny/i, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned with an incomplete deny rule');
});

test('goal-run.sh proceeds once goal-deny-setup.sh has installed the rule', () => {
  const fixture = repo({ deny: false });
  spawnSync('bash', [DENY_SETUP, fixture.dir], { encoding: 'utf8' });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.ok(existsSync(fixture.claudeLog), `the run never reached the implementer:\n${output}`);
});
