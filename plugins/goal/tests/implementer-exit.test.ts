import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PAUSED, repo, runInProcess } from './support/goal-run-harness.ts';

const implementerCalls = (claudeLog: string) =>
  (readFileSync(claudeLog, 'utf8').match(/^goal:goal-run-implementer$/gm) ?? []).length;

// R3 — a non-zero implementer exit names its cause, elapsed time and iteration in the log
test('a failed implementer logs its exit code, elapsed time and iteration', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_EXIT: '1' });

  assert.equal(code, PAUSED, output);
  assert.match(output, /RUN the implementer failed on iteration 1: exit code 1, after \d+s/, output);
});

// R3 — the third killed attempt stops the run, naming non-convergence
test('a killed implementer stops at the default bound of 3 attempts saying the iteration is not converging', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_EXIT: '143',
    GOAL_RUN_SHUTDOWN_BACKOFF: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /iteration 1 is not converging/, output);
  assert.equal(implementerCalls(fixture.claudeLog), 3, readFileSync(fixture.claudeLog, 'utf8'));
});
