import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const FIXTURE = resolve(import.meta.dirname, 'fixtures', 'verify-guarded.ts');

let repo = '';

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'verify-interrupt-')));
  const git = (...args: string[]) => spawnSync('git', args, { cwd: repo });
  git('init', '-q');
  git('config', 'user.email', 'a@b.c');
  git('config', 'user.name', 'n');
  writeFileSync(join(repo, 'tracked'), 'original\n');
  git('add', 'tracked');
  git('commit', '-q', '-m', 'init');
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  test(`${signal} sent to the command's own PID during the mutation step leaves the tree as found`, async () => {
    const child = spawn(process.execPath, [FIXTURE], { cwd: repo, env: { ...process.env, FIXTURE_MUTATE: '1' } });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    while (!out.includes('ready') && child.exitCode === null) {
      await new Promise((done) => setTimeout(done, 50));
    }
    assert.match(spawnSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).stdout, /tracked/);
    child.kill(signal);
    await new Promise((done) => child.on('close', done));
    assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).stdout, '');
    assert.equal(existsSync(join(repo, '.git', 'verify.lock')), false);
  });
}
