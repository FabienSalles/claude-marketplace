// Whether an iteration dropped off the regression wall between what `check` locked and what the
// plan ticks now.

import { err, ok, type Result } from '../result.ts';
import { halt, type Halt } from '../verdict.ts';

// `locked` undefined skips the check entirely — the shape a caller that never carries it (the
// frozen bash runner) leaves this in, so it is unaffected by construction.
export const monotonicTicks = (
  iteration: string,
  locked: string | undefined,
  now: string,
): Result<void, Halt> => {
  if (locked === undefined) return ok(undefined);

  const before = new Set(locked.split(',').filter((entry) => entry !== ''));
  const after = new Set(now.split(',').filter((entry) => entry !== ''));
  const missing = [...before].filter((entry) => !after.has(entry));

  if (missing.length > 0) {
    return err(halt(
      `Iteration ${iteration} would commit with fewer iterations ticked than this run locked.`,
      `Locked: ${[...before].join(',')}\nFound:  ${[...after].join(',')}\nMissing: ${missing.join(',')}\n\nAn untick between check and commit would drop an iteration off the regression wall while the plan hash still reports the contract intact. Restore the box, or report why it disappeared.`,
    ));
  }

  return ok(undefined);
};
