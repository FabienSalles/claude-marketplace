// The pure decision behind a declared command's exit status: whether it halts, and which of the
// two messages — a plain failure or a regression-wall hit — it halts with. The spawn stays in
// gate/commands.ts.

import { err, ok, type Result } from '../result.ts';
import { halt, type Halt } from '../verdict.ts';

export const gatePassed = (
  key: string,
  command: string,
  status: number | null,
  output: string,
  iteration: string,
  origin: string | undefined,
): Result<void, Halt> => {
  if (status === 0) return ok(undefined);

  const detail = `Command: ${command}\nExit code: ${status}\n\nOutput:\n${output.slice(-4000)}`;

  if (origin !== undefined) {
    return err(halt(
      `A command iteration ${origin} passed on fails at iteration ${iteration}.`,
      `${detail}\n\nThe regression wall replays every checked iteration's commands, so the slice that broke an earlier one halts instead of the slice that merely runs after it. The wall cannot prove a replayed command is idempotent: if it writes state — a migration, a snapshot, a generated file — it may be failing on the leftovers of its own earlier runs rather than on this slice. Declare only commands that can be run twice.`,
    ));
  }

  return err(halt(`Acceptance command ${key} failed for iteration ${iteration}.`, detail));
};

export const determinismHeld = (
  run: number,
  totalRuns: number,
  command: string,
  status: number | null,
  output: string,
  iteration: string,
): Result<void, Halt> => {
  if (status === 0) return ok(undefined);

  return err(halt(
    `Iteration ${iteration}'s acceptance command does not pass ${totalRuns} times in a row.`,
    `Command: ${command}\nRun ${run} of ${totalRuns} exited ${status}\n\nOutput:\n${output.slice(-4000)}\n\nA command that passes once and fails on a replay depends on the leftovers of its own previous run, or on something outside the tree. An unattended loop cannot tell that apart from a real failure, so it stops here.`,
  ));
};
