import { dirname } from 'node:path';

import { fs } from '../adapters/fs.ts';
import { git } from '../adapters/git.ts';
import { ok, type Result } from '../core/result.ts';
import { resolvablePaths, selectReplay, servicesOf } from '../core/rules/cross-iteration.ts';
import type { Halt } from '../core/verdict.ts';
import { gateCommands, runGates } from './commands.ts';
import { blockOf, declaredPaths, iterationNumbers } from './plan.ts';
import { declaredServices } from './services.ts';

// The checked iterations' commands, deduplicated by command string within one set of services, and replayed with them, so a slice that
// breaks an earlier one halts where the cause is. It re-enters runGates(); the slice's own
// commands are already spent there, so they count as seen.
export const regressionWall = (
  source: string,
  iteration: string,
  declared: Map<string, string>,
): Result<void, Halt> => {
  const own = servicesOf(declared);
  const ownCommands = gateCommands(declared).map(([, command]) => command);
  const groups = new Map<string, { block: Map<string, string>; earlier: [string, string][] }>();

  for (const checked of iterationNumbers(source, true)) {
    const block = blockOf(source, checked);
    const key = servicesOf(block);
    const group = groups.get(key) ?? { block, earlier: [] };

    for (const [, command] of gateCommands(block)) {
      group.earlier.push([checked, command]);
    }

    groups.set(key, group);
  }

  for (const [key, { block, earlier }] of groups) {
    const { replay, origin } = selectReplay(new Set(key === own ? ownCommands : []), earlier);

    if (replay.size === 0) continue;

    const services = declaredServices(block);

    try {
      services.start();

      const result = runGates(replay, iteration, origin, true, services);

      if (!result.ok) return result;
    } finally {
      services.stop();
    }
  }

  return ok(undefined);
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
