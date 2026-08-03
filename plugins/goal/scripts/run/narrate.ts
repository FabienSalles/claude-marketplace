// The implementer answers in stream-json, so each tool use it performs is rendered as one line
// as it happens, and the session_id every event carries is handed to the reporter to record
// beside the run rather than read once at the end.

import type { Reporter } from './report.ts';

type ToolUseBlock = { type: string; name?: string; input?: { file_path?: string; command?: string } };
type StreamEvent = { type?: string; session_id?: string; message?: { content?: ToolUseBlock[] } };

export const narrate = (stdout: string, reporter: Reporter): void => {
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') {
      continue;
    }

    let event: StreamEvent;

    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      continue;
    }

    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_use' && block.name) {
        const target = block.input?.file_path ?? block.input?.command;
        reporter.say(`RUN implementer: ${block.name}${target ? ` ${target}` : ''}`);
      }
    }

    if (event.session_id) {
      reporter.session?.(event.session_id);
    }
  }
};
