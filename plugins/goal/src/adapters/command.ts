import { spawn, spawnSync } from 'node:child_process';

import type { BinaryResult, CommandRunner } from '../ports.ts';

export const command: CommandRunner = {
  run: (cmd, args, options) => {
    const result = spawnSync(cmd, args, { ...options, encoding: 'utf8' });

    return { ...result, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  },
  spawn: (cmd, args, options) =>
    new Promise((resolve) => {
      const child = spawn(cmd, args, { env: options?.env, stdio: options?.stdio ?? 'pipe', signal: options?.signal, shell: options?.shell });
      let stdout = '';
      let stderr = '';

      child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
      child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
      child.on('error', (error) => {
        if (child.pid === undefined) {
          resolve({ status: null, stdout, stderr, error });
        }
      });
      child.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
    }),
  runBinary: (cmd, args, options) => spawnSync(cmd, args, { ...options, encoding: undefined }) as BinaryResult,
};
