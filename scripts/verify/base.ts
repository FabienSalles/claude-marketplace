import { spawnSync } from 'node:child_process';

const GIT_TIMEOUT_MS = 30_000;

const git = (root: string, args: readonly string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: GIT_TIMEOUT_MS });

export const behindNotes = (root: string, env: NodeJS.ProcessEnv): readonly string[] => {
  if (env['GITHUB_ACTIONS'] === 'true') {
    return [];
  }

  const fetched = git(root, ['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
  const counted = fetched.status === 0 ? git(root, ['rev-list', '--count', 'HEAD..origin/main']) : fetched;

  if (counted.status !== 0) {
    return [`not compared with origin/main: ${(counted.error?.message ?? counted.stderr).trim().replace(/\s+/g, ' ')}`];
  }

  const behind = Number(counted.stdout.trim());

  return behind === 0 ? [] : [`branch is ${behind} commits behind origin/main`];
};
