import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkSettings, settingValue } from '../src/core/settings.ts';

const NUMERIC = ['GOAL_RUN_QUOTA_MAX_RETRIES', 'GOAL_RUN_QUOTA_SLEEP', 'GOAL_RUN_SHUTDOWN_BACKOFF', 'GOAL_RUN_BURST_CAP', 'GOAL_CMD_TIMEOUT', 'GOAL_PROC_HEADROOM'];

const faultsOf = (env: Record<string, string>) => checkSettings(env).faults;

test('R1: 3 and 007 are accepted and read as numbers', () => {
  for (const name of NUMERIC) {
    assert.deepEqual(faultsOf({ [name]: '3' }), [], name);
    assert.equal(settingValue(name as 'GOAL_CMD_TIMEOUT', { [name]: '007' }), 7, name);
  }
});

test('R1: 0 is accepted where the range allows it', () => {
  for (const name of ['GOAL_RUN_QUOTA_MAX_RETRIES', 'GOAL_RUN_QUOTA_SLEEP', 'GOAL_RUN_SHUTDOWN_BACKOFF', 'GOAL_RUN_BURST_CAP']) {
    assert.deepEqual(faultsOf({ [name]: '0' }), [], name);
  }
});

test('R1: abc, 3.5, 1e3, a space, 3s, +3 and -1 are refused for every numeric setting', () => {
  for (const name of NUMERIC) {
    for (const value of ['abc', '3.5', '1e3', ' 3', '3s', '+3', '-1']) {
      const faults = faultsOf({ [name]: value });
      assert.equal(faults.length, 1, `${name}=${JSON.stringify(value)}`);
      assert.equal(faults[0]?.startsWith(`${name}="${value}"`), true, faults[0]);
    }
  }
});

test('R1: GOAL_CMD_TIMEOUT=0, GOAL_PROC_HEADROOM=0 and a duration above 604800 are refused', () => {
  assert.equal(faultsOf({ GOAL_CMD_TIMEOUT: '0' }).length, 1);
  assert.equal(faultsOf({ GOAL_PROC_HEADROOM: '0' }).length, 1);
  assert.deepEqual(faultsOf({ GOAL_CMD_TIMEOUT: '604800' }), []);

  for (const name of ['GOAL_RUN_QUOTA_SLEEP', 'GOAL_RUN_SHUTDOWN_BACKOFF', 'GOAL_RUN_BURST_CAP', 'GOAL_CMD_TIMEOUT']) {
    assert.equal(faultsOf({ [name]: '604801' }).length, 1, name);
  }

  assert.deepEqual(faultsOf({ GOAL_RUN_QUOTA_MAX_RETRIES: '99999999', GOAL_PROC_HEADROOM: '99999999' }), []);
});

test('R2: an empty value is refused for every setting, saying to unset the variable', () => {
  for (const name of [...NUMERIC, 'GOAL_GATE', 'GOAL_RUN_SETTINGS_PATH', 'GOAL_RUN_PROJECTS_ROOT']) {
    const faults = faultsOf({ [name]: '' });
    assert.equal(faults.length, 1, name);
    assert.match(String(faults[0]), /unset/, faults[0]);
  }
});

test('R3: a path or command setting is accepted whatever it names', () => {
  assert.deepEqual(faultsOf({ GOAL_GATE: 'no-such-command --x', GOAL_RUN_SETTINGS_PATH: '/nope', GOAL_RUN_PROJECTS_ROOT: '/nope' }), []);
});

test('R4: an unknown name under GOAL_RUN_, GOAL_CMD_ or GOAL_PROC_ is refused with the closest known name', () => {
  const faults = faultsOf({ GOAL_RUN_QUOTA_SLEPP: '1', GOAL_CMD_FOO: '1', GOAL_PROC_BAR: '1' });

  assert.equal(faults.length, 3);
  assert.match(faults.join('\n'), /GOAL_RUN_QUOTA_SLEPP.*GOAL_RUN_QUOTA_SLEEP/);
});

test('R4: the internal names and unrelated variables are not faults', () => {
  assert.deepEqual(faultsOf({ GOAL_RUN_JSONL: '/x', GOAL_RUN_TICKED: '1', PATH: '/bin', GOAL_OTHER: 'x' }), []);
});

test('R4: the retired GOAL_RUN_SHUTDOWN_MAX_RETRIES is refused, naming GOAL_RUN_QUOTA_MAX_RETRIES', () => {
  const faults = faultsOf({ GOAL_RUN_SHUTDOWN_MAX_RETRIES: '2' });

  assert.equal(faults.length, 1);
  assert.match(String(faults[0]), /GOAL_RUN_SHUTDOWN_MAX_RETRIES.*retired.*GOAL_RUN_QUOTA_MAX_RETRIES/, faults[0]);
});

test('R5: every fault is listed at once, with the name, the quoted value, the range and the default', () => {
  const { faults } = checkSettings({ GOAL_CMD_TIMEOUT: 'abc', GOAL_RUN_QUOTA_SLEEP: '', GOAL_RUN_BAD: '1' });

  assert.equal(faults.length, 3);
  assert.match(faults.join('\n'), /GOAL_CMD_TIMEOUT.*"abc".*1.*604800.*900/);
});

test('R8: a setting not in the environment takes its default, a set one reports its source', () => {
  const { effective } = checkSettings({ GOAL_RUN_BURST_CAP: '9' });

  assert.deepEqual(effective.GOAL_RUN_BURST_CAP, { value: 9, source: 'environment' });
  assert.deepEqual(effective.GOAL_RUN_QUOTA_SLEEP, { value: 1800, source: 'default' });
  assert.equal(settingValue('GOAL_RUN_QUOTA_MAX_RETRIES', {}), 3);
  assert.equal(settingValue('GOAL_RUN_SHUTDOWN_BACKOFF', {}), 5);
  assert.equal(settingValue('GOAL_RUN_BURST_CAP', {}), 8);
  assert.equal(settingValue('GOAL_CMD_TIMEOUT', {}), 900);
  assert.equal(settingValue('GOAL_PROC_HEADROOM', {}), 400);
  assert.equal(settingValue('GOAL_GATE', {}), undefined);
  assert.equal(settingValue('GOAL_GATE', { GOAL_GATE: 'x y' }), 'x y');
});
