// The one decision run/iteration.ts's tamper checks reduce to, once the tree is read exactly
// once after the implementer exits: a self-committed HEAD, a git-directory write, a pushed
// remote ref, or a moved local ref — checked in that order, since a self-commit is diagnosed as
// that even when it also happens to touch .git/, and .git/ is named before an empty tree ever
// reads as "wrote nothing".

import { err, ok, type Result } from './result.ts';

export type TreeState = {
  readonly head: string;
  readonly gitDirChanges: readonly string[];
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
