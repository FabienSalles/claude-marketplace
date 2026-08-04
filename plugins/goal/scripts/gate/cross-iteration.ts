// The two checks that read the whole plan rather than one slice: what earlier iterations proved,
// and what later ones still declare.

import { git, halt } from './halt.ts';
import { blockOf, declaredPaths, iterationNumbers } from './plan.ts';
import { gateCommands, runGates } from './commands.ts';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';

// The checked iterations' commands, deduplicated by command string and replayed, so a slice that
// breaks an earlier one halts where the cause is. It re-enters runGates(); the slice's own
// commands are already spent there, so they count as seen.
export const regressionWall = (source: string, iteration: string, declared: Map<string, string>): void => {
  const seen = new Set(gateCommands(declared).map(([, command]) => command));
  const replay = new Map<string, string>();
  const origin = new Map<string, string>();

  for (const earlier of iterationNumbers(source, true)) {
    for (const [, command] of gateCommands(blockOf(source, earlier))) {
      if (seen.has(command)) {
        continue;
      }

      seen.add(command);
      replay.set(`gate${replay.size + 1}`, command);
      origin.set(command, earlier);
    }
  }

  runGates(replay, iteration, origin, true);
};

export const inHead = (path: string): boolean => git('cat-file', '-e', `HEAD:${path}`).status === 0;

// A later iteration declares paths that do not exist yet, which is the normal case, so the unit
// is the parent directory and HEAD is what it is compared against: a directory present in HEAD
// and gone from the tree was renamed or moved, where a directory nobody has created yet was
// never there at all. The iteration being verified is excluded — the scope check, the budget and
// the removal check judge its own declarations, and a deletion emptying a directory the mode
// allows must not halt on itself.
export const resolvabilityCheck = (source: string, iteration: string): void => {
  const unresolvable: string[] = [];

  for (const later of iterationNumbers(source, false).filter((entry) => entry !== iteration)) {
    for (const path of declaredPaths(blockOf(source, later))) {
      const parent = path.endsWith('/') ? path.slice(0, -1) : dirname(path);

      if (!existsSync(parent) && inHead(parent)) {
        unresolvable.push(`iteration ${later}: ${path} (missing directory: ${parent})`);
      }
    }
  }

  if (unresolvable.length > 0) {
    halt(
      `Iteration ${iteration} leaves a path the plan still declares unresolvable.`,
      `${unresolvable.join('\n')}\n\nThese directories exist in HEAD and no longer exist in the tree, so the iterations declaring paths inside them can no longer run. The check is made before the commit on purpose: committing first would leave a commit whose own plan is already broken. Restore the directory, or update the declarations of the iterations named above.`,
    );
  }
};
