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

import { resolve } from 'node:path';

import { fs } from '../src/adapters/fs.ts';
import { rootCatch } from '../src/gate/halt.ts';
import { createReporter, runDir, type Reporter } from '../src/run/report.ts';
import { preflight, REFUSED } from '../src/run/preflight.ts';
import { createLock } from '../src/run/lock.ts';
import { runIteration } from '../src/run/iteration.ts';
import { blockedNote, createPublisher } from '../src/run/publish.ts';
import { close, LANDED } from '../src/run/close.ts';
import { quote } from '../src/run/shell.ts';
import { workIdOf } from '../src/core/plan.ts';
import { iterationNumbers } from '../src/gate/plan.ts';
import { inProcessGateAdapter, spawnGateAdapter, type GateAdapter } from '../src/adapters/gate.ts';

const main = async (): Promise<void> => {
  const [plan, iteration] = process.argv.slice(2);
  const reporter: Reporter = createReporter();

  if (!plan) {
    reporter.stop('usage: goal-run.ts <plan> [iteration]', REFUSED);
  }

  if (!fs.exists(plan) || !fs.isFile(plan)) {
    reporter.stop(`the plan is not readable: ${plan}`, REFUSED);
  }

  if (iteration !== undefined && !/^[0-9]+$/.test(iteration)) {
    reporter.stop(`the iteration must be a number, got: ${iteration}`, REFUSED);
  }

  const dir = runDir(workIdOf(plan));
  reporter.setLog(dir);
  reporter.say(`RUN writing this run's records to ${dir}`);

  // The channel this run gets its verdicts through: in-process by default — no subprocess spawned
  // for the CLI verbs at all — and the spawn+scrape channel a run has always driven, kept intact,
  // the moment GOAL_GATE names a command to drive instead. `gateLabel` stays a plain string:
  // nothing but the unlock hint below reads it, and that hint names the CLI a developer can still
  // run by hand whichever channel this run itself took.
  const gateLabel = process.env.GOAL_GATE ?? `node ${quote(resolve(import.meta.dirname, 'goal-gate.ts'))}`;
  const gate: GateAdapter = process.env.GOAL_GATE !== undefined ? spawnGateAdapter(gateLabel) : inProcessGateAdapter();
  const source = fs.readFile(plan);

  const preflightStart = Date.now();
  const { policy, remote } = preflight(plan, source, reporter, gateLabel);
  reporter.say(`RUN stage=preflight duration_ms=${Date.now() - preflightStart} exit=0`);

  const iterations = iteration !== undefined ? [iteration] : iterationNumbers(source, false);

  if (iterations.length === 0) {
    reporter.stop(`no unchecked iteration remains in ${plan}`, LANDED);
  }

  const hashes = new Map<string, string>();
  const tickedSets = new Map<string, string>();

  for (const n of iterations) {
    const checked = gate.check(plan, n);
    const output = `${checked.stdout}${checked.stderr}`;

    if (checked.status !== 0) {
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
    reporter.stop(`another run holds this plan. Wait for it, or free it with: ${gateLabel} unlock ${quote(plan)}`, REFUSED);
  }

  const publisher = createPublisher(plan, source, policy, remote, reporter, gate);

  const landed: string[] = [];

  for (const n of iterations) {
    await runIteration(plan, source, n, hashes.get(n)!, tickedSets.get(n) ?? '', gate, dir, reporter, publisher);
    landed.push(n);

    // Every iteration but the last publishes here, as it lands. The last one's push waits for
    // close(), behind the whole-branch Definition of Done.
    if (n !== iterations[iterations.length - 1]) {
      const pushStart = Date.now();
      publisher.publish(n);
      reporter.say(`RUN stage=push duration_ms=${Date.now() - pushStart} exit=${publisher.state.blocked ? 1 : 0}`);
    }
  }

  const exitCode = close(plan, gate, hashes.get(iterations[iterations.length - 1]!)!, remote, publisher, landed, dir, reporter);

  if (exitCode === LANDED) {
    reporter.say(`STOP ${iterations.length} iteration(s) landed, gate-verified.${blockedNote(publisher)}`);
  }

  process.exit(exitCode);
};

try {
  await main();
} catch (error) {
  rootCatch(error);
}
