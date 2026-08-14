import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

import { ok, type Result } from '../core/result.ts';
import { determinismHeld, gatePassed } from '../core/rules/commands.ts';
import type { Halt } from '../core/verdict.ts';
import { bounded, spawnOptions } from './bounded.ts';

// The runner's own event stream, appended to only when GOAL_RUN_JSONL names one: a gate run
// outside the runner — the sanctioned RED check among them — writes nothing here, so every
// standalone use is untouched.
export const emitCommand = (key: string, command: string, durationMs: number, exit: number | null): void => {
  const jsonl = process.env.GOAL_RUN_JSONL;

  if (!jsonl) {
    return;
  }

  // Bookkeeping, never the verdict's hostage: a stale or unwritable path loses the event, not
  // the judgement.
  try {
    appendFileSync(
      jsonl,
      `${JSON.stringify({ v: 1, ts: new Date().toISOString(), event: 'gate-command', key, command, duration_ms: durationMs, exit })}\n`,
    );
  } catch {
    // the stream is the runner's concern
  }
};

export const gateCommands = (declared: Map<string, string>): [string, string][] =>
  [...declared.entries()]
    .filter(([key]) => key.startsWith('gate'))
    .sort(([a], [b]) => Number(a.slice(4)) - Number(b.slice(4)));

export const runGates = (
  declared: Map<string, string>,
  iteration: string,
  origin?: Map<string, string>,
  wall = false,
): Result<number, Halt> => {
  const commands = gateCommands(declared);

  for (const [key, command] of commands) {
    const start = Date.now();
    const run = spawnSync(bounded(command), spawnOptions());

    emitCommand(wall ? `wall:${key}` : key, command, Date.now() - start, run.status);

    const decision = gatePassed(key, command, run.status, `${run.stdout}${run.stderr}`, iteration, origin?.get(command));

    if (!decision.ok) return decision;
  }

  return ok(commands.length);
};

export const DETERMINISM_RUNS = 3;

// gate1 alone, for the same reason the bite check bites it alone: R2 makes it the one
// mandatory command, where gate2..N are lints that cannot flake. runGates() already spent
// the first of the three runs.
export const determinismCheck = (declared: Map<string, string>, iteration: string): Result<void, Halt> => {
  const command = declared.get('gate1') ?? '';

  for (let run = 2; run <= DETERMINISM_RUNS; run += 1) {
    const start = Date.now();
    const result = spawnSync(bounded(command), spawnOptions());

    emitCommand(`determinism${run}`, command, Date.now() - start, result.status);

    const decision = determinismHeld(run, DETERMINISM_RUNS, command, result.status, `${result.stdout}${result.stderr}`, iteration);

    if (!decision.ok) return decision;
  }

  return ok(undefined);
};
