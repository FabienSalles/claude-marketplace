import type { Clock } from '../ports.ts';

export const clock: Clock = {
  now: () => Date.now(),
};
