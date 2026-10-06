import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { findHolders, lockPath, processes, takeLock } from '../verify/holder.ts';

const MARKER = 'fake-goal-run.ts';
const FIXTURE = resolve(import.meta.dirname, 'fixtures', 'verify-guarded.ts');
const DEADLINE_MS = 30_000;
const DEAD_PID = 2147483646;
const HERMETIC = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

type Checkout = { readonly root: string; readonly gitDir: string; readonly plan: string };

const checkout = (): Checkout => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'verify-holder-')));
  spawnSync('git', ['init', '-q'], { cwd: root, env: HERMETIC });
  mkdirSync(join(root, '.claude', 'plans'), { recursive: true });

  return { root, gitDir: join(root, '.git'), plan: join(root, '.claude', 'plans', 'demo-spec.md') };
};

const holding = (pid: number, ppid: number, command: string) => ({ pid, ppid, command });

test('a live goal run holding the checkout refuses verify, naming the plan', () => {
  const { root, gitDir, plan } = checkout();
  mkdirSync(`${plan}.run.lock`);

  try {
    const table = [holding(process.pid, 1, 'node verify'), holding(4242, 1, `node ${MARKER} ${plan}`)];
    const { refusal } = findHolders(root, gitDir, MARKER, table);

    assert.match(refusal ?? '', /refused: a goal run holds this checkout .*demo-spec\.md\.run\.lock/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the goal run's own call, a descendant of the process running it, is let through", () => {
  const { root, gitDir, plan } = checkout();
  mkdirSync(`${plan}.run.lock`);

  try {
    const table = [holding(4242, 1, `node ${MARKER} ${plan}`), holding(4243, 4242, 'npm run verify'), holding(process.pid, 4243, 'node verify')];

    assert.deepEqual(findHolders(root, gitDir, MARKER, table), { refusal: undefined, notes: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a lock with no goal run naming its plan is stale: it blocks nothing and is reported with its unlock command', () => {
  const { root, gitDir, plan } = checkout();
  mkdirSync(`${plan}.run.lock`);

  try {
    const { refusal, notes } = findHolders(root, gitDir, MARKER, [holding(process.pid, 1, 'node verify')]);

    assert.equal(refusal, undefined);
    assert.deepEqual(notes, [`stale goal run lock ${plan}.run.lock, release it with: goal-gate.ts unlock ${plan}`]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the verify lock is taken atomically: a second taker is refused while the first holder lives', () => {
  const { root, gitDir } = checkout();

  try {
    const release = takeLock(gitDir);

    assert.equal(typeof release, 'function');
    assert.equal(takeLock(gitDir), `refused: another verify run holds this checkout (pid ${process.pid})`);

    if (typeof release === 'function') {
      release();
    }

    assert.equal(existsSync(lockPath(gitDir)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a lock left by a dead PID is replaced', () => {
  const { root, gitDir } = checkout();
  writeFileSync(lockPath(gitDir), String(DEAD_PID));

  try {
    const release = takeLock(gitDir);

    assert.equal(typeof release, 'function');
    assert.equal(readFileSync(lockPath(gitDir), 'utf8'), String(process.pid));

    if (typeof release === 'function') {
      release();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a lock whose content is not a positive PID is stale and replaced', () => {
  for (const content of ['', '0', '-1', 'abc', '1.5']) {
    const { root, gitDir } = checkout();
    writeFileSync(lockPath(gitDir), content);

    try {
      const release = takeLock(gitDir);

      assert.equal(typeof release, 'function', JSON.stringify(content));

      if (typeof release === 'function') {
        release();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('the process table read from ps holds this process and its parent', () => {
  assert.ok(processes().some((proc) => proc.pid === process.pid && proc.ppid === process.ppid));
});

const started = async (child: ReturnType<typeof spawn>): Promise<{ readonly out: () => string; readonly exit: Promise<number | null> }> => {
  const exit = new Promise<number | null>((done) => child.on('close', done));
  let out = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    out += chunk.toString();
  });

  const deadline = Date.now() + DEADLINE_MS;

  while (!/started \d+/.test(out) && child.exitCode === null && Date.now() < deadline) {
    await delay(50);
  }

  return { out: () => out, exit };
};

const workerPid = (out: string): number => Number(/started (\d+)/.exec(out)?.[1]);

const WAITING = 'echo started $PPID; read -r line; echo finished';

test('a second run during another run is refused with the process doing the work named, and the first finishes undisturbed, leaving no lock', async () => {
  const { root, gitDir } = checkout();
  const env = { ...HERMETIC, FIXTURE_MARKER: MARKER };
  const first = spawn(process.execPath, [FIXTURE], { cwd: root, env: { ...env, FIXTURE_SCRIPT: WAITING } });

  try {
    const { out, exit } = await started(first);
    const worker = workerPid(out());

    assert.ok(worker > 0 && worker !== first.pid, out());

    const second = spawnSync(process.execPath, [FIXTURE], { cwd: root, encoding: 'utf8', env });

    assert.equal(second.status, 1);
    assert.match(second.stderr, new RegExp(`another verify run holds this checkout \\(pid ${String(worker)}\\)`));

    first.stdin?.end('go\n');

    assert.equal(await exit, 0);
    assert.match(out(), /finished/);
    assert.equal(existsSync(lockPath(gitDir)), false);
  } finally {
    first.kill('SIGKILL');
    rmSync(root, { recursive: true, force: true });
  }
});

test('a guard killed outright leaves the checkout held while the run it started still works', async () => {
  const { root } = checkout();
  const env = { ...HERMETIC, FIXTURE_MARKER: MARKER };
  const first = spawn(process.execPath, [FIXTURE], { cwd: root, env: { ...env, FIXTURE_SCRIPT: 'echo started $PPID; sleep 30' } });
  let worker = 0;

  try {
    const gone = new Promise((done) => first.on('exit', done));
    const { out } = await started(first);
    worker = workerPid(out());

    assert.ok(worker > 0, out());

    first.kill('SIGKILL');
    await gone;

    const second = spawnSync(process.execPath, [FIXTURE], { cwd: root, encoding: 'utf8', env });

    assert.equal(second.status, 1, second.stdout + second.stderr);
    assert.match(second.stderr, new RegExp(`another verify run holds this checkout \\(pid ${String(worker)}\\)`));
  } finally {
    if (worker > 0) {
      try {
        process.kill(-worker, 'SIGKILL');
      } catch {
        first.kill('SIGKILL');
      }
    }

    rmSync(root, { recursive: true, force: true });
  }
});
