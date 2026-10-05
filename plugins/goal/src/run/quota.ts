// What the runner does with a failure class: how long it waits before relaunching, and the
// slices a long wait is taken in.

import { clock as realClock } from '../adapters/clock.ts';
import { settingValue } from '../core/settings.ts';
import type { Clock, WaitingClock } from '../ports.ts';

// Capped exponential backoff in seconds, independent of GOAL_RUN_QUOTA_SLEEP: a burst clears on
// the order of seconds, not the multi-minute window an exhausted quota needs. The cap is read
// from GOAL_RUN_BURST_CAP, defaulting to the 8 it used to hardcode.
export const burstBackoffSeconds = (attempt: number): number =>
  Math.min(2 ** (attempt - 1), settingValue('GOAL_RUN_BURST_CAP', process.env));

// Fixed, not exponential like a burst: a shutdown is not a load signal to back off from, just a
// process that needs a moment to exit before the same iteration is handed to it again. Read from
// GOAL_RUN_SHUTDOWN_BACKOFF, defaulting to the 5s the constant used to pin.
export const shutdownBackoffSeconds = (): number => settingValue('GOAL_RUN_SHUTDOWN_BACKOFF', process.env);

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

export const waitInSlices = async (
  totalSeconds: number,
  onSlice: (remainingSeconds: number) => void,
  signal: AbortSignal,
  sliceSeconds = 300,
  clock: WaitingClock = realClock,
): Promise<void> => {
  let remaining = totalSeconds;

  while (remaining > 0 && !signal.aborted) {
    const slice = Math.min(sliceSeconds, remaining);

    onSlice(remaining);
    await clock.sleep(slice, signal);
    remaining -= slice;
  }
};
