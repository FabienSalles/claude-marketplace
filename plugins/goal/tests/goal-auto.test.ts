import { test } from 'node:test';
import assert from 'node:assert/strict';

import { commandOf, runWorkflow, type AgentCall } from './support/workflow-runtime.ts';

const PLAN = '.claude/plans/demo-spec.md';
const GATE = 'node /elsewhere/goal-gate.ts';

const ok = (output = '') => ({ exitCode: 0, output });

// The survey resolves the repository root before anything else needs it, so every run that
// gets past the lock answers this one.
const resolves = { 'git-common-dir': ok('/main/checkout') };

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
    answering({ ...resolves, lock: ok(), [PLAN]: ok('') }),
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
    answering({ ...resolves, lock: ok(), [PLAN]: ok('') }),
  );

  assert.equal(commands[0], `${GATE} lock ${PLAN}`);
});

test('a run with no plan refuses to start at all', async () => {
  await assert.rejects(
    () => runWorkflow({ gate: GATE }, answering({})),
    /goal-auto needs args\.plan/,
  );
});

// R8 — the auditor's memory belongs to the repository, not to the worktree the run stands in.
// `.claude/` is gitignored, so it is absent from a fresh worktree: a relative path would make
// every launched run read an empty directory and write where the worktree's deletion takes it.
test('the report directory is resolved from the main checkout, not from the tree it stands in', async () => {
  const { commands } = await runWorkflow(
    { plan: PLAN, gate: GATE },
    answering({ ...resolves, lock: ok(), [PLAN]: ok('') }),
  );

  assert.ok(
    commands.some((command) => command.includes('git rev-parse --git-common-dir')),
    `the report directory was never resolved off the main .git:\n${commands.join('\n')}`,
  );
});

for (const [claim, answer] of [
  ['the resolution fails', { exitCode: 1, output: 'not a git repository' }],
  ['the resolution is empty', { exitCode: 0, output: '  \n' }],
] as const) {
  test(`a run refuses when ${claim}, rather than anchoring on nothing`, async () => {
    const { result } = await runWorkflow(
      { plan: PLAN, gate: GATE },
      answering({ 'git-common-dir': answer, lock: ok(), [PLAN]: ok('') }),
    );

    assert.equal((result as { status: string }).status, 'refused');
  });
}
