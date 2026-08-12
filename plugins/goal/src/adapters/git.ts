import { spawnSync } from 'node:child_process';

export const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });
