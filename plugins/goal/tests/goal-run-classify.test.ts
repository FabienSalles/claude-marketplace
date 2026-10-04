import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, repo, runInProcess } from './support/goal-run-harness.ts';
import { classifyTerminal } from '../src/run/quota.ts';

const result = (text: string, isError = true) => `${JSON.stringify({ type: 'result', is_error: isError, result: text })}\n`;
const midStream = `${JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: 'the usage limit and HTTP 429 are documented here' }] } })}\n`;

// R3 — only the terminal outcome is read: a file mentioning `usage limit` mid-session is not a quota.
test('a quota phrase read mid-session does not classify a failed session', () => {
  assert.equal(classifyTerminal({ status: 1, stdout: `${midStream}${result('boom')}`, stderr: '' }).class, 'unrecognised');
});

// R3 — the final result and stderr carry the classes.
test('the final result and stderr classify exhausted, burst and signal', () => {
  assert.equal(classifyTerminal({ status: 1, stdout: result('Claude AI usage limit reached|1735689600'), stderr: '' }).class, 'exhausted');
  assert.equal(classifyTerminal({ status: 1, stdout: result('API Error: 429 Too Many Requests'), stderr: '' }).class, 'burst');
  assert.equal(classifyTerminal({ status: 1, stdout: '', stderr: 'rate_limit_error' }).class, 'burst');
  assert.equal(classifyTerminal({ status: 143, stdout: result('usage limit'), stderr: '' }).class, 'signal');
  assert.equal(classifyTerminal({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' }).class, 'signal');
});

// R3 — issue-47's real final events (a network cut after a read mentioning a quota) are unrecognised, quoting the outcome.
test('the issue-47 network cut classifies unrecognised and quotes the final result', () => {
  const outcome = classifyTerminal({ status: 1, stdout: readFileSync(join(import.meta.dirname, 'fixtures', 'issue-47-terminal.jsonl'), 'utf8'), stderr: '' });

  assert.equal(outcome.class, 'unrecognised');
  assert.match(outcome.quote, /ECONNRESET/);
});

// R4 — exit 0 with an error final result is a failure, classified.
test('an exit-0 session whose final result is an error is classified, not reported as wrote nothing', () => {
  assert.equal(classifyTerminal({ status: 0, stdout: result('usage limit reached'), stderr: '' }).class, 'exhausted');
  assert.equal(classifyTerminal({ status: 0, stdout: result('all good', false), stderr: '' }).failed, false);
});

// R4 — an unrecognised exit-0 error pauses quoting the final result.
test('an exit-0 session ending in an unrecognised error pauses quoting its final result', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_FINAL_ERROR: 'API Error: Unable to connect to API (ECONNRESET)',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /ECONNRESET/, output);
  assert.doesNotMatch(output, /wrote nothing/i, output);
});

// R3 — a session that read a quota phrase and then failed unrecognised is not slept on.
test('a mid-session quota phrase is not slept on when the session ends unrecognised', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_EXIT: '1',
    FAKE_CLAUDE_MIDSTREAM: 'the usage limit is documented here',
    GOAL_RUN_QUOTA_SLEEP: '999999',
  });

  assert.equal(code, PAUSED, output);
  assert.doesNotMatch(output, /quota sleep continues/i, output);
});
