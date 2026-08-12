// The set of iterations a plan has ticked, published by `check` beside the plan hash and
// enforced by `commit`: unlike the hash, a tick or untick leaves the hash unchanged by design,
// so nothing else on this contract would notice one iteration dropping off the regression wall.

import { monotonicityDecision } from '../core/rules/ticked.ts';
import type { Result } from '../core/result.ts';
import type { Halt } from '../core/verdict.ts';
import { iterationNumbers } from './plan.ts';

export const tickedSet = (source: string): string => iterationNumbers(source, true).join(',');

// `locked` is what `check` published for this run, carried by the runner into `commit` the way
// it carries the plan hash.
export const monotonicityCheck = (source: string, iteration: string, locked: string | undefined): Result<void, Halt> =>
  monotonicityDecision(iteration, locked, tickedSet(source));
