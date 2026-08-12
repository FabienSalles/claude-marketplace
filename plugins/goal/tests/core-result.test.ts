import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chain, err, map, ok, pipe } from '../src/core/result.ts';

// P11 — the socle proves itself in-process: ok/err tag a value, map/chain thread a pipeline
// through a success and short-circuit on a failure, pipe composes plain functions.

test('ok and err tag a value as a success or a failure', () => {
  assert.deepEqual(ok(1), { ok: true, value: 1 });
  assert.deepEqual(err('bad'), { ok: false, error: 'bad' });
});

test('map transforms a success and leaves a failure untouched', () => {
  assert.deepEqual(map(ok(2), (n) => n * 2), ok(4));
  assert.deepEqual(map(err('bad'), (n: number) => n * 2), err('bad'));
});

test('chain threads a success into the next step and short-circuits on a failure', () => {
  const halve = (n: number) => (n % 2 === 0 ? ok(n / 2) : err('odd'));

  assert.deepEqual(chain(ok(4), halve), ok(2));
  assert.deepEqual(chain(ok(3), halve), err('odd'));
  assert.deepEqual(chain(err('already bad'), halve), err('already bad'));
});

test('pipe composes plain functions left to right', () => {
  const result = pipe(
    2,
    (n: number) => n + 1,
    (n: number) => n * 3,
  );

  assert.equal(result, 9);
});
