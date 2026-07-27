// The process contract every other module speaks: how a refusal leaves this program, and the
// two primitives that touch the outside world. Nothing here knows what a plan is.

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

export const halt: (reason: string, detail: string) => never = (reason, detail) => {
  process.stdout.write(`HALT\n\nREASON: ${reason}\n\nDETAIL:\n${detail}\n`);
  process.exit(1);
};

export const misuse: (message: string) => never = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(2);
};

export const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });

export const heldLocks: string[] = [];

process.on('exit', () => heldLocks.forEach((path) => rmSync(path, { recursive: true, force: true })));
