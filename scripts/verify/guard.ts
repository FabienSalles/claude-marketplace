import { spawn, spawnSync } from 'node:child_process';
import { constants } from 'node:os';

import { findHolders, GOAL_RUN, takeLock } from './holder.ts';

const FORWARDED = ['SIGINT', 'SIGTERM'] as const;

export const guarded = async (root: string, inner: string, args: readonly string[], marker: string = GOAL_RUN): Promise<number> => {
  const gitDir = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const { refusal, notes } = findHolders(root, gitDir, marker);

  for (const note of notes) {
    process.stderr.write(`${note}\n`);
  }

  if (refusal !== undefined) {
    process.stderr.write(`${refusal}\n`);

    return 1;
  }

  const release = takeLock(gitDir);
  const child = spawn(process.execPath, [inner, ...args], { cwd: root, stdio: 'inherit', detached: true });
  const forward = (signal: NodeJS.Signals): void => {
    if (child.pid !== undefined) {
      try {
        process.kill(-child.pid, signal);
      } catch {
        // the check already exited
      }
    }
  };

  for (const signal of FORWARDED) {
    process.on(signal, () => forward(signal));
  }

  const code = await new Promise<number>((done) => {
    child.on('close', (status, signal) => done(signal === null ? (status ?? 1) : 128 + constants.signals[signal]));
  });

  release();

  return code;
};
