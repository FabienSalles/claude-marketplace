import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { claudeAgentSessions, reportOf } from '../src/adapters/claude/session.ts';
import { ceiling } from '../src/gate/bounded.ts';
import type { AgentRole } from '../src/ports.ts';
import { tmpDir } from './support/tmp.ts';

const stream = (name: string): string => readFileSync(join(import.meta.dirname, 'fixtures', 'claude-streams', name), 'utf8');
const ended = { status: 0, signal: null } as const;
const paths = { outPath: '/dev/null', errPath: '/dev/null' };

// R8 — a null line, or any line that is not an expected event, is read past; the session stays a success.
test('a stream carrying a null line is read to its end and stays a success', () => {
  const report = reportOf(ended, stream('null-line.jsonl'), '', 5, paths);

  assert.equal(report.outcome.class, 'success');
  assert.equal(report.outcome.isError, false);
  assert.equal(report.outcome.text, 'done');
  assert.equal(report.sessionId, 's-null');
});

// R8 — the report states how many lines were ignored.
test('the report counts the lines it ignored', () => {
  assert.equal(reportOf(ended, stream('null-line.jsonl'), '', 5, paths).ignoredLines, 6);
  assert.equal(reportOf(ended, stream('quota-exhausted.jsonl'), '', 5, paths).ignoredLines, 0);
});

// R3 — consumption is the four classes, the model, the peak and the compactions.
test('the report carries the consumption the stream stated', () => {
  const { consumption } = reportOf(ended, stream('null-line.jsonl'), '', 5, paths);

  assert.deepEqual(consumption?.usage, { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 });
  assert.equal(consumption?.model, 'claude-sonnet-5');
  assert.equal(consumption?.peakTokens, 5);
  assert.equal(consumption?.compactions, 0);
});

// R5 — no usage in the stream, no consumption in the report.
test('a stream stating no usage yields a report without consumption', () => {
  assert.equal(reportOf({ status: 1, signal: null }, '', 'boom', 5, paths).consumption, undefined);
});

// R4 — the adapter decides the class.
test('the adapter classes a session by its end and its terminal outcome', () => {
  assert.equal(reportOf({ status: 1, signal: null }, stream('quota-exhausted.jsonl'), '', 5, paths).outcome.class, 'exhausted');
  assert.equal(reportOf({ status: 1, signal: null }, '', 'HTTP 429', 5, paths).outcome.class, 'burst');
  assert.equal(reportOf({ status: null, signal: 'SIGKILL' }, '', '', 5, paths).outcome.class, 'signal');
  assert.equal(reportOf({ status: 1, signal: null }, '', 'boom', 5, paths).outcome.class, 'unrecognised');
});

// R3 — a session that cannot be launched yields one report, and the adapter never throws.
test('a launch that cannot happen yields a report with the launch error, never a throw', async () => {
  const dir = tmpDir('adapter-claude-');
  const saved = process.env.PATH;
  process.env.PATH = join(dir, 'empty');

  try {
    const missing = await claudeAgentSessions().launch('implementer', 'brief', { ...paths, onTool: () => {}, onSession: () => {} }, new AbortController().signal);
    const unwritable = await claudeAgentSessions().launch('implementer', 'brief', { outPath: join(dir, 'no', 'out'), errPath: join(dir, 'no', 'err'), onTool: () => {}, onSession: () => {} }, new AbortController().signal);

    assert.notEqual(missing.outcome.class, 'success');
    assert.equal(missing.end.status, 127);
    assert.notEqual(unwritable.outcome.class, 'success');
    assert.notEqual(unwritable.end.error, undefined);
  } finally {
    process.env.PATH = saved;
  }
});

