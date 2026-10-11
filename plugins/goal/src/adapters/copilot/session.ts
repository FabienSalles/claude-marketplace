import { closeSync, openSync } from 'node:fs';

import { clock } from '../clock.ts';
import { command } from '../command.ts';
import { fs } from '../fs.ts';
import { classifyTerminal } from './classify.ts';
import { ceiling } from '../../gate/bounded.ts';
import type { AgentReport, AgentSessions, Consumption } from '../../ports.ts';

type End = { status: number | null; signal: NodeJS.Signals | null; error?: NodeJS.ErrnoException };

type Event = {
  type?: string;
  sessionId?: string;
  exitCode?: number;
  data?: {
    toolCallId?: string;
    toolName?: string;
    arguments?: { command?: string; path?: string };
    success?: boolean;
    error?: { code?: string; message?: string };
    chosenModel?: string;
    summary?: string;
    providerModelMetrics?: { modelId?: string; metrics?: { usage?: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number } } }[];
  };
};

const DENIED = ['shell(git add)', 'shell(git commit)', 'shell(git push)'];

const readOrEmpty = (path: string): string => {
  try {
    return fs.readFile(path);
  } catch {
    return '';
  }
};

const eventsOf = (stdout: string): Event[] =>
  stdout.split('\n').flatMap((line) => {
    try {
      const event: unknown = JSON.parse(line);

      return typeof event === 'object' && event !== null ? [event as Event] : [];
    } catch {
      return [];
    }
  });

const reportOf = (end: End, stdout: string, stderr: string, durationMs: number, onTool: (line: string) => void, onSession: (id: string) => void): AgentReport => {
  const events = eventsOf(stdout);
  const started = new Map<string, string>();
  let model: string | undefined;
  let usage: NonNullable<NonNullable<Event['data']>['providerModelMetrics']>[number] | undefined;
  let summary: string | undefined;

  for (const { type, data } of events) {
    const id = data?.toolCallId ?? '';

    if (type === 'session.auto_mode_resolved') model = data?.chosenModel ?? model;
    if (type === 'session.task_complete') summary = data?.summary;
    if (type === 'session.usage_checkpoint') usage = data?.providerModelMetrics?.[0] ?? usage;

    if (type === 'tool.execution_start') {
      const target = data?.arguments?.command ?? data?.arguments?.path ?? '';

      started.set(id, target);
      onTool(`RUN implementer: ${data?.toolName ?? 'tool'}${target === '' ? '' : ` ${target}`}`);
    }

    if (type === 'tool.execution_complete' && data?.error?.code === 'denied') {
      onTool(`RUN implementer: refused ${started.get(id) ?? 'a tool call'}`);
    }
  }

  const result = events.filter((event) => event.type === 'result').pop();
  const sessionId = result?.sessionId;

  if (sessionId !== undefined && sessionId !== '') onSession(sessionId);

  const servedModel = usage?.modelId ?? model;
  const counts = usage?.metrics?.usage;
  const consumption: Consumption | undefined =
    servedModel === undefined && counts === undefined
      ? undefined
      : {
          ...(counts?.inputTokens === undefined ? {} : { inputTokens: counts.inputTokens }),
          ...(counts?.outputTokens === undefined ? {} : { outputTokens: counts.outputTokens }),
          ...(counts?.cacheWriteTokens === undefined ? {} : { cacheCreationInputTokens: counts.cacheWriteTokens }),
          ...(counts?.cacheReadTokens === undefined ? {} : { cacheReadInputTokens: counts.cacheReadTokens }),
          ...(servedModel === undefined ? {} : { model: servedModel }),
        };
  const terminal = classifyTerminal({ ...end, stdout, stderr });

  return {
    end,
    outcome: { text: summary ?? '', isError: terminal.failed, class: terminal.class, quote: terminal.quote },
    ...(consumption === undefined ? {} : { consumption }),
    ...(sessionId === undefined || sessionId === '' ? {} : { sessionId }),
    stderr,
    durationMs,
    ignoredLines: 0,
  };
};

export const copilotAgentSessions = (continues: number): AgentSessions => ({
  provider: 'copilot',
  onExhausted: 'pause',
  launch: async (role, brief, options, stop) => {
    if (role !== 'implementer') throw new Error(`the Copilot adapter launches the implementer only, not the ${role}`);

    const started = clock.now();
    let end: End;

    try {
      const fdOut = openSync(options.outPath, 'w');
      const fdErr = openSync(options.errPath, 'w');

      try {
        const args = [
          '-p',
          brief,
          '--output-format',
          'json',
          '--autopilot',
          '--max-autopilot-continues',
          String(continues),
          '--allow-all-tools',
          '--no-ask-user',
          '--no-auto-update',
          ...DENIED.flatMap((tool) => ['--deny-tool', tool]),
        ];
        const ended = await command.spawn('/bin/sh', ['-c', `${ceiling()}\nexec "$@"`, 'sh', 'copilot', ...args], {
          encoding: 'utf8',
          env: { ...process.env },
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

    return reportOf(end, readOrEmpty(options.outPath), readOrEmpty(options.errPath), clock.now() - started, options.onTool, options.onSession);
  },
});
