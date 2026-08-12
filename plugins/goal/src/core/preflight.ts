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

  return ok(policy);
};

export const remoteDeclared = (remote: string | undefined): Result<string, string> =>
  remote ? ok(remote) : err('the plan declares no Remote line');

export const featureBranch = (isGitRepo: boolean, branch: string, workId: string): Result<string, string> => {
  if (!isGitRepo) {
    return err('not a git repository');
  }

  return branch === `feature/${workId}` || branch.startsWith(`feature/${workId}-`)
    ? ok(branch)
    : err(`the checkout stands on ${branch}, not feature/${workId} (or feature/${workId}-...)`);
};

export const goalRunsIgnored = (ignored: boolean, goalRunsDir: string): Result<void, string> =>
  ignored ? ok(undefined) : err(`${goalRunsDir} is visible to git. Add it to .gitignore:\n${goalRunsDir}`);

export const cleanTree = (dirty: string): Result<void, string> =>
  dirty === '' ? ok(undefined) : err(`the tree is not clean:\n${dirty}`);

export const planDirIgnored = (ignored: boolean, planDir: string): Result<void, string> =>
  ignored
    ? ok(undefined)
    : err(`the plan's directory is visible to git: ${planDir}. Ignore it, untracking any spec already committed.`);

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
