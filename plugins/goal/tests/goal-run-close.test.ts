import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PLAN, repo, run } from './support/goal-run-harness.ts';

const PLAN_PR = PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n');

const land = (fixture: ReturnType<typeof repo>, env: Record<string, string> = {}) =>
  run(fixture, [fixture.plan], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    ...env,
  });

// R18 — every declared iteration landed only proves each slice against its own commands; the
// global Definition of Done is the barrier that replays against the whole plan, once, after all
// of them.
test('it replays the global Definition of Done once every requested iteration has landed', () => {
  const fixture = repo();

  const { code, output } = land(fixture);

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.gateLog, 'utf8').split('\n').filter((line) => line !== '');
  assert.equal(calls.filter((line) => line === 'dod').length, 1, `expected exactly one dod call:\n${calls.join('\n')}`);
});

// R18 — a passing Definition of Done is what "shipped" means: the already-open pull request is
// marked ready, mechanically, on the far side of the barrier.
test('a passing Definition of Done marks the open pull request ready', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = land(fixture, { FAKE_GH_PR_EXISTS: '1' });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.match(calls, /pr\nready/, `the pull request was never marked ready:\n${calls}`);
});

// R18 — a refusing Definition of Done halts the run after every slice landed, and nothing is
// marked ready on top of a plan that is not, as a whole, done.
test('a failing Definition of Done halts the run and skips marking the pull request ready', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = land(fixture, { FAKE_GH_PR_EXISTS: '1', FAKE_GATE_DOD_EXIT: '1' });

  assert.notEqual(code, 0);
  assert.match(output, /Definition of Done/, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.ok(!calls.includes('pr\nready'), `the pull request was marked ready though the Definition of Done refused:\n${calls}`);
});

// R18 — the advisory lens runs for the first time since it was written, and its own exit code
// never reaches the run's: a false alarm cannot undo work the gate already verified and shipped.
test('the advisory lens runs after a landed run and never blocks it', () => {
  const fixture = repo();

  const { code, output } = land(fixture, { FAKE_CLAUDE_LENS_EXIT: '1' });

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^goal:goal-run-lens$/m, `the lens was never invoked:\n${args}`);
});

// R18 — the audit records elapsed seconds per iteration, the one figure a shell script can
// measure honestly about its own run.
test('the auditor is invoked with elapsed seconds recorded for every landed iteration', () => {
  const fixture = repo();

  const { code, output } = land(fixture);

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^goal:goal-run-auditor$/m, `the auditor was never invoked:\n${args}`);
  assert.match(args, /1: \d+s/, `no elapsed time was recorded for iteration 1:\n${args}`);
  assert.match(args, /2: \d+s/, `no elapsed time was recorded for iteration 2:\n${args}`);
});

// R18 — the audit is nobody's optional step: it still runs when the Definition of Done itself
// is what halted the run, so a run that fails to ship is measured too.
test('the auditor still runs when the Definition of Done refuses the run', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = land(fixture, { FAKE_GATE_DOD_EXIT: '1' });

  assert.notEqual(code, 0);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^goal:goal-run-auditor$/m, `the auditor was never invoked on a halted run:\n${args}`);
});
