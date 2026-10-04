// The lock the gate holds for a run: taken before an implementer touches the tree, released on
// every exit path — landed, refused, paused, or killed — so a run that dies mid-iteration never
// blocks the next launch. INT and TERM are what a developer and a supervisor send; the process
// 'exit' event covers everything else, including an uncaught throw.

import { gateAdapterOf, type GateAdapter } from '../adapters/gate.ts';

export type Lock = {
  acquire: () => boolean;
  release: () => void;
};

let controller = new AbortController();
let requested: number | undefined;
let guarded = 0;

export const interrupt = {
  signal: (): AbortSignal => controller.signal,
  guard: async <T>(work: () => Promise<T>): Promise<T> => {
    guarded += 1;

    try {
      return await work();
    } finally {
      guarded -= 1;
    }
  },
  exitIfRequested: (): void => {
    if (requested !== undefined) {
      process.exit(requested);
    }
  },
};

export const createLock = (gateArg: GateAdapter | string, plan: string): Lock => {
  const gate = gateAdapterOf(gateArg);
  controller = new AbortController();
  requested = undefined;
  guarded = 0;
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
  const stop = (code: number) => (): void => {
    const again = requested !== undefined;

    requested = code;
    controller.abort();

    if (again || guarded === 0) {
      release();
      process.exit(code);
    }
  };

  for (const [name, code] of [['SIGINT', 130], ['SIGTERM', 143]] as const) {
    const inherited = process.listeners(name);

    process.on(name, stop(code));
    inherited.forEach((listener) => process.removeListener(name, listener));
  }

  return { acquire, release };
};
