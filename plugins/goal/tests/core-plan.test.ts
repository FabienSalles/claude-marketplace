import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makePlan } from '../src/core/plan.ts';

// P8/J3 — a Plan is a value that exists only when every construction rule holds: makePlan is
// the one place those rules are proven, in-process, with no process to exit and no filesystem
// to read.

const VALID = new Map([
  ['test_files', 'tests/a.test.ts'],
  ['impl_files', 'src/a.ts'],
  ['max_diff', '100'],
  ['commit_msg', 'feat(a): do a thing'],
  ['gate1', 'true'],
]);

test('a well-formed gate block builds an immutable Plan', () => {
  const result = makePlan('1', VALID);

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.testFiles, ['tests/a.test.ts']);
  assert.deepEqual(result.value.implFiles, ['src/a.ts']);
  assert.equal(result.value.maxDiff, 100);
  assert.equal(result.value.deliveryMode, 'no-bc-break');
  assert.throws(() => {
    (result.value as { maxDiff: number }).maxDiff = 0;
  });
});

test('a gate block declaring a key it may not set is refused', () => {
  const declared = new Map(VALID);
  declared.set('spec_hash', 'deadbeef');

  const result = makePlan('1', declared);

  assert.equal(result.ok, false);
  assert.match(result.error.reason, /declares a key it may not set/);
  assert.match(result.error.detail, /spec_hash/);
});

for (const missing of ['gate1', 'impl_files', 'commit_msg']) {
  test(`a gate block missing ${missing} is refused`, () => {
    const declared = new Map(VALID);
    declared.delete(missing);

    const result = makePlan('1', declared);

    assert.equal(result.ok, false);
    assert.match(result.error.detail, new RegExp(missing));
  });
}

test('impl_files covering its own test_files is refused, naming the fix', () => {
  const declared = new Map(VALID);
  declared.set('impl_files', 'src/a.ts tests/a.test.ts');

  const result = makePlan('1', declared);

  assert.equal(result.ok, false);
  assert.match(result.error.detail, /tests\/a\.test\.ts covers tests\/a\.test\.ts/);
  assert.match(result.error.detail, /Declare impl_files as: src\/a\.ts/);
});

test('an empty test_files is exempt from the overlap invariant', () => {
  const declared = new Map(VALID);
  declared.set('test_files', '');
  declared.set('impl_files', 'src/a.ts');

  const result = makePlan('1', declared);

  assert.equal(result.ok, true);
});

test('a max_diff that is not a number is refused', () => {
  const declared = new Map(VALID);
  declared.set('max_diff', 'about four hundred');

  const result = makePlan('1', declared);

  assert.equal(result.ok, false);
  assert.match(result.error.reason, /max_diff/);
});

test('a declared path carrying a glob character is refused', () => {
  const declared = new Map(VALID);
  declared.set('impl_files', 'src/*.ts');

  const result = makePlan('1', declared);

  assert.equal(result.ok, false);
  assert.match(result.error.detail, /Unusable: src\/\*\.ts/);
});

test('an impl_files declaring .env is refused before any tree exists', () => {
  const declared = new Map(VALID);
  declared.set('impl_files', 'src/a.ts .env');

  const result = makePlan('1', declared);

  assert.equal(result.ok, false);
  assert.match(result.error.reason, /must never be committed/);
  assert.match(result.error.detail, /\.env/);
});

test('.env.example declared in impl_files is not refused', () => {
  const declared = new Map(VALID);
  declared.set('impl_files', 'src/a.ts .env.example');

  const result = makePlan('1', declared);

  assert.equal(result.ok, true);
});

test('a secret named only on the Incidental header is refused too', () => {
  const result = makePlan('1', VALID, ['.env']);

  assert.equal(result.ok, false);
  assert.match(result.error.reason, /must never be committed/);
});
