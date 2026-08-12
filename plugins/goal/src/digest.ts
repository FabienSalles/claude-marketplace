// Reduces a session JSONL to one line per tool call — the same rendering `run/narrate.ts` does
// live, moved to a file the auditor reads instead of the raw transcript. Carries the result's
// `is_error` flag beside the call, and the JSONL line number the tool_use itself sits on, so a
// finding can be anchored back to it.

import { readFileSync } from 'node:fs';

import { parseEvents } from './core/events.ts';

export const digest = (transcriptPath: string): string[] => {
  const calls = new Map<string, { line: number; name: string; target: string }>();
  const outcomes = new Map<string, boolean>();
  const order: string[] = [];

  for (const { line, event } of parseEvents(readFileSync(transcriptPath, 'utf8'))) {
    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_use' && block.id && block.name) {
        const target = block.input?.file_path ?? block.input?.command ?? '';
        calls.set(block.id, { line, name: block.name, target });
        order.push(block.id);
      } else if (block.type === 'tool_result' && block.tool_use_id) {
        outcomes.set(block.tool_use_id, block.is_error === true);
      }
    }
  }

  return order.map((id) => {
    const call = calls.get(id);

    if (!call) {
      return '';
    }

    const status = outcomes.has(id) ? (outcomes.get(id) ? 'error' : 'ok') : 'pending';
    return `${call.line}: ${call.name}${call.target ? ` ${call.target}` : ''} -> ${status}`;
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
