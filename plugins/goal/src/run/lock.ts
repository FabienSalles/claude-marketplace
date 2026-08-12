// The lock the gate holds for a run: taken before an implementer touches the tree, released on
// every exit path — landed, refused, paused, or killed — so a run that dies mid-iteration never
// blocks the next launch. INT and TERM are what a developer and a supervisor send; the process
// 'exit' event covers everything else, including an uncaught throw.

import { gateAdapterOf, type GateAdapter } from '../adapters/gate.ts';

export type Lock = {
  acquire: () => boolean;
  release: () => void;
};

export const createLock = (gateArg: GateAdapter | string, plan: string): Lock => {
  const gate = gateAdapterOf(gateArg);
  let held = false;

  const release = (): void => {
    if (!held) {
      return;
    }

    held = false;
    gate.unlock(plan);
  };

  const acquire = (): boolean => {
    held = gate.lock(plan).status === 0;

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
