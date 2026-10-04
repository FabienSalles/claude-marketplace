import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const MARKER = 'fake-goal-run.ts';
const FIXTURE = resolve(import.meta.dirname, 'fixtures', 'verify-guarded.ts');

let repo = '';
let plan = '';
const spawned: ChildProcess[] = [];

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'verify-holder-')));
  spawnSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.claude', 'plans'), { recursive: true });
  plan = join(repo, '.claude', 'plans', 'demo-spec.md');
});

after(() => {
  for (const child of spawned) {
    child.kill('SIGKILL');
  }
  rmSync(repo, { recursive: true, force: true });
});

const run = (env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [FIXTURE], { cwd: repo, encoding: 'utf8', env: { ...process.env, FIXTURE_MARKER: MARKER, ...env } });

const fakeGoalRun = (): ChildProcess => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => undefined, 60000)', MARKER, plan], { stdio: 'ignore' });
  spawned.push(child);

  return child;
};

test('a live goal run holding the checkout refuses the command before any check, naming the plan', () => {
  mkdirSync(`${plan}.run.lock`);
  const child = fakeGoalRun();
  const result = run();
  child.kill('SIGKILL');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /demo-spec\.md/);
  assert.doesNotMatch(result.stdout, /ran/);
});

test('the goal run own call, a descendant of a process running goal-run.ts, is let through', () => {
  const ancestor = spawnSync(
    process.execPath,
    ['-e', `const r = require('node:child_process').spawnSync(process.execPath, [${JSON.stringify(FIXTURE)}], { cwd: ${JSON.stringify(repo)}, encoding: 'utf8', env: { ...process.env, FIXTURE_MARKER: ${JSON.stringify(MARKER)} } }); process.stdout.write(r.stdout); process.exit(r.status)`, MARKER, plan],
    { encoding: 'utf8' },
  );
  assert.equal(ancestor.status, 0, ancestor.stdout + ancestor.stderr);
  assert.match(ancestor.stdout, /ran/);
});

test('a lock with no goal-run.ts process naming its plan is stale: it blocks nothing and is reported with its unlock command', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ran/);
  assert.match(result.stderr, /goal-gate\.ts unlock .*demo-spec\.md/);
  rmSync(`${plan}.run.lock`, { recursive: true });
});

test('a second run during another run is refused with the first holder named, and the first finishes undisturbed', async () => {
  const first = spawn(process.execPath, [FIXTURE], {
    cwd: repo,
    env: { ...process.env, FIXTURE_MARKER: MARKER, FIXTURE_SCRIPT: 'echo started; sleep 2; echo finished' },
  });
  spawned.push(first);
  let out = '';
  first.stdout.on('data', (chunk: Buffer) => {
    out += chunk.toString();
  });
  while (!out.includes('started') && first.exitCode === null) {
    await new Promise((done) => setTimeout(done, 50));
  }
  const second = run();
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, new RegExp(String(first.pid)));
  await new Promise((done) => first.on('close', done));
  assert.match(out, /finished/);
  assert.equal(first.exitCode, 0);
});

test('a lock left by a killed run holds a dead PID and blocks nothing; a finished run leaves none', () => {
  const lock = join(repo, '.git', 'verify.lock');
  writeFileSync(lock, '2147483646');
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ran/);
  assert.equal(existsSync(lock), false);
});
