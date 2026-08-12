// The pure part of the two checks that read the whole plan: which earlier commands the
// regression wall still owes a replay, and whether a later iteration's path has gone unresolvable.

import { err, ok, type Result } from '../result.ts';
import { halt, type Halt } from '../verdict.ts';

// Deduplicated by command string, against what the slice's own commands already cover and
// against each other: a command two earlier iterations share is replayed once, under the first.
export const selectReplay = (
  seen: ReadonlySet<string>,
  earlier: readonly (readonly [iteration: string, command: string])[],
): { readonly replay: Map<string, string>; readonly origin: Map<string, string> } => {
  const carried = new Set(seen);
  const replay = new Map<string, string>();
  const origin = new Map<string, string>();

  for (const [iteration, command] of earlier) {
    if (carried.has(command)) continue;

    carried.add(command);
    replay.set(`gate${replay.size + 1}`, command);
    origin.set(command, iteration);
  }

  return { replay, origin };
};

export const resolvabilityDecision = (iteration: string, unresolvable: readonly string[]): Result<void, Halt> => {
  if (unresolvable.length > 0) {
    return err(halt(
      `Iteration ${iteration} leaves a path the plan still declares unresolvable.`,
      `${unresolvable.join('\n')}\n\nThese directories exist in HEAD and no longer exist in the tree, so the iterations declaring paths inside them can no longer run. The check is made before the commit on purpose: committing first would leave a commit whose own plan is already broken. Restore the directory, or update the declarations of the iterations named above.`,
    ));
  }

  return ok(undefined);
};
