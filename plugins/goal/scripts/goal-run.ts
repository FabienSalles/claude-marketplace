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

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { createReporter, type Reporter } from './run/report.ts';
import { preflight, REFUSED } from './run/preflight.ts';

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

  reporter.setLog(`${plan}.run.log`);

  const gate = process.env.GOAL_GATE ?? `node ${resolve(import.meta.dirname, 'goal-gate.ts')}`;
  const source = readFileSync(plan, 'utf8');

  preflight(plan, source, reporter, gate);

  if (iteration !== undefined) {
    reporter.say(`RUN handing iteration ${iteration} to the implementer`);
    spawnSync(
      'claude',
      ['-p', '--agent', 'goal:goal-run-implementer', '--permission-mode', 'auto', `Implement iteration ${iteration} of ${plan}.`],
      { encoding: 'utf8' },
    );
  }
};

main();
