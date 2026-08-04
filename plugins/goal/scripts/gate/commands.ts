// Running the commands a gate block declares, and requiring gate1 to hold across replays.

import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

import { bounded, spawnOptions } from './bounded.ts';
import { halt } from './halt.ts';

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
): number => {
  const commands = gateCommands(declared);

  for (const [key, command] of commands) {
    const start = Date.now();
    const run = spawnSync(bounded(command), spawnOptions());

    emitCommand(wall ? `wall:${key}` : key, command, Date.now() - start, run.status);

    if (run.status !== 0) {
      const detail = `Command: ${command}\nExit code: ${run.status}\n\nOutput:\n${`${run.stdout}${run.stderr}`.slice(-4000)}`;

      if (origin !== undefined) {
        halt(
          `A command iteration ${origin.get(command)} passed on fails at iteration ${iteration}.`,
          `${detail}\n\nThe regression wall replays every checked iteration's commands, so the slice that broke an earlier one halts instead of the slice that merely runs after it. The wall cannot prove a replayed command is idempotent: if it writes state — a migration, a snapshot, a generated file — it may be failing on the leftovers of its own earlier runs rather than on this slice. Declare only commands that can be run twice.`,
        );
      }

      halt(`Acceptance command ${key} failed for iteration ${iteration}.`, detail);
    }
  }

  return commands.length;
};

export const DETERMINISM_RUNS = 3;

// gate1 alone, for the same reason the bite check bites it alone: R2 makes it the one
// mandatory command, where gate2..N are lints that cannot flake. runGates() already spent
// the first of the three runs.
export const determinismCheck = (declared: Map<string, string>, iteration: string): void => {
  const command = declared.get('gate1') ?? '';

  for (let run = 2; run <= DETERMINISM_RUNS; run += 1) {
    const start = Date.now();
    const result = spawnSync(bounded(command), spawnOptions());

    emitCommand(`determinism${run}`, command, Date.now() - start, result.status);

    if (result.status !== 0) {
      halt(
        `Iteration ${iteration}'s acceptance command does not pass ${DETERMINISM_RUNS} times in a row.`,
        `Command: ${command}\nRun ${run} of ${DETERMINISM_RUNS} exited ${result.status}\n\nOutput:\n${`${result.stdout}${result.stderr}`.slice(-4000)}\n\nA command that passes once and fails on a replay depends on the leftovers of its own previous run, or on something outside the tree. An unattended loop cannot tell that apart from a real failure, so it stops here.`,
      );
    }
  }
};
