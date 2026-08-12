// The two verb bodies goal-gate.ts and the in-process adapter share, so neither carries a copy
// that only happens to agree with the other's.

import { biteCheck } from './bite.ts';
import { budgetCheck, removalCheck } from './bounds.ts';
import { determinismCheck, runGates } from './commands.ts';
import { regressionWall, resolvabilityCheck } from './cross-iteration.ts';
import { unwrap, type Say } from './halt.ts';
import { blockOf, declaredPaths, incidentalPaths, lockedHash, readPlan } from './plan.ts';
import { scopeCheck } from './scope.ts';
import { tickedSet } from './ticked.ts';

export const check = (plan: string, iteration: string, locked?: string): string => {
  const source = readPlan(plan);
  const hash = lockedHash(plan, source, `iteration ${iteration}`, locked);
  const declared = blockOf(source, iteration);
  const commands = [...declared.keys()].filter((key) => key.startsWith('gate')).length;

  return `OK: iteration ${iteration} is runnable (${commands} acceptance command(s)).\nplan_hash=${hash}\nticked=${tickedSet(source)}\n`;
};

// The order is the contract: everything cheap and mechanical runs before any command is spawned,
// so a slice that already broke its budget does not spend the wall-clock of a suite it will halt
// on anyway; the bite check runs last because it is the only one that touches the tree.
export const verify = (source: string, iteration: string, declared: Map<string, string>, say: Say) => {
  const paths = declaredPaths(declared);
  const incidental = incidentalPaths(source);
  const changed = unwrap(scopeCheck(paths, iteration, incidental));

  // The two bounds stay measured against the declared paths alone: generated tooling is not
  // authored work, so counting a lockfile against max_diff would blow every budget, and a
  // regenerated file is not the deletion removalCheck exists to catch.
  unwrap(budgetCheck(declared, paths, iteration));
  unwrap(removalCheck(source, paths, iteration));
  unwrap(resolvabilityCheck(source, iteration));

  const passed = unwrap(runGates(declared, iteration));

  unwrap(determinismCheck(declared, iteration));
  unwrap(regressionWall(source, iteration, declared));
  biteCheck(declared, iteration, changed, say);

  return { paths, incidental, changed, passed };
};
