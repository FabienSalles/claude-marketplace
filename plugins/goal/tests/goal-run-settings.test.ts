import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { repo, run } from './support/goal-run-harness.ts';

test('R5: a run with several faulty settings exits 2 listing every one, before any session or run directory', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    GOAL_RUN_QUOTA_MAX_RETRIES: 'abc',
    GOAL_RUN_QUOTA_SLEEPP: '1',
    GOAL_RUN_BURST_CAP: '',
  });

  assert.equal(code, 2, output);
  assert.match(output, /GOAL_RUN_QUOTA_MAX_RETRIES.*"abc"/, output);
  assert.match(output, /GOAL_RUN_QUOTA_SLEEPP.*GOAL_RUN_QUOTA_SLEEP/, output);
  assert.match(output, /GOAL_RUN_BURST_CAP.*unset/, output);
  assert.doesNotMatch(output, /RUN writing/, output);
  assert.equal(existsSync(fixture.claudeLog) ? readFileSync(fixture.claudeLog, 'utf8') : '', '');
});

test('R2: an empty GOAL_GATE refuses the start', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], { GOAL_GATE: '' });

  assert.equal(code, 2, output);
  assert.match(output, /GOAL_GATE.*unset/, output);
});

test('R5: a run lists a faulty GOAL_CMD_TIMEOUT and GOAL_PROC_HEADROOM among its faults', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], { GOAL_CMD_TIMEOUT: '0', GOAL_PROC_HEADROOM: 'abc' });

  assert.equal(code, 2, output);
  assert.match(output, /GOAL_CMD_TIMEOUT.*"0"/, output);
  assert.match(output, /GOAL_PROC_HEADROOM.*"abc"/, output);
  assert.doesNotMatch(output, /RUN writing/, output);
});

test('R7: an accepted run writes one RUN settings line giving each setting, its effective value and its origin', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1'], { GOAL_CMD_TIMEOUT: '120', GOAL_RUN_BURST_CAP: '007' });
  const lines = output.split('\n').filter((line) => line.includes('RUN settings'));

  assert.equal(lines.length, 1, output);
  assert.match(lines[0] ?? '', /GOAL_CMD_TIMEOUT=120 \(environment\)/, output);
  assert.match(lines[0] ?? '', /GOAL_RUN_BURST_CAP=7 \(environment\)/, output);
  assert.match(lines[0] ?? '', /GOAL_RUN_QUOTA_SLEEP=1800 \(default\)/, output);
  assert.match(lines[0] ?? '', /GOAL_RUN_QUOTA_MAX_RETRIES=3 \(default\)/, output);
  assert.match(lines[0] ?? '', /GOAL_RUN_SHUTDOWN_BACKOFF=5 \(default\)/, output);
  assert.match(lines[0] ?? '', /GOAL_PROC_HEADROOM=400 \(default\)/, output);
  assert.match(lines[0] ?? '', /GOAL_RUN_SETTINGS_PATH=unset \(default\)/, output);
  assert.match(lines[0] ?? '', /GOAL_RUN_PROJECTS_ROOT=unset \(default\)/, output);
  assert.match(lines[0] ?? '', /GOAL_GATE=\S+ \(environment\)/, output);
});

test('R7: the RUN settings line follows the line naming the run records', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1']);

  assert.match(output, /RUN writing this run's records to [^\n]*\nRUN settings /, output);
});
