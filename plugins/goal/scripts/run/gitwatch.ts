// The git directory's executable surface: `config` (arbitrary aliases and `core.hooksPath`),
// `hooks/` (every hook, recursive, `.sample` files included, so a `pre-commit` made from a
// sample is caught) and `info/exclude` in the common directory, plus `config.worktree` in the
// absolute one — read only per worktree once `extensions.worktreeConfig` is set, and able to
// carry a `core.hooksPath` of its own. A worktree's `--git-common-dir` can come back relative;
// both directories are resolved to absolute before anything is read, so the real `.git` is never
// fingerprinted twice under two names.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });

const read = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

const hookFiles = (hooksDir: string): string[] => {
  if (!existsSync(hooksDir)) {
    return [];
  }

  const out: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(path);
      } else {
        out.push(path);
      }
    }
  };

  walk(hooksDir);

  return out;
};

export type GitDirSnapshot = {
  hooksDir: string;
  entries: Map<string, string | null>;
};

export const snapshotGitDir = (): GitDirSnapshot => {
  const common = resolve(git('rev-parse', '--git-common-dir').stdout.trim());
  const absolute = git('rev-parse', '--absolute-git-dir').stdout.trim();
  const hooksDir = join(common, 'hooks');

  const fixed = [join(common, 'config'), join(common, 'info', 'exclude'), join(absolute, 'config.worktree')];

  const entries = new Map<string, string | null>();

  for (const path of [...fixed, ...hookFiles(hooksDir)]) {
    entries.set(path, read(path));
  }

  return { hooksDir, entries };
};

// Absence is recorded as absence (`null`), so a hook created after the snapshot shows up as a
// change even though its path never appeared in the map the snapshot walked.
export const changedGitDirPaths = (before: GitDirSnapshot): string[] => {
  const paths = new Set([...before.entries.keys(), ...hookFiles(before.hooksDir)]);
  const changed: string[] = [];

  for (const path of paths) {
    if (read(path) !== (before.entries.get(path) ?? null)) {
      changed.push(path);
    }
  }

  return changed.sort();
};

export type RemoteRefSnapshot = Map<string, string>;

// `for-each-ref`, never `ls-remote`: a push from this checkout is what moves the local tracking
// ref, which is the whole threat model. `ls-remote` asks the remote itself, so it would also
// catch someone else pushing an unrelated branch at 3am — a false positive that halts an
// unattended run for a push that was never this implementer's.
const remoteRefs = (): RemoteRefSnapshot => {
  const out = new Map<string, string>();

  for (const line of git('for-each-ref', 'refs/remotes').stdout.split('\n')) {
    if (line.trim() === '') {
      continue;
    }

    const [sha = '', , ref = ''] = line.split(/\s+/);
    out.set(ref, sha);
  }

  return out;
};

export const snapshotRemoteRefs = (): RemoteRefSnapshot => remoteRefs();

export const changedRemoteRefs = (before: RemoteRefSnapshot): string[] => {
  const after = remoteRefs();
  const refs = new Set([...before.keys(), ...after.keys()]);
  const changed: string[] = [];

  for (const ref of refs) {
    if (after.get(ref) !== before.get(ref)) {
      changed.push(ref);
    }
  }

  return changed.sort();
};
