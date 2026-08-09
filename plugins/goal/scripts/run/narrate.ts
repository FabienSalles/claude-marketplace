// The implementer answers in stream-json, so each tool use it performs is rendered as one line
// as it happens, and the session_id every event carries is handed to the reporter to record
// beside the run rather than read once at the end. Its `result` event also carries the session's
// token usage, in the same four classes every Claude session bills in, which narrate() hands back
// to its caller rather than emitting itself — a stage line is the caller's to shape.

import type { Reporter } from './report.ts';

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

type ToolUseBlock = { type: string; name?: string; input?: { file_path?: string; command?: string } };
type StreamEvent = { type?: string; session_id?: string; usage?: Usage; message?: { content?: ToolUseBlock[] } };

export const narrate = (stdout: string, reporter: Reporter): Usage | undefined => {
  let usage: Usage | undefined;

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

    if (event.type === 'result' && event.usage) {
      usage = event.usage;
    }
  }

  return usage;
};

// A stage advisory agents (lens, reviewer, auditor) answer with once asked for
// `--output-format json`: one JSON object, its prose in `result`, its token usage in `usage` — the
// same four classes the implementer's stream-json carries. A caller still handed prose, because
// the fixture it is talking to (or a future CLI change) never wrapped it, gets that prose back
// unmangled rather than losing it to a parse failure.
export const resultEnvelope = (raw: string): { text: string; usage?: Usage } => {
  try {
    const parsed = JSON.parse(raw.trim()) as { result?: string; usage?: Usage };

    if (typeof parsed.result === 'string') {
      return parsed.usage ? { text: parsed.result, usage: parsed.usage } : { text: parsed.result };
    }
  } catch {
    // not a JSON envelope: fall through to the raw text below
  }

  return { text: raw };
};

// The one line format every Claude-session stage reports its cost in, so a run report can total
// the four classes without re-deriving them from `stage=` lines that carry none. Non-session
// stages (the gate, `gh pr ready`, a push) never call this: `usage` stays undefined and no line is
// emitted.
export const tokensLine = (stage: string, usage?: Usage): string | undefined =>
  usage &&
  `RUN tokens stage=${stage} input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens} cache_creation_input_tokens=${usage.cache_creation_input_tokens} cache_read_input_tokens=${usage.cache_read_input_tokens}`;
