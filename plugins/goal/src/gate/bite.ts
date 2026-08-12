// Setting the implementation aside to find out whether the tests were asserting anything.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

import { git } from '../adapters/git.ts';
import { bounded, spawnOptions } from './bounded.ts';
import { emitCommand } from './commands.ts';
import { halt, heldLocks, restorers, type Say } from './halt.ts';
import { covers } from './plan.ts';

export const gitDir = (): string => {
  const dir = git('rev-parse', '--absolute-git-dir');

  if (dir.status !== 0) {
    halt(
      'The bite check found no git directory to hold its backup in.',
      `${dir.stderr}\n\nRun the gate from the repository, or from the track worktree.`,
    );
  }

  return dir.stdout.trim();
};

export const headBlob = (path: string): Buffer => {
  const run = spawnSync('git', ['show', `HEAD:${path}`], { maxBuffer: 512 * 1024 * 1024 });

  if (run.status !== 0) {
    halt(
      `The bite check cannot read ${path} out of HEAD.`,
      `${run.stderr}\n\nNothing was set aside, so the tree is untouched.`,
    );
  }

  return run.stdout;
};

export const fingerprint = (paths: string[]): string => {
  const digest = createHash('sha256').update(git('status', '--porcelain', '-uall').stdout);

  for (const path of paths) {
    digest.update(path).update(existsSync(path) ? readFileSync(path) : Buffer.of(0));
  }

  return digest.digest('hex');
};

// Sets the implementation aside, re-runs the acceptance command, requires it to fail, and puts
// the tree back by overwrite. gate1 alone is bitten: R2 makes it the one mandatory command, so
// it is the acceptance criterion by construction, where gate2..N are supporting lints that pass
// with or without the implementation.
export const biteCheck = (declared: Map<string, string>, iteration: string, changed: Set<string>, say: Say): void => {
  if ((declared.get('test_files') ?? '') === '') {
    say(`SKIP: iteration ${iteration} declares no test_files, so there is nothing to set aside.\n`);

    return;
  }

  const entries = (declared.get('impl_files') ?? '').split(/\s+/).filter((entry) => entry !== '');
  const implementation = [...changed]
    .filter((path) => entries.some((entry) => covers(entry, path)))
    .map((path) => ({
      path,
      inHead: git('cat-file', '-e', `HEAD:${path}`).status === 0,
      present: existsSync(path),
    }));

  const aside = implementation.map(({ path }) => path);
  const before = fingerprint(aside);
  const backup = mkdtempSync(join(gitDir(), 'goal-bite-'));

  heldLocks.push(backup);

  for (const { path, present } of implementation) {
    if (present) {
      mkdirSync(dirname(join(backup, path)), { recursive: true });
      copyFileSync(path, join(backup, path));
    }
  }

  let restored = false;
  const restore = (): void => {
    if (restored) {
      return;
    }

    restored = true;

    for (const { path, present } of implementation) {
      if (present) {
        copyFileSync(join(backup, path), path);
      } else {
        rmSync(path, { force: true });
      }
    }
  };

  restorers.push(restore);

  for (const { path, inHead } of implementation) {
    if (inHead) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, headBlob(path));
    } else {
      rmSync(path, { force: true });
    }
  }

  say(`BACKUP: iteration ${iteration}'s implementation is set aside in ${backup}\n`);

  const command = declared.get('gate1') ?? '';
  const start = Date.now();
  const run = spawnSync(bounded(command), spawnOptions());

  emitCommand('bite', command, Date.now() - start, run.status);

  restore();
  rmSync(backup, { recursive: true, force: true });

  if (fingerprint(aside) !== before) {
    halt(
      `The bite check did not leave iteration ${iteration}'s tree as it found it.`,
      `Set aside: ${aside.join(' ')}\n\ngit status --short -uall:\n${git('status', '--short', '-uall').stdout}\nThe acceptance command has side effects the restore could not undo — a snapshot writer, a migration, a generated file. Review the tree before committing anything.`,
    );
  }

  if (run.status === 0) {
    halt(
      `Iteration ${iteration}'s tests pass without its implementation.`,
      `Command: ${declared.get('gate1')}\nSet aside: ${aside.join(' ') || '(nothing — impl_files declares no changed path)'}\n\nThe acceptance command exited 0 with the implementation out of the tree, so it asserts nothing this slice built. The tree was restored; rewrite the test until it fails without ${declared.get('impl_files')}.`,
    );
  }

  say(`OK: gate1 fails without iteration ${iteration}'s implementation.\n`);
};
