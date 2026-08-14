import { command } from './command.ts';
import type { Clock } from '../ports.ts';

export const clock: Clock = {
  now: () => Date.now(),
  sleepSeconds: (seconds) => {
    command.run('sleep', [String(seconds)]);
  },
};
