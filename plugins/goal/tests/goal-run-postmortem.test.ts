import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { claudeBinaryMtime, claudeBinaryPath, postmortem } from '../src/adapters/claude/postmortem.ts';
import { reportOf } from '../src/adapters/claude/session.ts';
import type { AgentReport } from '../src/ports.ts';
import { tmpDir } from './support/tmp.ts';

const fakeReporter = (): { lines: string[]; say: (line: string) => void } => {
  const lines: string[] = [];

  return { lines, say: (m) => lines.push(m) };
};

const failedReport = (dir: string, stdout: string, stderr: string, binaryBefore?: number, attempt = 1): AgentReport =>
  reportOf({ status: 1, signal: null }, stdout, stderr, 5, { outPath: join(dir, `implementer-attempt-${attempt}.out`), ...(binaryBefore === undefined ? {} : { binaryBefore }) });

const diagnose = (reporter: { say: (line: string) => void }, dir: string, attempt: number, cwd: string, stdout: string, stderr: string, binaryBefore?: number): void =>
  postmortem(failedReport(dir, stdout, stderr, binaryBefore, attempt), reporter.say, { attempt, cwd, dir });

const withEnv = (key: string, value: string, fn: () => void): void => {
  const original = process.env[key];
  process.env[key] = value;

  try {
    fn();
  } finally {
    process.env[key] = original;
  }
};

const transcriptFixture = (sessionId: string, shutdown: boolean): { root: string; cwd: string } => {
  const root = tmpDir('postmortem-projects-');
  const cwd = '/Users/dev/my-repo';
  const projectPath = join(root, '-Users-dev-my-repo');
  mkdirSync(projectPath, { recursive: true });
  const marker = shutdown ? ',"interruptedByShutdown":true' : '';
  writeFileSync(join(projectPath, `${sessionId}.jsonl`), `{"type":"assistant"}\n{"type":"user"${marker},"sessionId":"${sessionId}"}\n`);

  return { root, cwd };
};

// Business rule: a killed attempt leaves its evidence — the attempt's own output.
test('a non-zero exit persists the attempt\'s full stdout and stderr to the run directory', () => {
  const dir = tmpDir('postmortem-');
  const reporter = fakeReporter();

  diagnose(reporter, dir, 2, tmpDir('postmortem-cwd-'), 'out line', 'err line');

  assert.equal(readFileSync(join(dir, 'implementer-attempt-2.out'), 'utf8'), 'out lineerr line');
  assert.match(reporter.lines.join('\n'), /implementer-attempt-2\.out/);
});

test('an unwritable run directory degrades silently instead of crashing', () => {
  const dir = tmpDir('postmortem-readonly-');
  chmodSync(dir, 0o500);

  try {
    assert.doesNotThrow(() => diagnose(fakeReporter(), dir, 1, tmpDir('postmortem-cwd-'), 'out', ''));
  } finally {
    chmodSync(dir, 0o700);
  }
});

// Business rule: a killed attempt leaves its evidence — the dying session's transcript confirms
// or names unknown the class of the kill.
test('a transcript carrying interruptedByShutdown upgrades the class to shutdown (confirmed)', () => {
  const { root, cwd } = transcriptFixture('sess-1', true);
  const reporter = fakeReporter();

  withEnv('GOAL_RUN_PROJECTS_ROOT', root, () =>
    diagnose(reporter, tmpDir('postmortem-'), 1, cwd, '{"type":"result","session_id":"sess-1"}\n', ''));

  assert.match(reporter.lines.join('\n'), /shutdown \(confirmed\)/);
});

test('a transcript without interruptedByShutdown marks the class sigterm (sender unknown)', () => {
  const { root, cwd } = transcriptFixture('sess-2', false);
  const reporter = fakeReporter();

  withEnv('GOAL_RUN_PROJECTS_ROOT', root, () =>
    diagnose(reporter, tmpDir('postmortem-'), 1, cwd, '{"type":"result","session_id":"sess-2"}\n', ''));

  assert.match(reporter.lines.join('\n'), /sigterm \(sender unknown\)/);
});

