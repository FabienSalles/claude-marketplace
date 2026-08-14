// The pure decisions behind the two bounds a slice is held to. The measurement each one judges
// stays in gate/bounds.ts, the adapter that makes the git call and halts of its own if it fails.

import { err, ok, type Result } from '../result.ts';
import { halt, type Halt } from '../verdict.ts';

// The one place a declared max_diff is parsed as a number: makePlan (core/plan.ts) calls this
// at plan-parse time, gate/bounds.ts's budgetCheck calls it again at measurement time.
export const numericBudget = (budget: string, iteration: string): Result<number | undefined, Halt> => {
  if (budget === '') return ok(undefined);

  if (!/^[0-9]+$/.test(budget)) {
    return err(halt(
      `Iteration ${iteration} declares a max_diff that is not a number.`,
      `Found: ${budget}\n\nA budget nothing can compare against is a budget nobody is held to: the slice would run unbounded while the plan claims otherwise. Write a plain line count.`,
    ));
  }

  return ok(Number(budget));
};

export const withinBudget = (
  budget: string,
  written: number,
  paths: readonly string[],
  iteration: string,
): Result<void, Halt> => {
  const numeric = numericBudget(budget, iteration);

  if (!numeric.ok) {
    return numeric;
  }

  if (numeric.value === undefined) {
    return ok(undefined);
  }

  if (written > numeric.value) {
    return err(halt(
      `Iteration ${iteration} exceeds its declared diff budget.`,
      `Written: ${written} line(s) across ${paths.join(' ')}\nBudget: ${budget}\n\nA slice that outgrows its own estimate is no longer the slice that was reviewed and frozen. Split it, or raise max_diff in the plan deliberately — before the halt, not after it.`,
    ));
  }

  return ok(undefined);
};

export const noBcBreak = (
  deliveryMode: string,
  removals: readonly string[],
  iteration: string,
): Result<void, Halt> => {
  if (deliveryMode === 'allow-bc-break') return ok(undefined);

  if (removals.length > 0) {
    return err(halt(
      `Iteration ${iteration} deletes or renames a pre-existing file under no-bc-break.`,
      `${removals.join('\n')}\n\nThe plan header declares no-bc-break — or declares no delivery mode at all, which reads the same way — so every consumer of these paths must keep working. Add beside the old path and leave it standing, or change the plan header to allow-bc-break and name what breaks.`,
    ));
  }

  return ok(undefined);
};
