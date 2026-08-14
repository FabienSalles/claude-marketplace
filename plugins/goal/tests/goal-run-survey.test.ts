import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { repo, run } from './support/goal-run-harness.ts';

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
