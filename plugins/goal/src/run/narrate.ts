// The lines a run writes about a session's cost and end, whichever adapter launched it. Claude's
// advisory agents still answer through resultEnvelope() below until they reach the port.

import { constants } from 'node:os';

import { extract, type Extraction } from '../core/events.ts';

// Claude Code's own effective context windows, not the documented API limits: this tool truncates
// a transcript before the API would refuse it, so a peak read against the API figure would still
// call a session comfortable that Claude Code was already about to compact. Maintained data, not
// machine-verified against the CLI's own future defaults — only that it is consulted at all.
const EFFECTIVE_WINDOWS: Record<string, number> = {
  'claude-sonnet-5': 200_000,
  'claude-fable-5': 1_000_000,
};

// A stage advisory agents (lens, reviewer, auditor) answer with once asked for
// a JSONL event stream: the same one narrate() already parses, its prose in the
// terminal `result` event's `result` field, its cost and served model extracted the same way. A
// caller still handed prose, because the fixture it is talking to (or a future CLI change) never
// wrapped it, gets that prose back unmangled rather than losing it to a parse failure.
export const resultEnvelope = (raw: string): Extraction & { text: string } => {
  const { text, ...extraction } = extract(raw);

  return { text: text ?? raw, ...extraction };
};

// The one line format every Claude-session stage reports its cost in, so a run report can total
// the four classes without re-deriving them from `stage=` lines that carry none. Non-session
// stages (the gate, `gh pr ready`, a push) never call this: `extraction` stays undefined and no
// line is emitted. The unknown-model rule: a served model absent from EFFECTIVE_WINDOWS still
// reports its peak in tokens, just with no percentage to read it against.
export const tokensLine = (stage: string, extraction?: Extraction): string | undefined => {
  if (extraction?.usage === undefined) {
    return undefined;
  }

  const { usage, model, peakTokens, compactions } = extraction;
  const window = model !== undefined && model !== '' ? EFFECTIVE_WINDOWS[model] : undefined;
  const peak =
    peakTokens === undefined
      ? ''
      : window !== undefined && window !== 0
        ? ` context_tokens=${peakTokens} context_pct=${Math.round((peakTokens / window) * 100)}%`
        : ` context_tokens=${peakTokens}`;

  return (
    `RUN tokens stage=${stage} input_tokens=${usage.input_tokens ?? 0} output_tokens=${usage.output_tokens ?? 0} ` +
    `cache_creation_input_tokens=${usage.cache_creation_input_tokens ?? 0} cache_read_input_tokens=${usage.cache_read_input_tokens ?? 0}` +
    `${model !== undefined && model !== '' ? ` model=${model}` : ''}${peak} compactions=${compactions}`
  );
};

export type SessionEnd = { status: number | null; signal?: NodeJS.Signals | null; error?: NodeJS.ErrnoException };

export const signalOfExit = (code: number): NodeJS.Signals | null =>
  (Object.entries(constants.signals).find(([, number]) => number === code - 128 && code > 128)?.[0] as NodeJS.Signals | undefined) ?? null;

export const exitOf = ({ status, signal, error }: SessionEnd): number => {
  if (status !== null) {
    return status;
  }

  if (signal !== undefined && signal !== null) {
    return 128 + constants.signals[signal];
  }

  return error?.code === 'ENOENT' ? 127 : 1;
};

export const endOf = (end: SessionEnd): string => {
  const signal = end.signal !== undefined && end.signal !== null ? ` signal=${end.signal}` : '';
  const error = end.error?.code !== undefined ? ` error=${end.error.code}` : '';

  return `exit=${exitOf(end)}${signal}${error}`;
};
