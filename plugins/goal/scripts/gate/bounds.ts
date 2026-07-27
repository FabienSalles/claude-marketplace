// The two bounds a slice is held to, both measured against HEAD.

import { git, halt } from './halt.ts';
import { deliveryMode } from './plan.ts';

// Both bounds are measured against HEAD: `git diff --numstat` with no revision misses a
// staged deletion entirely, which would let a slice remove a file for free.
export const headDiff = (flag: string, paths: string[], iteration: string): string[] => {
  const run = git('diff', flag, '-M', 'HEAD', '--', ...paths);

  if (run.status !== 0) {
    halt(
      `git diff failed, so iteration ${iteration}'s bounds were never measured.`,
      `${run.stderr}\n\nThe gate measures the tree it is standing in against HEAD: run it with the repository — or the track worktree — as the working directory.`,
    );
  }

  return run.stdout.split('\n').filter((line) => line !== '');
};

export const budgetCheck = (declared: Map<string, string>, paths: string[], iteration: string): void => {
  const budget = declared.get('max_diff') ?? '';

  if (budget === '') {
    return;
  }

  if (!/^[0-9]+$/.test(budget)) {
    halt(
      `Iteration ${iteration} declares a max_diff that is not a number.`,
      `Found: ${budget}\n\nA budget nothing can compare against is a budget nobody is held to: the slice would run unbounded while the plan claims otherwise. Write a plain line count.`,
    );
  }

  const written = headDiff('--numstat', paths, iteration).reduce((total, line) => {
    const [added, removed] = line.split('\t');

    return total + (Number(added) || 0) + (Number(removed) || 0);
  }, 0);

  if (written > Number(budget)) {
    halt(
      `Iteration ${iteration} exceeds its declared diff budget.`,
      `Written: ${written} line(s) across ${paths.join(' ')}\nBudget: ${budget}\n\nA slice that outgrows its own estimate is no longer the slice that was reviewed and frozen. Split it, or raise max_diff in the plan deliberately — before the halt, not after it.`,
    );
  }
};

export const removalCheck = (source: string, paths: string[], iteration: string): void => {
  if (deliveryMode(source) === 'allow-bc-break') {
    return;
  }

  const removals = headDiff('--name-status', paths, iteration).filter((line) => /^[DR]/.test(line));

  if (removals.length > 0) {
    halt(
      `Iteration ${iteration} deletes or renames a pre-existing file under no-bc-break.`,
      `${removals.join('\n')}\n\nThe plan header declares no-bc-break — or declares no delivery mode at all, which reads the same way — so every consumer of these paths must keep working. Add beside the old path and leave it standing, or change the plan header to allow-bc-break and name what breaks.`,
    );
  }
};
