import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { narrate, resultEnvelope, tokensLine } from '../src/run/narrate.ts';
import { createReporter } from '../src/run/report.ts';
import { tmpDir } from './support/tmp.ts';
import { jsonlOf, PLAN, repo, run } from './support/goal-run-harness.ts';

const dir = (): string => tmpDir('goal-run-events-');

// R1 — every call into report.ts writes one JSON line, versioned, alongside the prose the run
// log has always carried.
test('say writes a versioned JSON line to .run.jsonl next to the prose in .run.log', () => {
  const target = dir();
  const reporter = createReporter();
  reporter.setLog(target);

  reporter.say('RUN a message');

  const log = readFileSync(join(target, '.run.log'), 'utf8');
  assert.equal(log, 'RUN a message\n');

  const lines = readFileSync(join(target, '.run.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);

  const event = JSON.parse(lines[0] ?? '');
  assert.equal(event.v, 1);
  assert.match(event.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(event.event, 'say');
  assert.equal(event.message, 'RUN a message');
});

// R1 — record() carries the agent's own output as an event payload, not as a prose line: it
// never reaches stdout, exactly as today.
test('record writes a JSON line carrying the text as payload, and no prose reaches stdout', () => {
  const target = dir();
  const reporter = createReporter();
  reporter.setLog(target);

  reporter.record('the agent said something');

  const log = readFileSync(join(target, '.run.log'), 'utf8');
  assert.equal(log, 'the agent said something\n');

  const lines = readFileSync(join(target, '.run.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);

  const event = JSON.parse(lines[0] ?? '');
  assert.equal(event.event, 'record');
  assert.equal(event.payload, 'the agent said something');
});

// R1 — record() called with blank text writes neither a prose line nor a JSON line, exactly as
// today's guard on `text.trim() !== ''`.
test('record ignores blank text on both artifacts', () => {
  const target = dir();
  const reporter = createReporter();
  reporter.setLog(target);

  reporter.record('   ');

  assert.throws(() => readFileSync(join(target, '.run.log'), 'utf8'));
  assert.throws(() => readFileSync(join(target, '.run.jsonl'), 'utf8'));
});

// R1 — stop() renders the one prose line it always has, and records that same call as a single
// JSON line carrying the exit code.
test('stop writes one JSON line carrying the exit code, and exits with it', () => {
  const target = dir();
  const modulePath = resolve(import.meta.dirname, '..', 'src', 'run', 'report.ts');
  const script = `
    import { createReporter } from ${JSON.stringify(modulePath)};
    const reporter = createReporter();
    reporter.setLog(${JSON.stringify(target)});
    reporter.stop('a refusal', 7);
  `;

  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });

  assert.equal(child.status, 7, child.stderr);

  const log = readFileSync(join(target, '.run.log'), 'utf8');
  assert.equal(log, 'STOP a refusal\n');

  const lines = readFileSync(join(target, '.run.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1, lines.join('\n'));

  const event = JSON.parse(lines[0] ?? '');
  assert.equal(event.event, 'stop');
  assert.equal(event.message, 'STOP a refusal');
  assert.equal(event.exit, 7);
});

// R1 — nothing writes either artifact before a plan is known: `setLog` is what turns the
// reporter on, and until then `say` still renders to stdout alone, unchanged.
test('before setLog, say renders to stdout only and writes no jsonl file at all', () => {
  const target = dir();
  const reporter = createReporter();

  reporter.say('RUN before any plan is known');

  assert.throws(() => readFileSync(join(target, '.run.log'), 'utf8'));
  assert.throws(() => readFileSync(join(target, '.run.jsonl'), 'utf8'));
});

// R19 — every stage the runner times — preflight, the implementer session, the gate verdict
// call, and the push — writes a `stage=<name> duration_ms=<n> exit=<n>` event into the run's own
// jsonl, so the next run report has a real column per stage instead of one elapsed figure.
test('a landed run records a stage event with duration_ms and exit for preflight, implementer, gate and push', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);

  const lines = readFileSync(jsonlOf(fixture), 'utf8').trim().split('\n');
  const messages = lines.map((line) => (JSON.parse(line) as { event: string; message?: string }).message ?? '').join('\n');

  const stage = (name: string) => new RegExp(`^RUN stage=${name} duration_ms=\\d+ exit=\\d+$`, 'm');

  for (const name of ['preflight', 'implementer', 'gate', 'push']) {
    assert.match(messages, stage(name), `no stage=${name} event was recorded:\n${messages}`);
  }
});

// R20 — the implementer's stream-json result event carries the session's token usage, in the
// same four classes every Claude session bills in; narrate() hands that usage back to its caller
// rather than swallowing it.
test('narrate returns the four token classes carried by the result event', () => {
  const reporter = createReporter();
  const stdout = [
    JSON.stringify({ type: 'assistant', session_id: 's1', message: { content: [] } }),
    JSON.stringify({
      type: 'result',
      session_id: 's1',
      usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 },
    }),
  ].join('\n');

  const extraction = narrate(stdout, reporter);

  assert.deepEqual(extraction.usage, { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 });
});

// R20 — a result event carrying no usage (an older CLI, a stubbed fixture) leaves narrate()
// returning undefined rather than a fabricated zero.
test('narrate returns undefined usage when no result event carries usage', () => {
  const reporter = createReporter();
  const stdout = JSON.stringify({ type: 'result', session_id: 's1' });

  const extraction = narrate(stdout, reporter);

  assert.equal(extraction.usage, undefined);
});

// R21 — the served model is read from an assistant event's own `message.model` field when the
// stream carries one.
test('narrate reads the served model off an assistant event\'s own model field', () => {
  const reporter = createReporter();
  const stdout = JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5', content: [] } });

  const extraction = narrate(stdout, reporter);

  assert.equal(extraction.model, 'claude-sonnet-5');
});

// R21 — the served model is read from the result event's `modelUsage` key when no assistant event
// named one first.
test('narrate falls back to the result event\'s modelUsage key for the served model', () => {
  const reporter = createReporter();
  const stdout = JSON.stringify({ type: 'result', modelUsage: { 'claude-fable-5': {} } });

  const extraction = narrate(stdout, reporter);

  assert.equal(extraction.model, 'claude-fable-5');
});

// R21 — the context peak is the highest single assistant turn's input + cache read + cache
// creation tokens, not the sum across turns.
test('narrate reads the context peak as the max, not the sum, over assistant usage blocks', () => {
  const reporter = createReporter();
  const stdout = [
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 100, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }),
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: 5, cache_read_input_tokens: 5 } } }),
  ].join('\n');

  const extraction = narrate(stdout, reporter);

  assert.equal(extraction.peakTokens, 100);
});

