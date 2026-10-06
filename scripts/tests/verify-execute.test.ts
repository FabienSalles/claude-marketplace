import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { CHECKS } from '../verify/checks.ts';
import { execute } from '../verify/execute.ts';
import type { Check, CommandCheck } from '../verify/ports.ts';

const never = new AbortController().signal;

const DEADLINE_MS = 30_000;

const groupAlive = (pgid: number): boolean => {
  try {
    process.kill(-pgid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

test('a command that outlives its timeout is reported, and its whole process group is gone', async () => {
  const hung: Check = {
    name: 'hung',
    group: 'alpha',
    requirements: [],
    command: ['bash', '-c', 'echo "leader $$"; sleep 30 & sleep 30 & wait'],
    timeoutSeconds: 0.5,
  };

  const outcome = await execute(hung, tmpdir(), never);
  const pgid = Number(/leader (\d+)/.exec(outcome.detail)?.[1]);

  assert.equal(outcome.status, 'failed');
  assert.match(outcome.detail, /timed out after 0\.5 s$/);
  assert.ok(pgid > 0, outcome.detail);

  const deadline = Date.now() + DEADLINE_MS;

  while (groupAlive(pgid) && Date.now() < deadline) {
    await delay(50);
  }

  assert.equal(groupAlive(pgid), false);
});

test('a timed-out check leaves no process in its group, even one that ignores SIGTERM and no longer holds its output', async () => {
  const hung: Check = {
    name: 'hung',
    group: 'alpha',
    requirements: [],
    command: ['bash', '-c', 'echo "leader $$"; (trap "" TERM; exec sleep 300) >/dev/null 2>&1 & exec sleep 300'],
    timeoutSeconds: 0.5,
  };

  const outcome = await execute(hung, tmpdir(), never);
  const pgid = Number(/leader (\d+)/.exec(outcome.detail)?.[1]);

  try {
    assert.match(outcome.detail, /timed out after 0\.5 s$/);
    assert.ok(pgid > 0, outcome.detail);

    const deadline = Date.now() + DEADLINE_MS;

    while (groupAlive(pgid) && Date.now() < deadline) {
      await delay(50);
    }

    assert.equal(groupAlive(pgid), false);
  } finally {
    if (pgid > 0 && groupAlive(pgid)) {
      process.kill(-pgid, 'SIGKILL');
    }
  }
});

test('an aborted check that ignores the signal is killed after the grace, long before its own timeout', async () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'verify-execute-'));
  const pidFile = join(sandbox, 'leader');
  const deaf: Check = {
    name: 'deaf',
    group: 'alpha',
    requirements: [],
    command: ['bash', '-c', `trap "" TERM; echo $$ > "${pidFile}"; sleep 300 & wait`],
    timeoutSeconds: 120,
  };
  const abort = new AbortController();
  const start = Date.now();
  const running = execute(deaf, sandbox, abort.signal);
  const leader = (): number => (existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8')) : 0);

  try {
    while (leader() === 0 && Date.now() - start < DEADLINE_MS) {
      await delay(50);
    }

    abort.abort('SIGTERM');

    const outcome = await Promise.race([running, delay(DEADLINE_MS, undefined, { ref: false })]);

    assert.ok(outcome !== undefined, 'the aborted check never settled');
    assert.match(outcome.detail, /killed by SIGKILL$/);
    assert.equal(groupAlive(leader()), false);
  } finally {
    if (leader() > 0 && groupAlive(leader())) {
      process.kill(-leader(), 'SIGKILL');
    }

    await running;
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test('an inline check that throws is reported as failed with its message', async () => {
  const throwing: Check = {
    name: 'throws',
    group: 'alpha',
    requirements: [],
    inline: () => {
      throw new Error("Cannot find module 'yaml'");
    },
  };

  assert.deepEqual(await execute(throwing, tmpdir(), never), { status: 'failed', detail: "threw: Cannot find module 'yaml'" });
});

test('a command that fails silently still says why', async () => {
  const silent: Check = { name: 'silent', group: 'alpha', requirements: [], command: ['bash', '-c', 'exit 3'] };

  assert.deepEqual(await execute(silent, tmpdir(), never), { status: 'failed', detail: 'exit status 3' });
});

test('the node test checks refuse a run that passed no test and a skip with no reason, and accept a declared skip', async () => {
  const nodeTests = CHECKS.filter((check): check is CommandCheck => 'command' in check && check.command.includes('--test'));
  const printing = (template: CommandCheck, text: string): Check => ({ ...template, command: ['printf', text], requirements: [] });

  assert.equal(nodeTests.length, 2);

  for (const template of nodeTests) {
    assert.equal((await execute(printing(template, 'ℹ tests 12\nℹ pass 12\n'), tmpdir(), never)).status, 'passed', template.name);
    assert.equal((await execute(printing(template, 'ℹ tests 0\nℹ pass 0\n'), tmpdir(), never)).status, 'failed', template.name);
    assert.equal((await execute(printing(template, 'ℹ tests 3\nℹ pass 0\nℹ skipped 3\n'), tmpdir(), never)).status, 'failed', template.name);
    assert.equal(
      (await execute(printing(template, '  ﹣ a skip (0.1ms) # network unavailable\nℹ tests 3\nℹ pass 2\n'), tmpdir(), never)).status,
      'passed',
      template.name,
    );

    const undeclared = await execute(printing(template, '  ﹣ a skip (0.1ms) # SKIP\nℹ tests 3\nℹ pass 2\n'), tmpdir(), never);

    assert.equal(undeclared.status, 'failed', template.name);
    assert.match(undeclared.detail, /refused output: ﹣ a skip \(0\.1ms\) # SKIP$/, template.name);
  }
});

test('expected output is found through the colours a CI terminal adds', async () => {
  const coloured: Check = {
    name: 'coloured',
    group: 'alpha',
    requirements: [],
    command: ['printf', 'Total: \\033[32m12\\033[39m pass, 0 fail\\n'],
    expectOutput: /^Total: [1-9]\d* pass, 0 fail$/m,
  };

  assert.equal((await execute(coloured, tmpdir(), never)).status, 'passed');
});
