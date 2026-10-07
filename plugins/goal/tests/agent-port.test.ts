import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentReport, AgentSessions, FailureClass } from '../src/ports.ts';
import { HASH, PAUSED, PLAN, repo, runInProcess } from './support/goal-run-harness.ts';
import { close, LANDED } from '../src/run/close.ts';
import type { Reporter } from '../src/run/report.ts';

const reportOf = (failureClass: FailureClass | string, extra: Partial<AgentReport> = {}): AgentReport => ({
  end: { status: failureClass === 'success' ? 0 : 1, signal: null },
  outcome: { text: '', isError: failureClass !== 'success', class: failureClass as FailureClass, quote: 'scripted' },
  durationMs: 1,
  stderr: '',
  ignoredLines: 0,
  ...extra,
});

const scripted = (classes: (FailureClass | string)[], extra: Partial<AgentReport> = {}) => {
  const launched: { role: string; brief: string }[] = [];
  const adapter: AgentSessions = {
    launch: async (role, brief) => {
      if (role !== 'implementer') {
        return reportOf('success');
      }

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
  assert.equal(existsSync(join(fixture.dir, 'claude-args.txt')), false);
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
  const some = await runInProcess(withUsage, [withUsage.plan, '1'], env, scripted(['success'], { consumption: { inputTokens: 1, outputTokens: 2, compactions: 0 } }).adapter);

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

// R2, R3, R6 — close() launches the lens, the reviewer and the auditor by role, each returning its own report.
test('the lens, the reviewer and the auditor are launched through the port, and one failing leaves the other\'s record alone', async () => {
  const fixture = repo({ planText: PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n'), remote: true });
  const launched: { role: string; stopped: boolean }[] = [];
  const said: string[] = [];
  const recorded: string[] = [];
  const reporter: Reporter = { say: (line) => said.push(line), stop: () => { throw new Error('unexpected stop'); }, record: (text) => recorded.push(text), setLog: () => {} };
  const adapter: AgentSessions = {
    launch: async (role, _brief, _options, stop) => {
      launched.push({ role, stopped: stop.aborted });
      const failing = role === 'lens';

      return reportOf(failing ? 'unrecognised' : 'success', { outcome: { text: `${role} answer`, isError: failing, class: failing ? 'unrecognised' : 'success', quote: '' } });
    },
  };
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const code = await close(fixture.plan, join(fixture.bin, 'fake-gate'), HASH, 'origin', { isComplete: () => true, publish: () => undefined, state: { publishes: true, prOpen: true, landed: ['1'], onRemote: ['1'] } }, ['1'], 'run-dir', reporter, adapter);

    assert.equal(code, LANDED);
    assert.deepEqual(launched.map((l) => l.role).sort(), ['auditor', 'lens', 'reviewer']);
    assert.ok(launched.every((l) => !l.stopped));
    assert.deepEqual(recorded.slice(0, 2).sort(), ['lens answer', 'reviewer answer']);
    assert.ok(said.some((line) => line.includes('RUN the reviewer finished')), said.join('\n'));
    assert.equal(existsSync(join(fixture.dir, 'claude-args.txt')), false);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// R4 — a provider reporting no cache counts, no window and no compactions still prints a tokens line, with zeros and no percentage.
test('a report with only input and output counts prints zero cache counts and no percentage', async () => {
  const fixture = repo();

  const { output } = await runInProcess(fixture, [fixture.plan, '1'], env, scripted(['success'], { consumption: { inputTokens: 7, outputTokens: 9, contextTokens: 1234 } }).adapter);

  assert.match(output, /^RUN tokens stage=implementer input_tokens=7 output_tokens=9 cache_creation_input_tokens=0 cache_read_input_tokens=0 context_tokens=1234 compactions=0$/m);
  assert.doesNotMatch(output, /context_pct/);
});

// R5 — the runner only divides: the window the adapter reports gives the percentage.
test('a report naming its own context window prints the percentage against it', async () => {
  const fixture = repo();

  const { output } = await runInProcess(fixture, [fixture.plan, '1'], env, scripted(['success'], { consumption: { inputTokens: 1, outputTokens: 1, contextTokens: 50_000, contextWindow: 400_000, model: 'some-model' } }).adapter);

  assert.match(output, /model=some-model context_tokens=50000 context_pct=13% compactions=0$/m);
});

// R3 — each advisory role's diagnostics come from the report's own stderr, never from a file the launch was given.
test('close prints each role\'s diagnostics from the report stderr, ignoring the launch error file', async () => {
  const fixture = repo({ planText: PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n'), remote: true });
  const said: string[] = [];
  const reporter: Reporter = { say: (line) => said.push(line), stop: () => { throw new Error('unexpected stop'); }, record: () => {}, setLog: () => {} };
  const stderrs: Record<string, string> = { lens: ' lens complaint \n', reviewer: 'reviewer complaint', auditor: '  \n' };
  const adapter: AgentSessions = {
    launch: async (role, _brief, options) => {
      appendFileSync(options.errPath, 'file only noise');

      return reportOf('success', { stderr: stderrs[role] ?? '' });
    },
  };
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const code = await close(fixture.plan, join(fixture.bin, 'fake-gate'), HASH, 'origin', { isComplete: () => true, publish: () => undefined, state: { publishes: true, prOpen: true, landed: ['1'], onRemote: ['1'] } }, ['1'], 'run-dir', reporter, adapter);

    assert.equal(code, LANDED);
    assert.ok(said.includes('RUN diagnostics stage=lens: lens complaint'), said.join('\n'));
    assert.ok(said.includes('RUN diagnostics stage=reviewer: reviewer complaint'), said.join('\n'));
    assert.ok(!said.some((line) => line.startsWith('RUN diagnostics stage=auditor')), said.join('\n'));
    assert.ok(!said.some((line) => line.includes('file only noise')), said.join('\n'));
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});
