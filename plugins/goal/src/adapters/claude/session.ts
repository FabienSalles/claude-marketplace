// The one place that knows how a session is launched with Claude Code and how its stream is read
// back: the binary, its flags, the agent each role is pinned to, and the failure class its
// terminal outcome falls in. The runner above it names a role and a brief and reads one report.

import { closeSync, openSync } from 'node:fs';

import { clock } from '../clock.ts';
import { command } from '../command.ts';
import { fs } from '../fs.ts';
import { ceiling } from '../../gate/bounded.ts';
import type { AgentOptions, AgentReport, AgentRole, AgentSessions, Consumption } from '../../ports.ts';
import { classifyTerminal, finalResult } from './classify.ts';
import { autoUpdaterWarning } from './warning.ts';
import { claudeBinaryMtime, claudeBinaryPath, postmortem, type ClaudeLaunch } from './postmortem.ts';
import { narrate } from './stream.ts';

const AGENTS: Record<AgentRole, string> = {
  implementer: 'goal:goal-run-implementer',
  lens: 'goal:goal-run-lens',
  reviewer: 'goal:goal-run-reviewer',
  auditor: 'goal:goal-run-auditor',
};

const EFFECTIVE_WINDOWS: Record<string, number> = {
  'claude-sonnet-5': 200_000,
  'claude-sonnet-5-5': 1_000_000,
  'claude-opus-4-6': 200_000,
  'claude-opus-4-7': 1_000_000,
  'claude-opus-4-8': 1_000_000,
  'claude-opus-5': 1_000_000,
  'claude-opus-5-5': 1_000_000,
  'claude-haiku-4-5': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
  'claude-haiku-5-5': 1_000_000,
  'claude-fable-5': 1_000_000,
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
  launch: { outPath: string; binaryBefore?: number | undefined },
  narration: Pick<AgentOptions, 'onTool' | 'onSession'> = { onTool: () => {}, onSession: () => {} },
): AgentReport => {
  const extraction = narrate(stdout, { say: narration.onTool, session: narration.onSession });
  const outcome = classifyTerminal({ ...end, stdout, stderr });
  const { usage, model, peakTokens, compactions, ignoredLines, sessionId } = extraction;
  const window = model === undefined ? undefined : EFFECTIVE_WINDOWS[model];
  const consumption: Consumption | undefined =
    usage === undefined
      ? undefined
      : {
          ...(usage.input_tokens === undefined ? {} : { inputTokens: usage.input_tokens }),
          ...(usage.output_tokens === undefined ? {} : { outputTokens: usage.output_tokens }),
          ...(usage.cache_creation_input_tokens === undefined ? {} : { cacheCreationInputTokens: usage.cache_creation_input_tokens }),
          ...(usage.cache_read_input_tokens === undefined ? {} : { cacheReadInputTokens: usage.cache_read_input_tokens }),
          ...(peakTokens === undefined ? {} : { contextTokens: peakTokens }),
          ...(window === undefined ? {} : { contextWindow: window }),
          compactions,
          ...(model === undefined ? {} : { model }),
        };
  const providerData: ClaudeLaunch = { stdout, outPath: launch.outPath, binaryBefore: launch.binaryBefore };

  return {
    end,
    outcome: { text: finalResult(stdout) === undefined ? stdout : outcome.text, isError: outcome.isError, class: outcome.failed ? outcome.class : 'success', quote: outcome.quote },
    ...(consumption === undefined ? {} : { consumption }),
    ...(sessionId === undefined ? {} : { sessionId }),
    stderr,
    durationMs,
    ignoredLines,
    providerData,
  };
};

export const claudeAgentSessions = (): AgentSessions => {
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

      return reportOf(end, readOrEmpty(options.outPath), readOrEmpty(options.errPath), clock.now() - started, { outPath: options.outPath, binaryBefore: before }, options);
    },
    startupWarning: () => autoUpdaterWarning(),
    postmortem,
  };
};
