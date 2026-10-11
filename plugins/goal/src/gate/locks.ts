import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export type LockPaths = { readonly run: string; readonly tick: string; readonly oldRun: string; readonly oldTick: string };

export const lockRoot = (env: Readonly<Record<string, string | undefined>> = process.env): string =>
  env['GOAL_LOCK_ROOT'] ?? `/tmp/goal-locks-${String(process.getuid?.() ?? 0)}`;

export const realPlan = (plan: string): string => {
  try {
    return realpathSync(plan);
  } catch {
    return resolve(plan);
  }
};

export const lockPaths = (plan: string, root: string = lockRoot()): LockPaths => {
  const real = realPlan(plan);
  const name = `${basename(real).replace(/\.md$/, '')}-${createHash('sha256').update(real).digest('hex').slice(0, 12)}`;

  return { run: join(root, `${name}.run.lock`), tick: join(root, `${name}.tick.lock`), oldRun: `${plan}.run.lock`, oldTick: `${plan}.tick.lock` };
};
