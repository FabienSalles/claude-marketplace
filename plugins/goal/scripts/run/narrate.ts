// The implementer answers in stream-json, so each tool use it performs is rendered as one line
// as it happens, and the session_id every event carries is handed to the reporter to record
// beside the run rather than read once at the end. Its `result` event also carries the session's
// token usage, in the same four classes every Claude session bills in, which narrate() hands back
// to its caller rather than emitting itself — a stage line is the caller's to shape. The same
// stream also carries which model actually served the session, how close the transcript came to
// that model's context window, and how many times it compacted: extracted here, once, so every
// caller of a Claude session (the implementer, and — via resultEnvelope() below — the advisory
// lens, reviewer and auditor) answers the same three questions the same way.

import type { Reporter } from './report.ts';

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

// Claude Code's own effective context windows, not the documented API limits: this tool truncates
// a transcript before the API would refuse it, so a peak read against the API figure would still
// call a session comfortable that Claude Code was already about to compact. Maintained data, not
// machine-verified against the CLI's own future defaults — only that it is consulted at all.
const EFFECTIVE_WINDOWS: Record<string, number> = {
  'claude-sonnet-5': 200_000,
  'claude-fable-5': 1_000_000,
};

type ToolUseBlock = { type: string; name?: string; input?: { file_path?: string; command?: string } };
type StreamMessage = { content?: ToolUseBlock[]; model?: string; usage?: Usage };
type StreamEvent = {
  type?: string;
  subtype?: string;
  session_id?: string;
  usage?: Usage;
  message?: StreamMessage;
  modelUsage?: Record<string, unknown>;
  isCompactSummary?: boolean;
  result?: string;
};

// What every Claude-session stage line now carries beside its cost: the model that actually
// served it, the highest single-turn context load it reached (undefined when no assistant event
// ever carried a usage block), and how many times the session compacted.
export type Extraction = {
  usage?: Usage | undefined;
  model?: string | undefined;
  peakTokens?: number | undefined;
  compactions: number;
};

const modelOf = (event: StreamEvent, current: string | undefined): string | undefined => {
  if (current) {
    return current;
  }

  if (event.message?.model) {
    return event.message.model;
  }

  if (event.type === 'result' && event.modelUsage) {
    return Object.keys(event.modelUsage)[0];
  }

  return current;
};

const peakOf = (event: StreamEvent, current: number | undefined): number | undefined => {
  if (event.type !== 'assistant' || !event.message?.usage) {
    return current;
  }

  const { input_tokens, cache_read_input_tokens, cache_creation_input_tokens } = event.message.usage;
  const total = (input_tokens ?? 0) + (cache_read_input_tokens ?? 0) + (cache_creation_input_tokens ?? 0);

  return current === undefined ? total : Math.max(current, total);
};

// Both marker shapes the CLI has verified in the wild: a `compact_boundary` system event, and a
// `isCompactSummary` flag on the summary message it produces.
const isCompactionMarker = (event: StreamEvent): boolean => event.subtype === 'compact_boundary' || event.isCompactSummary === true;

const extract = (lines: string[], onEvent?: (event: StreamEvent) => void): Extraction & { text?: string | undefined } => {
  let usage: Usage | undefined;
  let model: string | undefined;
  let peakTokens: number | undefined;
  let compactions = 0;
  let text: string | undefined;

  for (const line of lines) {
    if (line.trim() === '') {
      continue;
    }

    let event: StreamEvent;

    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      continue;
    }

    onEvent?.(event);

    model = modelOf(event, model);
    peakTokens = peakOf(event, peakTokens);

    if (isCompactionMarker(event)) {
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

export const narrate = (stdout: string, reporter: Reporter): Extraction => {
  const { usage, model, peakTokens, compactions } = extract(stdout.split('\n'), (event) => {
    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_use' && block.name) {
        const target = block.input?.file_path ?? block.input?.command;
        reporter.say(`RUN implementer: ${block.name}${target ? ` ${target}` : ''}`);
      }
    }

    if (event.session_id) {
      reporter.session?.(event.session_id);
    }
  });

  return { usage, model, peakTokens, compactions };
};

// A stage advisory agents (lens, reviewer, auditor) answer with once asked for
// `--output-format stream-json`: the same event stream narrate() already parses, its prose in the
// terminal `result` event's `result` field, its cost and served model extracted the same way. A
// caller still handed prose, because the fixture it is talking to (or a future CLI change) never
// wrapped it, gets that prose back unmangled rather than losing it to a parse failure.
export const resultEnvelope = (raw: string): Extraction & { text: string } => {
  const { text, ...extraction } = extract(raw.split('\n'));

  return { text: text ?? raw, ...extraction };
};

// The one line format every Claude-session stage reports its cost in, so a run report can total
// the four classes without re-deriving them from `stage=` lines that carry none. Non-session
// stages (the gate, `gh pr ready`, a push) never call this: `extraction` stays undefined and no
// line is emitted. The unknown-model rule: a served model absent from EFFECTIVE_WINDOWS still
// reports its peak in tokens, just with no percentage to read it against.
export const tokensLine = (stage: string, extraction?: Extraction): string | undefined => {
  if (!extraction?.usage) {
    return undefined;
  }

  const { usage, model, peakTokens, compactions } = extraction;
  const window = model ? EFFECTIVE_WINDOWS[model] : undefined;
  const peak =
    peakTokens === undefined
      ? ''
      : window
        ? ` context_tokens=${peakTokens} context_pct=${Math.round((peakTokens / window) * 100)}%`
        : ` context_tokens=${peakTokens}`;

  return (
    `RUN tokens stage=${stage} input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens} ` +
    `cache_creation_input_tokens=${usage.cache_creation_input_tokens} cache_read_input_tokens=${usage.cache_read_input_tokens}` +
    `${model ? ` model=${model}` : ''}${peak} compactions=${compactions}`
  );
};
