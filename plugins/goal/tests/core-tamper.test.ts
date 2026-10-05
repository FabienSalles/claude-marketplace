import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyConfigChanges, classifyRefChanges, detectTamper, unnoted } from '../src/core/tamper.ts';

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

const config = (before: string[], after: string[]) => classifyConfigChanges(before, after);

test('harmless config entries are noted, never a pause', () => {
  const { pausing, noted } = config(
    ['core.bare=false'],
    ['core.bare=false', 'branch.sib.remote=origin', 'branch.sib.merge=refs/heads/sib', 'remote.origin.fetch=+refs/heads/*:refs/remotes/origin/*'],
  );

  assert.deepEqual(pausing, []);
  assert.equal(noted.length, 3);
  assert.match(noted[0]!.line, /^RUN config entry branch\.sib\.remote was added: noted, not a pause/);
});

test('a config key that executes code or redirects a push pauses, added, changed or removed', () => {
  assert.deepEqual(config([], ['core.hooksPath=/tmp/h']).pausing, ['core.hooksPath']);
  assert.deepEqual(config([], ['alias.x=!sh']).pausing, ['alias.x']);
  assert.deepEqual(config(['remote.origin.url=a'], ['remote.origin.url=b']).pausing, ['remote.origin.url']);
  assert.deepEqual(config(['remote.origin.pushurl=a'], []).pausing, ['remote.origin.pushurl']);
  assert.deepEqual(config([], ['remote.origin.push=x']).pausing, ['remote.origin.push']);
  assert.deepEqual(config([], ['credential.helper=!x']).pausing, ['credential.helper']);
});

test('a config that did not change in its entries leaves nothing to say', () => {
  const { pausing, noted } = config(['core.bare=false'], ['core.bare=false']);

  assert.deepEqual(pausing, []);
  assert.deepEqual(noted, []);
});

test('a git-directory change that is not attributable pauses with neutral wording', () => {
  const none = { head: 'a', gitDirChanges: [], remoteRefChanges: [], otherRefChanges: [] };
  const result = detectTamper(none, { ...none, sharedGitDirChanges: ['/r/.git/hooks/pre-commit'] });

  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /the git directory changed under the run, possibly from another worktree: \/r\/\.git\/hooks\/pre-commit/);
  assert.doesNotMatch(result.ok ? '' : result.error, /the implementer changed/);
});

test('an attributable git-directory change keeps the implementer wording', () => {
  const none = { head: 'a', gitDirChanges: [], remoteRefChanges: [], otherRefChanges: [] };
  const result = detectTamper(none, { ...none, gitDirChanges: ['/r/.git/worktrees/w/config.worktree'] });

  assert.match(result.ok ? '' : result.error, /the implementer changed the git directory/);
});
