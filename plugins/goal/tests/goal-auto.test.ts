import { test } from 'node:test';
import assert from 'node:assert/strict';

import { commandOf, runWorkflow, type AgentCall } from './support/workflow-runtime.ts';

const PLAN = '.claude/plans/demo-spec.md';
const GATE = 'node /elsewhere/goal-gate.ts';

const ok = (output = '') => ({ exitCode: 0, output });

// Each test answers by command rather than by call order, so inserting a command in the run
// does not silently shift what a later assertion is looking at.
const answering = (table: Record<string, { exitCode: number; output: string }>) => (call: AgentCall) => {
  const command = commandOf(call);

  for (const [fragment, result] of Object.entries(table)) {
    if (command.includes(fragment)) {
      return result;
    }
  }

  return ok();
};

// R1 — the orchestration script runs under a fake runtime, so later slices are proved by
// behaviour instead of by grep.
test('a plan with no unchecked iteration is done, and the lock comes back', async () => {
  const { result, commands } = await runWorkflow(
    { plan: PLAN, gate: GATE },
    answering({ lock: ok(), [PLAN]: ok('') }),
  );

  assert.deepEqual(result, { status: 'done', plan: PLAN, landed: [], notAttempted: [] });
  assert.ok(
    commands.some((command) => command === `${GATE} unlock ${PLAN}`),
    `the lock was never released:\n${commands.join('\n')}`,
  );
  assert.ok(
    !commands.some((command) => command.includes(`${GATE} check`)),
    'a plan with nothing pending should not be checked',
  );
});

// The lock is not held on this path, so it is the one exit that must not release it.
test('a lock held elsewhere refuses, and releases nothing it never took', async () => {
  const { result, commands } = await runWorkflow(
    { plan: PLAN, gate: GATE },
    answering({ lock: { exitCode: 1, output: 'another run holds this plan' } }),
  );

  assert.deepEqual(result, {
    status: 'refused',
    plan: PLAN,
    landed: [],
    notAttempted: [],
    detail: 'another run holds this plan',
  });
  assert.ok(
    !commands.some((command) => command.includes('unlock')),
    `a lock that was never taken was released:\n${commands.join('\n')}`,
  );
});

// The runtime hands a workflow its args as a JSON string, not as the object the launch site
// wrote, so the normalisation is a behaviour a test has to hold.
test('the gate the caller names is the gate every command runs', async () => {
  const { commands } = await runWorkflow(
    JSON.stringify({ plan: PLAN, gate: GATE }),
    answering({ lock: ok(), [PLAN]: ok('') }),
  );

  assert.equal(commands[0], `${GATE} lock ${PLAN}`);
});

test('a run with no plan refuses to start at all', async () => {
  await assert.rejects(
    () => runWorkflow({ gate: GATE }, answering({})),
    /goal-auto needs args\.plan/,
  );
});