// R2 — the role names the agent, the brief travels as the last argument, the output lands in the named files.
test('launch runs the role\'s agent with the brief and writes its output to the named files', async () => {
  const dir = tmpDir('adapter-claude-');
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'claude'), `#!/bin/sh\nprintf '%s\\n' "$@" > "${dir}/argv"\ncat "${join(import.meta.dirname, 'fixtures', 'claude-streams', 'null-line.jsonl')}"\n`);
  chmodSync(join(bin, 'claude'), 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${bin}:${saved}`;
  const tools: string[] = [];
  const sessions: string[] = [];

  try {
    const report = await claudeAgentSessions().launch(
      'reviewer',
      'the brief',
      { outPath: join(dir, 'o'), errPath: join(dir, 'e'), onTool: (line) => tools.push(line), onSession: (id) => sessions.push(id) },
      new AbortController().signal,
    );
    const argv = readFileSync(join(dir, 'argv'), 'utf8').split('\n');

    assert.ok(argv.includes('goal:goal-run-reviewer'), argv.join(' '));
    assert.equal(argv[argv.length - 2], 'the brief');
    assert.equal(report.outcome.class, 'success');
    assert.equal(readFileSync(join(dir, 'o'), 'utf8'), readFileSync(join(import.meta.dirname, 'fixtures', 'claude-streams', 'null-line.jsonl'), 'utf8'));
    assert.deepEqual(tools, ['RUN implementer: Edit a.txt']);
    assert.ok(sessions.includes('s-null'));
  } finally {
    process.env.PATH = saved;
  }
});

// R7 — Claude's diagnostics are capabilities of its adapter.
test('Claude\'s adapter provides the start-up warning and the postmortem', () => {
  const adapter = claudeAgentSessions();

  assert.equal(typeof adapter.startupWarning, 'function');
  assert.equal(typeof adapter.postmortem, 'function');
});

const recordLaunches = async (roles: AgentRole[], env: Record<string, string>) => {
  const dir = tmpDir('adapter-claude-');
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'claude'), `#!/bin/sh\nprintf '%s %s %s\\n' "$3" "$(ulimit -u)" "$DISABLE_AUTOUPDATER" >> "${dir}/launches"\nsleep 0.2\n`);
  chmodSync(join(bin, 'claude'), 0o755);
  const saved = { ...process.env };
  Object.assign(process.env, env, { PATH: `${bin}:${saved.PATH}` });
  delete process.env.DISABLE_AUTOUPDATER;

  try {
    const sessions = claudeAgentSessions();

    await Promise.all(
      roles.map((role) =>
        sessions.launch(role, 'brief', { outPath: join(dir, `${role}.out`), errPath: join(dir, `${role}.err`), onTool: () => {}, onSession: () => {} }, new AbortController().signal),
      ),
    );

    return readFileSync(join(dir, 'launches'), 'utf8').split('\n').filter((line) => line !== '').map((line) => line.split(' ') as [string, string, string]);
  } finally {
    process.env = saved;
  }
};

const probe = (env: Record<string, string>): boolean => {
  const saved = process.env.GOAL_PROC_HEADROOM;
  Object.assign(process.env, env);

  try {
    return ceiling() !== '';
  } finally {
    if (saved === undefined) {
      delete process.env.GOAL_PROC_HEADROOM;
    } else {
      process.env.GOAL_PROC_HEADROOM = saved;
    }
  }
};

const ROLES: AgentRole[] = ['implementer', 'lens', 'reviewer', 'auditor'];

// R1 R5 R6 — the four roles start with the auto-updater off, and the lens and reviewer launched
// together each record a bounded ceiling.
test('every role starts with the auto-updater off under the same ceiling', async (t) => {
  const env = { GOAL_PROC_HEADROOM: '200' };
  const launches = await recordLaunches(ROLES, env);

  if (!probe(env)) {
    t.skip('this shell cannot express the ceiling');
    return;
  }

  assert.equal(launches.length, 4);

  for (const [, limit, updater] of launches) {
    assert.equal(updater, '1');
    assert.ok(Number.isFinite(Number(limit)), `no bounded ulimit recorded: ${limit}`);
  }
});

// R3 — where the inherited limit is already lower than live plus headroom, no role is bounded and every role starts.
test('no role carries a ceiling when the inherited limit is already below it', async () => {
  const inherited = (await recordLaunches(['auditor'], { GOAL_PROC_HEADROOM: '1000000' }))[0]![1];
  const launches = await recordLaunches(ROLES, { GOAL_PROC_HEADROOM: '1000000' });

  assert.equal(launches.length, 4);

  for (const [, limit, updater] of launches) {
    assert.equal(limit, inherited);
    assert.equal(updater, '1');
  }
});
