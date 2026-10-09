// The ten decisions run/preflight.ts's ten checks reduce to, in the order they run: whether the
// plan, the checkout, the tree and the lock let a run start. Every fact each one judges is read
// in run/preflight.ts, the adapter; this is only what is decided once it is.

import { err, ok, type Result } from './result.ts';

export const metadataDeclared = (hasFrontmatter: boolean, legacy: readonly string[]): Result<void, string> =>
  hasFrontmatter
    ? ok(undefined)
    : err(
        `the plan declares no \`---\`-delimited metadata block. Paste this at the top of the plan, right after the title:\n\n---\n${legacy.join('\n')}\n---`,
      );

export const runnablePolicy = (policy: string | undefined): Result<string, string> => {
  if (policy === undefined) {
    return err('the plan declares no Policy line');
  }

  if (policy === 'manual') {
    return err(
      'Policy is manual, so nothing may be committed and there is nothing to run unattended. Change the Policy line in the spec, or run the manual loop with /goal and /goal:next.',
    );
  }

  if (policy !== 'commit' && policy !== 'commit+pr') {
    return err(`Policy is ${policy !== '' ? policy : 'empty'}, which is not one of the legal values: manual, commit, commit+pr.`);
  }

  return ok(policy);
};

export const remoteDeclared = (remote: string | undefined): Result<string, string> =>
  remote !== undefined && remote !== '' ? ok(remote) : err('the plan declares no Remote line');

export const featureBranch = (
  isGitRepo: boolean,
  branch: string,
  workId: string,
  fileName: string = workId,
): Result<string, string> => {
  if (!isGitRepo) {
    return err('not a git repository');
  }

  return branch === `feature/${workId}` || branch.startsWith(`feature/${workId}-`)
    ? ok(branch)
    : err(
        `the checkout stands on ${branch}, not feature/${workId} (or feature/${workId}-...)` +
          (fileName === workId
            ? ''
            : `. The plan's Work-id header says ${workId} while its file name says ${fileName}; the header wins.`),
      );
};

export const goalRunsIgnored = (ignored: boolean, goalRunsDir: string): Result<void, string> =>
  ignored ? ok(undefined) : err(`${goalRunsDir} is visible to git. Add it to .gitignore:\n${goalRunsDir}`);

export const cleanTree = (dirty: string): Result<void, string> =>
  dirty === '' ? ok(undefined) : err(`the tree is not clean:\n${dirty}`);

export const noCleanupIteration = (cleanup: boolean, hasTrigger: boolean): Result<void, string> =>
  !cleanup && hasTrigger
    ? err(
        'the plan carries a cleanup iteration (a Trigger: line) inside a feature plan. Move it out with /goal:run-issue, or run the *-cleanup-spec.md plan directly.',
      )
    : ok(undefined);

export const freeLock = (held: boolean, lockPath: string, unlockHint: string): Result<void, string> =>
  held ? err(`another run holds this plan: ${lockPath}. Wait for it, or free it with: ${unlockHint}`) : ok(undefined);

export const caughtUpWithBase = (isAncestor: boolean, base: string, missing: string): Result<void, string> =>
  isAncestor ? ok(undefined) : err(`the branch is behind ${base}:\n${missing}\n\nFetch and rebase before relaunching.`);

export const baseResolved = (base: string | undefined, tried: readonly string[]): Result<string, string> =>
  base !== undefined
    ? ok(base)
    : err(
        `no base resolves; tried ${tried.join(', ')}. Declare \`PR base:\` in the plan, or run \`git remote set-head <remote> -a\` so the remote's HEAD resolves.`,
      );

export const remoteFetched = (fetched: boolean, remote: string, detail: string): Result<void, string> =>
  fetched
    ? ok(undefined)
    : err(
        `could not fetch ${remote}, so the branch cannot be compared against it:\n${detail}\n\nRestore the connection to ${remote}, or fix its URL with \`git remote set-url ${remote} <url>\`, then relaunch.`,
      );

export const onGithub = (url: string): boolean => /^(?:https?:\/\/(?:[^@/]+@)?|ssh:\/\/git@|git@)github\.com[:/]/.test(url);

export const forkUndetermined = (policy: string, remote: string, detail: string): Result<string, string> =>
  policy === 'commit+pr'
    ? err(
        `could not ask GitHub whether ${remote} is a fork, so the branch cannot be checked against a parent:\n${detail}\n\nRun \`gh auth login\` (or restore the connection), then relaunch.`,
      )
    : ok(`${remote} is on github.com but gh could not tell whether it is a fork, so the parent was not checked (${detail})`);

export const parentRemoteFound = (found: string | undefined, parent: string): Result<string, string> =>
  found !== undefined
    ? ok(found)
    : err(`${parent} is the parent of this fork, and no local remote points at it. Add one with \`git remote add upstream https://github.com/${parent}\`, then relaunch.`);

export const parentFetched = (fetched: boolean, remote: string, detail: string): Result<void, string> =>
  fetched
    ? ok(undefined)
    : err(
        `could not fetch ${remote}, the parent of this fork, so the branch cannot be compared against it:\n${detail}\n\nFetch it by hand with \`git fetch ${remote}\`, or fix its URL with \`git remote set-url ${remote} <url>\`, then relaunch.`,
      );

export const parentBranchFound = (ref: string | undefined, remote: string, branch: string): Result<string, string> =>
  ref !== undefined
    ? ok(ref)
    : err(
        `${remote}, the parent of this fork, has no branch ${branch}. Correct \`PR base:\` in the plan, or run \`git remote set-head ${remote} -a\` if the parent's default branch is what is meant.`,
      );

export const foldedHistory = (subjects: readonly string[]): Result<void, string> => {
  const pending = subjects.filter((subject) => /^(fixup|squash)!/.test(subject));

  return pending.length === 0
    ? ok(undefined)
    : err(
        `the commits a push would send carry a fixup or squash:\n${pending.join('\n')}\n\nNothing may be pushed until they are folded: run \`git rebase -i --autosquash\` yourself, then relaunch.`,
      );
};