// R21 — a partial usage block (an absent class, not merely a zero one) still yields a peak, never
// NaN: each usage-class read defaults the missing class to 0.
test('narrate reads the context peak as a number, never NaN, when a usage class is absent', () => {
  const reporter = createReporter();
  const stdout = JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 100 } } });

  const extraction = narrate(stdout, reporter);

  assert.equal(extraction.peakTokens, 100);
});

// R21 — both verified compaction marker shapes are counted: a `compact_boundary` system event,
// and a `isCompactSummary` flag on the summary message it produces.
test('narrate counts both verified compaction marker shapes', () => {
  const reporter = createReporter();
  const stdout = [
    JSON.stringify({ type: 'system', subtype: 'compact_boundary' }),
    JSON.stringify({ type: 'user', isCompactSummary: true }),
  ].join('\n');

  const extraction = narrate(stdout, reporter);

  assert.equal(extraction.compactions, 2);
});

// R21 — a stream with no compaction marker at all reports zero, never undefined: a count is
// always meaningful, even when nothing compacted.
test('narrate reports zero compactions when the stream never compacted', () => {
  const reporter = createReporter();
  const stdout = JSON.stringify({ type: 'result' });

  const extraction = narrate(stdout, reporter);

  assert.equal(extraction.compactions, 0);
});

