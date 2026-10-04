import { spawnSync } from 'node:child_process';

import type { BinaryResult, CommandRunner } from '../ports.ts';

export const command: CommandRunner = {
  run: (cmd, args, options) => {
    const result = spawnSync(cmd, args, { ...options, encoding: 'utf8' });

    return { ...result, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  },
  runBinary: (cmd, args, options) => spawnSync(cmd, args, { ...options, encoding: undefined }) as BinaryResult,
};
