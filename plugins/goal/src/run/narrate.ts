// The lines a run writes about a session's cost and end, whichever adapter launched it. Claude's
// advisory agents still answer through resultEnvelope() below until they reach the port.

import { constants } from 'node:os';

import { extract, type Extraction } from '../core/events.ts';
import type { Consumption } from '../ports.ts';

// A stage advisory agents (lens, reviewer, auditor) answer with once asked for
// a JSONL event stream: the same one narrate() already parses, its prose in the
// terminal `result` event's `result` field, its cost and served model extracted the same way. A
// caller still handed prose, because the fixture it is talking to (or a future CLI change) never
// wrapped it, gets that prose back unmangled rather than losing it to a parse failure.
export const resultEnvelope = (raw: string): Extraction & { text: string } => {
  const { text, ...extraction } = extract(raw);

  return { text: text ?? raw, ...extraction };
};

// The one line format every session stage reports its cost in, so a run report can total
// the four classes without re-deriving them from `stage=` lines that carry none. Non-session
// stages (the gate, `gh pr ready`, a push) never call this: `consumption` stays undefined and no
// line is emitted. A missing or zero window keeps the context in tokens, with no percentage.
export const tokensLine = (stage: string, consumption?: Consumption): string | undefined => {
  if (consumption === undefined) {
    return undefined;
  }

  const { model, contextTokens, contextWindow } = consumption;
  const peak =
    contextTokens === undefined
      ? ''
      : contextWindow !== undefined && contextWindow !== 0
        ? ` context_tokens=${contextTokens} context_pct=${Math.round((contextTokens / contextWindow) * 100)}%`
        : ` context_tokens=${contextTokens}`;

  return (
    `RUN tokens stage=${stage} input_tokens=${consumption.inputTokens ?? 0} output_tokens=${consumption.outputTokens ?? 0} ` +
    `cache_creation_input_tokens=${consumption.cacheCreationInputTokens ?? 0} cache_read_input_tokens=${consumption.cacheReadInputTokens ?? 0}` +
    `${model !== undefined && model !== '' ? ` model=${model}` : ''}${peak} compactions=${consumption.compactions ?? 0}`
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
