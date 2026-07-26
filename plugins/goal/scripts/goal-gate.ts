#!/usr/bin/env node
// The single authority of an autonomous run. TypeScript, run natively by node:
// no build step, no dependency. Types are stripped at run time, never checked —
// `tsc --noEmit` is a CI concern.
//
// Usage: node goal-gate.ts check|verify|commit <plan> <iteration> [plan_hash]
//        node goal-gate.ts lock|unlock <plan>
//
// Exit codes: 0 the iteration is runnable · 1 HALT, with a reason · 2 misuse.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const USAGE =
  'usage: goal-gate.ts check|verify|commit <plan> <iteration> [plan_hash]\n       goal-gate.ts lock|unlock <plan>';

const ALLOWED_KEY = /^(test_files|impl_files|max_diff|commit_msg|gate[1-9][0-9]*)$/;
const REQUIRED_KEYS = ['gate1', 'impl_files', 'commit_msg'] as const;

const halt: (reason: string, detail: string) => never = (reason, detail) => {
  process.stdout.write(`HALT\n\nREASON: ${reason}\n\nDETAIL:\n${detail}\n`);
  process.exit(1);
};

const misuse: (message: string) => never = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(2);
};

const readPlan = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return misuse(`plan not readable: ${path}`);
  }
};

// A tick is the one edit an iteration is allowed to make to its own contract, so the
// hash is taken over the plan with every box unticked.
const planHash = (source: string): string =>
  createHash('sha256').update(source.replace(/^- \[x\]/gm, '- [ ]')).digest('hex');

const sectionBounds = (lines: string[], iteration: string): [number, number] => {
  const heading = new RegExp(`^### Iteration ${iteration}\\b`);
  const start = lines.findIndex((line) => heading.test(line));

  if (start === -1) {
    halt(
      `The plan declares no iteration ${iteration}.`,
      `No "### Iteration ${iteration}" heading found.\n\nThe loop asked for an iteration the plan does not contain: either the plan was rewritten or the caller counted wrong. Nothing was run.`,
    );
  }

  const next = lines.slice(start + 1).findIndex((line) => /^#{2,3} /.test(line));

  return [start + 1, next === -1 ? lines.length : start + 1 + next];
};

const iterationSection = (source: string, iteration: string): string[] => {
  const lines = source.split('\n');
  const [start, end] = sectionBounds(lines, iteration);

  return lines.slice(start, end);
};

const gateBlock = (section: string[], iteration: string): string[] => {
  const open = section.findIndex((line) => line.trim() === '```gate');
  const body = section.slice(open + 1);
  const close = body.findIndex((line) => line.trim() === '```');

  if (open === -1 || close === -1) {
    halt(
      `Iteration ${iteration} declares no gate block.`,
      'The iteration section holds no closed ```gate fence.\n\nAn iteration with no gate block has no acceptance criterion, no declared scope and no commit message, so nothing can be verified about it. The global Definition of Done block is not a substitute: it belongs to the plan, not to this slice.',
    );
  }

  return body.slice(0, close);
};

const declaredKeys = (block: string[], iteration: string): Map<string, string> => {
  const declared = new Map<string, string>();
  const twice: string[] = [];

  for (const line of block) {
    if (line.trim() === '') {
      continue;
    }

    const split = line.indexOf('=');
    const key = split === -1 ? line.trim() : line.slice(0, split).trim();

    if (declared.has(key)) {
      twice.push(key);
    }

    declared.set(key, split === -1 ? '' : line.slice(split + 1).trim());
  }

  if (twice.length > 0) {
    halt(
      `Iteration ${iteration} declares the same key twice.`,
      `Duplicated: ${twice.join(' ')}\n\nOne occurrence would silently win over the other, so the slice would be judged by a criterion nobody chose: a block carrying both gate1=true and gate1=false has no defined meaning. Keep one line per key.`,
    );
  }

  return declared;
};

const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });

const declaredPaths = (declared: Map<string, string>): string[] =>
  ['test_files', 'impl_files']
    .flatMap((key) => (declared.get(key) ?? '').split(/\s+/))
    .filter((path) => path !== '');

const covers = (entry: string, path: string): boolean =>
  entry === path || (entry.endsWith('/') && path.startsWith(entry));

// Returns the paths git reports as changed, so the commit stages what the tree really holds
// rather than what the plan hoped for.
const scopeCheck = (paths: string[], iteration: string): Set<string> => {
  const unusable = paths.filter((path) => /[`()*?[\]]/.test(path));

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

  const status = git('status', '--porcelain', '-uall');

  if (status.status !== 0) {
    halt(
      'git status failed, so the scope check never ran.',
      `${status.stderr}\n\nThe gate reads the tree it is standing in: run it with the repository — or the track worktree — as the working directory. A scope check that cannot see the tree is not a check, and must never exit 0.`,
    );
  }

  const changed = new Set<string>();

  for (const line of status.stdout.split('\n').filter((entry) => entry !== '')) {
    const rest = line.slice(3);
    const arrow = rest.indexOf(' -> ');
    const parts = arrow === -1 ? [rest] : [rest.slice(0, arrow), rest.slice(arrow + 4)];

    for (const part of parts) {
      changed.add(part.replace(/^"|"$/g, ''));
    }
  }

  // The porcelain code is not evidence: the git-add-empty hook runs `git add -N` on every
  // created file, so a parasite shows up as " A" and never as "??".
  const undeclared = [...changed].filter((path) => !paths.some((entry) => covers(entry, path)));

  if (undeclared.length > 0) {
    halt(
      `Scope leak on iteration ${iteration}.`,
      `Changed but not declared: ${undeclared.join(' ')}\n\nDeclared: ${paths.join(' ')}\n\ngit status --short -uall:\n${git('status', '--short', '-uall').stdout}`,
    );
  }

  return changed;
};

const runGates = (declared: Map<string, string>, iteration: string): number => {
  const commands = [...declared.entries()]
    .filter(([key]) => key.startsWith('gate'))
    .sort(([a], [b]) => Number(a.slice(4)) - Number(b.slice(4)));

  for (const [key, command] of commands) {
    const run = spawnSync(command, { shell: true, encoding: 'utf8' });

    if (run.status !== 0) {
      halt(
        `Acceptance command ${key} failed for iteration ${iteration}.`,
        `Command: ${command}\nExit code: ${run.status}\n\nOutput:\n${`${run.stdout}${run.stderr}`.slice(-4000)}`,
      );
    }
  }

  return commands.length;
};

const heldLocks: string[] = [];

process.on('exit', () => heldLocks.forEach((path) => rmSync(path, { recursive: true, force: true })));

const takeLock = (path: string, iteration: string): void => {
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

const runLock = (subcommand: string, plan: string): void => {
  const path = `${plan}.run.lock`;

  if (subcommand === 'unlock') {
    rmSync(path, { recursive: true, force: true });
    process.stdout.write(`OK: run lock released.\n`);

    return;
  }

  if (existsSync(path)) {
    halt(
      'Another run holds this plan.',
      `Held: ${path}\n\nTwo runs on the same plan implement the same iteration twice, and the second commits over the first. Wait for the holder to finish, or release it with: goal-gate.ts unlock ${plan}`,
    );
  }

  mkdirSync(path);
  process.stdout.write(`OK: run lock taken.\n`);
};

const commitAndTick = (
  plan: string,
  source: string,
  iteration: string,
  declared: Map<string, string>,
  paths: string[],
  changed: Set<string>,
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

  const staged = paths.filter((path) => existsSync(path) || changed.has(path));
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

const main = (): void => {
  const [subcommand, plan, iteration, locked] = process.argv.slice(2);

  if (plan === undefined || !['check', 'verify', 'commit', 'lock', 'unlock'].includes(subcommand ?? '')) {
    misuse(USAGE);
  }

  if (subcommand === 'lock' || subcommand === 'unlock') {
    return runLock(subcommand, plan);
  }

  if (iteration === undefined) {
    misuse(USAGE);
  }

  if (!/^[0-9]+$/.test(iteration)) {
    misuse(`${USAGE}\niteration must be a number, got: ${iteration}`);
  }

  const source = readPlan(plan);
  const hash = planHash(source);

  if (locked !== undefined && locked !== hash) {
    halt(
      `The plan was modified during iteration ${iteration}, beyond ticking a box.`,
      `Locked normalized hash ${locked}\nFound            ${hash}\n\nThe executor rewrote its own contract. Review ${plan} and the last diff before resuming.`,
    );
  }

  const declared = declaredKeys(gateBlock(iterationSection(source, iteration), iteration), iteration);

  const forbidden = [...declared.keys()].filter((key) => !ALLOWED_KEY.test(key));

  if (forbidden.length > 0) {
    halt(
      `Iteration ${iteration} declares a key it may not set.`,
      `Refused: ${forbidden.join(' ')}\n\nAn iteration gate block sets only test_files, impl_files, max_diff, commit_msg and gate1..N. Any other key either belongs to the run rather than the slice — the plan hash, the global DoD, whether anything ships — or is not a key at all. A slice that could set them would be rewriting the terms it is judged by.`,
    );
  }

  const missing = REQUIRED_KEYS.filter((key) => (declared.get(key) ?? '') === '');

  if (missing.length > 0) {
    halt(
      `Iteration ${iteration} is not runnable unattended.`,
      `Missing or empty: ${missing.join(' ')}\n\ngate1 is the acceptance criterion — without it the iteration exits 0 having proved nothing, which is exactly what the loop must never advance on. impl_files is the reference the scope check is made against. commit_msg is the message the slice is committed under. Write them into the gate block, or halt and report that this slice cannot be verified unattended.`,
    );
  }

  if (subcommand === 'check') {
    const commands = [...declared.keys()].filter((key) => key.startsWith('gate')).length;

    process.stdout.write(
      `OK: iteration ${iteration} is runnable (${commands} acceptance command(s)).\nplan_hash=${hash}\n`,
    );

    return;
  }

  const paths = declaredPaths(declared);
  const changed = scopeCheck(paths, iteration);
  const passed = runGates(declared, iteration);

  if (subcommand === 'verify') {
    process.stdout.write(
      `OK: iteration ${iteration} passed ${passed} acceptance command(s), no scope leak.\n`,
    );

    return;
  }

  commitAndTick(plan, source, iteration, declared, paths, changed);
};

main();