// R21 — lens, reviewer and auditor answer `--output-format stream-json`: the same event stream
// narrate() already parses, its prose in the terminal result event's `result` field, its usage and
// served model extracted the same way. resultEnvelope() is what extracts all of it.
test('resultEnvelope extracts the text, usage and model from a stream-json envelope', () => {
  const raw = [
    JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5', content: [] } }),
    JSON.stringify({
      type: 'result',
      result: 'the lens finding',
      usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 },
    }),
  ].join('\n');

  const { text, usage, model } = resultEnvelope(raw);

  assert.equal(text, 'the lens finding');
  assert.deepEqual(usage, { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 });
  assert.equal(model, 'claude-sonnet-5');
});

// Implementation trap — an agent still answering bare prose (an un-updated fixture, or a CLI that
// never wrapped its answer) must not have its text swallowed by the extraction step: resultEnvelope
// falls back to the raw text, with no usage.
test('resultEnvelope falls back to the raw text when the input is not a json envelope', () => {
  const { text, usage } = resultEnvelope('plain prose, no envelope here');

  assert.equal(text, 'plain prose, no envelope here');
  assert.equal(usage, undefined);
});

// R20 — the one line format a Claude-session stage reports its cost in, so a run report can total
// the four classes without re-deriving them from a `stage=` line that carries none.
test('tokensLine formats the four classes for a named stage', () => {
  const line = tokensLine('lens', {
    usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 },
    compactions: 0,
  });

  assert.equal(line, 'RUN tokens stage=lens input_tokens=1 output_tokens=2 cache_creation_input_tokens=3 cache_read_input_tokens=4 compactions=0');
});

// R21 — the peak reads against the served model's own effective window: a known model carries
// both the raw tokens and the percentage they represent of that window.
test('tokensLine reads the peak against the served model\'s effective window', () => {
  const line = tokensLine('implementer', {
    usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 },
    model: 'claude-sonnet-5',
    peakTokens: 100_000,
    compactions: 1,
  });

  assert.match(line ?? '', /model=claude-sonnet-5 context_tokens=100000 context_pct=50% compactions=1$/);
});

// R21 — the unknown-model rule: a served model absent from the effective-window map still reports
// its peak in tokens, with no percentage to read it against.
test('tokensLine reports the peak in tokens with no percentage for an unmapped model', () => {
  const line = tokensLine('implementer', {
    usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 },
    model: 'claude-unknown-9',
    peakTokens: 12_345,
    compactions: 0,
  });

  assert.match(line ?? '', /model=claude-unknown-9 context_tokens=12345 compactions=0$/);
  assert.ok(!(line ?? '').includes('context_pct'), `an unmapped model still reported a percentage:\n${line}`);
});

// R20 — a non-session stage (the gate, `gh pr ready`, a push) never carries usage, and
// tokensLine() reports that by returning nothing to emit, rather than a line of dashes.
test('tokensLine returns undefined when there is no usage to report', () => {
  assert.equal(tokensLine('gate', undefined), undefined);
});

// R20 / R21 — driven end to end against the fixture's fake `claude`, a landed run's own
// .run.jsonl carries a token line for every runner-spawned session — the implementer and the
// lens, reviewer and auditor, all stream-json now — each carrying the served model, the context
// peak against its effective window, and a compaction count, never left with an empty cell.
test('a driven iteration and close land a token line carrying model, peak and compactions for every session', () => {
  const fixture = repo({ planText: PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n'), remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GH_PR_EXISTS: '1',
    FAKE_CLAUDE_COMPACT: '1',
  });

  assert.equal(code, 0, output);

  const lines = readFileSync(jsonlOf(fixture), 'utf8').trim().split('\n');
  const messages = lines.map((line) => (JSON.parse(line) as { event: string; message?: string }).message ?? '').join('\n');

  const tokens = (stage: string) =>
    new RegExp(
      `^RUN tokens stage=${stage} input_tokens=\\d+ output_tokens=\\d+ cache_creation_input_tokens=\\d+ cache_read_input_tokens=\\d+ ` +
        `model=claude-sonnet-5 context_tokens=50000 context_pct=25% compactions=1$`,
      'm',
    );

  for (const stage of ['implementer', 'lens', 'reviewer', 'auditor']) {
    assert.match(messages, tokens(stage), `no full token line for stage=${stage}:\n${messages}`);
  }
});

