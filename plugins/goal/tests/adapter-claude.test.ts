import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { claudeAgentSessions, reportOf } from '../src/adapters/claude/session.ts';
import { ceiling } from '../src/gate/bounded.ts';
import type { AgentRole } from '../src/ports.ts';
import { tmpDir } from './support/tmp.ts';

const stream = (name: string): string => readFileSync(join(import.meta.dirname, 'fixtures', 'claude-streams', name), 'utf8');
const ended = { status: 0, signal: null } as const;
const paths = { outPath: '/dev/null' };

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

// R4 — consumption is neutral: counts, the context peak and its window, the compactions and the model.
test('the report carries the consumption the stream stated, in neutral names', () => {
  const { consumption } = reportOf(ended, stream('null-line.jsonl'), '', 5, paths);

  assert.deepEqual(consumption, {
    inputTokens: 10,
    outputTokens: 20,
    cacheCreationInputTokens: 30,
    cacheReadInputTokens: 40,
    contextTokens: 5,
    contextWindow: 200_000,
    compactions: 0,
    model: 'claude-sonnet-5',
  });
});

// R5 — the adapter knows each model's window.
test('the adapter reports the effective window of both known models and none for an unknown one', () => {
  const result = (model: string): string => `${JSON.stringify({ type: 'assistant', message: { model, usage: { input_tokens: 1 } } })}\n${JSON.stringify({ type: 'result', usage: { input_tokens: 1 } })}\n`;

  assert.equal(reportOf(ended, result('claude-sonnet-5'), '', 5, paths).consumption?.contextWindow, 200_000);
  assert.equal(reportOf(ended, result('claude-fable-5'), '', 5, paths).consumption?.contextWindow, 1_000_000);
  assert.equal('contextWindow' in (reportOf(ended, result('claude-unknown-9'), '', 5, paths).consumption ?? {}), false);
});

// R4 — a count the stream never stated is absent from the report, not zero.
test('a result stating only input tokens leaves every other count absent', () => {
  const { consumption } = reportOf(ended, `${JSON.stringify({ type: 'result', usage: { input_tokens: 4 } })}\n`, '', 5, paths);

  assert.deepEqual(consumption, { inputTokens: 4, compactions: 0 });
});

// R5 — no usage in the stream, no consumption in the report.
test('a stream stating no usage yields a report without consumption', () => {
  assert.equal(reportOf({ status: 1, signal: null }, '', 'boom', 5, paths).consumption, undefined);
});

// R3 — the report carries the session's stderr as text.
test('the report carries the stderr text it was given, and the empty string when there is none', () => {
  assert.equal(reportOf({ status: 1, signal: null }, '', 'boom\n', 5, paths).stderr, 'boom\n');
  assert.equal(reportOf(ended, stream('null-line.jsonl'), '', 5, paths).stderr, '');
  assert.equal('outPath' in reportOf(ended, '', '', 5, paths), false);
  assert.equal('errPath' in reportOf(ended, '', '', 5, paths), false);
});

// R6 — the id is the last one the stream announced, decoded from its events and never matched in raw output.
test('the report\'s session id is the last one announced, and none when no event announces one', () => {
  const events = [{ type: 'assistant', session_id: 's1' }, { type: 'assistant', session_id: '' }, { type: 'assistant' }, { type: 'assistant', session_id: 's2' }, { type: 'assistant' }];
  const announced: string[] = [];

  assert.equal(reportOf(ended, events.map((e) => JSON.stringify(e)).join('\n'), '', 5, paths, { onTool: () => {}, onSession: (id) => announced.push(id) }).sessionId, 's2');
  assert.deepEqual(announced, ['s1', 's2']);
  assert.equal(reportOf(ended, JSON.stringify({ type: 'assistant' }), '', 5, paths).sessionId, undefined);
  assert.equal(reportOf(ended, 'raw prose "session_id":"not-an-event" and more', '', 5, paths).sessionId, undefined);
});

