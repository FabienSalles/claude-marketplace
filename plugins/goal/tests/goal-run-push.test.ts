import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { HASH, PAUSED, PLAN, repo, run } from './support/goal-run-harness.ts';

// goal-run.ts's own exit code for a gate refusal (see its header comment), distinct from PAUSED.
const HALTED = 1;

const PLAN_PR = PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n');

// A gate that commits iteration 1 (mirroring FAKE_GATE_COMMITS) but refuses iteration 2 outright,
// the shape a HALT needs after the first iteration has already landed and blocked its push.
const gateThatHaltsSecondIteration = (fixture: ReturnType<typeof repo>): string => {
  const path = join(fixture.bin, 'gate-halts-second');

  writeFileSync(
    path,
    `#!/bin/sh
case "$1" in
  check)  printf 'OK\\nplan_hash=${HASH}\\n'; exit 0 ;;
  lock)   mkdir "$2.run.lock" 2>/dev/null; exit 0 ;;
  unlock) rm -rf "$2.run.lock"; exit 0 ;;
  scan)   exit \${FAKE_GATE_SCAN_EXIT:-0} ;;
  dod)    exit 0 ;;
  commit)
    if [ "$3" = "2" ]; then
      exit 1
    fi
    git add -A >/dev/null 2>&1
    git commit -qm "iteration $3" >/dev/null 2>&1
    exit 0
    ;;
esac
exit 2
`,
  );
  chmodSync(path, 0o755);

  return path;
};

// A `claude` that lands the first call (implementer for iteration 1) and fails non-quota-shaped
// on the second (iteration 2), the shape a PAUSED implementer failure needs after the first
// iteration has already landed and blocked its push.
const claudeThatFailsSecondCall = (fixture: ReturnType<typeof repo>, writes: string): void => {
  writeFileSync(
    join(fixture.bin, 'claude'),
    `#!/bin/sh
n=$(cat ${fixture.dir}/claude-calls 2>/dev/null || echo 0)
echo $((n + 1)) > ${fixture.dir}/claude-calls
if [ "$n" -ge 1 ]; then
  echo 'boom, a non-quota failure' >&2
  exit 9
fi
printf 'written\\n' >> ${writes}
case "$*" in
  *"stream-json"*)
    printf '{"type":"result","session_id":"fake-session-id"}\\n'
    ;;
esac
exit 0
`,
  );
  chmodSync(join(fixture.bin, 'claude'), 0o755);
};

// R6 (I2) — a push from this checkout moves the local remote-tracking ref, which is exactly the
// side effect `git for-each-ref refs/remotes` catches. Only the gate may publish, so the run has
// to halt and name the ref rather than let a self-published implementer through unnoticed.
test('the implementer pushing halts the run, naming the moved ref', () => {
  const fixture = repo({ remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_PUSHES: '1',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /pushed/i, output);
  assert.match(output, /refs\/remotes\/origin\//, output);
});

// R6 (I8) — the snapshot is taken once, before the quota-retry loop, same as the git-directory
// guard: a push on attempt 1 must still be caught after a quota failure sends the same iteration
// to attempt 2, so a fresh snapshot per attempt (which would use attempt 1's push as its own
// baseline) is not an option.
test('a push on the first attempt survives a quota failure and retry', () => {
  const fixture = repo({ remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_QUOTA_UNTIL: '1',
    FAKE_CLAUDE_QUOTA_COUNTER: `${fixture.dir}/quota-counter`,
    FAKE_CLAUDE_PUSHES: '1',
    GOAL_RUN_QUOTA_SLEEP: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /pushed/i, output);
});

// A blocked publication is named in the run's own terminal line, sourced from the publisher's
// own `blocked` state, not left in an earlier RUN line a developer skimming straight to the
// bottom of the log would never reach.
test("a blocked publication is named in the run's terminal line", () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_SCAN_EXIT: '1',
  });

  assert.equal(code, 0, output);
  const lastLine = output.trim().split('\n').pop() ?? '';
  assert.match(lastLine, /^STOP/, output);
  assert.match(lastLine, /blocked/i, output);
});

// A halt that comes after an earlier push already stuck names both: the gate's own refusal and
// the publication block the run has been carrying since iteration 1, not just whichever the
// developer happens to scroll to first.
test('a halt after an earlier publication block names it too', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const gate = gateThatHaltsSecondIteration(fixture);

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_SCAN_EXIT: '1',
    GOAL_GATE: gate,
  });

  assert.equal(code, HALTED, output);
  const lastLine = output.trim().split('\n').pop() ?? '';
  assert.match(lastLine, /^STOP/, output);
  assert.match(lastLine, /refused by the gate/i, output);
  assert.match(lastLine, /blocked/i, output);
});

// A pause behaves the same as a halt: the implementer failing on iteration 2 still names the
// publication block iteration 1 already left stuck, since a relaunch needs both facts at once.
test('a pause after an earlier publication block names it too', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const writes = join(fixture.dir, 'a.txt');
  claudeThatFailsSecondCall(fixture, writes);

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_CLAUDE_WRITES: writes,
    FAKE_GATE_SCAN_EXIT: '1',
    FAKE_GATE_COMMITS: '1',
  });

  assert.equal(code, PAUSED, output);
  const lastLine = output.trim().split('\n').pop() ?? '';
  assert.match(lastLine, /^STOP/, output);
  assert.match(lastLine, /exited 9/, output);
  assert.match(lastLine, /blocked/i, output);
});

// The false-positive side: an ordinary run that never pushes still lands past this check, even
// with a real remote configured.
test('an ordinary run that never pushes is not stopped by this check', () => {
  const fixture = repo({ remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: `${fixture.dir}/a.txt`,
  });

  assert.equal(code, 0, output);
  assert.doesNotMatch(output, /pushed/i, output);
});
