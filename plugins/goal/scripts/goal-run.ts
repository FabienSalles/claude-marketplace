#!/usr/bin/env node
// Node port of goal-run.sh — the seam that lets the suite prove the two runners interchangeable
// one behaviour at a time. GOAL_RUN_IMPL selects which one a caller of the test harness spawns;
// this file only has to honour what has already landed here.
//
// Usage:
//   node goal-run.ts <plan> [iteration]
//
// Exit codes:
//   2 — refused: the run never started, and nothing needs undoing

import { existsSync, statSync } from 'node:fs';
import { createReporter, type Reporter } from './run/report.ts';

const REFUSED = 2;

const main = (): void => {
  const [plan, iteration] = process.argv.slice(2);
  const reporter: Reporter = createReporter();

  if (!plan) {
    reporter.stop('usage: goal-run.ts <plan> [iteration]', REFUSED);
  }

  if (!existsSync(plan) || !statSync(plan).isFile()) {
    reporter.stop(`the plan is not readable: ${plan}`, REFUSED);
  }

  if (iteration !== undefined && !/^[0-9]+$/.test(iteration)) {
    reporter.stop(`the iteration must be a number, got: ${iteration}`, REFUSED);
  }
};

main();
