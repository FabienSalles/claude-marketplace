import { test } from 'node:test';
import assert from 'node:assert/strict';

import { err, ok } from '../src/core/result.ts';

// P11 — the socle proves itself in-process: ok/err tag a value.

test('ok and err tag a value as a success or a failure', () => {
  assert.deepEqual(ok(1), { ok: true, value: 1 });
  assert.deepEqual(err('bad'), { ok: false, error: 'bad' });
});
