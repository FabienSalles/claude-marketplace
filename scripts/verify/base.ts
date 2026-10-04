import { spawnSync } from 'node:child_process';

import type { Check } from './ports.ts';

export type Failure = { readonly failure: string };

export type FreshBase = { readonly base: string; readonly behind: number } | Failure;

const git = (root: string, args: readonly string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

export const freshBase = (root: string): FreshBase => {
  const fetched = git(root, ['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']);

  if (fetched.status !== 0) {
    return { failure: `missing: the network (fetching origin/main failed: ${fetched.stderr.trim()})` };
  }

  const base = git(root, ['merge-base', 'origin/main', 'HEAD']);
  const behind = git(root, ['rev-list', '--count', 'HEAD..origin/main']);

  if (base.status !== 0 || behind.status !== 0) {
    return { failure: `no merge base with origin/main: ${base.stderr.trim()}${behind.stderr.trim()}` };
  }

  return { base: base.stdout.trim(), behind: Number(behind.stdout.trim()) };
};

export const behindLine = (behind: number): string | undefined =>
  behind === 0 ? undefined : `branch is ${behind} commits behind origin/main`;

const isDiffCertification = (check: Check): boolean =>
  'command' in check && check.command.includes('--diff');

export const withDiffBase = (checks: readonly Check[], base: string | Failure): readonly Check[] =>
  checks.map((check): Check => {
    if (!isDiffCertification(check) || !('command' in check)) {
      return check;
    }

    return typeof base === 'string'
      ? { ...check, command: check.command.map((word) => (word === 'origin/main' ? base : word)) }
      : { name: check.name, group: check.group, requirements: check.requirements, inline: () => [base.failure] };
  });
