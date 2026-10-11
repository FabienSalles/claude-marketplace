import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { git, repo, runDirOf, runInProcess } from './support/goal-run-harness.ts';
import { testAgents } from './support/test-agents.ts';

const env = { GOAL_RUN_QUOTA_SLEEP: '1', GOAL_RUN_BURST_CAP: '1', FAKE_GATE_COMMITS: '1' };

// R13 — every file, ref, HEAD and settings change a Copilot close makes is named, and left in place.
test('a Copilot close names every change it leaves behind and leaves them in place', async () => {
  const fixture = repo();
  const { adapter } = testAgents(['success'], {
    provider: 'copilot',
    during: (role) => {
      if (role === 'lens') {
        writeFileSync(join(fixture.dir, 'a.txt'), 'rewritten by lens\n');
        writeFileSync(join(fixture.dir, 'stray.txt'), 'stray\n');
        mkdirSync(join(fixture.dir, '.claude'), { recursive: true });
        writeFileSync(join(fixture.dir, '.claude', 'settings.local.json'), '{}\n');
        git(fixture.dir, 'branch', 'lens-branch');
        git(fixture.dir, 'commit', '--allow-empty', '-qm', 'lens commit');
      } else {
        writeFileSync(join(runDirOf(fixture), 'report.md'), '### Outcome\n');
      }
    },
  });

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.equal(code, 0, output);
  assert.match(output, /^RUN copilot close changed file: a\.txt$/m, output);
  assert.match(output, /^RUN copilot close changed file: stray\.txt$/m, output);
  assert.match(output, /^RUN copilot close changed file: \.claude\/settings\.local\.json$/m, output);
  assert.match(output, /^RUN copilot close changed ref: refs\/heads\/lens-branch$/m, output);
  assert.match(output, /^RUN copilot close changed HEAD$/m, output);
  assert.doesNotMatch(output, /changed file: .*report\.md/);
  assert.equal(readFileSync(join(fixture.dir, 'stray.txt'), 'utf8'), 'stray\n');
});

test('a Copilot close that changes nothing says so', async () => {
  const fixture = repo();
  const { adapter } = testAgents(['success'], { provider: 'copilot', during: () => {} });

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.equal(code, 0, output);
  assert.match(output, /^RUN copilot close left nothing behind$/m, output);
});

// R1 — a Claude close is not checked.
test('a Claude close is not checked', async () => {
  const fixture = repo();
  const { adapter } = testAgents(['success'], {
    provider: 'claude',
    during: (role) => role === 'lens' && writeFileSync(join(fixture.dir, 'stray.txt'), 'stray\n'),
  });

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.equal(code, 0, output);
  assert.doesNotMatch(output, /copilot close/);
  assert.equal(existsSync(join(fixture.dir, 'stray.txt')), true);
});
