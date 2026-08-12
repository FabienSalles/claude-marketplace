// The two bounds a slice is held to, both measured against HEAD.

import { git } from '../adapters/git.ts';
import { budgetDecision, removalDecision } from '../core/rules/bounds.ts';
import type { Result } from '../core/result.ts';
import type { Halt } from '../core/verdict.ts';
import { halt } from './halt.ts';
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

export const budgetCheck = (declared: Map<string, string>, paths: string[], iteration: string): Result<void, Halt> => {
  const budget = declared.get('max_diff') ?? '';

  const written =
    budget === ''
      ? 0
      : headDiff('--numstat', paths, iteration).reduce((total, line) => {
          const [added, removed] = line.split('\t');

          return total + (Number(added) || 0) + (Number(removed) || 0);
        }, 0);

  return budgetDecision(budget, written, paths, iteration);
};

export const removalCheck = (source: string, paths: string[], iteration: string): Result<void, Halt> => {
  const mode = deliveryMode(source);

  const removals =
    mode === 'allow-bc-break' ? [] : headDiff('--name-status', paths, iteration).filter((line) => /^[DR]/.test(line));

  return removalDecision(mode, removals, iteration);
};
