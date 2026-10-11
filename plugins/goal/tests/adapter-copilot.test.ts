import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { copilotAgentSessions } from '../src/adapters/copilot/session.ts';
import type { AgentReport, AgentRole } from '../src/ports.ts';
import { repo } from './support/goal-run-harness.ts';

const launch = async (env: Record<string, string>, continues = 3, role: AgentRole = 'implementer'): Promise<{ report: AgentReport; tools: string[]; sessions: string[]; args: string[]; dir: string }> => {
  const fixture = repo();
  const saved = { PATH: process.env.PATH, ...Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]])) };
  const tools: string[] = [];
  const sessions: string[] = [];

  process.env.PATH = `${fixture.bin}:${saved.PATH ?? ''}`;
  Object.assign(process.env, env);

  try {
    const report = await copilotAgentSessions(continues).launch(
      role,
      'the brief',
      { outPath: join(fixture.dir, 'out'), errPath: join(fixture.dir, 'err'), onTool: (line) => tools.push(line), onSession: (id) => sessions.push(id) },
      new AbortController().signal,
    );

    return { report, tools, sessions, args: readFileSync(join(fixture.dir, 'copilot-args.txt'), 'utf8').split('\n'), dir: fixture.dir };
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
test('the argv denies every git command that stages, commits, pushes or rewrites a ref', async () => {
  const { args } = await launch({});

  for (const denied of ['add', 'rm', 'mv', 'commit', 'push', 'update-index', 'update-ref', 'tag', 'reset', 'stash'].map((command) => `shell(git ${command})`)) {
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

const GIT_DENIED = ['add', 'rm', 'mv', 'commit', 'push', 'update-index', 'update-ref', 'tag', 'reset', 'stash'].map((command) => `shell(git ${command})`);
const ALLOWED = ['git log', 'git show', 'git diff', 'git status', 'git blame', 'git grep', 'git ls-files', 'git rev-parse', 'git branch', 'cat', 'head', 'tail', 'grep', 'ls', 'wc'].map((command) => `shell(${command})`);

const allowedOf = (args: string[]): string[] => args.flatMap((arg, i) => (args[i - 1] === '--allow-tool' ? [arg] : []));

// R11 — a close session is denied the ten git commands and never granted every tool.
test('a lens, a reviewer and an auditor get the read-only allowlist and the ten git denials, not --allow-all-tools', async () => {
  for (const role of ['lens', 'reviewer', 'auditor'] as const) {
    const { args } = await launch({}, 3, role);

    assert.equal(args.includes('--allow-all-tools'), false, role);
    assert.ok(args.includes('--no-ask-user'), role);

    for (const denied of GIT_DENIED) assert.equal(args[args.indexOf(denied) - 1], '--deny-tool', `${role} ${denied}`);

    assert.deepEqual(allowedOf(args).filter((tool) => tool.startsWith('shell(')), ALLOWED, role);
  }
});

// R9, R10 — only the auditor may write, and only its report.
test('the auditor alone may write, and only the absolute path of its report', async () => {
  const auditor = await launch({}, 3, 'auditor');

  assert.deepEqual(allowedOf(auditor.args).filter((tool) => tool.startsWith('write(')), [`write(${auditor.dir}/report.md)`]);

  for (const role of ['lens', 'reviewer'] as const) {
    assert.deepEqual(allowedOf((await launch({}, 3, role)).args).filter((tool) => tool.startsWith('write')), [], role);
  }
});

// R8 — the role's instructions, without the frontmatter, come before the brief.
test('the prompt of a close session is the agent file body, then the brief', async () => {
  for (const role of ['lens', 'reviewer', 'auditor'] as const) {
    const body = readFileSync(join(import.meta.dirname, '..', 'agents', `goal-run-${role}.md`), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').trim();
    const { args } = await launch({}, 3, role);
    const prompt = args.slice(args.indexOf('-p') + 1, args.indexOf('--output-format')).join('\n');

    assert.equal(prompt, `${body}\n\nthe brief`, role);
    assert.doesNotMatch(prompt, /^---/, role);
  }
});

// R9 — a refusal names the role that attempted it.
test('a refusal by a close session is named after its role', async () => {
  const { tools } = await launch({ FAKE_COPILOT_FIXTURE: 'denied-git' }, 3, 'lens');

  assert.ok(tools.some((line) => /^RUN lens: refused .*git add b\.txt/.test(line)), tools.join('\n'));
  assert.equal(tools.some((line) => line.startsWith('RUN implementer')), false);
  assert.equal(tools.some((line) => /^RUN lens: (?!refused)/.test(line)), false, 'a close session narrates refusals only');
});

test('the adapter names its provider', () => {
  assert.equal(copilotAgentSessions(3).provider, 'copilot');
});
