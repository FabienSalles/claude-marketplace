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
import { createPublisher, remoteNote } from '../src/run/publish.ts';
import { close, LANDED } from '../src/run/close.ts';
import { pauseLine } from '../src/core/publication.ts';
import { PAUSED } from '../src/core/verdict.ts';
import { quote } from '../src/run/shell.ts';
import { claudeAgentSessions } from '../src/adapters/claude/session.ts';
import { defaultSettingsPath } from '../src/adapters/claude/warning.ts';
import { defaultProjectsRoot } from '../src/adapters/claude/postmortem.ts';
import { workIdOf } from '../src/core/plan.ts';
import { checkSettings, settingValue } from '../src/core/settings.ts';
import { iterationNumbers, subHeadings } from '../src/gate/plan.ts';
import { inProcessGateAdapter, spawnGateAdapter, type GateAdapter } from '../src/adapters/gate.ts';

const main = async (): Promise<void> => {
  const [plan, iteration] = process.argv.slice(2);
  const reporter: Reporter = createReporter();

  if (plan === undefined || plan === '') {
    reporter.stop('usage: goal-run.ts <plan> [iteration]', REFUSED);
  }

  if (!fs.exists(plan) || !fs.isFile(plan)) {
    reporter.stop(`the plan is not readable: ${plan}`, REFUSED);
  }

  if (iteration !== undefined && !/^[0-9]+$/.test(iteration)) {
    reporter.stop(`the iteration must be a number, got: ${iteration}`, REFUSED);
  }

  const { faults, effective } = checkSettings(process.env);

  if (faults.length > 0) {
    reporter.stop(`refusing to start, ${faults.length} faulty setting(s):\n${faults.map((fault) => `  - ${fault}`).join('\n')}`, REFUSED);
  }

  const source = fs.readFile(plan);

  if (iteration !== undefined && iterationNumbers(source, true).includes(iteration)) {
    reporter.stop(`iteration ${iteration} is already ticked in ${plan}, so nothing was attempted`, REFUSED);
  }

  const dir = runDir(workIdOf(plan, source));
  reporter.setLog(dir);
  reporter.say(`RUN writing this run's records to ${dir}`);
  const resolved: Record<string, string> = { GOAL_RUN_SETTINGS_PATH: defaultSettingsPath(), GOAL_RUN_PROJECTS_ROOT: defaultProjectsRoot() };
  reporter.say(
    `RUN settings ${Object.entries(effective)
      .map(([name, { value, source }]) => (name === 'GOAL_GATE' ? `${name}=(${source})` : `${name}=${resolved[name] ?? value ?? 'unset'} (${source})`))
      .join(' ')}`,
  );

  // The channel this run gets its verdicts through: in-process by default — no subprocess spawned
  // for the CLI verbs at all — and the spawn+scrape channel a run has always driven, kept intact,
  // the moment GOAL_GATE names a command to drive instead. `gateLabel` stays a plain string:
  // nothing but the unlock hint below reads it, and that hint names the CLI a developer can still
  // run by hand whichever channel this run itself took.
  const gateCommand = settingValue('GOAL_GATE', process.env);
  const gateLabel = gateCommand ?? `node ${quote(resolve(import.meta.dirname, 'goal-gate.ts'))}`;
  const gate: GateAdapter = gateCommand !== undefined ? spawnGateAdapter(gateLabel) : inProcessGateAdapter();

  const agents = claudeAgentSessions();

  const preflightStart = Date.now();
  const { policy, remote } = preflight(plan, source, reporter, gateLabel);
  reporter.say(`RUN stage=preflight duration_ms=${Date.now() - preflightStart} exit=0`);

  const iterations = iteration !== undefined ? [iteration] : iterationNumbers(source, false);

  // No unchecked iteration means two opposite things, and only one of them is a finished plan.
  // Every box ticked is done. No heading parsed as an iteration at all is a plan this runner
  // cannot read — a mistyped or translated heading — and reporting that as landed is a green
  // that shipped nothing, indistinguishable from success in the exit code and in the log.
  if (iterations.length === 0 && iterationNumbers(source, true).length === 0) {
    const found = subHeadings(source);

    reporter.stop(
      `the plan declares no iteration this runner can read: ${plan}\n` +
        'An iteration heading must read exactly `### Iteration <n>`, in English, whatever language the rest of the plan is written in.\n' +
        (found.length === 0
          ? 'The plan carries no `### ` heading at all.'
          : `Found instead:\n${found.map((line) => `  ${line}`).join('\n')}`),
      REFUSED,
    );
  }

  const publisher = createPublisher(plan, source, policy, remote, reporter, gate);
  const closing = iterations.length === 0;

  if (closing && publisher.isComplete()) {
    reporter.stop(`no unchecked iteration remains in ${plan}`, LANDED);
  }

  const hashes = new Map<string, string>();
  const tickedSets = new Map<string, string>();

  const checking = closing ? iterationNumbers(source, true).slice(-1) : iterations;
  const lastIteration = checking[checking.length - 1]!;

  for (const n of checking) {
    const checked = gate.check(plan, n);
    const output = `${checked.stdout}${checked.stderr}`;

    if (checked.status !== 0) {
      reporter.say(`STOP the gate will not run iteration ${n}, so nothing was attempted:`);
      reporter.say(output);
      process.exit(REFUSED);
    }

    const hash = /^plan_hash=([0-9a-f]*)$/m.exec(output)?.[1];

    if (hash === undefined || hash === '') {
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

  if (!closing && publisher.state.publishes && iterationNumbers(source, true).length > 0) {
    const refusal = publisher.publish();

    if (refusal !== undefined) {
      reporter.stop(pauseLine(refusal, publisher.state.landed, publisher.state.onRemote), PAUSED);
    }
  }

  const landed: string[] = [];
  const noted = new Set<string>();

  for (const n of iterations) {
    await runIteration(plan, source, n, hashes.get(n)!, tickedSets.get(n) ?? '', gate, agents, dir, reporter, publisher, noted);
    landed.push(n);

    // Every iteration but the last publishes here, as it lands. The last one's push waits for
    // close(), behind the whole-branch Definition of Done.
    if (n !== iterations[iterations.length - 1]) {
      const pushStart = Date.now();
      const refusal = publisher.publish(n);
      reporter.say(`RUN stage=push duration_ms=${Date.now() - pushStart} exit=${refusal === undefined ? 0 : 1}`);

      if (refusal !== undefined) {
        reporter.stop(pauseLine(refusal, publisher.state.landed, publisher.state.onRemote), PAUSED);
      }
    }
  }

  const exitCode = await close(plan, gate, hashes.get(lastIteration)!, remote, publisher, landed, dir, reporter, agents);

  if (exitCode === LANDED) {
    reporter.say(
      closing
        ? `STOP every iteration was already ticked, the close ran.${remoteNote(publisher)}`
        : `STOP ${iterations.length} iteration(s) landed, gate-verified.${remoteNote(publisher)}`,
    );
  }

  process.exit(exitCode);
};

try {
  await main();
} catch (error) {
  rootCatch(error);
}
