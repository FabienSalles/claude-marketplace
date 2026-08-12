// The quota rule split in two: a burst 429 (`429`, `rate_limit_error`) is a different failure
// from an exhausted usage window (`usage limit`) — the two used to share one loose regex
// (`rate.limit`, an unescaped wildcard) and one sleep, so a burst that clears in seconds slept
// the full GOAL_RUN_QUOTA_SLEEP anyway. Kept out of run/iteration.ts to respect its own
// 200-line ceiling.

import { spawnSync } from 'node:child_process';

export type QuotaClass = 'burst' | 'exhausted' | null;

// `usage limit` checked first: an explicit usage-limit message takes the long sleep even if a
// 429 also shows up somewhere in the same output. `\b429\b` keeps a bare status code from
// matching inside an unrelated number such as "14290".
const EXHAUSTED = /usage limit/i;
const BURST = /\b429\b|rate_limit_error/i;

export const classifyQuotaFailure = (output: string): QuotaClass => {
  if (EXHAUSTED.test(output)) {
    return 'exhausted';
  }

  if (BURST.test(output)) {
    return 'burst';
  }

  return null;
};

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

// A loop of short slices, not one spawnSync('sleep', [totalSeconds]) whose return value is
// discarded: a long wait is then a sequence of small, observable steps, each reported through
// onSlice, rather than one opaque call that a run can only sit through in full.
export const sleepInSlices = (totalSeconds: number, onSlice: (remainingSeconds: number) => void, sliceSeconds = 300): void => {
  let remaining = totalSeconds;

  while (remaining > 0) {
    const slice = Math.min(sliceSeconds, remaining);

    onSlice(remaining);
    spawnSync('sleep', [String(slice)]);
    remaining -= slice;
  }
};
