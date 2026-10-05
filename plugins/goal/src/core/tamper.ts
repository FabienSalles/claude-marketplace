// The one decision run/iteration.ts's tamper checks reduce to, once the tree is read exactly
// once after the implementer exits: a self-committed HEAD, a git-directory write, a pushed
// remote ref, or a moved local ref — checked in that order, since a self-commit is diagnosed as
// that even when it also happens to touch .git/, and .git/ is named before an empty tree ever
// reads as "wrote nothing".

import { err, ok, type Result } from './result.ts';

export type TreeState = {
  readonly head: string;
  readonly gitDirChanges: readonly string[];
  readonly sharedGitDirChanges?: readonly string[];
  readonly remoteRefChanges: readonly string[];
  readonly otherRefChanges: readonly string[];
};

export const detectTamper = (before: TreeState, after: TreeState): Result<void, string> => {
  if (after.head !== before.head) {
    return err(
      `the implementer committed on its own, which only the gate may do. HEAD moved from ${before.head} to ${after.head}. Nothing was gate-verified: review that commit before relaunching.`,
    );
  }

  if (after.gitDirChanges.length > 0) {
    return err(
      `the implementer changed the git directory: ${after.gitDirChanges.join(', ')}. \`git status\` will not show this: the artifact is still in .git/, not in the tree. Review it before relaunching.`,
    );
  }

  if (after.sharedGitDirChanges !== undefined && after.sharedGitDirChanges.length > 0) {
    return err(
      `the git directory changed under the run, possibly from another worktree: ${after.sharedGitDirChanges.join(', ')}. \`git status\` will not show this: the artifact is in .git/, not in the tree. Review it before relaunching.`,
    );
  }

  if (after.remoteRefChanges.length > 0) {
    return err(
      `the implementer pushed: ${after.remoteRefChanges.join(', ')} moved. Only the gate may publish. Review it before relaunching.`,
    );
  }

  if (after.otherRefChanges.length > 0) {
    return err(
      `the implementer moved ${after.otherRefChanges.join(', ')}. \`git status\` will not show this: review it before relaunching.`,
    );
  }

  return ok(undefined);
};

export type RefChange = { readonly ref: string; readonly after: string | undefined };

export type RefNote = { readonly key: string; readonly line: string };

export const classifyRefChanges = (
  changes: readonly RefChange[],
  carriesWork: (change: RefChange) => boolean,
): { pausing: string[]; noted: RefNote[] } => {
  const pausing: string[] = [];
  const noted: RefNote[] = [];

  for (const change of changes) {
    if (change.after === undefined) {
      noted.push({ key: `${change.ref}@deleted`, line: `RUN ${change.ref} was deleted: noted, not a pause` });
    } else if (carriesWork(change)) {
      pausing.push(change.ref);
    } else {
      noted.push({
        key: `${change.ref}@${change.after}`,
        line: `RUN ${change.ref} moved to ${change.after.slice(0, 7)}, which is not this run's work: noted, not a pause`,
      });
    }
  }

  return { pausing, noted };
};

export const unnoted = (notes: readonly RefNote[], seen: Set<string>): RefNote[] => {
  const fresh = notes.filter((note) => !seen.has(note.key));

  for (const note of fresh) {
    seen.add(note.key);
  }

  return fresh;
};

const harmlessConfigKey = (key: string): boolean => {
  if (key.startsWith('branch.')) {
    return true;
  }

  return key.startsWith('remote.') && !['url', 'pushurl', 'push', 'uploadpack', 'receivepack'].includes(key.slice(key.lastIndexOf('.') + 1));
};

export const classifyConfigChanges = (before: readonly string[], after: readonly string[]): { pausing: string[]; noted: RefNote[] } => {
  const pausing = new Set<string>();
  const noted: RefNote[] = [];
  const seenBefore = new Set(before);
  const seenAfter = new Set(after);
  const changes = [
    ...after.filter((entry) => !seenBefore.has(entry)).map((entry) => ({ entry, what: 'added' })),
    ...before.filter((entry) => !seenAfter.has(entry)).map((entry) => ({ entry, what: 'removed' })),
  ];

  for (const { entry, what } of changes) {
    const key = entry.split('=')[0]!;

    if (harmlessConfigKey(key)) {
      noted.push({ key: `config:${entry}@${what}`, line: `RUN config entry ${key} was ${what}: noted, not a pause (a harmless key)` });
    } else {
      pausing.add(key);
    }
  }

  return { pausing: [...pausing], noted };
};
