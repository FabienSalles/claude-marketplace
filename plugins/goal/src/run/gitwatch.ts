// The git directory's executable surface: `config` (arbitrary aliases and `core.hooksPath`),
// `hooks/` (every hook, recursive, `.sample` files included, so a `pre-commit` made from a
// sample is caught) and `info/exclude` in the common directory, plus `config.worktree` in the
// absolute one — read only per worktree once `extensions.worktreeConfig` is set, and able to
// carry a `core.hooksPath` of its own. A worktree's `--git-common-dir` can come back relative;
// both directories are resolved to absolute before anything is read, so the real `.git` is never
// fingerprinted twice under two names.

import { join, resolve } from 'node:path';

import { fs } from '../adapters/fs.ts';
import { git } from '../adapters/git.ts';
import { classifyConfigChanges, type RefChange, type RefNote } from '../core/tamper.ts';

const read = (path: string): string | null => {
  try {
    return fs.readFile(path);
  } catch {
    return null;
  }
};

const hookFiles = (hooksDir: string): string[] => {
  if (!fs.exists(hooksDir)) {
    return [];
  }

  const out: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readDirEntries(dir)) {
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
  config: string;
  worktreeConfig: string;
  configEntries: string[] | null;
  entries: Map<string, string | null>;
};

const configEntries = (path: string): string[] | null => {
  if (!fs.exists(path)) {
    return [];
  }

  const listed = git('config', '--file', path, '--list', '-z');

  if (listed.status !== 0) {
    return null;
  }

  return listed.stdout
    .split('\0')
    .filter((entry) => entry !== '')
    .map((entry) => entry.replace('\n', '='));
};

export const snapshotGitDir = (): GitDirSnapshot => {
  const [commonLine = '', absoluteLine = ''] = git('rev-parse', '--git-common-dir', '--absolute-git-dir').stdout.split('\n');
  const common = resolve(commonLine.trim());
  const absolute = absoluteLine.trim();
  const hooksDir = join(common, 'hooks');

  const config = join(common, 'config');
  const worktreeConfig = join(absolute, 'config.worktree');
  const fixed = [config, join(common, 'info', 'exclude'), worktreeConfig];

  const entries = new Map<string, string | null>();

  for (const path of [...fixed, ...hookFiles(hooksDir)]) {
    entries.set(path, read(path));
  }

  return { hooksDir, config, worktreeConfig, configEntries: configEntries(config), entries };
};

// Absence is recorded as absence (`null`), so a hook created after the snapshot shows up as a
// change even though its path never appeared in the map the snapshot walked.
export const changedGitDirPaths = (before: GitDirSnapshot): { attributable: string[]; shared: string[]; notes: RefNote[] } => {
  const paths = new Set([...before.entries.keys(), ...hookFiles(before.hooksDir)]);
  const attributable: string[] = [];
  const shared: string[] = [];
  const notes: RefNote[] = [];

  for (const path of paths) {
    if (read(path) === (before.entries.get(path) ?? null)) {
      continue;
    }

    if (path === before.worktreeConfig) {
      attributable.push(path);
    } else if (path === before.config) {
      const after = configEntries(path);

      if (after === null || before.configEntries === null) {
        shared.push(path);

        continue;
      }

      const classified = classifyConfigChanges(before.configEntries, after);
      notes.push(...classified.noted);

      if (classified.pausing.length > 0) {
        shared.push(`${path} (${classified.pausing.join(', ')})`);
      }
    } else {
      shared.push(path);
    }
  }

  return { attributable: attributable.sort(), shared: shared.sort(), notes };
};

export type RefSnapshot = { refs: Map<string, string>; reflogLines: number };

const allRefs = (): Map<string, string> => {
  const out = new Map<string, string>();

  for (const line of git('for-each-ref').stdout.split('\n')) {
    if (line.trim() === '') {
      continue;
    }

    const [sha = '', , ref = ''] = line.split(/\s+/);
    out.set(ref, sha);
  }

  return out;
};

const headReflog = (): string[] => {
  const absolute = git('rev-parse', '--absolute-git-dir').stdout.trim();

  return (read(join(absolute, 'logs', 'HEAD')) ?? '').split('\n').filter((line) => line.trim() !== '');
};

export const snapshotRefs = (): RefSnapshot => ({ refs: allRefs(), reflogLines: headReflog().length });

const newCommits = (tips: string[], known: string[]): string[] =>
  git('rev-list', ...tips, '--not', ...known)
    .stdout.split('\n')
    .filter((sha) => sha !== '');

export const refChanges = (before: RefSnapshot, branch: string): { changes: RefChange[]; carriesWork: (change: RefChange) => boolean } => {
  const after = allRefs();
  const changes: RefChange[] = [];

  for (const ref of new Set([...before.refs.keys(), ...after.keys()])) {
    if (after.get(ref) !== before.refs.get(ref)) {
      changes.push({ ref, after: after.get(ref) });
    }
  }

  changes.sort((a, b) => (a.ref < b.ref ? -1 : 1));

  const known = [...new Set(before.refs.values())];
  const created = headReflog()
    .slice(before.reflogLines)
    .map((line) => line.split(/\s+/)[1] ?? '')
    .filter((sha) => /^[0-9a-f]+$/.test(sha) && !/^0+$/.test(sha));
  const own = new Set(newCommits(['HEAD', ...new Set(created)], known));
  const stashSubject = new RegExp(`^(WIP on|On) ${branch === 'HEAD' ? '\\(no branch\\)' : branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`);

  const carriesWork = (change: RefChange): boolean => {
    if (change.after === undefined) {
      return false;
    }

    if (change.ref === 'refs/stash') {
      return stashSubject.test(git('log', '-1', '--format=%s', change.after).stdout);
    }

    return newCommits([change.after], known).some((sha) => own.has(sha));
  };

  return { changes, carriesWork };
};
