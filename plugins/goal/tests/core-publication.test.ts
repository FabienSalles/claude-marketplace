import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deliveredList, onRemoteOf, prDecision, pauseLine, remoteStatus } from '../src/core/publication.ts';

test('remoteStatus names, for each landed iteration, whether it is on the remote', () => {
  assert.equal(remoteStatus(['1', '2', '3'], ['1', '2']), 'on the remote: 1, 2; local only: 3');
});

test('remoteStatus says none when nothing is on the remote, and none when nothing is local', () => {
  assert.equal(remoteStatus(['1'], []), 'on the remote: none; local only: 1');
  assert.equal(remoteStatus(['1'], ['1']), 'on the remote: 1; local only: none');
});

test('remoteStatus never asserts publication for an iteration that was not pushed', () => {
  assert.doesNotMatch(remoteStatus(['1'], []), /on the remote: 1/);
});

test('pauseLine carries the reason on one line and ends with the remote status', () => {
  const line = pauseLine('The push failed:\nfatal: unreachable\n', ['1'], []);

  assert.ok(!line.includes('\n'), line);
  assert.match(line, /fatal: unreachable/);
  assert.ok(line.endsWith('on the remote: none; local only: 1'), line);
});

test('a pull request found open is edited', () => {
  assert.deepEqual(prDecision(0, '{"number":4,"state":"OPEN"}'), { kind: 'edit' });
});

test('a branch without a pull request gets one created', () => {
  assert.deepEqual(prDecision(1, ''), { kind: 'create' });
  assert.deepEqual(prDecision(0, 'not json'), { kind: 'create' });
});

test('a closed or merged pull request pauses, naming its number and state', () => {
  for (const state of ['CLOSED', 'MERGED', 'MERGE_QUEUE']) {
    const decision = prDecision(0, `{"number":9,"state":"${state}"}`);

    assert.equal(decision.kind, 'pause');
    assert.match(decision.kind === 'pause' ? decision.reason : '', new RegExp(`#9.*${state}`));
  }
});

const entries = [
  { number: '1', goal: 'first goal', subject: 'feat: one' },
  { number: '2', goal: 'second goal', subject: 'feat: two' },
  { number: '3', goal: 'third goal', subject: 'feat: three' },
];

const log = [
  { sha: '3333333333', subject: 'feat: three' },
  { sha: '2222222222', subject: 'feat: two' },
  { sha: '1111111111', subject: 'feat: one' },
  { sha: '0000000000', subject: 'init' },
];

test('the delivered list numbers every ticked iteration in plan order with the short sha of its commit', () => {
  assert.equal(deliveredList(entries, log), '1. first goal 1111111\n2. second goal 2222222\n3. third goal 3333333');
});

test('the delivered list keeps an iteration whose commit subject is not in the log, without a sha', () => {
  assert.equal(deliveredList(entries.slice(0, 2), log.slice(1)), '1. first goal 1111111\n2. second goal 2222222');
  assert.equal(deliveredList(entries, log.slice(2)), '1. first goal 1111111\n2. second goal\n3. third goal');
});

test('an iteration is on the remote when its commit is among the remote branch commits', () => {
  assert.deepEqual(onRemoteOf(entries, log, ['1111111111', '0000000000']), ['1']);
  assert.deepEqual(onRemoteOf(entries, log, []), []);
  assert.deepEqual(onRemoteOf(entries, log, ['3333333333', '2222222222', '1111111111']), ['1', '2', '3']);
});