// Business rule: a killed attempt leaves its evidence — a missing transcript degrades to less
// evidence, never to a crash.
test('no session id and no transcript degrade silently, without crashing', () => {
  const reporter = fakeReporter();

  withEnv('GOAL_RUN_PROJECTS_ROOT', tmpDir('postmortem-projects-'), () =>
    assert.doesNotThrow(() => diagnose(reporter, tmpDir('postmortem-'), 1, '/Users/dev/never-ran', 'plain text, no json', '')));

  assert.match(reporter.lines.join('\n'), /no transcript found/);
});

const withFakeClaude = (fn: (path: string) => void): void => {
  const bin = tmpDir('postmortem-bin-');
  const claudePath = join(bin, 'claude');
  writeFileSync(claudePath, '#!/bin/sh\nexit 0\n');
  chmodSync(claudePath, 0o755);

  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath ?? ''}`;

  try {
    fn(claudePath);
  } finally {
    process.env.PATH = originalPath;
  }
};

// Business rule: a killed attempt leaves its evidence — the claude binary's mtime, compared
// before and after the attempt, names the auto-updater when it changed.
test('a changed claude binary mtime names the auto-updater in the log line', () => {
  withFakeClaude((claudePath) => {
    const before = claudeBinaryMtime(claudeBinaryPath());
    utimesSync(claudePath, new Date(Date.now() + 60_000), new Date(Date.now() + 60_000));

    const reporter = fakeReporter();
    diagnose(reporter, tmpDir('postmortem-'), 1, tmpDir('postmortem-cwd-'), 'out', '', before);

    assert.match(reporter.lines.join('\n'), /auto-updater/);
  });
});

test('an unchanged claude binary mtime names no auto-updater', () => {
  withFakeClaude(() => {
    const before = claudeBinaryMtime(claudeBinaryPath());
    const reporter = fakeReporter();
    diagnose(reporter, tmpDir('postmortem-'), 1, tmpDir('postmortem-cwd-'), 'out', '', before);

    assert.doesNotMatch(reporter.lines.join('\n'), /auto-updater/);
  });
});

test('claudeBinaryMtime degrades to undefined for a missing path or no path at all', () => {
  assert.equal(claudeBinaryMtime(join(tmpDir('postmortem-missing-'), 'claude')), undefined);
  assert.equal(claudeBinaryMtime(undefined), undefined);
});

// Business rule: the output saved is the file the launch was actually given.
test('the saved-output line names the file the launch was given, and the evidence lands there', () => {
  const dir = tmpDir('postmortem-');
  const reporter = fakeReporter();
  const report = reportOf({ status: 1, signal: null }, 'out line', 'err line', 5, { outPath: join(dir, 'given-elsewhere.out') });

  postmortem(report, reporter.say, { attempt: 4, cwd: tmpDir('postmortem-cwd-'), dir });

  assert.match(reporter.lines.join('\n'), /output saved to given-elsewhere\.out/);
  assert.doesNotMatch(reporter.lines.join('\n'), /implementer-attempt-4/);
  assert.equal(readFileSync(join(dir, 'given-elsewhere.out'), 'utf8'), 'out lineerr line');
});

// Business rule: the transcript is found by the report's own session id, the last one announced.
test('the transcript is found by the final id the stream announced', () => {
  const { root, cwd } = transcriptFixture('sess-final', true);
  const reporter = fakeReporter();
  const stdout = '{"type":"assistant","session_id":"sess-early"}\n{"type":"result","session_id":"sess-final"}\n';

  withEnv('GOAL_RUN_PROJECTS_ROOT', root, () => diagnose(reporter, tmpDir('postmortem-'), 1, cwd, stdout, ''));

  assert.match(reporter.lines.join('\n'), /shutdown \(confirmed\)/);
});
