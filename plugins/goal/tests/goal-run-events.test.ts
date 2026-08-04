import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createReporter } from '../scripts/run/report.ts';
import { tmpDir } from './support/tmp.ts';

const plan = (): string => join(tmpDir('goal-run-events-'), 'plan-spec.md');

// R1 — every call into report.ts writes one JSON line, versioned, alongside the prose the run
// log has always carried.
test('say writes a versioned JSON line to <plan>.run.jsonl next to the prose in <plan>.run.log', () => {
  const target = plan();
  const reporter = createReporter();
  reporter.setLog(`${target}.run.log`);

  reporter.say('RUN a message');

  const log = readFileSync(`${target}.run.log`, 'utf8');
  assert.equal(log, 'RUN a message\n');

  const lines = readFileSync(`${target}.run.jsonl`, 'utf8').trim().split('\n');
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
  const target = plan();
  const reporter = createReporter();
  reporter.setLog(`${target}.run.log`);

  reporter.record('the agent said something');

  const log = readFileSync(`${target}.run.log`, 'utf8');
  assert.equal(log, 'the agent said something\n');

  const lines = readFileSync(`${target}.run.jsonl`, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);

  const event = JSON.parse(lines[0] ?? '');
  assert.equal(event.event, 'record');
  assert.equal(event.payload, 'the agent said something');
});

// R1 — record() called with blank text writes neither a prose line nor a JSON line, exactly as
// today's guard on `text.trim() !== ''`.
test('record ignores blank text on both artifacts', () => {
  const target = plan();
  const reporter = createReporter();
  reporter.setLog(`${target}.run.log`);

  reporter.record('   ');

  assert.throws(() => readFileSync(`${target}.run.log`, 'utf8'));
  assert.throws(() => readFileSync(`${target}.run.jsonl`, 'utf8'));
});

// R1 — stop() renders the one prose line it always has, and records that same call as a single
// JSON line carrying the exit code.
test('stop writes one JSON line carrying the exit code, and exits with it', () => {
  const target = plan();
  const modulePath = resolve(import.meta.dirname, '..', 'scripts', 'run', 'report.ts');
  const script = `
    import { createReporter } from ${JSON.stringify(modulePath)};
    const reporter = createReporter();
    reporter.setLog(${JSON.stringify(`${target}.run.log`)});
    reporter.stop('a refusal', 7);
  `;

  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });

  assert.equal(child.status, 7, child.stderr);

  const log = readFileSync(`${target}.run.log`, 'utf8');
  assert.equal(log, 'STOP a refusal\n');

  const lines = readFileSync(`${target}.run.jsonl`, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1, lines.join('\n'));

  const event = JSON.parse(lines[0] ?? '');
  assert.equal(event.event, 'stop');
  assert.equal(event.message, 'STOP a refusal');
  assert.equal(event.exit, 7);
});

// R1 — nothing writes either artifact before a plan is known: `setLog` is what turns the
// reporter on, and until then `say` still renders to stdout alone, unchanged.
test('before setLog, say renders to stdout only and writes no jsonl file at all', () => {
  const target = plan();
  const reporter = createReporter();

  reporter.say('RUN before any plan is known');

  assert.throws(() => readFileSync(`${target}.run.log`, 'utf8'));
  assert.throws(() => readFileSync(`${target}.run.jsonl`, 'utf8'));
});
