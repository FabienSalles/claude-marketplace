import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentReport, AgentSessions, FailureClass } from '../src/ports.ts';
import { PAUSED, repo, runInProcess } from './support/goal-run-harness.ts';

const reportOf = (failureClass: FailureClass | string, extra: Partial<AgentReport> = {}): AgentReport => ({
  end: { status: failureClass === 'success' ? 0 : 1, signal: null },
  outcome: { text: '', isError: failureClass !== 'success', class: failureClass as FailureClass, quote: 'scripted' },
  durationMs: 1,
  outPath: '/dev/null',
  errPath: '/dev/null',
  ignoredLines: 0,
  ...extra,
});

const scripted = (classes: (FailureClass | string)[], extra: Partial<AgentReport> = {}) => {
  const launched: { role: string; brief: string }[] = [];
  const adapter: AgentSessions = {
    launch: async (role, brief) => {
      launched.push({ role, brief });
      appendFileSync(join(process.cwd(), 'a.txt'), 'written\n');

      return reportOf(classes[Math.min(launched.length - 1, classes.length - 1)]!, extra);
    },
  };

  return { adapter, launched };
};

const env = { GOAL_RUN_QUOTA_SLEEP: '1', GOAL_RUN_BURST_CAP: '1', FAKE_GATE_COMMITS: '1' };

// R2 — the runner names a role and a brief, nothing else.
test('the implementer is launched through the port by its role and a brief', async () => {
  const fixture = repo();
  const { adapter, launched } = scripted(['success']);

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.equal(code, 0, output);
  assert.equal(launched.length, 1);
  assert.equal(launched[0]?.role, 'implementer');
  assert.match(launched[0]?.brief ?? '', /write a\.txt/);
  assert.equal(readFileSync(join(fixture.dir, 'claude-args.txt'), 'utf8').includes('goal-run-implementer'), false);
});

// R4 — the runner relaunches on the class the adapter reports.
test('a quota class in the report relaunches the same iteration, then the gate and the commit follow', async () => {
  const fixture = repo();
  const { adapter, launched } = scripted(['exhausted', 'success']);

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.equal(code, 0, output);
  assert.equal(launched.length, 2);
  assert.match(output, /looks quota-exhausted/);
  assert.match(output, /iteration 1 landed, gate-verified/);
});

// R4 — a class the runner does not know is a pause, never a success.
test('a class the runner does not know pauses the run', async () => {
  const fixture = repo();
  const { adapter, launched } = scripted(['martian']);

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.equal(code, PAUSED, output);
  assert.equal(launched.length, 1);
  assert.match(output, /unrecognised/);
});

// R4 — the unrecognised class pauses with the adapter's quote.
test('an unrecognised report pauses, quoting what the adapter quoted', async () => {
  const fixture = repo();
  const { adapter } = scripted(['unrecognised']);

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.equal(code, PAUSED, output);
  assert.match(output, /scripted/);
});

// R5 — a report without consumption yields no tokens line, a report with one yields it.
test('a report without consumption produces no RUN tokens line', async () => {
  const bare = repo();
  const withUsage = repo();

  const none = await runInProcess(bare, [bare.plan, '1'], env, scripted(['success']).adapter);
  const some = await runInProcess(withUsage, [withUsage.plan, '1'], env, scripted(['success'], { consumption: { usage: { input_tokens: 1, output_tokens: 2 }, compactions: 0 } }).adapter);

  assert.doesNotMatch(none.output, /RUN tokens stage=implementer/);
  assert.match(some.output, /RUN tokens stage=implementer input_tokens=1 output_tokens=2 .*compactions=0/);
});

// R7 — an adapter providing neither diagnostic makes the runner write nothing in their place.
test('an adapter with no postmortem leaves the runner silent after a failure', async () => {
  const fixture = repo();
  const { adapter } = scripted(['unrecognised']);

  const { output } = await runInProcess(fixture, [fixture.plan, '1'], env, adapter);

  assert.doesNotMatch(output, /postmortem/);
});

// R7 — Claude's own adapter still writes the postmortem after a failure.
test('the Claude adapter writes the postmortem after a failed session', async () => {
  const fixture = repo();

  const { output } = await runInProcess(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_EXIT: '1' });

  assert.match(output, /RUN postmortem: attempt 1 exited 1/);
});

// R8 — through the real Claude adapter, a null line in the stream leaves a success a success.
test('a null line in a Claude session\'s output no longer turns a success into a failure', async () => {
  const fixture = repo();

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], { ...env, FAKE_CLAUDE_RAW_LINE: 'null', FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.match(output, /iteration 1 landed, gate-verified/);
});
