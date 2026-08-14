import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clock } from '../src/adapters/clock.ts';

// R5 — the real Clock adapter is the one seam production reads the wall clock and waits
// through: this is the single test that ever lets it touch the real clock, everywhere else
// substitutes it.
test('clock.now reports the real current time', () => {
  const before = Date.now();
  const now = clock.now();
  const after = Date.now();

  assert.ok(now >= before && now <= after, `expected ${before} <= ${now} <= ${after}`);
});

// R4/R7 — the same adapter that reads Date.now() is the one every wait spawns behind, so a
// caller passing a duration in seconds actually waits that long, not merely returns.
test('clock.sleepSeconds actually waits for roughly the requested duration', () => {
  const before = Date.now();
  clock.sleepSeconds(0.3);
  const elapsedMs = Date.now() - before;

  assert.ok(elapsedMs >= 250, `expected at least ~300ms of real sleep, got ${elapsedMs}ms`);
});
