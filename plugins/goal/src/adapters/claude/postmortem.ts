// The evidence a killed attempt used to take a half-day to dig up by hand, gathered here on
// every non-zero implementer exit: the attempt's own output, the dying session's transcript
// tail, and whether the `claude` binary itself changed underneath it. The runner only
// asks the adapter for it and narrates nothing itself. Every finding below is a prose event line through `say` — the JSONL schema stays untouched.

import { basename, join } from 'node:path';

import { command } from '../../adapters/command.ts';
import { fs } from '../../adapters/fs.ts';
import { projectDir } from '../../core/events.ts';
import { settingValue } from '../../core/settings.ts';
import type { AgentSessions } from '../../ports.ts';

// Overridable the same way warning.ts's defaultSettingsPath() is: a test points it at a tmp
// directory rather than the real ~/.claude/projects.
export const defaultProjectsRoot = (): string => settingValue('GOAL_RUN_PROJECTS_ROOT', process.env) ?? join(fs.homeDir(), '.claude', 'projects');

export const claudeBinaryPath = (): string | undefined => {
  const which = command.run('which', ['claude']);

  return which.status === 0 ? which.stdout.trim() : undefined;
};

// A binary this process cannot even locate says nothing about whether the auto-updater replaced
// it, so both a missing path and an unreadable one degrade to `undefined` rather than throwing.
export const claudeBinaryMtime = (path: string | undefined): number | undefined => {
  if (path === undefined) {
    return undefined;
  }

  try {
    return fs.mtime(path);
  } catch {
    return undefined;
  }
};

export type ClaudeLaunch = { stdout: string; outPath: string; binaryBefore: number | undefined };

export const claudeLaunchOf = (data: unknown): ClaudeLaunch | undefined => {
  if (typeof data !== 'object' || data === null || !('stdout' in data) || !('outPath' in data) || !('binaryBefore' in data)) {
    return undefined;
  }

  const { stdout, outPath, binaryBefore } = data;

  return typeof stdout === 'string' && typeof outPath === 'string' && (binaryBefore === undefined || typeof binaryBefore === 'number') ? { stdout, outPath, binaryBefore } : undefined;
};

const persistAttemptOutput = (path: string, output: string): void => {
  try {
    if (!fs.exists(path)) {
      fs.writeFile(path, output);
    }
  } catch {
    // An unwritable run directory degrades to less evidence, never to a crash.
  }
};

const transcriptTail = (sessionId: string | undefined, cwd: string, lines = 20): string[] => {
  if (sessionId === undefined) {
    return [];
  }

  const path = join(projectDir(cwd, defaultProjectsRoot()), `${sessionId}.jsonl`);

  if (!fs.exists(path)) {
    return [];
  }

  try {
    return fs.readFile(path)
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

export const postmortem: NonNullable<AgentSessions['postmortem']> = (report, say, { attempt, cwd, dir }) => {
  const launch = claudeLaunchOf(report.providerData) ?? { stdout: '', outPath: join(dir, `implementer-attempt-${attempt}.out`), binaryBefore: undefined };

  persistAttemptOutput(launch.outPath, `${launch.stdout}${report.stderr}`);
  say(`RUN postmortem: attempt ${attempt} exited ${report.end.status ?? 1}, output saved to ${basename(launch.outPath)}`);

  const tail = transcriptTail(report.sessionId, cwd);

  if (tail.length === 0) {
    say('RUN postmortem: no transcript found for the dying session, evidence degrades to output and binary mtime alone');
  } else {
    const cls = confirmedShutdown(tail) ? 'shutdown (confirmed)' : 'sigterm (sender unknown)';
    say(`RUN postmortem: class is ${cls} — dying words: ${tail[tail.length - 1]}`);
  }

  const binaryAfter = claudeBinaryMtime(claudeBinaryPath());

  if (launch.binaryBefore !== undefined && binaryAfter !== undefined && launch.binaryBefore !== binaryAfter) {
    say('RUN postmortem: the claude binary\'s mtime changed during the attempt, naming the auto-updater');
  }
};
