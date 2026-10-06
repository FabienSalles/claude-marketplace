import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { jsonlOf, repo, run, runDirOf } from './support/goal-run-harness.ts';

const MIB = 1024 * 1024;

// R2 — no output size kills a session.
test('an implementer writing several MiB runs to its end, its result read and its output kept', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_OUTPUT_BYTES: String(4 * MIB),
  });

  assert.equal(code, 0, output);
  assert.match(output, /RUN stage=implementer duration_ms=\d+ exit=0$/m);
  assert.match(output, /RUN tokens stage=implementer input_tokens=10 /);
  assert.ok(statSync(join(runDirOf(fixture), 'implementer-attempt-1.out')).size >= 4 * MIB);
});

// R4 — every attempt's output is kept.
test('each attempt keeps its own stdout in the run directory', () => {
  const fixture = repo();

  run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_QUOTA_UNTIL: '1',
    FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
    GOAL_RUN_QUOTA_SLEEP: '0',
  });

  const dir = runDirOf(fixture);

  assert.match(readFileSync(join(dir, 'implementer-attempt-1.out'), 'utf8'), /usage limit reached/);
  assert.match(readFileSync(join(dir, 'implementer-attempt-2.out'), 'utf8'), /"type":"result"/);
});

// R9 — every stage line says how the session ended.
test('an implementer killed by a signal reads as such on its stage line and in the jsonl', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_KILL_SIGNAL: 'KILL',
    FAKE_CLAUDE_STDERR_NOISE: 'dying words',
    GOAL_RUN_SHUTDOWN_BACKOFF: '0',
  });

  assert.match(output, /RUN stage=implementer duration_ms=\d+ exit=137 signal=SIGKILL$/m);
  assert.match(readFileSync(jsonlOf(fixture), 'utf8'), /exit=137 signal=SIGKILL/);
  assert.match(readFileSync(join(runDirOf(fixture), 'implementer-attempt-1.err'), 'utf8'), /dying words/);
});

test('a clean stage line carries no signal or error', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.doesNotMatch(output, /stage=\w+ duration_ms=\d+ exit=\d+ (signal|error)=/);
});

test('the auditor writes its output to the run directory, whatever its size', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_OUTPUT_BYTES: String(3 * MIB),
  });

  assert.equal(code, 0, output);
  assert.match(output, /RUN stage=auditor duration_ms=\d+ exit=0$/m);
  assert.ok(readdirSync(runDirOf(fixture)).includes('auditor.out'));
  assert.ok(statSync(join(runDirOf(fixture), 'auditor.out')).size >= 3 * MIB);
});

test('a lens killed by a signal reports its own status with the signal', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_KILL_SIGNAL: 'KILL',
    FAKE_CLAUDE_KILL_ON: 'goal-run-lens',
  });

  assert.match(output, /RUN stage=lens duration_ms=\d+ exit=137 signal=SIGKILL$/m);
});
