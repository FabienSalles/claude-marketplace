// The quota policy split in two: a burst 429 (`429`, `rate_limit_error`) is a different failure
// from an exhausted usage window (`usage limit`), and only the terminal outcome of a session is
// read, never a phrase a tool result carried mid-stream.

import { parseEvents, type StreamEvent } from '../../core/events.ts';
import type { FailureClass } from '../../ports.ts';

export type QuotaClass = 'burst' | 'exhausted' | null;

// The quota policy as data, checked top to bottom: an explicit usage-limit message takes the
// long sleep even if a 429 also shows up somewhere in the same output, so `exhausted` is listed
// before `burst`. `\b429\b` keeps a bare status code from matching inside an unrelated number
// such as "14290".
const QUOTA_POLICY: readonly { class: Exclude<QuotaClass, null>; pattern: RegExp }[] = [
  { class: 'exhausted', pattern: /usage limit/i },
  { class: 'burst', pattern: /\b429\b|rate_limit_error/i },
];

export const classifyQuotaFailure = (output: string): QuotaClass =>
  QUOTA_POLICY.find((rule) => rule.pattern.test(output))?.class ?? null;

export type TerminalOutcome = { failed: boolean; class: Exclude<FailureClass, 'success'>; quote: string; text: string; isError: boolean };

export const finalResult = (stdout: string): { text: string; isError: boolean } | undefined => {
  const last = parseEvents(stdout)
    .map(({ event }) => event as StreamEvent & { is_error?: boolean })
    .filter((event) => event.type === 'result')
    .pop();

  return last === undefined ? undefined : { text: last.result ?? '', isError: last.is_error === true };
};

export const classifyTerminal = (end: { status: number | null; signal?: NodeJS.Signals | null; stdout: string; stderr: string }): TerminalOutcome => {
  const final = finalResult(end.stdout);
  const quote = [final?.isError === true || end.status !== 0 ? final?.text : undefined, end.stderr.trim()].filter((part) => part !== undefined && part !== '').join(' | ');
  const failed = end.status !== 0 || final?.isError === true;
  const text = final?.text ?? '';
  const isError = final?.isError === true;
  const killed = end.status === 143 || (end.signal !== undefined && end.signal !== null);

  if (killed) {
    return { failed, class: 'signal', quote, text, isError };
  }

  return { failed, class: classifyQuotaFailure(quote) ?? 'unrecognised', quote, text, isError };
};
