import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyRefChanges, unnoted } from '../src/core/tamper.ts';

const carries = (shas: string[]) => (change: { after: string | undefined }) => change.after !== undefined && shas.includes(change.after);

test('a ref moved to a commit carrying this run\'s work pauses, whatever its name', () => {
  const changes = [
    { ref: 'refs/remotes/origin/another-name', after: 'mine' },
    { ref: 'refs/tags/v1', after: 'mine' },
    { ref: 'refs/stash', after: 'mine' },
  ];

  const { pausing, noted } = classifyRefChanges(changes, carries(['mine']));

  assert.deepEqual(pausing, ['refs/remotes/origin/another-name', 'refs/tags/v1', 'refs/stash']);
  assert.deepEqual(noted, []);
});

test('a ref moved to a commit carrying none of this run\'s work is noted, never a pause', () => {
  const { pausing, noted } = classifyRefChanges([{ ref: 'refs/remotes/origin/sibling', after: 'abcdef1234' }], carries(['mine']));

  assert.deepEqual(pausing, []);
  assert.equal(noted.length, 1);
  assert.match(noted[0]!.line, /^RUN refs\/remotes\/origin\/sibling moved to abcdef1, which is not this run's work/);
});

test('a deleted ref is noted, never a pause', () => {
  const { pausing, noted } = classifyRefChanges([{ ref: 'refs/heads/gone', after: undefined }], carries(['mine']));

  assert.deepEqual(pausing, []);
  assert.match(noted[0]!.line, /^RUN refs\/heads\/gone was deleted/);
});

test('a real pause is never hidden by notes: both come back from the same read', () => {
  const changes = [
    { ref: 'refs/remotes/origin/sibling', after: 'theirs' },
    { ref: 'refs/remotes/origin/feat', after: 'mine' },
  ];

  const { pausing, noted } = classifyRefChanges(changes, carries(['mine']));

  assert.deepEqual(pausing, ['refs/remotes/origin/feat']);
  assert.equal(noted.length, 1);
});

test('a note already written at an earlier read of the same run is not written again', () => {
  const seen = new Set<string>();
  const { noted } = classifyRefChanges([{ ref: 'refs/heads/gone', after: undefined }], carries([]));

  assert.equal(unnoted(noted, seen).length, 1);
  assert.equal(unnoted(noted, seen).length, 0);
});
