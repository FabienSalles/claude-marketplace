// R1 — every gate verb's happy `OK:` line, the `HALT` envelope, and the value of guard_hash are
// pinned against a reference capture: this suite is what turns rewriting the envelope, or
// widening what the scanner scans, into a red test instead of a silent drift. mutate.sh is the
// proof this net actually bites — see its own header.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  captured,
  fixture,
  okLines,
  runGate,
  runGuard,
  scannerArgv,
  stageImplementation,
} from './support/gate-capture.ts';

test('check answers a fixed OK line, plan_hash and ticked set', () => {
  const fx = fixture();
  const { code, output } = runGate(fx, 'check', fx.plan, '1');

  assert.equal(code, 0, output);
  assert.equal(output, captured('check'));
});

test('verify answers the bite check\'s and its own OK line, in order', () => {
  const fx = fixture();
  stageImplementation(fx);
  const { code, output } = runGate(fx, 'verify', fx.plan, '1');

  assert.equal(code, 0, output);
  assert.equal(okLines(output), captured('verify'));
});

test('bite alone answers the one OK line proving gate1 fails without the implementation', () => {
  const fx = fixture();
  stageImplementation(fx);
  const { code, output } = runGate(fx, 'bite', fx.plan, '1');

  assert.equal(code, 0, output);
  assert.equal(okLines(output), captured('bite'));
});

test('lock answers a fixed OK line', () => {
  const fx = fixture();
  const { code, output } = runGate(fx, 'lock', fx.plan);

  assert.equal(code, 0, output);
  assert.equal(output, captured('lock'));
});

test('unlock answers a fixed OK line', () => {
  const fx = fixture();
  const { code, output } = runGate(fx, 'unlock', fx.plan);

  assert.equal(code, 0, output);
  assert.equal(output, captured('unlock'));
});

test('dod answers a fixed OK line', () => {
  const fx = fixture();
  const { code, output } = runGate(fx, 'dod', fx.plan);

  assert.equal(code, 0, output);
  assert.equal(output, captured('dod'));
});

// R1 (scanner scope) — the scanner is invoked with `git . --redact`, never `dir`: the fake
// scanner records its own argv, so a mutation widening the scan to the working directory turns
// this comparison red rather than passing on a fake blind to the difference.
test('scan answers a fixed OK line, invoking the scanner on git history, not the working tree', () => {
  const fx = fixture();
  const { code, output } = runGate(fx, 'scan');

  assert.equal(code, 0, output);
  assert.equal(output, captured('scan'));
  assert.equal(scannerArgv(fx), captured('scan-argv'));
});

test('commit answers the bite check\'s and its own OK line, in order', () => {
  const fx = fixture();
  stageImplementation(fx);
  const { code, output } = runGate(fx, 'commit', fx.plan, '1');

  assert.equal(code, 0, output);
  assert.equal(okLines(output), captured('commit'));
});

// R1 (guard_hash) — plan-guard.ts's own value for this fixed plan, and the OK line it answers
// once a locked hash matches it.
test('plan-guard prints a fixed guard_hash for the fixed plan', () => {
  const fx = fixture();
  const { code, output } = runGuard(fx, fx.plan);

  assert.equal(code, 0, output);
  assert.equal(output, captured('guard'));
});

test('plan-guard answers a fixed OK line once the locked hash matches guard_hash', () => {
  const fx = fixture();
  const hash = captured('guard').trim().split('=')[1]!;
  const { code, output } = runGuard(fx, fx.plan, hash);

  assert.equal(code, 0, output);
  assert.equal(output, captured('guard-ok'));
});

// R1 (envelope) — a deterministic, non-excluded HALT (no iteration 2 in the plan) pins the
// `HALT\n\nREASON: ...\n\nDETAIL:\n...\n` envelope haltText() renders, and the exact refusal
// prose plan.ts writes for it.
test('a deterministic HALT answers the fixed envelope and refusal prose', () => {
  const fx = fixture();
  const { code, output } = runGate(fx, 'check', fx.plan, '2');

  assert.equal(code, 1, output);
  assert.equal(output, captured('halt-envelope'));
});

// R1 (guard_hash) — plan-guard.ts's own HALT, carrying both the locked value handed to it and
// guard_hash's own value for the fixed plan side by side.
test('plan-guard HALTs with the envelope, naming the locked value beside guard_hash', () => {
  const fx = fixture();
  const bogus = '0'.repeat(64);
  const { code, output } = runGuard(fx, fx.plan, bogus);

  assert.equal(code, 1, output);
  assert.equal(output, captured('halt-guard'));
});
