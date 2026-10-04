import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const FIXTURE_ROOT = resolve(import.meta.dirname, 'fixtures', 'verify-root.ts');

let repo = '';

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'verify-honesty-')));
  spawnSync('git', ['init', '-q'], { cwd: repo });
  writeFileSync(join(repo, '.gitignore'), '.worktrees/\nnode_modules/\n');
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

const run = (env: Record<string, string>, path?: string) =>
  spawnSync(process.execPath, [FIXTURE_ROOT], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: '', ...env, ...(path === undefined ? {} : { PATH: path }) },
  });

test('a green local run ends by listing exactly the gaps it cannot reproduce', () => {
  const result = run({ FIXTURE_HONEST: '1' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const gaps = result.stdout.trimEnd().split('\n').filter((line) => line.startsWith('not reproduced on this Mac'));
  assert.equal(gaps.length, 3);
  assert.match(gaps[0] ?? '', /ubuntu runner/);
  assert.match(gaps[1] ?? '', /latest Claude Code CI installs/);
  assert.match(gaps[2] ?? '', /marketplace re-sync/);
  assert.match(result.stdout.trimEnd().split('\n').at(-1) ?? '', /marketplace re-sync/);
});

test('in CI the report lists no gap', () => {
  const result = run({ FIXTURE_HONEST: '1', GITHUB_ACTIONS: 'true' });
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /not reproduced on this Mac/);
});

test('with claude off the PATH its check fails naming the claude CLI while the others still report', () => {
  const bin = join(repo, 'bin');
  mkdirSync(bin);
  for (const program of ['node', 'git']) {
    const found = spawnSync('which', [program], { encoding: 'utf8' }).stdout.trim();
    symlinkSync(found, join(bin, program));
  }
  const result = run({ FIXTURE_CLAUDE: '1' }, bin);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /failed.*needs claude/);
  assert.match(result.stdout, /missing: the claude CLI/);
  assert.match(result.stdout, /passed.*one/);
  assert.match(result.stdout, /passed.*three/);
});

test('an untracked file is named as uncommitted work and a broken skill under an ignored .worktrees changes nothing', () => {
  const broken = join(repo, '.worktrees', 'x', 'skills', 'broken');
  mkdirSync(broken, { recursive: true });
  writeFileSync(join(broken, 'SKILL.md'), '---\nname: [unclosed\n');
  const clean = run({});
  assert.doesNotMatch(clean.stdout, /uncommitted work.*worktrees/);
  assert.doesNotMatch(clean.stdout, /worktrees/);
  assert.equal(clean.status, 0);

  writeFileSync(join(repo, 'stray.txt'), 'x');
  const dirty = run({});
  assert.equal(dirty.status, 0);
  assert.match(dirty.stdout, /uncommitted work.*stray\.txt/);
  assert.doesNotMatch(dirty.stdout, /worktrees/);
  rmSync(join(repo, 'stray.txt'));
});

test('skills discovery counts the same skills with and without a broken skill under ignored .worktrees', (t) => {
  const online = spawnSync(process.execPath, ['-e', "require('node:dns').lookup('registry.npmjs.org',(e)=>process.exit(e===null?0:1))"]);
  if (online.status !== 0) {
    t.skip('network unavailable');
    return;
  }
  const withBroken = run({ FIXTURE_DISCOVERY: '1' });
  rmSync(join(repo, '.worktrees'), { recursive: true, force: true });
  const without = run({ FIXTURE_DISCOVERY: '1' });
  assert.equal(withBroken.status, without.status, withBroken.stdout + without.stdout);
});
