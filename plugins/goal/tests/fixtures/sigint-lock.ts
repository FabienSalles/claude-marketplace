import { createLock } from '../../src/run/lock.ts';

const [, , gate, plan] = process.argv;
const lock = createLock(gate!, plan!);

if (!lock.acquire()) {
  process.exit(1);
}

setInterval(() => {}, 1000);
