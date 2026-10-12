import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { digest } from '../src/digest.ts';
import { tmpDir } from './support/tmp.ts';

const fixture = (lines: string[]): string => {
  const dir = tmpDir('digest-');
  const path = join(dir, 'session.jsonl');
  writeFileSync(path, `${lines.join('\n')}\n`);
  return path;
};

const userText = () => JSON.stringify({ type: 'user', message: { role: 'user', content: 'go' } });
const toolUse = (id: string, name: string, command: string) =>
  JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: 'thinking' }, { type: 'tool_use', id, name, input: { command } }] },
  });
const toolResult = (id: string, isError: boolean) =>
  JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: isError }] } });

// R9 — the digest hands the auditor one line per tool call, not the raw transcript: a session
// with two tool calls spread across seven JSONL lines (assistant text, tool_result echoes)
// reduces to exactly two lines.
test('digest returns one line per tool call, not one per transcript line', () => {
  const path = fixture([
    userText(),
    toolUse('t1', 'Bash', 'ls'),
    toolResult('t1', false),
    userText(),
    toolUse('t2', 'Bash', 'pwd'),
    toolResult('t2', false),
  ]);

  const lines = digest(path);

  assert.equal(lines.length, 2);
});

// R10 — the digest carries the result, not just the call: a command that failed twice in a row
// must show as an error both times, which is what the auditor's own "same command failed twice"
// finding depends on.
test('digest carries the is_error flag from the matching tool_result', () => {
  const path = fixture([
    toolUse('t1', 'Bash', 'false'),
    toolResult('t1', true),
    toolUse('t2', 'Bash', 'false'),
    toolResult('t2', true),
  ]);

  const lines = digest(path);

  assert.equal(lines.length, 2);
  assert.ok(lines[0]?.endsWith('-> error') === true);
  assert.ok(lines[1]?.endsWith('-> error') === true);
});

// R11 — the digest keeps the line index of the tool_use itself, so the auditor can reopen the
// transcript at that exact line to quote it, instead of scanning the file to relocate the call.
test('digest anchors each call to the JSONL line the tool_use sits on', () => {
  const path = fixture([
    userText(),
    toolUse('t1', 'Bash', 'ls'),
    toolResult('t1', false),
    userText(),
    userText(),
    toolUse('t2', 'Bash', 'pwd'),
    toolResult('t2', false),
  ]);

  const lines = digest(path);

  assert.equal(lines[0]?.split(':')[0], '2');
  assert.equal(lines[1]?.split(':')[0], '6');
});

// R10 hole — a tool_use with no matching tool_result anywhere in the transcript (the call was
// still in flight when the session ended) reads as pending, distinct from both ok and error.
test('digest marks a tool_use with no matching tool_result as pending, and a resolved one as ok', () => {
  const path = fixture([toolUse('t1', 'Bash', 'ls'), toolUse('t2', 'Bash', 'pwd'), toolResult('t2', false)]);

  const lines = digest(path);

  assert.equal(lines.length, 2);
  assert.ok(lines[0]?.endsWith('-> pending') === true, `expected pending, got: ${lines[0]}`);
  assert.ok(lines[1]?.endsWith('-> ok') === true, `expected ok, got: ${lines[1]}`);
});

const copilotStart = (id: string, toolName: string, args: Record<string, string>) =>
  JSON.stringify({ type: 'tool.execution_start', data: { toolCallId: id, toolName, arguments: args } });
const copilotComplete = (id: string, success: boolean) =>
  JSON.stringify({ type: 'tool.execution_complete', data: { toolCallId: id, success } });

test('digest renders a Copilot events.jsonl in the same line form, anchored on the start line', () => {
  const path = fixture([
    JSON.stringify({ type: 'session.start', data: { sessionId: 's' } }),
    copilotStart('c1', 'bash', { command: 'ls' }),
    copilotComplete('c1', true),
    copilotStart('c2', 'view', { path: '/tmp/a.ts' }),
    copilotComplete('c2', false),
    copilotStart('c3', 'skill', { skill: 'x' }),
  ]);

  assert.deepEqual(digest(path), ['2: bash ls -> ok', '4: view /tmp/a.ts -> error', '6: skill -> pending']);
});

const codexCall = (callId: string, name: string, args: Record<string, string>) =>
  JSON.stringify({ type: 'response_item', payload: { type: 'function_call', name, arguments: JSON.stringify(args), call_id: callId } });
const codexOutput = (callId: string) => JSON.stringify({ type: 'response_item', payload: { type: 'function_call_output', call_id: callId, output: 'x' } });

test('digest renders a Codex rollout function_call items, anchored on the call line', () => {
  const path = fixture([
    JSON.stringify({ type: 'session_meta', payload: { cwd: '/x' } }),
    codexCall('k1', 'exec_command', { cmd: 'ls' }),
    codexOutput('k1'),
    codexCall('k2', 'apply_patch', {}),
  ]);

  assert.deepEqual(digest(path), ['2: exec_command ls -> ok', '4: apply_patch -> pending']);
});
