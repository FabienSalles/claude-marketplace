// The one stream-json parser every Claude-session consumer reads through: narrate(), digest()
// and postmortem() all walk the same JSONL shape through parseEvents(), so a parsing rule fixed
// once is fixed for all three rather than once per file.

import { join } from 'node:path';

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

export type EventBlock = {
  type?: string;
  id?: string;
  name?: string;
  input?: { file_path?: string; command?: string };
  tool_use_id?: string;
  is_error?: boolean;
};
export type StreamMessage = { content?: EventBlock[]; model?: string; usage?: Usage };
export type StreamEvent = {
  type?: string;
  subtype?: string;
  session_id?: string;
  usage?: Usage;
  message?: StreamMessage;
  modelUsage?: Record<string, unknown>;
  isCompactSummary?: boolean;
  result?: string;
};

export type ParsedLine = { line: number; event: StreamEvent };

// One JSONL line per element, 1-indexed, blank and malformed lines dropped rather than crashing
// the walk — the same tolerance every caller needs from a transcript a killed session may have
// left mid-write.
export const parseEvents = (raw: string): ParsedLine[] =>
  raw.split('\n').flatMap((text, index) => {
    if (text.trim() === '') {
      return [];
    }

    try {
      return [{ line: index + 1, event: JSON.parse(text) as StreamEvent }];
    } catch {
      return [];
    }
  });

// What every Claude-session stage line carries beside its cost: the served model, the highest
// single-turn context load reached, and how many times the session compacted.
export type Extraction = {
  usage?: Usage | undefined;
  model?: string | undefined;
  peakTokens?: number | undefined;
  compactions: number;
};

export const extract = (raw: string, onEvent?: (event: StreamEvent) => void): Extraction & { text?: string | undefined } => {
  let usage: Usage | undefined;
  let model: string | undefined;
  let peakTokens: number | undefined;
  let compactions = 0;
  let text: string | undefined;

  for (const { event } of parseEvents(raw)) {
    onEvent?.(event);

    model ??= event.message?.model ?? (event.type === 'result' && event.modelUsage ? Object.keys(event.modelUsage)[0] : undefined);

    if (event.type === 'assistant' && event.message?.usage) {
      const { input_tokens, cache_read_input_tokens, cache_creation_input_tokens } = event.message.usage;
      const total = (input_tokens ?? 0) + (cache_read_input_tokens ?? 0) + (cache_creation_input_tokens ?? 0);
      peakTokens = peakTokens === undefined ? total : Math.max(peakTokens, total);
    }

    // Both verified marker shapes: a `compact_boundary` system event, and a `isCompactSummary` flag.
    if (event.subtype === 'compact_boundary' || event.isCompactSummary === true) {
      compactions += 1;
    }

    if (event.type === 'result') {
      if (event.usage) {
        usage = event.usage;
      }

      if (typeof event.result === 'string') {
        text = event.result;
      }
    }
  }

  return { usage, model, peakTokens, compactions, text };
};

// The last session id any stream-json event of a transcript carried.
export const lastSessionId = (raw: string): string | undefined => {
  let found: string | undefined;
  extract(raw, (event) => {
    if (event.session_id) {
      found = event.session_id;
    }
  });
  return found;
};

// Claude Code keys a project's transcripts by its absolute cwd with every `/` and `.` turned into a `-`.
export const projectDir = (cwd: string, root: string): string => join(root, cwd.replace(/[/.]/g, '-'));
