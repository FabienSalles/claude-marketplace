import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { logOf, repo, run } from './support/goal-run-harness.ts';

// R17 — a run that says nothing is indistinguishable from one that jammed, which is the whole
// reason the developer ends up watching it. Every line declares which of the three it is.
test('every log line says whether the run is advancing or stopped', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  const lines = output.split('\n').filter((line) => line.trim() !== '');

  assert.ok(lines.length > 0, 'the run said nothing at all');

  for (const line of lines) {
    assert.match(line, /^(RUN|WAIT|STOP) /, `a line declares no state:\n${line}`);
  }

  assert.match(output, /^STOP /m, 'the run never said it was over');
});

test('it writes the same account to a log file beside the plan', () => {
  const fixture = repo();

  run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  const log = logOf(fixture);
  assert.ok(existsSync(log), 'no log file was written');
  assert.match(readFileSync(log, 'utf8'), /^STOP /m);
});
