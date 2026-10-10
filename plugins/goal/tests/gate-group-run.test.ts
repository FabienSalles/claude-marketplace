import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';
import { bounded } from '../src/gate/bounded.ts';

const hang = (n: number): string => `sleep ${n}`;

const GROUP_RUN = resolve(import.meta.dirname, '..', 'src', 'gate', 'group-run.ts');

const run = (script: string, seconds = 30) =>
  spawnSync(process.execPath, [GROUP_RUN, String(seconds), script], { encoding: 'utf8' });

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const gone = (pid: number): boolean => {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (!alive(pid)) {
      return true;
    }
    spawnSync('sleep', ['0.05']);
  }

  return false;
};

const leftover = () => {
  const file = join(tmpDir('group-run'), 'pid');

  return { file, script: `${hang(301)} & echo $! > ${file}`, pid: () => Number(readFileSync(file, 'utf8')) };
};

test('R1: a command stopped on its clock leaves nothing, its orphaned grandchild included', () => {
  const left = leftover();
  const result = run(`${left.script}; ${hang(302)}`, 1);

  assert.notEqual(result.status, 0);
  assert.ok(gone(left.pid()), 'the grandchild survived the clock');
});

test('R2: a command that exits on its own leaves nothing, green or red', () => {
  const green = leftover();
  const red = leftover();

  run(green.script);
  run(`${red.script}; exit 3`);

  assert.ok(gone(green.pid()), 'a green command left a process');
  assert.ok(gone(red.pid()), 'a red command left a process');
});

test('R3: stopping leftovers never changes the verdict', () => {
  assert.equal(run(`${leftover().script}`).status, 0, 'a green command turned red');
  assert.equal(run(`${leftover().script}; exit 3`).status, 3, 'a red command lost its exit code');
  assert.equal(run(hang(303), 1).signal, 'SIGKILL', 'a command stopped on its clock stopped failing as before');
});

test('R4: every stop is reported with its cause, pid and command line', () => {
  const left = leftover();
  const after = run(left.script);

  assert.match(after.stderr, /left processes behind/);
  assert.match(after.stderr, new RegExp(`${left.pid()}\\b.*${hang(301)}`));

  const onClock = run(hang(304), 1);

  assert.match(onClock.stderr, /clock reached after 1 s/);
  assert.match(onClock.stderr, new RegExp(`\\d+ .*${hang(304)}`));

  const clean = run('echo hi');

  assert.equal(clean.stdout, 'hi\n');
  assert.equal(clean.stderr, '', 'a command that left nothing reported a stop');
});

test('R5: a process outside the command tree is still running afterwards', () => {
  const bystander = spawn('sleep', ['305'], { detached: true, stdio: 'ignore' });

  try {
    run(`${leftover().script}; ${hang(306)}`, 1);

    assert.ok(alive(bystander.pid as number), 'the gate stopped a process it did not start');
  } finally {
    bystander.kill('SIGKILL');
  }
});

test('bounded() routes the command through the group wrapper', () => {
  const left = leftover();
  const result = spawnSync(bounded(left.script), { shell: true, encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.ok(gone(left.pid()), 'a process survived bounded()');
  assert.match(result.stderr, /left processes behind/);
});
