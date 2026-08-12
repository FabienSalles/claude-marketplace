// The pure decisions inside the scope check. What the tree holds — git status, check-ignore —
// is read in gate/scope.ts; this is what it decides from that.

import { err, ok, type Result } from '../result.ts';
import { halt, type Halt } from '../verdict.ts';

export const shapedPaths = (paths: readonly string[], iteration: string): Result<void, Halt> => {
  const unusable = paths.filter((path) => /[`()*?[\]]/.test(path));

  if (unusable.length > 0) {
    return err(halt(
      `Iteration ${iteration} does not declare a list of paths.`,
      `Unusable: ${unusable.join(' ')}\n\ntest_files and impl_files hold bare, space-separated, repo-relative paths and nothing else: no glob, no backtick, no markdown annotation. A whole subtree is declared by a trailing slash (plugins/goal/).`,
    ));
  }

  return ok(undefined);
};

export const noIgnoredPaths = (ignored: readonly string[], iteration: string): Result<void, Halt> => {
  if (ignored.length > 0) {
    return err(halt(
      `Iteration ${iteration} declares a gitignored path.`,
      `Ignored: ${ignored.join(' ')}\n\nA write to an ignored path is invisible to git, so the scope check would pass and the commit would carry none of it. The iteration would be green and incomplete at the same time.`,
    ));
  }

  return ok(undefined);
};

export const noScopeLeak = (
  undeclared: readonly string[],
  iteration: string,
  paths: readonly string[],
  incidental: readonly string[],
  statusShort: string,
): Result<void, Halt> => {
  if (undeclared.length > 0) {
    return err(halt(
      `Scope leak on iteration ${iteration}.`,
      `Changed but not declared: ${undeclared.join(' ')}\n\nDeclared: ${paths.join(' ')}\n\nIncidental (plan header): ${incidental.length > 0 ? incidental.join(' ') : '(none)'}\n\ngit status --short -uall:\n${statusShort}\n\nGenerated tooling a project cannot help producing — a lockfile, a tsconfig — belongs on the plan's "Incidental:" header line, declared once for the whole plan. Anything else here is either out of this slice's scope or should not be versioned at all.`,
    ));
  }

  return ok(undefined);
};
