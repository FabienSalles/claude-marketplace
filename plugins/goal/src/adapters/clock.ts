import { setTimeout as delay } from 'node:timers/promises';

import { command } from './command.ts';
import type { WaitingClock } from '../ports.ts';

export const clock: WaitingClock = {
  now: () => Date.now(),
  sleepSeconds: (seconds) => {
    command.run('sleep', [String(seconds)]);
  },
  sleep: (seconds, signal) => delay(seconds * 1000, undefined, { signal }).catch(() => undefined),
};
