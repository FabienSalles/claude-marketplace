// Reduces a session JSONL to one line per tool call — the same rendering `run/narrate.ts` does
// live, moved to a file the auditor reads instead of the raw transcript. Carries the result's
// `is_error` flag beside the call, and the JSONL line number the tool_use itself sits on, so a
// finding can be anchored back to it.

import { fs } from './adapters/fs.ts';
import { parseEvents } from './core/events.ts';

const codexTarget = (raw: string | undefined): string => {
  try {
    const args = JSON.parse(raw ?? '{}') as { cmd?: unknown; command?: unknown; path?: unknown };
    const target = args.cmd ?? args.command ?? args.path;

    return typeof target === 'string' ? target : '';
  } catch {
    return '';
  }
};

const exitStatus = (text: unknown): string => {
  const code = typeof text === 'string' ? /"?exit_code"?\s*[:=]\s*(-?\d+)|Exit code:\s*(-?\d+)/i.exec(text) : null;
  const value = code?.[1] ?? code?.[2];

  return value === undefined ? 'unknown' : value === '0' ? 'ok' : 'failed';
};

const unread = '(unread)';

const execCommands = (input: string | undefined): string[] =>
  (input ?? '')
    .split('exec_command(')
    .slice(1)
    .map((segment) => {
      const match = /\bcmd:\s*("(?:[^"\\]|\\.)*")/.exec(segment);

      return match === null ? unread : (JSON.parse(match[1] ?? '""') as string);
    });

const chunkExitCodes = (output: unknown): (number | null)[] =>
  (Array.isArray(output) ? (output as { text?: unknown }[]) : []).flatMap((part) => {
    if (typeof part.text !== 'string' || !part.text.includes('chunk_id')) {
      return [];
    }

    try {
      const chunk = JSON.parse(part.text) as { exit_code?: unknown } | null;

      return chunk !== null && typeof chunk === 'object' && 'chunk_id' in chunk ? [typeof chunk.exit_code === 'number' ? chunk.exit_code : null] : [];
    } catch {
      return [];
    }
  });

export const digest = (transcriptPath: string): string[] => {
  const calls = new Map<string, { line: number; name: string; target: string }>();
  const outcomes = new Map<string, string>();
  const execs = new Map<string, string[]>();
  const order: string[] = [];

  for (const { line, event } of parseEvents(fs.readFile(transcriptPath))) {
    const { data } = event;
    const item = (event as { type?: string; payload?: { type?: string; name?: string; arguments?: string; call_id?: string; input?: string; output?: unknown } }).payload;

    if (event.type === 'response_item' && item?.call_id !== undefined) {
      if (item.type === 'function_call' && item.name !== undefined) {
        calls.set(item.call_id, { line, name: item.name, target: codexTarget(item.arguments) });
        order.push(item.call_id);
      } else if (item.type === 'function_call_output') {
        outcomes.set(item.call_id, exitStatus(item.output));
      } else if (item.type === 'custom_tool_call' && item.name === 'exec') {
        const ids = execCommands(item.input).map((cmd, index) => {
          const id = `${item.call_id}#${index}`;
          calls.set(id, { line, name: 'exec_command', target: cmd });
          order.push(id);
          return id;
        });
        execs.set(item.call_id, ids);
      } else if (item.type === 'custom_tool_call_output') {
        const ids = execs.get(item.call_id) ?? [];
        const codes = chunkExitCodes(item.output);
        const paired = ids.length === codes.length && ids.every((id) => calls.get(id)?.target !== unread) && codes.every((code) => code !== null);
        ids.forEach((id, index) => outcomes.set(id, paired ? (codes[index] === 0 ? 'ok' : 'failed') : 'unknown'));
      }
    }

    if (event.type === 'tool.execution_start' && data?.toolCallId !== undefined && data.toolName !== undefined) {
      calls.set(data.toolCallId, { line, name: data.toolName, target: data.arguments?.command ?? data.arguments?.path ?? '' });
      order.push(data.toolCallId);
    } else if (event.type === 'tool.execution_complete' && data?.toolCallId !== undefined) {
      outcomes.set(data.toolCallId, data.success === false ? 'error' : 'ok');
    }

    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_use' && block.id !== undefined && block.id !== '' && block.name !== undefined && block.name !== '') {
        const target = block.input?.file_path ?? block.input?.command ?? '';
        calls.set(block.id, { line, name: block.name, target });
        order.push(block.id);
      } else if (block.type === 'tool_result' && block.tool_use_id !== undefined && block.tool_use_id !== '') {
        outcomes.set(block.tool_use_id, block.is_error === true ? 'error' : 'ok');
      }
    }
  }

  return order.map((id) => {
    const call = calls.get(id);

    if (call === undefined) {
      return '';
    }

    const status = outcomes.get(id) ?? (id.includes('#') ? 'unknown' : 'pending');
    return `${call.line}: ${call.name}${call.target !== undefined && call.target !== '' ? ` ${call.target}` : ''} -> ${status}`;
  });
};

// Usage: node digest.ts <transcript.jsonl> — one line per tool call.
if (import.meta.main) {
  const [transcriptPath] = process.argv.slice(2);

  if (transcriptPath === undefined) {
    process.stderr.write('usage: digest.ts <transcript.jsonl>\n');
    process.exit(2);
  }

  for (const line of digest(transcriptPath)) {
    process.stdout.write(`${line}\n`);
  }
}
