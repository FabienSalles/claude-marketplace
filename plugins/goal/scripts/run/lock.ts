// The lock the gate holds for a run: taken before an implementer touches the tree, released on
// every exit path — landed, refused, paused, or killed — so a run that dies mid-iteration never
// blocks the next launch. INT and TERM are what a developer and a supervisor send; the process
// 'exit' event covers everything else, including an uncaught throw.

import { spawnSync } from 'node:child_process';

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

const gateCall = (gate: string, subcommand: string, plan: string): number =>
  spawnSync(`${gate} ${subcommand} ${quote(plan)}`, { shell: true, stdio: 'ignore' }).status ?? 1;

export type Lock = {
  acquire: () => boolean;
  release: () => void;
};

export const createLock = (gate: string, plan: string): Lock => {
  let held = false;

  const release = (): void => {
    if (!held) {
      return;
    }

    held = false;
    gateCall(gate, 'unlock', plan);
  };

  const acquire = (): boolean => {
    held = gateCall(gate, 'lock', plan) === 0;

    return held;
  };

  process.once('exit', release);
  process.once('SIGINT', () => {
    release();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    release();
    process.exit(143);
  });

  return { acquire, release };
};
