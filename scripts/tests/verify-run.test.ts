import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const FIXTURE_ROOT = resolve(import.meta.dirname, 'fixtures', 'verify-root.ts');

let repo = '';

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'verify-run-')));
  spawnSync('git', ['init', '-q'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

const run = (broken: string, ...groups: string[]) =>
  spawnSync('node', [FIXTURE_ROOT, ...groups], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, FIXTURE_BROKEN: broken },
  });

test('nothing broken: every check passed and the exit status is zero', () => {
  const result = run('');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /passed.*one/);
  assert.match(result.stdout, /passed.*two/);
  assert.match(result.stdout, /passed.*three/);
});

test('two checks broken at once give two failed lines in one run and a non-zero exit', () => {
  const result = run('one,three');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /failed.*one/);
  assert.match(result.stdout, /failed.*three/);
  assert.match(result.stdout, /passed.*two/);
});

test('a failing check shows its output', () => {
  assert.match(run('two').stdout, /boom/);
});

test('the report ends with one line per check then a verdict', () => {
  const lines = run('two').stdout.trimEnd().split('\n');
  const tail = lines.slice(-4);
  assert.match(tail[0] ?? '', /passed.*one/);
  assert.match(tail[1] ?? '', /failed.*two/);
  assert.match(tail[2] ?? '', /passed.*three/);
  assert.match(tail[3] ?? '', /red/i);
});

test('a named group runs only its checks', () => {
  const result = run('', 'beta');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /three/);
  assert.doesNotMatch(result.stdout, /one/);
});

test('an unknown group is refused', () => {
  assert.notEqual(run('', 'nonsense').status, 0);
});

test('dependencies are installed before judging', () => {
  rmSync(join(repo, 'node_modules'), { recursive: true, force: true });
  const result = run('');
  assert.equal(result.status, 0);
  assert.ok(existsSync(join(repo, 'node_modules', '.installed')));
});
