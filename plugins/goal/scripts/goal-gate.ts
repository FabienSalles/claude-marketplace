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

import { biteCheck } from './gate/bite.ts';
import { HaltError, MisuseError, haltText, misuse, unwrap, type Say } from './gate/halt.ts';
import { blockOf, declaredPaths, incidentalPaths, lockedHash, readPlan } from './gate/plan.ts';
import { commitAndTick, runLock, scopeCheck } from './gate/scope.ts';
import { dodCheck, secretScan } from './gate/ship.ts';
import { monotonicityCheck } from './gate/ticked.ts';
import { check, verify } from './gate/verbs.ts';

const say: Say = (chunk) => void process.stdout.write(chunk);

const USAGE =
  'usage: goal-gate.ts check|verify|commit <plan> <iteration> [plan_hash] [ticked]\n       goal-gate.ts bite <plan> <iteration>\n       goal-gate.ts dod <plan> [plan_hash]\n       goal-gate.ts scan\n       goal-gate.ts lock|unlock <plan>';

const SUBCOMMANDS = ['check', 'verify', 'commit', 'bite', 'dod', 'lock', 'unlock'];

const main = (): void => {
  // The ticked set travels by argument only. It used to fall back to GOAL_RUN_TICKED, and a
  // declared command that spawns gates of its own — the suite does — read the outer run's lock
  // as its own: three tests red on the first run that ever locked with a non-empty set.
  const [subcommand, plan, iteration, locked, ticked] = process.argv.slice(2);

  if (subcommand === 'scan') {
    return void process.stdout.write(secretScan());
  }

  if (plan === undefined || !SUBCOMMANDS.includes(subcommand ?? '')) {
    misuse(USAGE);
  }

  if (subcommand === 'lock' || subcommand === 'unlock') {
    return void process.stdout.write(runLock(subcommand, plan));
  }

  if (subcommand === 'dod') {
    const source = readPlan(plan);

    lockedHash(plan, source, 'the Definition of Done replay', iteration);

    return void process.stdout.write(dodCheck(source));
  }

  if (iteration === undefined) {
    misuse(USAGE);
  }

  if (!/^[0-9]+$/.test(iteration)) {
    misuse(`${USAGE}\niteration must be a number, got: ${iteration}`);
  }

  if (subcommand === 'check') {
    return void process.stdout.write(check(plan, iteration, locked));
  }

  const source = readPlan(plan);

  lockedHash(plan, source, `iteration ${iteration}`, locked);

  // Every construction invariant — legal keys, overlap, path shape, a declared secret, a
  // numeric max_diff — is proven inside blockOf(), which halts on the first one a plan fails:
  // an invalid-by-construction plan never reaches the gates `verify` spawns.
  const declared = blockOf(source, iteration);

  // The sanctioned RED check: sets impl_files aside, reruns gate1, requires it to fail, restores
  // by overwrite — the same mechanism `verify` runs last, invocable on demand so an implementer
  // proves RED without paying for the whole pipeline, and without reaching for `git stash`.
  if (subcommand === 'bite') {
    const paths = declaredPaths(declared);
    const incidental = incidentalPaths(source);
    const changed = unwrap(scopeCheck(paths, iteration, incidental));

    biteCheck(declared, iteration, changed, say);

    return;
  }

  const { paths, incidental, changed, passed } = verify(source, iteration, declared, say);

  if (subcommand === 'verify') {
    process.stdout.write(
      `OK: iteration ${iteration} passed ${passed} acceptance command(s), no scope leak.\n`,
    );

    return;
  }

  unwrap(monotonicityCheck(source, iteration, ticked));

  process.stdout.write(commitAndTick(plan, source, iteration, declared, paths, changed, incidental));
};

try {
  main();
} catch (error) {
  if (error instanceof HaltError) {
    process.stdout.write(haltText(error));
    process.exit(1);
  }

  if (error instanceof MisuseError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }

  throw error;
}
