import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, sep } from 'node:path';

import { lockRoot } from '../../plugins/goal/src/gate/locks.ts';

type Proc = { readonly pid: number; readonly ppid: number; readonly command: string };

export type Holders = { readonly refusal: string | undefined; readonly notes: readonly string[] };

export const GOAL_RUN = 'goal-run.ts';
const LOCK_SUFFIX = '.run.lock';

export const processes = (): readonly Proc[] =>
  spawnSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' })
    .stdout.split('\n')
    .flatMap((row) => {
      const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(row);

      return match === null ? [] : [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3] ?? '' }];
    });

export const isRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const runsGoalRun = (proc: Proc, marker: string): boolean => proc.command.includes(marker);

const hasGoalRunAncestor = (all: readonly Proc[], pid: number, marker: string): boolean => {
  const byPid = new Map(all.map((proc) => [proc.pid, proc]));
  const seen = new Set<number>();

  for (let current = byPid.get(pid); current !== undefined && !seen.has(current.pid); current = byPid.get(current.ppid)) {
    seen.add(current.pid);

    if (current.pid !== pid && runsGoalRun(current, marker)) {
      return true;
    }
  }

  return false;
};

export type GoalRunLock = { readonly plan: string; readonly lock: string };

const namesIn = (dir: string): readonly string[] => (existsSync(dir) ? readdirSync(dir).filter((entry) => entry.endsWith(LOCK_SUFFIX)) : []);

export const goalRunLocks = (root: string): readonly GoalRunLock[] => {
  const plans = join(root, '.claude', 'plans');
  const base = realpathSync(root) + sep;
  const old = namesIn(plans).map((entry) => ({ plan: join(plans, entry.slice(0, -LOCK_SUFFIX.length)), lock: join(plans, entry) }));
  const dir = lockRoot();
  const current = namesIn(dir).flatMap((entry) => {
    const lock = join(dir, entry);
    const file = join(lock, 'plan');
    const plan = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';

    return plan.startsWith(base) ? [{ plan, lock }] : [];
  });

  return [...old, ...current];
};

export const lockPath = (gitDir: string): string => join(gitDir, 'verify.lock');

const lockRefusal = (lock: string): string | undefined => {
  if (!existsSync(lock)) {
    return undefined;
  }

  const pid = Number(readFileSync(lock, 'utf8').trim());

  return Number.isInteger(pid) && pid > 0 && isRunning(pid) ? `refused: another verify run holds this checkout (pid ${pid})` : undefined;
};

export const findHolders = (root: string, gitDir: string, marker: string = GOAL_RUN, all: readonly Proc[] = processes()): Holders => {
  const notes: string[] = [];
  const ownCall = hasGoalRunAncestor(all, process.pid, marker);

  for (const { plan, lock } of goalRunLocks(root)) {
    const live = all.some((proc) => runsGoalRun(proc, marker) && proc.command.split(/\s+/).some((token) => basename(token) === basename(plan)));

    if (live && !ownCall) {
      return { refusal: `refused: a goal run holds this checkout (${lock}, a ${marker} process is running it)`, notes };
    }

    if (!live) {
      notes.push(`stale goal run lock ${lock}, release it with: goal-gate.ts unlock ${plan}`);
    }
  }

  return { refusal: lockRefusal(lockPath(gitDir)), notes };
};

const created = (lock: string): boolean => {
  try {
    writeFileSync(lock, String(process.pid), { flag: 'wx' });

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false;
    }

    throw error;
  }
};

export const takeLock = (gitDir: string): (() => void) | string => {
  const lock = lockPath(gitDir);
  const release = (): void => rmSync(lock, { force: true });

  if (created(lock)) {
    return release;
  }

  const refusal = lockRefusal(lock);

  if (refusal !== undefined) {
    return refusal;
  }

  rmSync(lock, { force: true });

  return created(lock) ? release : (lockRefusal(lock) ?? 'refused: another verify run took this checkout at the same moment');
};
