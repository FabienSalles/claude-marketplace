#!/usr/bin/env node
// With no iteration named, the plan's unchecked boxes are surveyed and every one of them proven
// runnable before any is implemented, so a plan that would fail on its third iteration never
// spends the first two.
//
// Usage:
//   node goal-run.ts <plan> [iteration]
//
// Exit codes:
//   0 — every iteration attempted landed, gate-verified
//   1 — halted: the gate refused one of them
//   2 — refused: the run never started, and nothing needs undoing
//   3 — paused: a clean boundary, relaunch resumes here

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { createReporter, type Reporter } from './run/report.ts';
import { preflight, REFUSED } from './run/preflight.ts';
import { createLock } from './run/lock.ts';
import { runIteration } from './run/iteration.ts';
import { createPublisher } from './run/publish.ts';
import { close, LANDED } from './run/close.ts';
import { quote } from './run/shell.ts';
import { iterationNumbers } from './gate/plan.ts';

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

  const { policy, remote } = preflight(plan, source, reporter, gate);

  const iterations = iteration !== undefined ? [iteration] : iterationNumbers(source, false);

  if (iterations.length === 0) {
    reporter.stop(`no unchecked iteration remains in ${plan}`, LANDED);
  }

  const hashes = new Map<string, string>();
  const tickedSets = new Map<string, string>();

  for (const n of iterations) {
    const checked = spawnSync(`${gate} check ${quote(plan)} ${quote(n)}`, { shell: true, encoding: 'utf8' });
    const output = `${checked.stdout}${checked.stderr}`;

    if ((checked.status ?? 1) !== 0) {
      reporter.say(`STOP the gate will not run iteration ${n}, so nothing was attempted:`);
      reporter.say(output);
      process.exit(REFUSED);
    }

    const hash = /^plan_hash=([0-9a-f]*)$/m.exec(output)?.[1];

    if (!hash) {
      reporter.say(`STOP the gate published no plan_hash for iteration ${n}, so nothing locks the contract:`);
      reporter.say(output);
      process.exit(REFUSED);
    }

    hashes.set(n, hash);

    const ticked = /^ticked=(.*)$/m.exec(output)?.[1];

    if (ticked !== undefined) {
      tickedSets.set(n, ticked);
    }
  }

  const lock = createLock(gate, plan);

  // Taken once, before the first iteration, and released only when this process exits — see
  // lock.ts's process.once('exit') handler, which runs on every path out of here, landed or not.
  if (!lock.acquire()) {
    reporter.stop(`another run holds this plan. Wait for it, or free it with: ${gate} unlock ${plan}`, REFUSED);
  }

  const publisher = createPublisher(plan, source, policy, remote, reporter, gate);

  const landed: string[] = [];
  let elapsed = '';

  for (const n of iterations) {
    const start = Date.now();
    runIteration(plan, source, n, hashes.get(n)!, tickedSets.get(n) ?? '', gate, reporter);
    landed.push(n);

    // Every iteration but the last publishes here, as it lands. The last one's push waits for
    // close(), behind the whole-branch Definition of Done.
    if (n !== iterations[iterations.length - 1]) {
      publisher.publish(n);
    }

    elapsed += `${n}: ${Math.round((Date.now() - start) / 1000)}s\n`;
  }

  const exitCode = close(plan, gate, hashes.get(iterations[iterations.length - 1]!)!, remote, publisher, landed, elapsed, reporter);

  if (exitCode === LANDED) {
    reporter.say(`STOP ${iterations.length} iteration(s) landed, gate-verified`);
  }

  process.exit(exitCode);
};

main();
