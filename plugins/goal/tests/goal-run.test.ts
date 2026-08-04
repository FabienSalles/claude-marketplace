import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HASH, RUN_NODE, lockOf, repo, run, sessionOf } from './support/goal-run-harness.ts';

// R4 — the plan lives in a gitignored directory outside the run's tree, and handing its path to
// the implementer is what made a real run write its whole iteration into another checkout. The
// section travels as text; the path does not travel at all.
test('it hands the implementer the iteration section, and never the plan path', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /write a\.txt/, `the section was not handed over:\n${args}`);
  assert.ok(!args.includes(fixture.plan), `the plan path reached the implementer:\n${args}`);
});

// R4 — the implementer is pinned to its own agent, in a mode that never stops to ask: nobody is
// watching, and a permission prompt nobody answers is a run that looks alive and advances nothing.
test('it pins the implementer to its own agent, in a mode that never prompts', () => {
  const fixture = repo();

  run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^--agent$/m);
  assert.match(args, /^goal:goal-run-implementer$/m);
  assert.match(args, /^--permission-mode$/m);
  assert.match(args, /^auto$/m);
});

// R4 — the implementer is invoked in a streamed, verbose account of its own actions, which is
// what makes each of its tool uses renderable as it happens rather than buried in a wall of prose.
test('it asks the implementer for a streamed, verbose account of its own actions', () => {
  const fixture = repo();

  run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^--output-format$/m);
  assert.match(args, /^stream-json$/m);
  assert.match(args, /^--verbose$/m);
});

// R4 — each tool use the implementer performs is rendered as one line, so watching a run means
// reading a handful of `RUN implementer: <tool> <target>` lines rather than its prose.
test('it renders each of the implementer tool uses as one line', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_TOOL_NAME: 'Edit',
    FAKE_CLAUDE_TOOL_ARG: 'run/publish.ts',
  });

  assert.match(output, /^RUN implementer: Edit run\/publish\.ts$/m, output);
});

// R5 — the session_id the stream reports is recorded beside the run, so the full transcript
// Claude Code already wrote can be found later without correlating timestamps.
test('it records the implementer session id beside the run', () => {
  const fixture = repo();

  run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_SESSION_ID: 'sess-abc123',
  });

  assert.match(readFileSync(sessionOf(fixture), 'utf8'), /sess-abc123/);
});

// R2 — the hash is published by `check` and carried to `commit`. Recomputing it there would bless
// a plan that moved between the two calls, which is the one thing the hash exists to catch.
test('it carries the hash check published into the commit call', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.match(readFileSync(fixture.gateLog, 'utf8'), new RegExp(`^${HASH}$`, 'm'));
});

// R6 — an implementer that wrote nothing is not the same event as work the gate rejected, and
// reporting it as a refusal tells someone asleep their work was judged when it never existed.
test('an implementer that wrote nothing is reported as such, and no verdict is asked for', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /wrote nothing/i, output);
  assert.ok(!readFileSync(fixture.gateLog, 'utf8').includes('commit'), 'the gate was asked to commit nothing');
});

// R6 / hole H2 — an implementer that commits also leaves a clean tree, so a check reading only
// `git status` calls it "wrote nothing" about work that is right there in HEAD. Comparing HEAD
// before and after is what tells the two apart.
test('an implementer that committed is not mistaken for one that wrote nothing', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_COMMITS: '1',
  });

  assert.notEqual(code, 0);
  assert.match(output, /committed/i, output);
  assert.ok(!/wrote nothing/i.test(output), `the diagnosis is wrong:\n${output}`);
});

// R7 — the gate exits 0 for a pass and 1 for a halt. Anything else means it never really ran, and
// calling that a refusal reports a verdict that was never reached.
test('a gate that could not run is not reported as a refusal', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '2',
  });

  assert.notEqual(code, 0);
  assert.match(output, /could not be run/i, output);
  assert.ok(!/refus/i.test(output), `a non-verdict was reported as a refusal:\n${output}`);
});

test('a gate that refuses the work halts the run and says so', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '1',
  });

  assert.notEqual(code, 0);
  assert.match(output, /refused/i, output);
});

