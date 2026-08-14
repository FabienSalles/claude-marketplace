// The quota rule split in two: a burst 429 (`429`, `rate_limit_error`) is a different failure
// from an exhausted usage window (`usage limit`) — the two used to share one loose regex
// (`rate.limit`, an unescaped wildcard) and one sleep, so a burst that clears in seconds slept
// the full GOAL_RUN_QUOTA_SLEEP anyway. Kept out of run/iteration.ts to respect its own
// 200-line ceiling.

import { clock as realClock } from '../adapters/clock.ts';
import type { Clock } from '../ports.ts';

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

// Capped exponential backoff in seconds, independent of GOAL_RUN_QUOTA_SLEEP: a burst clears on
// the order of seconds, not the multi-minute window an exhausted quota needs. The cap is read
// from GOAL_RUN_BURST_CAP, defaulting to the 8 it used to hardcode.
export const burstBackoffSeconds = (attempt: number): number =>
  Math.min(2 ** (attempt - 1), Number(process.env.GOAL_RUN_BURST_CAP ?? '8'));

export type FailureClass = 'shutdown' | QuotaClass;

// Exit 143 is SIGTERM, the shape of a self-update or platform-triggered shutdown, not a quota
// window: checked first, so the quota regex never even runs against its output and a run/
// iteration.ts loop never waits out GOAL_RUN_QUOTA_SLEEP for something a few seconds will clear.
export const classifyFailure = (status: number | null, output: string): FailureClass =>
  status === 143 ? 'shutdown' : classifyQuotaFailure(output);

// Fixed, not exponential like a burst: a shutdown is not a load signal to back off from, just a
// process that needs a moment to exit before the same iteration is handed to it again. Read from
// GOAL_RUN_SHUTDOWN_BACKOFF, defaulting to the 5s the constant used to pin.
export const shutdownBackoffSeconds = (): number => Number(process.env.GOAL_RUN_SHUTDOWN_BACKOFF ?? '5');

export const shutdownMaxRetries = (): number => Number(process.env.GOAL_RUN_SHUTDOWN_MAX_RETRIES ?? '5');

// A loop of short slices, not one call to the Clock port for the whole totalSeconds whose return
// value is discarded: a long wait is then a sequence of small, observable steps, each reported
// through onSlice, rather than one opaque wait that a run can only sit through in full. `clock`
// defaults to the real one and takes a test double in its place, the seam that lets a suite
// observe every slice slept without paying for one.
export const sleepInSlices = (
  totalSeconds: number,
  onSlice: (remainingSeconds: number) => void,
  sliceSeconds = 300,
  clock: Clock = realClock,
): void => {
  let remaining = totalSeconds;

  while (remaining > 0) {
    const slice = Math.min(sliceSeconds, remaining);

    onSlice(remaining);
    clock.sleepSeconds(slice);
    remaining -= slice;
  }
};
