import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { copilotAgentSessions } from '../src/adapters/copilot/session.ts';
import type { AgentReport } from '../src/ports.ts';
import { repo } from './support/goal-run-harness.ts';

const launch = async (env: Record<string, string>, continues = 3): Promise<{ report: AgentReport; tools: string[]; sessions: string[]; args: string[] }> => {
  const fixture = repo();
  const saved = { PATH: process.env.PATH, ...Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]])) };
  const tools: string[] = [];
  const sessions: string[] = [];

  process.env.PATH = `${fixture.bin}:${saved.PATH ?? ''}`;
  Object.assign(process.env, env);

  try {
    const report = await copilotAgentSessions(continues).launch(
      'implementer',
      'the brief',
      { outPath: join(fixture.dir, 'out'), errPath: join(fixture.dir, 'err'), onTool: (line) => tools.push(line), onSession: (id) => sessions.push(id) },
      new AbortController().signal,
    );

    return { report, tools, sessions, args: readFileSync(join(fixture.dir, 'copilot-args.txt'), 'utf8').split('\n') };
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

// R6 — Copilot receives the very brief the runner built, as its prompt.
test('the prompt is the brief verbatim', async () => {
  const { args } = await launch({});

  assert.equal(args[args.indexOf('-p') + 1], 'the brief');
});

// R7 — stage, commit and push are denied in the argv itself.
test('the argv denies git add, git commit and git push', async () => {
  const { args } = await launch({});

  for (const denied of ['shell(git add)', 'shell(git commit)', 'shell(git push)']) {
    assert.equal(args[args.indexOf(denied) - 1], '--deny-tool', denied);
  }
});

// R9 — no question reaches a human, no permission is granted by prompt.
test('the argv disables the ask-user tool and leaves no terminal to answer on', async () => {
  const { args, report } = await launch({});

  assert.ok(args.includes('--no-ask-user'));
  assert.ok(args.includes('--allow-all-tools'));
  assert.equal(report.end.status, 0);
});

// R10 — the continuation cap is the launch setting.
test('the continuation cap rides on the argv', async () => {
  assert.equal((await launch({})).args.join(' ').includes('--autopilot --max-autopilot-continues 3'), true);
  assert.equal((await launch({}, 7)).args.join(' ').includes('--max-autopilot-continues 7'), true);
  assert.equal((await launch({}, 0)).args.join(' ').includes('--max-autopilot-continues 0'), true);
});

test('the report carries the session, the exit, the model and the token counts of a clean session', async () => {
  const { report, sessions } = await launch({ FAKE_COPILOT_FIXTURE: 'autopilot-complete' });

  assert.equal(report.end.status, 0);
  assert.equal(report.outcome.class, 'success');
  assert.equal(report.outcome.isError, false);
  assert.equal(report.consumption?.model, 'mai-code-1.1-flash');
  assert.equal(typeof report.consumption?.inputTokens, 'number');
  assert.equal(typeof report.consumption?.outputTokens, 'number');
  assert.match(report.sessionId ?? '', /^c4bd2667-b43f-419f-b907-3394b1ef07bb$/);
  assert.deepEqual(sessions, [report.sessionId]);
});

// R7 — a refusal is a line of the run log naming the command.
test('a denied tool becomes an onTool line naming the refused command', async () => {
  const { tools, report } = await launch({ FAKE_COPILOT_FIXTURE: 'denied-git' });

  assert.ok(tools.some((line) => /refused/.test(line) && line.includes("git add b.txt && git commit -m 'feat: b'")), tools.join('\n'));
  assert.equal(report.outcome.class, 'success');
});

test('a non-zero exit is a failure the runner does not recognise', async () => {
  const { report } = await launch({ FAKE_COPILOT_EXIT: '1' });

  assert.equal(report.end.status, 1);
  assert.equal(report.outcome.isError, true);
  assert.equal(report.outcome.class, 'unrecognised');
});

test('only the implementer role is launched', async () => {
  await assert.rejects(copilotAgentSessions(3).launch('lens', 'brief', { outPath: '/dev/null', errPath: '/dev/null', onTool: () => {}, onSession: () => {} }, new AbortController().signal), /implementer/);
});

test('the adapter names its provider', () => {
  assert.equal(copilotAgentSessions(3).provider, 'copilot');
});
