import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DENY_SETUP, denyOf, repo, run } from './support/goal-run-harness.ts';

// R9 — `git commit`, `git push` and `git add` are denied to the implementer by a settings rule,
// installed by goal-deny-setup.sh. goal-run.ts does not gate on it: the check it once carried was
// a substring match over raw JSON, so a file whose permissions.allow granted `Bash(git commit:*)`
// satisfied it while granting the opposite; it was installed project-wide, so it also restrained
// the interactive session where the developer reads every diff; and permissions are read at
// session start, so it described a future session and never the running one.

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

test('a run proceeds once goal-deny-setup.sh has installed the rule', () => {
  const fixture = repo({ deny: false });
  spawnSync('bash', [DENY_SETUP, fixture.dir], { encoding: 'utf8' });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.ok(existsSync(fixture.claudeLog), `the run never reached the implementer:\n${output}`);
});

test('a run starts with no settings file at all, and says nothing about a deny rule', () => {
  const fixture = repo({ deny: false });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.ok(existsSync(fixture.claudeLog), `the run never reached the implementer:\n${output}`);
  assert.doesNotMatch(output, /denied git/, output);
});
