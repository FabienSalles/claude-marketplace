import { spawnSync } from 'node:child_process';

import type { BinaryResult, CommandRunner } from '../ports.ts';

export const command: CommandRunner = {
  run: (cmd, args, options) => spawnSync(cmd, args, { ...options, encoding: 'utf8' }),
  runBinary: (cmd, args, options) => spawnSync(cmd, args, { ...options, encoding: undefined }) as BinaryResult,
};
