import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');
const BOUNDED = resolve(import.meta.dirname, '..', 'src', 'gate', 'bounded.ts');

const gate = (args: string[], env: Record<string, string>) =>
  spawnSync(process.execPath, [GATE, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

test('R6: every verb refuses a faulty GOAL_CMD_TIMEOUT or GOAL_PROC_HEADROOM with exit 2, before running any command', () => {
  const dir = tmpDir('gate-settings');
  const marker = join(dir, 'ran');
  const plan = join(dir, 'plan.md');

  for (const verb of ['verify', 'commit', 'bite', 'check']) {
    for (const env of [{ GOAL_CMD_TIMEOUT: '0' }, { GOAL_CMD_TIMEOUT: '' }, { GOAL_PROC_HEADROOM: 'abc' }, { GOAL_CMD_FOO: '1' }, { GOAL_PROC_BAR: '1' }]) {
      const run = gate([verb, plan, '1'], env);
      const name = `${verb} ${JSON.stringify(env)}`;

      assert.equal(run.status, 2, `${name}: ${run.stdout}${run.stderr}`);
      assert.match(run.stderr + run.stdout, /faulty setting/, name);
    }
  }

  const dod = gate(['dod', plan], { GOAL_CMD_TIMEOUT: '0' });
  assert.equal(dod.status, 2, dod.stderr);
  assert.match(dod.stderr + dod.stdout, /GOAL_CMD_TIMEOUT="0"/);
  assert.equal(existsSync(marker), false);
});

test('R6: a run\'s own GOAL_RUN_* variables do not stop the gate', () => {
  const run = gate(['scan'], { GOAL_RUN_JSONL: '/x', GOAL_RUN_QUOTA_SLEEP: 'abc' });

  assert.notEqual(run.status, 2, run.stderr);
});

test('R8: bounded.ts reads both settings when a command is prepared, not at import', () => {
  const script = `
    import { spawnOptions, ceilingFor } from ${JSON.stringify(BOUNDED)};
    process.env.GOAL_CMD_TIMEOUT = '7';
    process.env.GOAL_PROC_HEADROOM = '11';
    process.stdout.write(spawnOptions().timeout + ' ' + ceilingFor(100, Infinity));
  `;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, GOAL_CMD_TIMEOUT: '5', GOAL_PROC_HEADROOM: '9' } });

  assert.equal(run.stdout, '7000 ulimit -u 111 || { echo "goal: cannot set the process ceiling (ulimit -u 111)" >&2; exit 1; }', run.stderr);
});
