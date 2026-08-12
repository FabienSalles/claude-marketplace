import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { extract, lastSessionId, parseEvents, projectDir } from '../src/core/events.ts';

// P3 — the one stream-json parser: a blank and a malformed line are dropped, a well-formed line
// keeps the 1-indexed position it sits on so a caller (digest) can anchor a finding back to it.
test('parseEvents drops blank and malformed lines, keeping the 1-indexed line number of the rest', () => {
  const raw = [JSON.stringify({ type: 'assistant' }), '', 'not json', JSON.stringify({ type: 'result' })].join('\n');

  const parsed = parseEvents(raw);

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], { line: 1, event: { type: 'assistant' } });
  assert.deepEqual(parsed[1], { line: 4, event: { type: 'result' } });
});

// P3 — the usage/model/compactions extraction narrate() and resultEnvelope() both depend on:
// usage from the terminal result event, model from an assistant event, one compaction counted.
test('extract reads usage, model and compactions out of a stream-json transcript', () => {
  const raw = [
    JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5', content: [] } }),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary' }),
    JSON.stringify({ type: 'result', usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 } }),
  ].join('\n');

  const extraction = extract(raw);

  assert.deepEqual(extraction.usage, { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 });
  assert.equal(extraction.model, 'claude-sonnet-5');
  assert.equal(extraction.compactions, 1);
});

// P3 — postmortem() reads the last session id any event of a dying attempt's output carried,
// rather than re-walking the stream itself.
test('lastSessionId returns the last session_id carried by the stream, ignoring lines without one', () => {
  const raw = [
    JSON.stringify({ type: 'assistant', session_id: 's1' }),
    JSON.stringify({ type: 'assistant' }),
    JSON.stringify({ type: 'result', session_id: 's2' }),
  ].join('\n');

  assert.equal(lastSessionId(raw), 's2');
});

// P3 — projectDir is the one place a cwd is turned into the directory Claude Code persists that
// project's transcripts under: every `/` and `.` becomes a `-`.
test('projectDir encodes both the slashes and the dots of a cwd', () => {
  const root = '/tmp/projects';

  assert.equal(projectDir('/Users/dev/dotfiles/.claude/x', root), join(root, '-Users-dev-dotfiles--claude-x'));
});
