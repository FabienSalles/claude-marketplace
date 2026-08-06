// What the tree really holds against what the slice declared, then the commit and the tick.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

import { git, halt, heldLocks } from './halt.ts';
import { neverVersionedCheck } from './never.ts';
import { covers, sectionBounds } from './plan.ts';

// Returns the paths git reports as changed, so the commit stages what the tree really holds
// rather than what the plan hoped for.
export const scopeCheck = (
  paths: string[],
  iteration: string,
  incidental: string[] = [],
): Set<string> => {
  const unusable = [...paths, ...incidental].filter((path) => /[`()*?[\]]/.test(path));

  if (unusable.length > 0) {
    halt(
      `Iteration ${iteration} does not declare a list of paths.`,
      `Unusable: ${unusable.join(' ')}\n\ntest_files and impl_files hold bare, space-separated, repo-relative paths and nothing else: no glob, no backtick, no markdown annotation. A whole subtree is declared by a trailing slash (plugins/goal/).`,
    );
  }

  const ignored = paths.filter((path) => git('check-ignore', '-q', path).status === 0);

  if (ignored.length > 0) {
    halt(
      `Iteration ${iteration} declares a gitignored path.`,
      `Ignored: ${ignored.join(' ')}\n\nA write to an ignored path is invisible to git, so the scope check would pass and the commit would carry none of it. The iteration would be green and incomplete at the same time.`,
    );
  }

  const status = git('-c', 'core.quotepath=false', 'status', '--porcelain', '-z', '-uall');

  if (status.status !== 0) {
    halt(
      'git status failed, so the scope check never ran.',
      `${status.stderr}\n\nThe gate reads the tree it is standing in: run it with the repository — or the track worktree — as the working directory. A scope check that cannot see the tree is not a check, and must never exit 0.`,
    );
  }

  const changed = new Set<string>();
  const records = status.stdout.split('\0').filter((entry) => entry !== '');

  // With `-z`, a rename is the new path's record followed by the original as a record of its own.
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    changed.add(record.slice(3));

    if (/^[RC]/.test(record)) {
      index += 1;
      const origin = records[index];

      if (origin !== undefined) {
        changed.add(origin);
      }
    }
  }

  neverVersionedCheck([...changed, ...paths, ...incidental], `Iteration ${iteration}`);

  // The porcelain code is not evidence: the git-add-empty hook runs `git add -N` on every
  // created file, so a parasite shows up as " A" and never as "??".
  //
  // Incidental paths widen what is tolerated, never what is expected: the slice is still
  // judged on `paths`, and a generated lockfile no longer refuses an implementation that is
  // otherwise exactly what the plan asked for.
  const allowed = [...paths, ...incidental];
  const undeclared = [...changed].filter((path) => !allowed.some((entry) => covers(entry, path)));

  if (undeclared.length > 0) {
    halt(
      `Scope leak on iteration ${iteration}.`,
      `Changed but not declared: ${undeclared.join(' ')}\n\nDeclared: ${paths.join(' ')}\n\nIncidental (plan header): ${incidental.length > 0 ? incidental.join(' ') : '(none)'}\n\ngit status --short -uall:\n${git('status', '--short', '-uall').stdout}\n\nGenerated tooling a project cannot help producing — a lockfile, a tsconfig — belongs on the plan's "Incidental:" header line, declared once for the whole plan. Anything else here is either out of this slice's scope or should not be versioned at all.`,
    );
  }

  return changed;
};

export const takeLock = (path: string, iteration: string): void => {
  try {
    mkdirSync(path);
  } catch {
    halt(
      `Another writer holds the plan lock for iteration ${iteration}.`,
      `Held: ${path}\n\nTwo writers to the plan would tick the same box from different trees, and the second would overwrite the first's contract. Wait for the holder to finish, or remove the lock if you know its process is gone.`,
    );
  }

  heldLocks.push(path);
};

export const runLock = (subcommand: string, plan: string): void => {
  const path = `${plan}.run.lock`;

  if (subcommand === 'unlock') {
    rmSync(path, { recursive: true, force: true });
    process.stdout.write(`OK: run lock released.\n`);

    return;
  }

  try {
    mkdirSync(path);
  } catch {
    halt(
      'Another run holds this plan.',
      `Held: ${path}\n\nTwo runs on the same plan implement the same iteration twice, and the second commits over the first. Wait for the holder to finish, or release it with: goal-gate.ts unlock ${plan}`,
    );
  }

  process.stdout.write(`OK: run lock taken.\n`);
};

export const commitAndTick = (
  plan: string,
  source: string,
  iteration: string,
  declared: Map<string, string>,
  paths: string[],
  changed: Set<string>,
  incidental: string[] = [],
): void => {
  const lines = source.split('\n');
  const [start, end] = sectionBounds(lines, iteration);
  const box = lines.slice(start, end).findIndex((line) => line.startsWith('- [ ]'));

  if (box === -1) {
    halt(
      `Iteration ${iteration} carries no unticked box.`,
      'Every [x] matches exactly one commit carrying its commit_msg. Ticking an already ticked iteration would leave two commits behind one box, so nothing was committed.',
    );
  }

  takeLock(`${plan}.tick.lock`, iteration);

  // Incidental paths are staged too, and only when the tree actually moved them: a tsconfig
  // tolerated by the scope check but left out of the commit would turn the next iteration red
  // on a file missing from the repository — a deferred failure in place of an honest halt.
  const staged = [...paths, ...incidental].filter((path) => existsSync(path) || changed.has(path));
  const add = git('add', '--', ...staged);

  if (add.status !== 0) {
    halt(`Staging failed for iteration ${iteration}.`, `${add.stderr}\n\nDeclared: ${paths.join(' ')}`);
  }

  const commit = git('commit', '-m', declared.get('commit_msg') ?? '');

  if (commit.status !== 0) {
    halt(
      `The commit failed for iteration ${iteration}.`,
      `${commit.stdout}${commit.stderr}\n\nThe plan was left unticked, so the iteration can be retried once the cause is fixed.`,
    );
  }

  lines[start + box] = lines[start + box]!.replace('- [ ]', '- [x]');
  writeFileSync(plan, lines.join('\n'));

  process.stdout.write(`OK: iteration ${iteration} committed and ticked.\n`);
};