// R1 — the lock is the gate's, and a run that keeps it after dying blocks every later launch on
// a plan nobody is working on. Documented recovery is prose; a trap is a mechanism.
test('it releases the lock on the way out, whatever the outcome', () => {
  for (const [claim, env] of [
    ['the iteration lands', { FAKE_CLAUDE_WRITES: 'a.txt' }],
    ['the gate refuses', { FAKE_CLAUDE_WRITES: 'a.txt', FAKE_GATE_COMMIT_EXIT: '1' }],
    ['the implementer wrote nothing', {}],
  ] as const) {
    const fixture = repo();

    run(fixture, [fixture.plan, '1'], { ...env, ...(env.FAKE_CLAUDE_WRITES ? { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') } : {}) });

    assert.ok(!existsSync(lockOf(fixture)), `the lock survived when ${claim}`);
  }
});

// A crash is not an exit path anyone writes, which is exactly why it is the one that leaked the
// lock on a real run. SIGTERM is what Orca sends when the developer stops a run.
test('it releases the lock when the run is killed mid-implementation', () => {
  const fixture = repo();

  spawnSync(
    'bash',
    ['-c', `node "${RUN_NODE}" "${fixture.plan}" 1 & pid=$!; sleep 1; kill -TERM $pid; wait $pid`],
    {
      cwd: fixture.dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        GOAL_GATE: join(fixture.bin, 'fake-gate'),
        FAKE_CLAUDE_SLEEPS: '10',
      },
    },
  );

  assert.ok(!existsSync(lockOf(fixture)), 'the lock survived a killed run');
});

// R17 — a run that says nothing is indistinguishable from one that jammed, which is the whole
// reason the developer ends up watching it. Every line declares which of the three it is.
test('every log line says whether the run is advancing or stopped', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  const lines = output.split('\n').filter((line) => line.trim() !== '');

  assert.ok(lines.length > 0, 'the run said nothing at all');

  for (const line of lines) {
    assert.match(line, /^(RUN|WAIT|STOP) /, `a line declares no state:\n${line}`);
  }

  assert.match(output, /^STOP /m, 'the run never said it was over');
});

test('it writes the same account to a log file beside the plan', () => {
  const fixture = repo();

  run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  const log = `${fixture.plan}.run.log`;
  assert.ok(existsSync(log), 'no log file was written');
  assert.match(readFileSync(log, 'utf8'), /^STOP /m);
});

for (const [claim, args] of [
  ['no plan is named', [] as string[]],
  ['the iteration is not a number', ['.claude/plans/demo-spec.md', 'one']],
] as const) {
  test(`it refuses when ${claim}`, () => {
    const fixture = repo();

    const { code } = run(fixture, [...args]);

    assert.notEqual(code, 0);
    assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
  });
}

// R3 — with no iteration named, the plan's unchecked boxes are surveyed and run in order: the
// same reading the gate uses, an `### Iteration N` heading then the first checkbox in its
// section.
test('it surveys the unchecked iterations and runs them in order when no iteration is named', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /write a\.txt/, `iteration 1's section was not handed over:\n${args}`);
  assert.match(args, /write b\.txt/, `iteration 2's section was not handed over:\n${args}`);
  assert.ok(
    args.indexOf('write a.txt') < args.indexOf('write b.txt'),
    `the iterations did not run in order:\n${args}`,
  );
});

// R5 — every unchecked iteration is proven runnable before any of them is implemented, so a
// plan that would fail on its second iteration never spends the first.
test('it proves every unchecked iteration runnable before implementing any', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_GATE_CHECK_FAIL_N: '2',
  });

  assert.notEqual(code, 0);
  assert.ok(
    !existsSync(fixture.claudeLog),
    `iteration 1 was implemented before iteration 2 was proven runnable:\n${output}`,
  );
});

// R3 — the survey stops dead at the first gate refusal, and never attempts what follows it.
test('it stops at the first iteration the gate refuses, and never attempts the next', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '1',
  });

  assert.notEqual(code, 0);
  assert.match(output, /refused/i, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /write a\.txt/);
  assert.ok(!args.includes('write b.txt'), `iteration 2 was attempted after iteration 1 was refused:\n${args}`);
});

// R3 — the single-iteration form still runs exactly the one named, which is what makes a
// halted plan resumable by hand.
test('with an iteration named, only that one runs', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '2'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'b.txt'),
  });

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /write b\.txt/);
  assert.ok(!args.includes('write a.txt'), `iteration 1 was attempted though only 2 was named:\n${args}`);
});

// The plan is read before the lock is taken, so a run that cannot be started leaves nothing to
// clean up — and the refusal names the tree rather than a lock the developer now has to free.
test('a plan the gate refuses to check never reaches an implementer', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_CHECK_EXIT: '1' });

  assert.notEqual(code, 0);
  assert.ok(!existsSync(fixture.claudeLog), `an implementer ran on an unrunnable iteration:\n${output}`);
  assert.ok(!existsSync(lockOf(fixture)), 'a lock was left behind by a run that never started');
});
