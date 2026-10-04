import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { signalWhenHeld, type Held } from './support/await-state.ts';
import { tmpDir } from './support/tmp.ts';

const WAIT = resolve(import.meta.dirname, 'support', 'await-marker.sh');
const SHORT = 1000;

const child = (dir: string, body: string) => ['-c', body, 'sh', dir, WAIT];

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

const TRAP = `trap 'if [ -e "$1/marker" ]; then echo after > "$1/signalled"; else echo before > "$1/signalled"; fi; exit 0' TERM`;
const HOLD = `sh "$2" "$1/never" 30000 & wait $!`;

test('R1 a child that reaches its state only later is never signalled before its marker', async () => {
  const dir = tmpDir('goal-await-state-');

  const result = await signalWhenHeld(
    'sh',
    child(dir, `${TRAP}\nsh "$2" "$1/never" 300 || true\ntouch "$1/marker"\n${HOLD}`),
    {},
    { state: 'the late state', markers: [join(dir, 'marker')], signal: 'SIGTERM', deadlineMs: 10_000 },
  );

  assert.equal(result.code, 0);
  assert.equal(readFileSync(join(dir, 'signalled'), 'utf8').trim(), 'after');
});

test('R2 a marker never written rejects naming the state, and no signal is sent', async () => {
  const dir = tmpDir('goal-await-state-');
  let held: Held | undefined;

  await assert.rejects(
    signalWhenHeld('sh', child(dir, `${TRAP}\n${HOLD}`), {}, {
      state: 'the lock held',
      markers: [join(dir, 'marker')],
      signal: 'SIGTERM',
      deadlineMs: SHORT,
    }),
    (error: Held) => {
      held = error;

      return /the lock held never reached/.test(error.message);
    },
  );

  assert.ok(!existsSync(join(dir, 'signalled')), 'a signal was sent anyway');
  assert.ok(!alive(held!.pid), 'the child outlived the failure');
});

test('R3 a child exiting at start rejects well inside the deadline with its exit code and output', async () => {
  const dir = tmpDir('goal-await-state-');
  const startedAt = Date.now();
  let held: Held | undefined;

  await assert.rejects(
    signalWhenHeld('sh', child(dir, 'echo boom; exit 3'), {}, {
      state: 'the lock held',
      markers: [join(dir, 'marker')],
      signal: 'SIGTERM',
      deadlineMs: 20_000,
    }),
    (error: Held) => {
      held = error;

      return /code 3/.test(error.message) && /boom/.test(error.message);
    },
  );

  assert.ok(Date.now() - startedAt < 10_000, 'the failure waited for the deadline');
  assert.ok(!alive(held!.pid), 'the child outlived the failure');
});

test('R4 a child leaving its state before the signal rejects as having left it', async () => {
  const dir = tmpDir('goal-await-state-');
  const marker = join(dir, 'marker');
  let held: Held | undefined;

  await assert.rejects(
    signalWhenHeld('sh', child(dir, `${TRAP}\ntouch "$1/marker"\n${HOLD}`), {}, {
      state: 'the lock held',
      markers: [marker],
      signal: 'SIGTERM',
      deadlineMs: SHORT,
      beforeSignal: () => rmSync(marker),
    }),
    (error: Held) => {
      held = error;

      return /left the lock held before the signal/.test(error.message);
    },
  );

  assert.ok(!existsSync(join(dir, 'signalled')), 'a signal was sent anyway');
  assert.ok(!alive(held!.pid), 'the child outlived the failure');
});

test('R5 a child ignoring the signal rejects instead of hanging', async () => {
  const dir = tmpDir('goal-await-state-');
  let held: Held | undefined;

  await assert.rejects(
    signalWhenHeld('sh', child(dir, `trap '' TERM\ntouch "$1/marker"\n${HOLD}`), {}, {
      state: 'the lock held',
      markers: [join(dir, 'marker')],
      signal: 'SIGTERM',
      deadlineMs: SHORT,
    }),
    (error: Held) => {
      held = error;

      return /did not exit after SIGTERM/.test(error.message);
    },
  );

  assert.ok(!alive(held!.pid), 'the child outlived the failure');
});
