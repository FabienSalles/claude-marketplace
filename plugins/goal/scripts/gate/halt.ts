// The process contract every other module speaks: how a refusal leaves this program, and the
// two primitives that touch the outside world. Nothing here knows what a plan is.

import { rmSync } from 'node:fs';

export { git } from '../adapters/git.ts';

export const halt: (reason: string, detail: string) => never = (reason, detail) => {
  process.stdout.write(`HALT\n\nREASON: ${reason}\n\nDETAIL:\n${detail}\n`);
  process.exit(1);
};

export const misuse: (message: string) => never = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(2);
};

export const heldLocks: string[] = [];

export const restorers: (() => void)[] = [];

const release = (): void => {
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
