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
const codexOutput = (callId: string) => JSON.stringify({ type: 'response_item', payload: { type: 'function_call_output', call_id: callId, output: 'Exit code: 0\nOutput: x' } });

test('digest renders a Codex rollout function_call items, anchored on the call line', () => {
  const path = fixture([
    JSON.stringify({ type: 'session_meta', payload: { cwd: '/x' } }),
    codexCall('k1', 'exec_command', { cmd: 'ls' }),
    codexOutput('k1'),
    codexCall('k2', 'apply_patch', {}),
  ]);

  assert.deepEqual(digest(path), ['2: exec_command ls -> ok', '4: apply_patch -> pending']);
});

const codexExec = (callId: string, cmds: string[]) =>
  JSON.stringify({
    type: 'response_item',
    payload: { type: 'custom_tool_call', name: 'exec', call_id: callId, input: cmds.map((cmd) => `await tools.exec_command({cmd: ${JSON.stringify(cmd)}, yield_time_ms: 1000});`).join('\n') },
  });
const chunk = (exitCode: number) => ({ type: 'input_text', text: JSON.stringify({ chunk_id: 'c', exit_code: exitCode }) });
const execOutput = (callId: string, items: unknown[]) =>
  JSON.stringify({ type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: callId, output: items } });

test('digest renders one entry per Codex exec_command with its exit code outcome', () => {
  const path = fixture([
    codexExec('e1', ['git status', 'false', 'ls']),
    execOutput('e1', [chunk(0), { type: 'input_text', text: 'note' }, chunk(1), chunk(0)]),
  ]);

  assert.deepEqual(digest(path), ['1: exec_command git status -> ok', '1: exec_command false -> failed', '1: exec_command ls -> ok']);
});

test('digest marks Codex commands unknown when output is missing, short of chunks or unparseable', () => {
  const path = fixture([
    codexExec('m1', ['a']),
    codexExec('m2', ['b', 'c']),
    execOutput('m2', [chunk(0)]),
    codexExec('m3', ['d']),
    execOutput('m3', [{ type: 'input_text', text: '{"chunk_id": oops' }]),
    codexCall('f1', 'exec_command', { cmd: 'e' }),
    JSON.stringify({ type: 'response_item', payload: { type: 'function_call_output', call_id: 'f1', output: 'no code here' } }),
    codexCall('f2', 'exec_command', { cmd: 'f' }),
    JSON.stringify({ type: 'response_item', payload: { type: 'function_call_output', call_id: 'f2', output: 'Exit code: 2' } }),
  ]);

  assert.deepEqual(digest(path), [
    '1: exec_command a -> unknown',
    '2: exec_command b -> unknown',
    '2: exec_command c -> unknown',
    '4: exec_command d -> unknown',
    '6: exec_command e -> unknown',
    '8: exec_command f -> failed',
  ]);
});

const execInput = (callId: string, input: string) =>
  JSON.stringify({ type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', call_id: callId, input } });
const nullChunk = { type: 'input_text', text: JSON.stringify({ chunk_id: 'c', exit_code: null }) };

test('digest gives every command unknown when chunks outnumber commands', () => {
  const path = fixture([codexExec('x1', ['a', 'b']), execOutput('x1', [chunk(0), chunk(1), chunk(0)])]);

  assert.deepEqual(digest(path), ['1: exec_command a -> unknown', '1: exec_command b -> unknown']);
});

test('digest gives every command unknown when a chunk yielded, even with equal counts', () => {
  const path = fixture([codexExec('y1', ['sleep 40; false', 'true']), execOutput('y1', [nullChunk, chunk(0)])]);

  assert.deepEqual(digest(path), ['1: exec_command sleep 40; false -> unknown', '1: exec_command true -> unknown']);
});

test('digest keeps the reproduction fixture unknown for null, 1, 0 chunks', () => {
  const path = fixture([codexExec('y2', ['sleep 40; false', 'true']), execOutput('y2', [nullChunk, chunk(1), chunk(0)])]);

  assert.deepEqual(digest(path), ['1: exec_command sleep 40; false -> unknown', '1: exec_command true -> unknown']);
});

test('digest leaves an unread entry for a template-literal command and marks all unknown', () => {
  const input = 'await tools.exec_command({cmd: "ls", yield_time_ms: 1});\nawait tools.exec_command({cmd: `echo ${x}`});';
  const path = fixture([execInput('z1', input), execOutput('z1', [chunk(0), chunk(0)])]);

  assert.deepEqual(digest(path), ['1: exec_command ls -> unknown', '1: exec_command (unread) -> unknown']);
});

test('digest reads the exit code from the parsed chunk, not from the output text', () => {
  const text = JSON.stringify({ chunk_id: 'c', exit_code: 1, output: 'exit_code: 0\nExit code: 0' });
  const path = fixture([codexExec('w1', ['x']), execOutput('w1', [{ type: 'input_text', text }])]);

  assert.deepEqual(digest(path), ['1: exec_command x -> failed']);
});

test('digest keeps outcomes when counts match and no chunk yielded', () => {
  const path = fixture([codexExec('v1', ['a', 'b', 'c']), execOutput('v1', [chunk(1), chunk(0), chunk(0)])]);

  assert.deepEqual(digest(path), ['1: exec_command a -> failed', '1: exec_command b -> ok', '1: exec_command c -> ok']);
});
