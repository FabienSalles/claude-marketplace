// The evidence a killed attempt used to take a half-day to dig up by hand, gathered here on
// every non-zero implementer exit: the attempt's own output, the dying session's transcript
// tail, and whether the `claude` binary itself changed underneath it. run/iteration.ts only
// calls postmortem() and narrates nothing itself, to respect its own 200-line ceiling. Every
// finding below is a prose event line through Reporter.say — the JSONL schema stays untouched.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { lastSessionId, projectDir } from '../core/events.ts';
import type { Reporter } from './report.ts';

// Overridable the same way advisory.ts's defaultSettingsPath() is: a test points it at a tmp
// directory rather than the real ~/.claude/projects.
const defaultProjectsRoot = (): string => process.env.GOAL_RUN_PROJECTS_ROOT ?? join(homedir(), '.claude', 'projects');

export const claudeBinaryPath = (): string | undefined => {
  const which = spawnSync('which', ['claude'], { encoding: 'utf8' });

  return which.status === 0 ? which.stdout.trim() : undefined;
};

// A binary this process cannot even locate says nothing about whether the auto-updater replaced
// it, so both a missing path and an unreadable one degrade to `undefined` rather than throwing.
export const claudeBinaryMtime = (path: string | undefined): number | undefined => {
  if (path === undefined) {
    return undefined;
  }

  try {
    return statSync(path).mtimeMs;
  } catch {
    return undefined;
  }
};

const persistAttemptOutput = (dir: string, attempt: number, output: string): void => {
  try {
    writeFileSync(join(dir, `implementer-attempt-${attempt}.out`), output);
  } catch {
    // An unwritable run directory degrades to less evidence, never to a crash.
  }
};

const transcriptTail = (sessionId: string | undefined, cwd: string, lines = 20): string[] => {
  if (sessionId === undefined) {
    return [];
  }

  const path = join(projectDir(cwd, defaultProjectsRoot()), `${sessionId}.jsonl`);

  if (!existsSync(path)) {
    return [];
  }

  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(-lines);
  } catch {
    return [];
  }
};

// `interruptedByShutdown: true` on the last entry is the platform's own word that this was a
// shutdown; its absence leaves the sender of the SIGTERM unnamed, flagged for the auditor.
const confirmedShutdown = (tail: string[]): boolean => tail.some((line) => line.includes('"interruptedByShutdown":true'));

export const postmortem = (
  reporter: Reporter,
  dir: string,
  attempt: number,
  cwd: string,
  status: number,
  stdout: string,
  stderr: string,
  binaryBefore: number | undefined,
): void => {
  persistAttemptOutput(dir, attempt, `${stdout}${stderr}`);
  reporter.say(`RUN postmortem: attempt ${attempt} exited ${status}, output saved to implementer-attempt-${attempt}.out`);

  const tail = transcriptTail(lastSessionId(stdout), cwd);

  if (tail.length === 0) {
    reporter.say('RUN postmortem: no transcript found for the dying session, evidence degrades to output and binary mtime alone');
  } else {
    const cls = confirmedShutdown(tail) ? 'shutdown (confirmed)' : 'sigterm (sender unknown)';
    reporter.say(`RUN postmortem: class is ${cls} — dying words: ${tail[tail.length - 1]}`);
  }

  const binaryAfter = claudeBinaryMtime(claudeBinaryPath());

  if (binaryBefore !== undefined && binaryAfter !== undefined && binaryBefore !== binaryAfter) {
    reporter.say('RUN postmortem: the claude binary\'s mtime changed during the attempt, naming the auto-updater');
  }
};
