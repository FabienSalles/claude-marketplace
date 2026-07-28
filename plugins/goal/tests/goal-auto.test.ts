import { test } from 'node:test';
import assert from 'node:assert/strict';

import { commandOf, runWorkflow, type AgentCall } from './support/workflow-runtime.ts';

const PLAN = '.claude/plans/demo-spec.md';
const GATE = 'node /elsewhere/goal-gate.ts';

const ok = (output = '') => ({ exitCode: 0, output });

const PROBE = 'dir\t/worktrees/demo\nbranch\tfeature/demo\nsha\tabc1234\nroot\t/main/checkout\n';

// The probe runs before the lock and answers where the run stands, so every run that gets past
// it answers this one.
const resolves = { 'git-common-dir': ok(PROBE) };

const WHERE = { dir: '/worktrees/demo', branch: 'feature/demo', sha: 'abc1234' };

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

  assert.deepEqual(result, { ...WHERE, status: 'done', plan: PLAN, landed: [], notAttempted: [] });
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
    answering({ ...resolves, lock: { exitCode: 1, output: 'another run holds this plan' } }),
  );

  assert.deepEqual(result, {
    ...WHERE,
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

  assert.equal(commands.find((command) => command.startsWith(GATE)), `${GATE} lock ${PLAN}`);
});

