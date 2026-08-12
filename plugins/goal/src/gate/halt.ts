// The refusal contract every gate module speaks: halt() and misuse() leave the current verb by
// throwing, and only a root — goal-gate.ts, plan-guard.ts, the in-process adapter — turns one
// into printed output and an exit status.

import { rmSync } from 'node:fs';

import type { Result } from '../core/result.ts';
import type { Halt } from '../core/verdict.ts';

export class HaltError extends Error {
  readonly reason: string;
  readonly detail: string;

  constructor(reason: string, detail: string) {
    super(reason);
    this.reason = reason;
    this.detail = detail;
  }
}

export class MisuseError extends Error {}

export const halt: (reason: string, detail: string) => never = (reason, detail) => {
  throw new HaltError(reason, detail);
};

export const misuse: (message: string) => never = (message) => {
  throw new MisuseError(message);
};

export const haltText = (error: HaltError): string => `HALT\n\nREASON: ${error.reason}\n\nDETAIL:\n${error.detail}\n`;

// The channel a long check streams progress through — a root decides whether it reaches stdout
// live or a buffer. A message that matters if the process dies mid-check (a backup's location)
// must stream; a verb's final one-liner is returned instead.
export type Say = (chunk: string) => void;

export const unwrap = <T>(result: Result<T, Halt>): T => (result.ok ? result.value : halt(result.error.reason, result.error.detail));

export const heldLocks: string[] = [];

export const restorers: (() => void)[] = [];

// A spawned gate starts every verb with neither of these held, because its previous process
// exit released them; the in-process adapter calls this after every verb for the same reason.
export const release = (): void => {
  restorers.splice(0).forEach((restore) => restore());
  heldLocks.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true }));
};

process.on('exit', release);
process.once('SIGINT', () => {
  release();
  process.exit(130);
});
process.once('SIGTERM', () => {
  release();
  process.exit(143);
});
