import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { command } from '../adapters/command.ts';
import { noBcBreak, withinBudget } from '../core/rules/bounds.ts';
import type { Result } from '../core/result.ts';
import type { Halt } from '../core/verdict.ts';
import { halt } from './halt.ts';
import { deliveryMode } from './plan.ts';

export const headDiff = (flag: string, paths: string[], iteration: string): string[] => {
  const dir = mkdtempSync(join(tmpdir(), 'goal-index-'));
  const env = { ...process.env, GIT_INDEX_FILE: join(dir, 'index') };
  const throwaway = (...args: string[]) => command.run('git', args, { env });

  try {
    const readTree = throwaway('read-tree', 'HEAD');
    const add = throwaway('add', '-A', '--', ...paths);
    const diff = throwaway('diff', '--cached', flag, '-M', 'HEAD', '--', ...paths);
    const failed = [readTree, add, diff].find((step) => step.status !== 0);

    if (failed !== undefined) {
      halt(
        `git diff failed, so iteration ${iteration}'s bounds were never measured.`,
        `${failed.stderr}\n\nThe gate measures the tree it is standing in against HEAD: run it with the repository — or the track worktree — as the working directory.`,
      );
    }

    return diff.stdout.split('\n').filter((line) => line !== '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

export const budgetCheck = (declared: Map<string, string>, paths: string[], iteration: string): Result<void, Halt> => {
  const budget = declared.get('max_diff') ?? '';

  const written =
    budget === ''
      ? 0
      : headDiff('--numstat', paths, iteration).reduce((total, line) => {
          const [addedText, removedText] = line.split('\t');

          const added = Number(addedText);
          const removed = Number(removedText);

          return total + (Number.isNaN(added) ? 0 : added) + (Number.isNaN(removed) ? 0 : removed);
        }, 0);

  return withinBudget(budget, written, paths, iteration);
};

export const removalCheck = (source: string, paths: string[], iteration: string): Result<void, Halt> => {
  const mode = deliveryMode(source);

  const removals =
    mode === 'allow-bc-break' ? [] : headDiff('--name-status', paths, iteration).filter((line) => /^[DR]/.test(line));

  return noBcBreak(mode, removals, iteration);
};
