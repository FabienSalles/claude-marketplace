// The set of iterations a plan has ticked, published by `check` beside the plan hash and
// enforced by `commit`: unlike the hash, a tick or untick leaves the hash unchanged by design,
// so nothing else on this contract would notice one iteration dropping off the regression wall.

import { halt } from './halt.ts';
import { iterationNumbers } from './plan.ts';

export const tickedSet = (source: string): string => iterationNumbers(source, true).join(',');

// `locked` is what `check` published for this run, carried by the runner into `commit` the way
// it carries the plan hash. Undefined skips the check entirely — the shape a caller that never
// carries it (the frozen bash runner) leaves this in, so it is unaffected by construction.
export const monotonicityCheck = (source: string, iteration: string, locked: string | undefined): void => {
  if (locked === undefined) {
    return;
  }

  const before = new Set(locked.split(',').filter((entry) => entry !== ''));
  const now = new Set(tickedSet(source).split(',').filter((entry) => entry !== ''));
  const missing = [...before].filter((entry) => !now.has(entry));

  if (missing.length > 0) {
    halt(
      `Iteration ${iteration} would commit with fewer iterations ticked than this run locked.`,
      `Locked: ${[...before].join(',')}\nFound:  ${[...now].join(',')}\nMissing: ${missing.join(',')}\n\nAn untick between check and commit would drop an iteration off the regression wall while the plan hash still reports the contract intact. Restore the box, or report why it disappeared.`,
    );
  }
};
