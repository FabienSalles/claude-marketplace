import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { repo, run, sessionOf } from './support/goal-run-harness.ts';
import { narrate } from '../src/run/narrate.ts';

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

// R4 hole — a tool_use block with no file_path (a Bash call, addressed by its command rather
// than a path) still renders a target: narrate() falls back to input.command.
test('a tool use with no file_path renders its command as the target', () => {
  const seen: string[] = [];
  const reporter = { say: (message: string) => seen.push(message), record: () => {}, stop: () => { throw new Error('unexpected stop'); }, setLog: () => {} };
  const stdout = `${JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] },
  })}\n`;

  narrate(stdout, reporter);

  assert.ok(seen.includes('RUN implementer: Bash npm test'), `no command fallback rendered:\n${seen.join('\n')}`);
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
