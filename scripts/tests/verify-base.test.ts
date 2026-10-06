import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { behindNotes } from '../verify/base.ts';

let sandbox = '';
let origin = '';
let clone = '';
let other = '';

const git = (cwd: string, ...args: string[]): string => {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  });
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
  other = join(sandbox, 'other');
  git(sandbox, 'init', '-q', '--bare', '-b', 'main', origin);
  git(sandbox, 'clone', '-q', origin, clone);
  git(clone, 'checkout', '-q', '-b', 'main');
  commit(clone, 'first');
  git(clone, 'push', '-q', 'origin', 'main');
  git(clone, 'checkout', '-q', '-b', 'feature');
  commit(clone, 'feature-work');
  git(sandbox, 'clone', '-q', origin, other);
});

after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

test('on CI nothing is fetched and no note is printed', () => {
  commit(other, 'upstream-on-ci');
  git(other, 'push', '-q', 'origin', 'main');
  const tracking = git(clone, 'rev-parse', 'origin/main');

  assert.deepEqual(behindNotes(clone, { GITHUB_ACTIONS: 'true' }), []);
  assert.equal(git(clone, 'rev-parse', 'origin/main'), tracking);
});

test('locally the fetch moves the origin/main tracking ref and no local branch', () => {
  const before = { main: git(clone, 'rev-parse', 'main'), feature: git(clone, 'rev-parse', 'feature') };
  const advanced = git(origin, 'rev-parse', 'main');

  behindNotes(clone, {});

  assert.equal(git(clone, 'rev-parse', 'origin/main'), advanced);
  assert.equal(git(clone, 'rev-parse', 'main'), before.main);
  assert.equal(git(clone, 'rev-parse', 'feature'), before.feature);
  assert.equal(git(clone, 'branch', '--show-current'), 'feature');
});

test('the note says how many commits origin/main has that the branch lacks, and nothing when there are none', () => {
  commit(other, 'upstream-two');
  git(other, 'push', '-q', 'origin', 'main');

  assert.deepEqual(behindNotes(clone, {}), ['branch is 2 commits behind origin/main']);

  git(clone, 'merge', '-q', '--no-edit', 'origin/main');

  assert.deepEqual(behindNotes(clone, {}), []);
});

test('a failed fetch is named in the note instead of failing a check', () => {
  git(clone, 'remote', 'set-url', 'origin', join(sandbox, 'missing.git'));

  const [note, ...rest] = behindNotes(clone, {});

  assert.match(note ?? '', /^not compared with origin\/main: .*missing\.git/s);
  assert.deepEqual(rest, []);
});

test('a git that cannot start is named in the note instead of failing the run', () => {
  const saved = process.env['PATH'] ?? '';
  process.env['PATH'] = join(sandbox, 'no-such-bin');

  try {
    assert.deepEqual(behindNotes(clone, {}), ['not compared with origin/main: spawnSync git ENOENT']);
  } finally {
    process.env['PATH'] = saved;
  }
});
