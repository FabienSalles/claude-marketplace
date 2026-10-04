import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { behindLine, freshBase, withDiffBase } from '../verify/base.ts';
import type { Check } from '../verify/ports.ts';

let sandbox = '';
let origin = '';
let clone = '';

const git = (cwd: string, ...args: string[]): string => {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  return result.stdout.trim();
};

const commit = (cwd: string, file: string): void => {
  writeFileSync(join(cwd, file), file);
  git(cwd, 'add', file);
  git(cwd, 'commit', '-qm', file);
};

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'verify-base-')));
  origin = join(sandbox, 'origin.git');
  clone = join(sandbox, 'clone');
  git(sandbox, 'init', '-q', '--bare', '-b', 'main', origin);
  git(sandbox, 'clone', '-q', origin, clone);
  git(clone, 'checkout', '-q', '-b', 'main');
  commit(clone, 'first');
  git(clone, 'push', '-q', 'origin', 'main');
  git(clone, 'checkout', '-q', '-b', 'feature');
  commit(clone, 'feature-work');

  const other = join(sandbox, 'other');
  git(sandbox, 'clone', '-q', origin, other);
  commit(other, 'upstream-one');
  commit(other, 'upstream-two');
  git(other, 'push', '-q', 'origin', 'main');
});

after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

test('the fetch moves the origin/main tracking ref and no local branch', () => {
  const before = { main: git(clone, 'rev-parse', 'main'), feature: git(clone, 'rev-parse', 'feature'), tracking: git(clone, 'rev-parse', 'origin/main') };
  const advanced = git(origin, 'rev-parse', 'main');
  assert.notEqual(before.tracking, advanced);

  freshBase(clone);

  assert.equal(git(clone, 'rev-parse', 'origin/main'), advanced);
  assert.equal(git(clone, 'rev-parse', 'main'), before.main);
  assert.equal(git(clone, 'rev-parse', 'feature'), before.feature);
  assert.equal(git(clone, 'branch', '--show-current'), 'feature');
});

test('the base is the merge base and the behind count is how far origin/main is ahead', () => {
  const result = freshBase(clone);
  assert.ok('base' in result);
  assert.equal(result.base, git(clone, 'merge-base', 'origin/main', 'HEAD'));
  assert.notEqual(result.base, git(clone, 'rev-parse', 'origin/main'));
  assert.equal(result.behind, 2);
  assert.equal(behindLine(result.behind), 'branch is 2 commits behind origin/main');
  assert.equal(behindLine(0), undefined);
});

test('the diff certification receives the merge base instead of origin/main', () => {
  const diff: Check = { name: 'diff', group: 'structure', requirements: [], command: ['node', 'certify.ts', '--diff', 'origin/main'] };
  const other: Check = { name: 'other', group: 'structure', requirements: [], command: ['node', 'other.ts', 'origin/main'] };
  const [changed, untouched] = withDiffBase([diff, other], 'abc123');
  assert.deepEqual(changed !== undefined && 'command' in changed ? changed.command : [], ['node', 'certify.ts', '--diff', 'abc123']);
  assert.equal(untouched, other);
});

test('a failed fetch fails the diff certification naming the network', () => {
  git(clone, 'remote', 'set-url', 'origin', join(sandbox, 'missing.git'));
  const result = freshBase(clone);
  assert.ok('failure' in result);
  assert.match(result.failure, /the network/);

  const diff: Check = { name: 'diff', group: 'structure', requirements: [], command: ['node', 'certify.ts', '--diff', 'origin/main'] };
  const [failing] = withDiffBase([diff], result);
  assert.ok(failing !== undefined && 'inline' in failing);
  assert.match(failing.inline(clone).join('\n'), /the network/);
});
