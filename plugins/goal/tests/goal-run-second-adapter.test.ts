import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, repo, runInProcess } from './support/goal-run-harness.ts';
import { testAgents } from './support/test-agents.ts';
import { tmpDir } from './support/tmp.ts';

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
  assert.match(output, /^RUN tokens stage=implementer input_tokens=3 output_tokens=4 cache_creation_input_tokens=0 cache_read_input_tokens=0 compactions=0$/m);
  assert.doesNotMatch(output, /context_pct/);
  assert.match(output, /^RUN diagnostics stage=lens: second adapter lens complaint$/m);
  assert.doesNotMatch(output, /RUN diagnostics stage=auditor/);
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

const warningSettings = (): Record<string, string> => {
  const settingsPath = join(tmpDir('second-adapter-settings-'), 'settings.json');
  writeFileSync(settingsPath, JSON.stringify({ autoUpdatesChannel: 'latest' }));

  return { GOAL_RUN_SETTINGS_PATH: settingsPath };
};

// R8/R10 — the startup warning printed is the one the adapter supplies, whatever Claude's settings say.
test('a test-only adapter\'s own startup warning is printed and Claude\'s is not', async () => {
  const fixture = repo();
  const { adapter } = testAgents(['success']);

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], { ...env, ...warningSettings() }, { ...adapter, startupWarning: () => 'second adapter startup warning' });

  assert.equal(code, 0, output);
  assert.match(output, /^RUN preflight: warning — second adapter startup warning$/m);
  assert.doesNotMatch(output, /auto-updater/);
});

// R8 — an adapter with no startup warning prints none, even where Claude's settings would warn.
test('a test-only adapter without a startup warning prints no warning line', async () => {
  const fixture = repo();
  const { adapter } = testAgents(['success']);

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], { ...env, ...warningSettings() }, adapter);

  assert.equal(code, 0, output);
  assert.doesNotMatch(output, /RUN preflight: warning/);
});

// R8 — an empty warning is silence too.
test('a test-only adapter whose startup warning is empty prints no warning line', async () => {
  const fixture = repo();
  const { adapter } = testAgents(['success']);

  const { output } = await runInProcess(fixture, [fixture.plan, '1'], { ...env, ...warningSettings() }, { ...adapter, startupWarning: () => '' });

  assert.doesNotMatch(output, /RUN preflight: warning/);
});