// R3 — the seven `STOP ...` lines goal-run.ts, iteration.ts and close.ts write themselves, ahead
// of a bare process.exit(...), never go through reporter.stop(): each still lands on .run.jsonl
// as a plain 'say' event, carrying no 'exit' field, exactly like every other reporter.say() call.
const sayEvent = (fixture: ReturnType<typeof repo>, prefix: string): { event: string; message: string } => {
  const lines = readFileSync(jsonlOf(fixture), 'utf8').trim().split('\n');
  const events = lines.map((line) => JSON.parse(line) as { event: string; message?: string });
  const found = events.find((event) => (event.message ?? '').startsWith(prefix));

  assert.ok(found, `no event found for prefix "${prefix}":\n${events.map((event) => event.message).join('\n')}`);

  return found as { event: string; message: string };
};

const assertPlainSay = (event: object): void => {
  assert.equal((event as { event: string }).event, 'say');
  assert.equal('exit' in event, false, JSON.stringify(event));
};

test('the "gate will not run iteration" STOP (goal-run.ts) stays a say event with no exit field', () => {
  const fixture = repo();

  const { code } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_CHECK_EXIT: '1' });

  assert.equal(code, 2);
  assertPlainSay(sayEvent(fixture, 'STOP the gate will not run iteration'));
});

test('the "gate published no plan_hash" STOP (goal-run.ts) stays a say event with no exit field', () => {
  const fixture = repo();
  const gate = join(fixture.bin, 'no-hash-gate');

  writeFileSync(
    gate,
    `#!/bin/sh
case "$1" in
  check)  printf 'OK\\n'; exit 0 ;;
  lock)   mkdir "$2.run.lock" 2>/dev/null; exit 0 ;;
  unlock) rm -rf "$2.run.lock"; exit 0 ;;
esac
exit 2
`,
  );
  chmodSync(gate, 0o755);

  const { code } = run(fixture, [fixture.plan, '1'], { GOAL_GATE: gate });

  assert.equal(code, 2);
  assertPlainSay(sayEvent(fixture, 'STOP the gate published no plan_hash'));
});

test('the "iteration(s) landed" STOP (goal-run.ts) stays a say event with no exit field', () => {
  const fixture = repo();

  const { code } = run(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0);
  assertPlainSay(sayEvent(fixture, 'STOP 1 iteration(s) landed'));
});

test('the "gate could not be run" STOP (iteration.ts) stays a say event with no exit field', () => {
  const fixture = repo();

  const { code } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '2',
  });

  assert.equal(code, 3);
  assertPlainSay(sayEvent(fixture, 'STOP the gate could not be run'));
});

test('the "refused by the gate" STOP (iteration.ts) stays a say event with no exit field', () => {
  const fixture = repo();

  const { code } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '1',
  });

  assert.equal(code, 1);
  assertPlainSay(sayEvent(fixture, 'STOP iteration 1 was refused by the gate'));
});

test('the "Definition of Done could not be run" STOP (close.ts) stays a say event with no exit field', () => {
  const fixture = repo();

  const { code } = run(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_DOD_EXIT: '2',
  });

  assert.equal(code, 3);
  assertPlainSay(sayEvent(fixture, 'STOP the global Definition of Done could not be run'));
});

test('the "Definition of Done refused this run" STOP (close.ts) stays a say event with no exit field', () => {
  const fixture = repo();

  const { code } = run(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_DOD_EXIT: '1',
  });

  assert.equal(code, 1);
  assertPlainSay(sayEvent(fixture, 'STOP the global Definition of Done refused this run'));
});
