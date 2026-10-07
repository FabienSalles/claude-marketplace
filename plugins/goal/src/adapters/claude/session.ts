// The one place that knows how a session is launched with Claude Code and how its stream is read
// back: the binary, its flags, the agent each role is pinned to, and the failure class its
// terminal outcome falls in. The runner above it names a role and a brief and reads one report.

import { closeSync, openSync } from 'node:fs';

import { clock } from '../clock.ts';
import { command } from '../command.ts';
import { fs } from '../fs.ts';
import { ceiling } from '../../gate/bounded.ts';
import type { AgentOptions, AgentReport, AgentRole, AgentSessions } from '../../ports.ts';
import { classifyTerminal, finalResult } from './classify.ts';
import { autoUpdaterWarning } from './warning.ts';
import { claudeBinaryMtime, claudeBinaryPath, postmortem } from './postmortem.ts';
import { narrate } from './stream.ts';

const AGENTS: Record<AgentRole, string> = {
  implementer: 'goal:goal-run-implementer',
  lens: 'goal:goal-run-lens',
  reviewer: 'goal:goal-run-reviewer',
  auditor: 'goal:goal-run-auditor',
};

type End = { status: number | null; signal: NodeJS.Signals | null; error?: NodeJS.ErrnoException };

const readOrEmpty = (path: string): string => {
  try {
    return fs.readFile(path);
  } catch {
    return '';
  }
};

export const reportOf = (
  end: End,
  stdout: string,
  stderr: string,
  durationMs: number,
  paths: { outPath: string; errPath: string },
  narration: Pick<AgentOptions, 'onTool' | 'onSession'> = { onTool: () => {}, onSession: () => {} },
): AgentReport => {
  const extraction = narrate(stdout, { say: narration.onTool, session: narration.onSession });
  const outcome = classifyTerminal({ ...end, stdout, stderr });
  const { usage, model, peakTokens, compactions, ignoredLines } = extraction;
  const sessionId = [...stdout.matchAll(/"session_id":"([^"]+)"/g)].pop()?.[1];

  return {
    end,
    outcome: { text: finalResult(stdout) === undefined ? stdout : outcome.text, isError: outcome.isError, class: outcome.failed ? outcome.class : 'success', quote: outcome.quote },
    ...(usage === undefined ? {} : { consumption: { usage, model, peakTokens, compactions } }),
    ...(sessionId === undefined ? {} : { sessionId }),
    durationMs,
    ...paths,
    ignoredLines,
  };
};

export const claudeAgentSessions = (): AgentSessions => {
  const binaryBefore = new WeakMap<AgentReport, number | undefined>();

  return {
    launch: async (role, brief, options, stop) => {
      const started = clock.now();
      const before = claudeBinaryMtime(claudeBinaryPath());
      let end: End;

      try {
        const fdOut = openSync(options.outPath, 'w');
        const fdErr = openSync(options.errPath, 'w');

        try {
          const claudeArgs = ['-p', '--agent', AGENTS[role], '--permission-mode', 'auto', '--output-format', 'stream-json', '--verbose', brief];
          const ended = await command.spawn('/bin/sh', ['-c', `${ceiling()}\nexec "$@"`, 'sh', 'claude', ...claudeArgs], {
            encoding: 'utf8',
            env: { ...process.env, DISABLE_AUTOUPDATER: '1' },
            stdio: ['ignore', fdOut, fdErr],
            signal: stop,
          });

          end = { status: ended.status, signal: ended.signal ?? null, ...(ended.error === undefined ? {} : { error: ended.error }) };
        } finally {
          closeSync(fdOut);
          closeSync(fdErr);
        }
      } catch (error) {
        end = { status: null, signal: null, error: error as NodeJS.ErrnoException };
      }

      const report = reportOf(end, readOrEmpty(options.outPath), readOrEmpty(options.errPath), clock.now() - started, options, options);

      binaryBefore.set(report, before);

      return report;
    },
    startupWarning: () => autoUpdaterWarning(),
    postmortem: (report, say, { attempt, cwd, dir }) =>
      postmortem({ say }, dir, attempt, cwd, report.end.status ?? 1, readOrEmpty(report.outPath), readOrEmpty(report.errPath), binaryBefore.get(report)),
  };
};