// R6 — a stream that never reaches its final event still reports the id it announced, and raw prose reports none.
test('a stream with no final event keeps its announced id and raw prose yields plain text', () => {
  const cut = reportOf({ status: 1, signal: null }, `${JSON.stringify({ type: 'assistant', session_id: 'cut-session' })}\n`, '', 5, paths);
  const prose = reportOf({ status: 1, signal: null }, 'something went wrong', '', 5, paths);

  assert.equal(cut.sessionId, 'cut-session');
  assert.equal(cut.consumption, undefined);
  assert.equal(prose.outcome.text, 'something went wrong');
  assert.equal(prose.sessionId, undefined);
  assert.equal(prose.consumption, undefined);
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
    const missing = await claudeAgentSessions().launch('implementer', 'brief', { ...paths, errPath: '/dev/null', onTool: () => {}, onSession: () => {} }, new AbortController().signal);
    const unwritable = await claudeAgentSessions().launch('implementer', 'brief', { outPath: join(dir, 'no', 'out'), errPath: join(dir, 'no', 'err'), onTool: () => {}, onSession: () => {} }, new AbortController().signal);

    assert.notEqual(missing.outcome.class, 'success');
    assert.equal(missing.end.status, 127);
    assert.equal(missing.stderr, '');
    assert.equal(missing.sessionId, undefined);
    assert.equal(unwritable.stderr, '');
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

// R1 R5 R6 — the four roles, launched together, each start with the auto-updater off and record a
// bounded ceiling.
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

const withFakeClaude = async <T>(script: (dir: string) => string, fn: (dir: string, claudePath: string) => Promise<T>): Promise<T> => {
  const dir = tmpDir('adapter-claude-');
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const claudePath = join(bin, 'claude');
  writeFileSync(claudePath, `#!/bin/sh\n${script(dir)}\n`);
  chmodSync(claudePath, 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${bin}:${saved}`;

  try {
    return await fn(dir, claudePath);
  } finally {
    process.env.PATH = saved;
  }
};

const launchOptions = (outPath: string, errPath: string) => ({ outPath, errPath, onTool: () => {}, onSession: () => {} });
const projectsRoot = (cwd: string, ids: Record<string, string>): string => {
  const root = tmpDir('adapter-claude-projects-');
  const project = join(root, cwd.replace(/[/.]/g, '-'));
  mkdirSync(project, { recursive: true });

  for (const [id, words] of Object.entries(ids)) {
    writeFileSync(join(project, `${id}.jsonl`), `{"type":"assistant"}\n{"type":"user","note":"${words}"}\n`);
  }

  return root;
};
const withProjects = async (root: string, fn: () => void | Promise<void>): Promise<void> => {
  const saved = process.env.GOAL_RUN_PROJECTS_ROOT;
  process.env.GOAL_RUN_PROJECTS_ROOT = root;

  try {
    await fn();
  } finally {
    if (saved === undefined) {
      delete process.env.GOAL_RUN_PROJECTS_ROOT;
    } else {
      process.env.GOAL_RUN_PROJECTS_ROOT = saved;
    }
  }
};

// R3 R7 — parallel launches each carry their own stderr and are diagnosed from their own final id and output path.
test('simultaneous launches never see each other\'s stderr, id or output path', async () => {
  const script = (): string =>
    `case "$3" in\n*lens) echo '{"type":"assistant","session_id":"sess-lens-1"}'; echo '{"type":"result","session_id":"sess-lens-2"}'; echo lens-err >&2;;\n*) echo '{"type":"result","session_id":"sess-reviewer"}'; echo reviewer-err >&2;;\nesac\nsleep 0.2\nexit 1`;

  await withFakeClaude(script, async (dir) => {
    const cwd = '/Users/dev/parallel';
    const root = projectsRoot(cwd, { 'sess-lens-1': 'stale-lens', 'sess-lens-2': 'lens-words', 'sess-reviewer': 'reviewer-words' });
    const sessions = claudeAgentSessions();
    const [lens, reviewer] = await Promise.all([
      sessions.launch('lens', 'brief', launchOptions(join(dir, 'lens.out'), join(dir, 'lens.err')), new AbortController().signal),
      sessions.launch('reviewer', 'brief', launchOptions(join(dir, 'reviewer.out'), join(dir, 'reviewer.err')), new AbortController().signal),
    ]);

    assert.equal(lens.stderr, readFileSync(join(dir, 'lens.err'), 'utf8'));
    assert.equal(reviewer.stderr, readFileSync(join(dir, 'reviewer.err'), 'utf8'));
    assert.equal(lens.stderr, 'lens-err\n');
    assert.equal(reviewer.stderr, 'reviewer-err\n');
    assert.equal(lens.sessionId, 'sess-lens-2');
    assert.equal(reviewer.sessionId, 'sess-reviewer');

    await withProjects(root, () => {
      const said: Record<string, string[]> = { lens: [], reviewer: [] };
      sessions.postmortem?.(lens, (line) => said.lens!.push(line), { attempt: 1, cwd, dir });
      sessions.postmortem?.(reviewer, (line) => said.reviewer!.push(line), { attempt: 1, cwd, dir });

      assert.match(said.lens!.join('\n'), /lens-words/);
      assert.doesNotMatch(said.lens!.join('\n'), /reviewer-words|stale-lens/);
      assert.match(said.lens!.join('\n'), /output saved to lens\.out/);
      assert.match(said.reviewer!.join('\n'), /reviewer-words/);
      assert.match(said.reviewer!.join('\n'), /output saved to reviewer\.out/);
    });
  });
});

// R7 — successive attempts keep their own state, and a copy of a report diagnoses like the original.
test('a copied report yields the same diagnosis, and consecutive attempts never share state', async () => {
  const script = (dir: string): string =>
    `n=$(cat "${dir}/n" 2>/dev/null || echo 0)\nn=$((n + 1))\necho $n > "${dir}/n"\nif [ $n = 1 ]; then touch "$0"; echo '{"type":"result","session_id":"sess-a"}'; echo fail >&2; exit 1; fi\necho '{"type":"result","session_id":"sess-b"}'\nexit 0`;

  await withFakeClaude(script, async (dir, claudePath) => {
    utimesSync(claudePath, new Date(2020, 0, 1), new Date(2020, 0, 1));
    const cwd = '/Users/dev/attempts';
    const root = projectsRoot(cwd, { 'sess-a': 'first-words', 'sess-b': 'second-words' });
    const sessions = claudeAgentSessions();
    const first = await sessions.launch('implementer', 'brief', launchOptions(join(dir, 'implementer-attempt-1.out'), join(dir, 'implementer-attempt-1.err')), new AbortController().signal);
    const second = await sessions.launch('implementer', 'brief', launchOptions(join(dir, 'implementer-attempt-2.out'), join(dir, 'implementer-attempt-2.err')), new AbortController().signal);

    assert.equal(first.outcome.class, 'unrecognised');
    assert.equal(second.outcome.class, 'success');

    await withProjects(root, () => {
      const original: string[] = [];
      const copied: string[] = [];
      const later: string[] = [];
      sessions.postmortem?.(first, (line) => original.push(line), { attempt: 1, cwd, dir });
      sessions.postmortem?.({ ...first }, (line) => copied.push(line), { attempt: 1, cwd, dir });
      sessions.postmortem?.(second, (line) => later.push(line), { attempt: 2, cwd, dir });

      assert.deepEqual(copied, original);
      assert.match(original.join('\n'), /first-words/);
      assert.match(original.join('\n'), /auto-updater/);
      assert.match(later.join('\n'), /second-words/);
      assert.doesNotMatch(later.join('\n'), /first-words|auto-updater/);
    });
  });
});
