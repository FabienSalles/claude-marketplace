import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { constants, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const GUARDED = resolve(import.meta.dirname, 'fixtures', 'verify-guarded.ts');
const ROOT = resolve(import.meta.dirname, 'fixtures', 'verify-root.ts');

const DEADLINE_MS = 30_000;

const HERMETIC = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

let repo = '';

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'verify-interrupt-')));
  const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, env: HERMETIC });
  git('init', '-q');
  git('config', 'user.email', 'a@b.c');
  git('config', 'user.name', 'n');
  writeFileSync(join(repo, 'tracked'), 'original\n');
  writeFileSync(join(repo, '.gitignore'), 'ready\ntrapped\nnode_modules/\n');
  git('add', 'tracked', '.gitignore');
  git('commit', '-q', '-m', 'init');
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

const until = async (condition: () => boolean): Promise<void> => {
  const deadline = Date.now() + DEADLINE_MS;

  while (!condition() && Date.now() < deadline) {
    await delay(50);
  }
};

const closed = (child: ChildProcess): Promise<number | null> =>
  new Promise((done) => {
    const timer = setTimeout(() => done(null), DEADLINE_MS + 10_000);

    child.on('close', (status) => {
      clearTimeout(timer);
      done(status);
    });
  });

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  test(`${signal} sent to the command's own PID during the mutation step reaches the check, which leaves the tree as found`, async () => {
    const child = spawn(process.execPath, [GUARDED], { cwd: repo, env: { ...HERMETIC, FIXTURE_MUTATE: '1' } });
    const exit = closed(child);
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });

    await until(() => out.includes('ready') || child.exitCode !== null);

    assert.match(out, /ready/);
    assert.match(spawnSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8', env: HERMETIC }).stdout, /tracked/);

    child.kill(signal);

    assert.equal(await exit, 143);
    assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8', env: HERMETIC }).stdout, '');
    assert.equal(existsSync(join(repo, '.git', 'verify.lock')), false);
  });
}

for (const signal of ['SIGTERM', 'SIGHUP'] as const) {
  test(`${signal} to verify while a check runs reaches the check in its own process group, and the run ends without a verdict`, async () => {
    rmSync(join(repo, 'ready'), { force: true });
    rmSync(join(repo, 'trapped'), { force: true });
    const child = spawn(process.execPath, [ROOT, 'delta'], { cwd: repo, env: { ...HERMETIC, FIXTURE_TRAP: '1' } });
    const exit = closed(child);
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });

    await until(() => existsSync(join(repo, 'ready')) || child.exitCode !== null);

    assert.ok(existsSync(join(repo, 'ready')), out);

    child.kill(signal);

    assert.equal(await exit, 128 + constants.signals[signal]);
    assert.ok(existsSync(join(repo, 'trapped')), out);
    assert.match(out, /^failed {2}trapped {2}/m);
    assert.match(out, new RegExp(`^interrupted by ${signal}: 0 check\\(s\\) not run, no verdict$`, 'm'));
  });
}
