// The one refusal a plan cannot opt out of: paths that must never enter a commit, whatever
// the gate block says about them.
//
// Every other scope rule asks "was this declared?", so a plan declaring `.env` in impl_files
// answered yes and the gate staged it. That is the wrong question for this class of file: the
// harm is not that nobody expected the change, it is that the file itself has no business in
// git. The secret scanner does not close the gap either — it runs at push, which is after the
// commit, and a secret committed is already in the local history whatever happens next.

import { NEVER_VERSIONED, neverVersionedDecision } from '../core/rules/never.ts';
import type { Result } from '../core/result.ts';
import type { Halt } from '../core/verdict.ts';

export { NEVER_VERSIONED };

// Reads both what the tree holds and what the plan declared: a plan naming `.env` is refused
// before the file exists, which is the moment it is cheapest to fix.
export const neverVersionedCheck = (candidates: string[], subject: string): Result<void, Halt> =>
  neverVersionedDecision(candidates, subject);
