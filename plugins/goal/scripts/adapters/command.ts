import { spawnSync } from 'node:child_process';

import type { CommandRunner } from '../ports.ts';

export const command: CommandRunner = {
  run: (cmd, args, options) => spawnSync(cmd, args, { encoding: 'utf8', ...options }),
};
