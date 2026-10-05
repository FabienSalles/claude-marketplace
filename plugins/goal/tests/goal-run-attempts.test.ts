import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, repo, run, runInProcess } from './support/goal-run-harness.ts';

const implementerCalls = (claudeLog: string) =>
  existsSync(claudeLog) ? (readFileSync(claudeLog, 'utf8').match(/^goal:goal-run-implementer$/gm) ?? []).length : 0;

const stopLine = (output: string) => output.split('\n').find((line) => line.startsWith('STOP')) ?? '';

test('R5: an implementer commit on a quota-shaped attempt stops the run at once, before any wait or relaunch', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_FINAL_ERROR: 'Claude AI usage limit reached|1735689600',
    FAKE_CLAUDE_EXIT: '1',
    GOAL_RUN_QUOTA_SLEEP: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.match(stopLine(output), /committed on its own/, output);
  assert.match(stopLine(output), /HEAD moved from [0-9a-f]{40} to [0-9a-f]{40}/, output);
  assert.match(stopLine(output), /review that commit before relaunching/, output);
  assert.doesNotMatch(output, /sleeping|backing off/, output);
  assert.equal(implementerCalls(fixture.claudeLog), 1, readFileSync(fixture.claudeLog, 'utf8'));
});

test('R5: an implementer commit on a killed attempt wins over the signal class', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_EXIT: '143',
    GOAL_RUN_SHUTDOWN_BACKOFF: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.match(stopLine(output), /committed on its own/, output);
  assert.doesNotMatch(output, /backing off/, output);
  assert.equal(implementerCalls(fixture.claudeLog), 1, readFileSync(fixture.claudeLog, 'utf8'));
});

test('R7: one ceiling bounds the attempts whatever their class, and the pause lists each attempt with its class', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_EXIT: '143',
    GOAL_RUN_QUOTA_MAX_RETRIES: '2',
    GOAL_RUN_SHUTDOWN_BACKOFF: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.equal(implementerCalls(fixture.claudeLog), 2, readFileSync(fixture.claudeLog, 'utf8'));
  assert.match(stopLine(output), /attempt 1: signal.*attempt 2: signal/, output);
});

test('R7: a pause claims no cause no attempt showed', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_EXIT: '143',
    GOAL_RUN_SHUTDOWN_BACKOFF: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.equal(implementerCalls(fixture.claudeLog), 3, readFileSync(fixture.claudeLog, 'utf8'));
  assert.match(stopLine(output), /attempt 1: signal.*attempt 2: signal.*attempt 3: signal/, output);
  assert.doesNotMatch(stopLine(output), /exhausted|burst/i, output);
});

test('R7: a quota that never reopens lists every attempt as exhausted', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_QUOTA_UNTIL: '999',
    FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
    GOAL_RUN_QUOTA_SLEEP: '0',
    GOAL_RUN_QUOTA_MAX_RETRIES: '2',
  });

  assert.equal(code, PAUSED, output);
  assert.match(stopLine(output), /attempt 1: exhausted.*attempt 2: exhausted/, output);
});

test('R8: GOAL_RUN_SHUTDOWN_MAX_RETRIES set refuses the run before any iteration, naming GOAL_RUN_QUOTA_MAX_RETRIES', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], { GOAL_RUN_SHUTDOWN_MAX_RETRIES: '2' });

  assert.equal(code, 2, output);
  assert.match(output, /GOAL_RUN_SHUTDOWN_MAX_RETRIES/, output);
  assert.match(output, /GOAL_RUN_QUOTA_MAX_RETRIES/, output);
  assert.equal(implementerCalls(fixture.claudeLog), 0);
});
