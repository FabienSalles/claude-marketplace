import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

import { git, repo, run } from './support/goal-run-harness.ts';

const COPILOT = { GOAL_RUN_IMPLEMENTER: 'copilot', FAKE_GATE_COMMITS: '1' };

const untouched = (fixture: { dir: string }): void => {
  assert.equal(existsSync(join(fixture.dir, '.goal')), false, 'a run record was written');
  assert.equal(git(fixture.dir, 'status', '--porcelain').stdout.trim(), '');
};

test('a Copilot launch with no copilot on PATH is refused as not installed, before any write', () => {
  const fixture = repo();

  rmSync(join(fixture.bin, 'copilot'));
  symlinkSync(process.execPath, join(fixture.bin, 'node'));

  const { code, output } = run(fixture, [fixture.plan, '1'], { ...COPILOT, PATH: `${fixture.bin}:/usr/bin:/bin` });

  assert.equal(code, 2, output);
  assert.match(output, /Copilot CLI is not installed \(no `copilot` on PATH\)/);
  untouched(fixture);
});

test('a probe that exits non-zero is refused as unable to run a session, quoting stderr', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { ...COPILOT, FAKE_COPILOT_EXIT: '1', FAKE_COPILOT_STDERR: 'Error: No authentication information found.' });

  assert.equal(code, 2, output);
  assert.match(output, /Copilot CLI is installed but cannot run a session \(not authenticated\?\)/);
  assert.match(output, /No authentication information found/);
  untouched(fixture);
});

test('a probe with no result event is refused as unable to run a session', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { ...COPILOT, FAKE_COPILOT_RAW: '{"type":"session.start"}' });

  assert.equal(code, 2, output);
  assert.match(output, /cannot run a session/);
  untouched(fixture);
});

test('a probe whose result carries a non-zero exitCode is refused as unable to run a session', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { ...COPILOT, FAKE_COPILOT_RAW: '{"type":"result","exitCode":1}' });

  assert.equal(code, 2, output);
  assert.match(output, /cannot run a session/);
  untouched(fixture);
});

test('a Claude launch runs no Copilot check, even when Copilot is broken', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_COMMITS: '1', FAKE_COPILOT_EXIT: '1', FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.equal(existsSync(join(fixture.dir, 'copilot-args.txt')), false);
});

test('a working probe lets the Copilot launch through', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { ...COPILOT, FAKE_COPILOT_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
});

// R6 — any role on Copilot triggers the probe.
test('GOAL_RUN_PROVIDER=copilot with a Claude implementer is refused at launch when Copilot is broken', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], {
    GOAL_RUN_PROVIDER: 'copilot',
    GOAL_RUN_IMPLEMENTER: 'claude',
    FAKE_GATE_COMMITS: '1',
    FAKE_COPILOT_EXIT: '1',
    FAKE_COPILOT_STDERR: 'Error: No authentication information found.',
  });

  assert.equal(code, 2, output);
  assert.match(output, /Copilot CLI is installed but cannot run a session \(not authenticated\?\)/);
  untouched(fixture);
});

test('GOAL_RUN_PROVIDER=copilot with no copilot on PATH is refused as not installed', () => {
  const fixture = repo();

  rmSync(join(fixture.bin, 'copilot'));
  symlinkSync(process.execPath, join(fixture.bin, 'node'));

  const { code, output } = run(fixture, [fixture.plan, '1'], { GOAL_RUN_PROVIDER: 'copilot', GOAL_RUN_IMPLEMENTER: 'claude', FAKE_GATE_COMMITS: '1', PATH: `${fixture.bin}:/usr/bin:/bin` });

  assert.equal(code, 2, output);
  assert.match(output, /Copilot CLI is not installed/);
  untouched(fixture);
});
