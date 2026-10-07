// The implementer answers in stream-json, so each tool use it performs is rendered as one line,
// and the session_id every event carries is handed to the caller to record beside the run. Its
// `result` event also carries the session's token usage, which narrate() hands back to its caller
// rather than emitting itself, with the served model, the context peak and the compaction count.

import { extract, type Extraction } from '../../core/events.ts';

type Narration = { say: (line: string) => void; session?: (id: string) => void };

export const narrate = (stdout: string, narration: Narration): Extraction & { ignoredLines: number; sessionId?: string } => {
  let sessionId: string | undefined;
  const { usage, model, peakTokens, compactions, ignoredLines } = extract(stdout, (event) => {
    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_use' && block.name !== undefined && block.name !== '') {
        const target = block.input?.file_path ?? block.input?.command;
        narration.say(`RUN implementer: ${block.name}${target !== undefined && target !== '' ? ` ${target}` : ''}`);
      }
    }

    if (event.session_id !== undefined && event.session_id !== '') {
      sessionId = event.session_id;
      narration.session?.(event.session_id);
    }
  });

  return { usage, model, peakTokens, compactions, ignoredLines, ...(sessionId === undefined ? {} : { sessionId }) };
};
