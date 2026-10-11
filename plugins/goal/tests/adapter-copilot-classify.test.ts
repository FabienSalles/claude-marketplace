import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { classifyTerminal } from '../src/adapters/copilot/classify.ts';

const fixture = (name: string): string => readFileSync(join(import.meta.dirname, 'fixtures', 'providers', 'copilot', '1.0.95', `${name}.jsonl`), 'utf8');
const errorEvent = (message: string): string => `${JSON.stringify({ type: 'session.error', data: { message } })}\n`;
const failed = (stdout: string, stderr = '', status = 1) => classifyTerminal({ status, signal: null, stdout, stderr });

// R11 — the exhausted fixture, the error event and stderr each read as a quota.
test('a quota text in the terminal error event or in stderr is exhausted', () => {
  assert.equal(failed(fixture('synthetic-exhausted')).class, 'exhausted');
  assert.equal(failed(errorEvent('out of credits')).class, 'exhausted');
  assert.equal(failed('', 'Error: 402 Payment Required').class, 'exhausted');
});

// R12 — a rate limit is a burst.
test('a rate-limit text is a burst', () => {
  assert.equal(failed(fixture('synthetic-burst')).class, 'burst');
  assert.equal(failed('', 'rate limit hit').class, 'burst');
  assert.equal(failed(errorEvent('Too many requests')).class, 'burst');
});

test('exhausted wins when both texts are present, and a bare number is not a 429', () => {
  assert.equal(failed(errorEvent('429 premium request quota used up')).class, 'exhausted');
  assert.equal(failed(errorEvent('error 14290 happened')).class, 'unrecognised');
});

// R13 — nothing recognisable, or a phrase only a tool result carried, is unrecognised.
test('an unknown failure is unrecognised, and a tool result mid-stream is never read', () => {
  assert.equal(failed(fixture('synthetic-unrecognised')).class, 'unrecognised');
  assert.equal(failed('').class, 'unrecognised');
  assert.equal(failed(fixture('synthetic-unrecognised')).quote, 'The model stopped answering.');
});

test('exit 143 or a signal is a signal, whatever the text says', () => {
  assert.equal(failed(fixture('synthetic-exhausted'), '', 143).class, 'signal');
  assert.equal(classifyTerminal({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }).class, 'signal');
});

test('a clean exit is a success', () => {
  assert.equal(classifyTerminal({ status: 0, signal: null, stdout: fixture('synthetic-exhausted').replace('"exitCode":1', '"exitCode":0'), stderr: '' }).class, 'success');
});

test('a non-zero result event fails a session whose process exited 0', () => {
  assert.equal(failed(fixture('synthetic-burst'), '', 0).class, 'burst');
});
