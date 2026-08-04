// Shared shell helpers: every runner module that shells out needs the same quoting and the same
// git(), so one definition of each lives here rather than four and five copies drifting apart.

import { spawnSync } from 'node:child_process';

export const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

export const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });
