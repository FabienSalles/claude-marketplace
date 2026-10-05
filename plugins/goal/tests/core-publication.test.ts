import { test } from 'node:test';
import assert from 'node:assert/strict';

import { prDecision, pauseLine, remoteStatus } from '../src/core/publication.ts';

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
