import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { HASH, repo, run } from './support/goal-run-harness.ts';

// goal-run.ts's own exit code for a gate refusal (see its header comment), distinct from PAUSED.
const HALTED = 1;

// A gate that answers `check`/`lock`/`unlock` the way the fixture's own fake-gate does, but
// splits its `commit` verdict across stdout and stderr, the shape `iteration.ts` has to
// concatenate back together before it reaches the log.
const customGate = (fixture: ReturnType<typeof repo>, exitCode: number): string => {
  const path = join(fixture.bin, 'custom-gate');

  writeFileSync(
    path,
    `#!/bin/sh
case "$1" in
  check)  printf 'OK\\nplan_hash=${HASH}\\n'; exit 0 ;;
  lock)   mkdir "$2.run.lock" 2>/dev/null; exit 0 ;;
  unlock) rm -rf "$2.run.lock"; exit 0 ;;
  commit)
    printf 'REASON: the gate refused it\\n'
    printf 'DETAIL: from stderr\\n' >&2
    exit ${exitCode}
    ;;
  dod) exit 0 ;;
esac
exit 2
`,
  );
  chmodSync(path, 0o755);

  return path;
};

// R7 (I5) — the gate's verdict on a refusal is recorded in the run log rather than printed, and
// the STOP line names the log so the evidence stays findable.
test('a gate refusal records the verdict in the run log and the STOP line names it', () => {
  const fixture = repo();
  const gate = customGate(fixture, 1);

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_GATE: gate,
  });

  assert.equal(code, HALTED, output);

  const logPath = `${fixture.plan}.run.log`;

  assert.match(output, new RegExp(logPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), output);
  assert.doesNotMatch(output, /REASON: the gate refused it/, output);
  assert.doesNotMatch(output, /DETAIL: from stderr/, output);

  const log = readFileSync(logPath, 'utf8');

  assert.match(log, /REASON: the gate refused it/, log);
  assert.match(log, /DETAIL: from stderr/, log);
  // stdout precedes stderr in the recorded text, the order `implemented.stdout` then
  // `implemented.stderr` preserves.
  assert.ok(log.indexOf('REASON: the gate refused it') < log.indexOf('DETAIL: from stderr'), log);
});

// R7 (I5) — recorded once, not duplicated: the failure path used to log the verdict on write and
// print it again on the failure branch.
test('a gate refusal is recorded exactly once in the log', () => {
  const fixture = repo();
  const gate = customGate(fixture, 1);

  run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_GATE: gate,
  });

  const log = readFileSync(`${fixture.plan}.run.log`, 'utf8');
  const occurrences = log.split('REASON: the gate refused it').length - 1;

  assert.equal(occurrences, 1, log);
});

// R7 (I5) — the pass path is recorded too: `record()` runs on every verdict, not only refusals.
test('a gate pass also records the verdict in the run log', () => {
  const fixture = repo();
  const gate = customGate(fixture, 0);

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_GATE: gate,
  });

  assert.equal(code, 0, output);
  assert.doesNotMatch(output, /REASON: the gate refused it/, output);

  const log = readFileSync(`${fixture.plan}.run.log`, 'utf8');

  assert.match(log, /REASON: the gate refused it/, log);
  assert.match(log, /DETAIL: from stderr/, log);
});
