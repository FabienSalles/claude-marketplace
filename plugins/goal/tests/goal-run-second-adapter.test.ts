import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, repo, runInProcess } from './support/goal-run-harness.ts';
import { testAgents } from './support/test-agents.ts';

const env = { GOAL_RUN_QUOTA_SLEEP: '1', GOAL_RUN_BURST_CAP: '1', FAKE_GATE_COMMITS: '1' };

// R10 — launch, report, failure class, a relaunch on quota, the gate and the commit, through an adapter that is not Claude's.
test('a test-only adapter carries an iteration through a quota relaunch to the gate and the commit', async () => {
  const fixture = repo();
  const { adapter, launched, postmortems } = testAgents(['exhausted', 'success']);

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.equal(code, 0, output);
  assert.deepEqual(launched.map((l) => l.role), ['implementer', 'implementer', 'lens', 'auditor']);
  assert.match(launched[0]?.brief ?? '', /write a\.txt/);
  assert.match(output, /RUN tool second-adapter wrote a\.txt/);
  assert.match(output, /RUN tokens stage=implementer input_tokens=3 output_tokens=4/);
  assert.match(output, /looks quota-exhausted/);
  assert.match(output, /second adapter diagnosis of attempt 1: exhausted/);
  assert.deepEqual(postmortems, [1]);
  assert.match(output, /iteration 1 landed, gate-verified/);
  assert.equal(existsSync(join(fixture.dir, 'claude-args.txt')), false);
  assert.match(readFileSync(join(fixture.dir, 'a.txt'), 'utf8'), /written/);
});

// R10 — a class the adapter reports and the runner does not recognise pauses the run.
test('a test-only adapter\'s unrecognised class pauses the run before any gate', async () => {
  const fixture = repo();
  const { adapter, launched } = testAgents(['unrecognised']);

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.equal(code, PAUSED, output);
  assert.equal(launched.length, 1);
  assert.match(output, /ended unrecognised:second adapter/);
  assert.doesNotMatch(output, /asking the gate for a verdict/);
});
