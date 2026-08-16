import { dirname } from 'node:path';

import { fs } from '../adapters/fs.ts';
import { git } from '../adapters/git.ts';
import { ok, type Result } from '../core/result.ts';
import { resolvablePaths, selectReplay } from '../core/rules/cross-iteration.ts';
import type { Halt } from '../core/verdict.ts';
import { gateCommands, runGates } from './commands.ts';
import { blockOf, declaredPaths, iterationNumbers } from './plan.ts';

// The checked iterations' commands, deduplicated by command string and replayed, so a slice that
// breaks an earlier one halts where the cause is. It re-enters runGates(); the slice's own
// commands are already spent there, so they count as seen.
export const regressionWall = (
  source: string,
  iteration: string,
  declared: Map<string, string>,
): Result<void, Halt> => {
  const seen = new Set(gateCommands(declared).map(([, command]) => command));
  const earlier: [string, string][] = [];

  for (const checked of iterationNumbers(source, true)) {
    for (const [, command] of gateCommands(blockOf(source, checked))) {
      earlier.push([checked, command]);
    }
  }

  const { replay, origin } = selectReplay(seen, earlier);
  const result = runGates(replay, iteration, origin, true);

  return result.ok ? ok(undefined) : result;
};

export const inHead = (path: string): boolean => git('cat-file', '-e', `HEAD:${path}`).status === 0;

// A later iteration declares paths that do not exist yet, which is the normal case, so the unit
// is the parent directory and HEAD is what it is compared against: a directory present in HEAD
// and gone from the tree was renamed or moved, where a directory nobody has created yet was
// never there at all. The iteration being verified is excluded — the scope check, the budget and
// the removal check judge its own declarations, and a deletion emptying a directory the mode
// allows must not halt on itself.
export const resolvabilityCheck = (source: string, iteration: string): Result<void, Halt> => {
  const unresolvable: string[] = [];

  for (const later of iterationNumbers(source, false).filter((entry) => entry !== iteration)) {
    for (const path of declaredPaths(blockOf(source, later))) {
      const parent = path.endsWith('/') ? path.slice(0, -1) : dirname(path);

      if (!fs.exists(parent) && inHead(parent)) {
        unresolvable.push(`iteration ${later}: ${path} (missing directory: ${parent})`);
      }
    }
  }

  return resolvablePaths(iteration, unresolvable);
};