test('a run with no plan refuses to start at all', async () => {
  const { error } = await runWorkflow({ gate: GATE }, answering({}));

  assert.match(String(error), /goal-auto needs args\.plan/);
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

// R2 — the run pushes the branch the checkout is on, so standing on the wrong one would push
// the wrong one. The probe is read-only and runs before the lock, so this refusal costs nothing
// and never takes a lock it would release one line later.
test('a run standing on a branch the plan is not delivered on refuses, and says which', async () => {
  const { result, commands } = await runWorkflow(
    { plan: PLAN, gate: GATE },
    answering({ 'git-common-dir': ok(PROBE.replace('feature/demo', 'main')), lock: ok(), [PLAN]: ok('') }),
  );

  const refusal = result as { status: string; branch: string; detail: string };

  assert.equal(refusal.status, 'refused');
  assert.equal(refusal.branch, 'main');
  assert.match(refusal.detail, /feature\/demo/);
  assert.ok(!commands.some((command) => command.includes('lock')), `a lock was taken anyway:\n${commands.join('\n')}`);
});

// `commands/auto.md` preflight check 2 accepts a suffix, so the fact held in the workflow has to
// say the same thing as the fact held in the prose.
test('a branch named after the plan with a suffix is accepted', async () => {
  const { result } = await runWorkflow(
    { plan: PLAN, gate: GATE },
    answering({ 'git-common-dir': ok(PROBE.replace('feature/demo', 'feature/demo-slug')), lock: ok(), [PLAN]: ok('') }),
  );

  assert.equal((result as { status: string }).status, 'done');
});

const HASH = `plan_hash=${'a'.repeat(64)}`;

// Answered in this order: `unlock` before `lock` because one contains the other.
const wholeRun = {
  'git-common-dir': ok(PROBE),
  unlock: ok(),
  check: ok(HASH),
  commit: ok(),
  dod: ok(),
  'Policy:': ok('commit'),
  'Remote:': ok('origin'),
  'PR base:': ok(''),
  'gh issue': ok(''),
  awk: ok('1'),
  lock: ok(),
};

// R3 — the implementer is the only agent that writes, and the refactor left it told nothing at
// all about the tree it writes in.
test("the implementer's brief names the tree and the branch it writes in", async () => {
  const { agents } = await runWorkflow({ plan: PLAN, gate: GATE }, answering(wholeRun));

  const implementer = agents.find((call) => call.opts.agentType === 'goal:goal-implementer');

  assert.ok(implementer, 'no implementer was ever briefed');
  assert.match(implementer.prompt, /\/worktrees\/demo/);
  assert.match(implementer.prompt, /feature\/demo/);
});

// R4 — the identity of a run became its directory, and no report named one.
test('a completed run reports the tree, the branch and the commit it is talking about', async () => {
  const { result } = await runWorkflow({ plan: PLAN, gate: GATE }, answering(wholeRun));

  const done = result as { status: string; dir: string; branch: string; sha: string; landed: string[] };

  assert.equal(done.status, 'done');
  assert.deepEqual(done.landed, ['1']);
  assert.equal(done.dir, WHERE.dir);
  assert.equal(done.branch, WHERE.branch);
  assert.equal(done.sha, WHERE.sha);
});

// R7 — `runner()` fabricates { exitCode: -1 } when an agent returns nothing, and that -1 used to
// fall straight through the "the gate refused it" branch. The run then told someone asleep that
// the gate had refused, when the gate may never have run.
test('a gate that never ran is a pause, not a refusal it never gave', async () => {
  const { result } = await runWorkflow(
    { plan: PLAN, gate: GATE },
    (call) => (commandOf(call).includes(`${GATE} commit`) ? undefined : answering(wholeRun)(call)),
  );

  const paused = result as { status: string; iteration: string; detail: string };

  assert.equal(paused.status, 'paused');
  assert.equal(paused.iteration, '1');
  assert.match(paused.detail, /no verdict exists/);
});

const HEX = `plan_hash=${'b'.repeat(64)}`;

// Two iterations, publishing, and a push that fails on the second: the pull request exists from
// the first, and `shipping.blocked` is sticky from the second.
const publishingRun = (onPush: () => { exitCode: number; output: string }) => {
  const table = {
    'git-common-dir': ok(PROBE),
    unlock: ok(),
    check: ok(HEX),
    commit: ok(),
    dod: ok(),
    'Policy:': ok('commit+pr'),
    'Remote:': ok('origin'),
    'PR base:': ok(''),
    'gh issue': ok(''),
    awk: ok('1\n2'),
    scan: ok(),
    'fixup|squash': ok('0'),
    '# Spec: ': ok('# Spec: demo\nallow-bc-break\n### Iteration 1 — one'),
    'gh pr': ok(),
    lock: ok(),
  };

  return (call: AgentCall) => (commandOf(call).includes('git push -u') ? onPush() : answering(table)(call));
};

// R5 — every other gh call names its repository; this one is the last write of the run.
test('the pull request is marked ready on a named repository and a named branch', async () => {
  const { commands } = await runWorkflow({ plan: PLAN, gate: GATE }, publishingRun(() => ok()));

  const readied = commands.find((command) => command.includes('gh pr ready'));

  assert.ok(readied, `the run never marked the pull request ready:\n${commands.join('\n')}`);
  assert.match(readied, /--repo/);
  assert.match(readied, /feature\/demo/);
});

// R6 — `shipping.pr` is sticky and so is `shipping.blocked`, and the ready call used to consult
// only the first. A run blocked at iteration 2 of 2 would still mark ready a pull request that
// holds iteration 1 alone.
test('a run whose publication was blocked does not mark its stale pull request ready', async () => {
  let pushes = 0;

  const { commands, result } = await runWorkflow(
    { plan: PLAN, gate: GATE },
    publishingRun(() => {
      pushes += 1;

      return pushes === 1 ? ok() : { exitCode: 1, output: 'rejected: non-fast-forward' };
    }),
  );

  assert.equal((result as { status: string }).status, 'done');
  assert.equal(pushes, 2, 'the second iteration never tried to publish');
  assert.ok(
    !commands.some((command) => command.includes('gh pr ready')),
    `a stale pull request was marked ready:\n${commands.join('\n')}`,
  );
});

// R10 — the run lock is the only inter-run exclusion left since the tracks were removed, and
// release() used to be reached only on the returns the loop controls. A throw held it forever,
// blocking every later run including the relaunch of this one.
test('an agent that throws mid-run still gives the lock back', async () => {
  const { commands, error } = await runWorkflow({ plan: PLAN, gate: GATE }, (call) =>
    commandOf(call).includes(`${GATE} commit`) ? (() => { throw new Error('the runner died'); })() : answering(wholeRun)(call),
  );

  assert.match(String(error), /the runner died/, 'the throw was swallowed');
  assert.ok(
    commands.some((command) => command === `${GATE} unlock ${PLAN}`),
    `the lock was never released:\n${commands.join('\n')}`,
  );
});

// A throw inside a finally REPLACES the original error, and release() runs through the very
// agent layer whose failure is the scenario. The diagnosis must survive its own cleanup.
test('a release that fails too does not bury the error that killed the run', async () => {
  const { error, logs } = await runWorkflow({ plan: PLAN, gate: GATE }, (call) => {
    const command = commandOf(call);

    if (command.includes(`${GATE} commit`)) {
      throw new Error('the runner died');
    }

    if (command.includes('unlock')) {
      throw new Error('the unlock died too');
    }

    return answering(wholeRun)(call);
  });

  assert.match(String(error), /the runner died/, 'the cleanup replaced the diagnosis');
  assert.ok(
    logs.some((line) => line.includes('unlock')),
    `nothing said the lock is still held:\n${logs.join('\n')}`,
  );
});
