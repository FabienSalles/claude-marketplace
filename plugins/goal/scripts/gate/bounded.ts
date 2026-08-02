// The process ceiling every declared command and every implementer runs under. `ulimit -u` lowers
// the soft and the hard limit together, so nothing spawned underneath can raise it back: a runaway
// fork dies on EAGAIN in milliseconds instead of filling the process table. The figure is relative
// to what is already running, because an absolute one either refuses a healthy suite or bounds
// nothing.

import { spawnSync } from 'node:child_process';

const HEADROOM = Number(process.env.GOAL_PROC_HEADROOM ?? '400');

const liveProcesses = (uid: number): number => {
  const ps = spawnSync('ps', ['-u', String(uid), '-o', 'pid='], { encoding: 'utf8' });

  if (ps.status !== 0) {
    return 0;
  }

  return ps.stdout.split('\n').filter((line) => line.trim() !== '').length;
};

// Empty when there is no POSIX uid to count against, or when `ps` cannot be read: a ceiling
// guessed from nothing would refuse healthy commands, and refusing everything is not a guard.
export const ceiling = (): string => {
  const uid = process.getuid?.();

  if (uid === undefined) {
    return '';
  }

  const live = liveProcesses(uid);

  return live === 0 ? '' : `ulimit -u ${live + HEADROOM} || exit 1`;
};

// A newline, never `&&`: the command keeps its own shape, so a `!` negation or a pipeline still
// parses as its author wrote it.
export const bounded = (command: string): string => {
  const limit = ceiling();

  return limit === '' ? command : `${limit}\n${command}`;
};
