#!/usr/bin/env node
// The single authority of an autonomous run. TypeScript, run natively by node: no build step,
// no dependency. Types are stripped at run time, never checked — `tsc --noEmit` is a CI concern.
//
// This file holds one thing: which checks a verb runs, and in which order. Every rule lives in
// its own module under `gate/`, one per group of business rules, matching the test files.
//
// Usage: node goal-gate.ts check|verify|commit <plan> <iteration> [plan_hash]
//        node goal-gate.ts bite <plan> <iteration>
//        node goal-gate.ts dod <plan> [plan_hash]
//        node goal-gate.ts scan
//        node goal-gate.ts lock|unlock <plan>
//
// Exit codes: 0 the iteration is runnable · 1 HALT, with a reason · 2 misuse.

import { halt, misuse } from './gate/halt.ts';
import { blockOf, declaredPaths, incidentalPaths, lockedHash, readPlan } from './gate/plan.ts';
import { determinismCheck, runGates } from './gate/commands.ts';
import { commitAndTick, runLock, scopeCheck } from './gate/scope.ts';
import { budgetCheck, removalCheck } from './gate/bounds.ts';
import { regressionWall, resolvabilityCheck } from './gate/cross-iteration.ts';
import { biteCheck } from './gate/bite.ts';
import { dodCheck, secretScan } from './gate/ship.ts';
import { monotonicityCheck, tickedSet } from './gate/ticked.ts';

const USAGE =
  'usage: goal-gate.ts check|verify|commit <plan> <iteration> [plan_hash] [ticked]\n       goal-gate.ts bite <plan> <iteration>\n       goal-gate.ts dod <plan> [plan_hash]\n       goal-gate.ts scan\n       goal-gate.ts lock|unlock <plan>';

const SUBCOMMANDS = ['check', 'verify', 'commit', 'bite', 'dod', 'lock', 'unlock'];

const ALLOWED_KEY = /^(test_files|impl_files|max_diff|commit_msg|gate[1-9][0-9]*)$/;
const REQUIRED_KEYS = ['gate1', 'impl_files', 'commit_msg'] as const;

// An iteration may only set the terms it is judged on for itself. Anything else belongs to the
// run — the plan hash, the global DoD, whether anything ships — and a slice that could set them
// would be rewriting its own contract.
const keysAreLegal = (declared: Map<string, string>, iteration: string): void => {
  const forbidden = [...declared.keys()].filter((key) => !ALLOWED_KEY.test(key));

  if (forbidden.length > 0) {
    halt(
      `Iteration ${iteration} declares a key it may not set.`,
      `Refused: ${forbidden.join(' ')}\n\nAn iteration gate block sets only test_files, impl_files, max_diff, commit_msg and gate1..N. Any other key either belongs to the run rather than the slice — the plan hash, the global DoD, whether anything ships — or is not a key at all. A slice that could set them would be rewriting the terms it is judged by.`,
    );
  }

  const missing = REQUIRED_KEYS.filter((key) => (declared.get(key) ?? '') === '');

  if (missing.length > 0) {
    halt(
      `Iteration ${iteration} is not runnable unattended.`,
      `Missing or empty: ${missing.join(' ')}\n\ngate1 is the acceptance criterion — without it the iteration exits 0 having proved nothing, which is exactly what the loop must never advance on. impl_files is the reference the scope check is made against. commit_msg is the message the slice is committed under. Write them into the gate block, or halt and report that this slice cannot be verified unattended.`,
    );
  }
};

// The order is the contract. Everything cheap and mechanical runs before any command is spawned,
// so a slice that already broke its budget does not spend the wall-clock of a suite it will halt
// on anyway; the bite check runs last because it is the only one that touches the tree.
const verify = (source: string, iteration: string, declared: Map<string, string>) => {
  const paths = declaredPaths(declared);
  const incidental = incidentalPaths(source);
  const changed = scopeCheck(paths, iteration, incidental);

  // The two bounds stay measured against the declared paths alone: generated tooling is not
  // authored work, so counting a lockfile against max_diff would blow every budget, and a
  // regenerated file is not the deletion removalCheck exists to catch.
  budgetCheck(declared, paths, iteration);
  removalCheck(source, paths, iteration);
  resolvabilityCheck(source, iteration);

  const passed = runGates(declared, iteration);

  determinismCheck(declared, iteration);
  regressionWall(source, iteration, declared);
  biteCheck(declared, iteration, changed);

  return { paths, incidental, changed, passed };
};

const main = (): void => {
  // The ticked set travels by argument only. It used to fall back to GOAL_RUN_TICKED, and a
  // declared command that spawns gates of its own — the suite does — read the outer run's lock
  // as its own: three tests red on the first run that ever locked with a non-empty set.
  const [subcommand, plan, iteration, locked, ticked] = process.argv.slice(2);

  if (subcommand === 'scan') {
    return secretScan();
  }

  if (plan === undefined || !SUBCOMMANDS.includes(subcommand ?? '')) {
    misuse(USAGE);
  }

  if (subcommand === 'lock' || subcommand === 'unlock') {
    return runLock(subcommand, plan);
  }

  if (subcommand === 'dod') {
    const source = readPlan(plan);

    lockedHash(plan, source, 'the Definition of Done replay', iteration);

    return dodCheck(source);
  }

  if (iteration === undefined) {
    misuse(USAGE);
  }

  if (!/^[0-9]+$/.test(iteration)) {
    misuse(`${USAGE}\niteration must be a number, got: ${iteration}`);
  }

  const source = readPlan(plan);
  const hash = lockedHash(plan, source, `iteration ${iteration}`, locked);
  const declared = blockOf(source, iteration);

  keysAreLegal(declared, iteration);

  // The sanctioned RED check: sets impl_files aside, reruns gate1, requires it to fail, restores
  // by overwrite — the same mechanism `verify` runs last, invocable on demand so an implementer
  // proves RED without paying for the whole pipeline, and without reaching for `git stash`.
  if (subcommand === 'bite') {
    const paths = declaredPaths(declared);
    const incidental = incidentalPaths(source);
    const changed = scopeCheck(paths, iteration, incidental);

    biteCheck(declared, iteration, changed);

    return;
  }

  if (subcommand === 'check') {
    const commands = [...declared.keys()].filter((key) => key.startsWith('gate')).length;

    process.stdout.write(
      `OK: iteration ${iteration} is runnable (${commands} acceptance command(s)).\nplan_hash=${hash}\nticked=${tickedSet(source)}\n`,
    );

    return;
  }

  const { paths, incidental, changed, passed } = verify(source, iteration, declared);

  if (subcommand === 'verify') {
    process.stdout.write(
      `OK: iteration ${iteration} passed ${passed} acceptance command(s), no scope leak.\n`,
    );

    return;
  }

  monotonicityCheck(source, iteration, ticked);

  commitAndTick(plan, source, iteration, declared, paths, changed, incidental);
};

main();
