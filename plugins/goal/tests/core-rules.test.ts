import { test } from 'node:test';
import assert from 'node:assert/strict';

import { neverVersionedDecision } from '../scripts/core/rules/never.ts';
import { monotonicityDecision } from '../scripts/core/rules/ticked.ts';
import { budgetDecision, removalDecision } from '../scripts/core/rules/bounds.ts';
import { resolvabilityDecision, selectReplay } from '../scripts/core/rules/cross-iteration.ts';
import { determinismFailureDecision, gateFailureDecision } from '../scripts/core/rules/commands.ts';
import { ignoredDecision, leakDecision, shapeDecision } from '../scripts/core/rules/scope.ts';

// P2 — each gate rule proves itself in-process as a Result<_, Halt>, with no process to exit and
// no command to spawn: every case below is a plain value in, a plain value out.

test('never: a plan-declared .env is refused, a clean tree is not', () => {
  const refused = neverVersionedDecision(['src/a.ts', '.env'], 'Iteration 1');
  const clean = neverVersionedDecision(['src/a.ts', '.env.example'], 'Iteration 1');
  assert.equal(refused.ok, false);
  assert.match(refused.error.reason, /must never be committed/);
  assert.match(refused.error.detail, /\.env/);
  assert.equal(clean.ok, true);
});

test('ticked: an untick between check and commit halts naming what dropped', () => {
  const dropped = monotonicityDecision('3', '1,2', '1');
  const held = monotonicityDecision('3', '1,2', '1,2,3');
  const unlocked = monotonicityDecision('3', undefined, '');
  assert.equal(dropped.ok, false);
  assert.match(dropped.error.detail, /Missing: 2/);
  assert.equal(held.ok, true);
  assert.equal(unlocked.ok, true);
});

test('bounds: a max_diff that is not a number is refused, one that is respected passes', () => {
  const notANumber = budgetDecision('about four hundred', 10, ['a.ts'], '1');
  const overBudget = budgetDecision('10', 11, ['a.ts'], '1');
  const withinBudget = budgetDecision('10', 10, ['a.ts'], '1');
  const unbounded = budgetDecision('', 999, ['a.ts'], '1');
  assert.equal(notANumber.ok, false);
  assert.match(notANumber.error.reason, /not a number/);
  assert.equal(overBudget.ok, false);
  assert.match(overBudget.error.reason, /exceeds its declared diff budget/);
  assert.equal(withinBudget.ok, true);
  assert.equal(unbounded.ok, true);
});

test('bounds: a removal under no-bc-break halts, under allow-bc-break it does not', () => {
  const blocked = removalDecision('no-bc-break', ['D\told.ts'], '1');
  const allowed = removalDecision('allow-bc-break', ['D\told.ts'], '1');
  const nothingRemoved = removalDecision('no-bc-break', [], '1');
  assert.equal(blocked.ok, false);
  assert.match(blocked.error.detail, /old\.ts/);
  assert.equal(allowed.ok, true);
  assert.equal(nothingRemoved.ok, true);
});

test('cross-iteration: selectReplay skips a command already seen, keeps the first origin', () => {
  const { replay, origin } = selectReplay(new Set(['true']), [
    ['1', 'true'],
    ['2', 'echo a'],
    ['3', 'echo a'],
  ]);
  assert.deepEqual([...replay.values()], ['echo a']);
  assert.equal(origin.get('echo a'), '2');
});

test('cross-iteration: resolvabilityDecision halts on an unresolvable later declaration', () => {
  const blocked = resolvabilityDecision('1', ['iteration 2: src/b.ts (missing directory: src)']);
  const clear = resolvabilityDecision('1', []);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error.reason, /unresolvable/);
  assert.equal(clear.ok, true);
});

test('commands: gateFailureDecision names the regression wall origin when one is given', () => {
  const plain = gateFailureDecision('gate1', 'true', 1, 'boom', '2', undefined);
  const wall = gateFailureDecision('gate1', 'true', 1, 'boom', '2', '1');
  const passing = gateFailureDecision('gate1', 'true', 0, '', '2', undefined);
  assert.equal(plain.ok, false);
  assert.match(plain.error.reason, /Acceptance command gate1 failed/);
  assert.equal(wall.ok, false);
  assert.match(wall.error.reason, /iteration 1 passed on fails at iteration 2/);
  assert.equal(passing.ok, true);
});

test('commands: determinismFailureDecision halts on a replay that does not hold', () => {
  const flaked = determinismFailureDecision(2, 3, 'true', 1, 'boom', '1');
  const held = determinismFailureDecision(2, 3, 'true', 0, '', '1');
  assert.equal(flaked.ok, false);
  assert.match(flaked.error.reason, /does not pass 3 times in a row/);
  assert.equal(held.ok, true);
});

test('scope: shapeDecision refuses a glob, ignoredDecision refuses a gitignored path', () => {
  const glob = shapeDecision(['src/*.ts'], '1');
  const shaped = shapeDecision(['src/a.ts'], '1');
  const ignored = ignoredDecision(['dist/a.ts'], '1');
  const notIgnored = ignoredDecision([], '1');
  assert.equal(glob.ok, false);
  assert.match(glob.error.detail, /Unusable: src\/\*\.ts/);
  assert.equal(shaped.ok, true);
  assert.equal(ignored.ok, false);
  assert.match(ignored.error.detail, /dist\/a\.ts/);
  assert.equal(notIgnored.ok, true);
});

test('scope: leakDecision halts on a changed path the plan never declared', () => {
  const leaked = leakDecision(['src/b.ts'], '1', ['src/a.ts'], [], ' M src/a.ts\n?? src/b.ts\n');
  const declared = leakDecision([], '1', ['src/a.ts'], [], ' M src/a.ts\n');
  assert.equal(leaked.ok, false);
  assert.match(leaked.error.reason, /Scope leak on iteration 1/);
  assert.match(leaked.error.detail, /src\/b\.ts/);
  assert.equal(declared.ok, true);
});
