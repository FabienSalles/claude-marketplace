// The process ceiling every declared command and every implementer runs under. `ulimit -u` lowers
// the soft and the hard limit together, so nothing spawned underneath can raise it back — which is
// the property that bounds a runaway fork, and the same one that makes a second attempt fail with
// EPERM. The gate is a descendant of its own bounded commands (a swept `run.sh` spawns the gate,
// which bounds again), so the ceiling is emitted only when it would genuinely lower what was
// inherited; nested calls are no-ops and the outermost one binds them all.

import { spawnSync } from 'node:child_process';

const HEADROOM = Number(process.env.GOAL_PROC_HEADROOM ?? '400');

const liveProcesses = (uid: number): number => {
  const ps = spawnSync('ps', ['-u', String(uid), '-o', 'pid='], { encoding: 'utf8' });

  if (ps.status !== 0) {
    return 0;
  }

  return ps.stdout.split('\n').filter((line) => line.trim() !== '').length;
};

// `unlimited` reads as a string, and a limit this process cannot report reads as absent. Both mean
// "nothing is holding us yet", so the ceiling applies.
const inheritedLimit = (): number => {
  const report = process.report?.getReport() as
    | { userLimits?: { max_user_processes?: { soft?: number | string } } }
    | undefined;
  const soft = report?.userLimits?.max_user_processes?.soft;

  return typeof soft === 'number' ? soft : Number.POSITIVE_INFINITY;
};

export const ceilingFor = (live: number, inherited: number): string => {
  const target = live + HEADROOM;

  return target >= inherited ? '' : `ulimit -u ${target} || exit 1`;
};

export const ceiling = (): string => {
  const uid = process.getuid?.();

  if (uid === undefined) {
    return '';
  }

  const live = liveProcesses(uid);

  return live === 0 ? '' : ceilingFor(live, inheritedLimit());
};

// A newline, never `&&`: the command keeps its own shape, so a `!` negation or a pipeline still
// parses as its author wrote it.
export const bounded = (command: string): string => {
  const limit = ceiling();

  return limit === '' ? command : `${limit}\n${command}`;
};
