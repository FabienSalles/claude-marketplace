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
