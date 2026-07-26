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
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const USAGE =
  'usage: goal-gate.ts check|verify|commit <plan> <iteration> [plan_hash]\n       goal-gate.ts dod <plan> [plan_hash]\n       goal-gate.ts tracks <plan>\n       goal-gate.ts scan\n       goal-gate.ts lock|unlock <plan>';

const ALLOWED_KEY = /^(test_files|impl_files|max_diff|commit_msg|gate[1-9][0-9]*)$/;
const REQUIRED_KEYS = ['gate1', 'impl_files', 'commit_msg'] as const;
const ALLOWED_DOD_KEY = /^dod[1-9][0-9]*$/;
const SCANNERS = ['betterleaks', 'gitleaks'];

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

const lockedHash = (
  plan: string,
  source: string,
  subject: string,
  locked: string | undefined,
): string => {
  const hash = planHash(source);

  if (locked !== undefined && locked !== hash) {
    halt(
      `The plan was modified during ${subject}, beyond ticking a box.`,
      `Locked normalized hash ${locked}\nFound            ${hash}\n\nThe executor rewrote its own contract. Review ${plan} and the last diff before resuming.`,
    );
  }

  return hash;
};

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

const gateBlock = (section: string[], subject: string): string[] => {
  const open = section.findIndex((line) => line.trim() === '```gate');
  const body = section.slice(open + 1);
  const close = body.findIndex((line) => line.trim() === '```');

  if (open === -1 || close === -1) {
    halt(
      `${subject} declares no gate block.`,
      'The iteration section holds no closed ```gate fence.\n\nAn iteration with no gate block has no acceptance criterion, no declared scope and no commit message, so nothing can be verified about it. The global Definition of Done block is not a substitute: it belongs to the plan, not to this slice.',
    );
  }

  return body.slice(0, close);
};

const declaredKeys = (block: string[], subject: string): Map<string, string> => {
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
      `${subject} declares the same key twice.`,
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

// Both bounds are measured against HEAD: `git diff --numstat` with no revision misses a
// staged deletion entirely, which would let a slice remove a file for free.
const headDiff = (flag: string, paths: string[], iteration: string): string[] => {
  const run = git('diff', flag, '-M', 'HEAD', '--', ...paths);

  if (run.status !== 0) {
    halt(
      `git diff failed, so iteration ${iteration}'s bounds were never measured.`,
      `${run.stderr}\n\nThe gate measures the tree it is standing in against HEAD: run it with the repository — or the track worktree — as the working directory.`,
    );
  }

  return run.stdout.split('\n').filter((line) => line !== '');
};

const budgetCheck = (declared: Map<string, string>, paths: string[], iteration: string): void => {
  const budget = declared.get('max_diff') ?? '';

  if (budget === '') {
    return;
  }

  if (!/^[0-9]+$/.test(budget)) {
    halt(
      `Iteration ${iteration} declares a max_diff that is not a number.`,
      `Found: ${budget}\n\nA budget nothing can compare against is a budget nobody is held to: the slice would run unbounded while the plan claims otherwise. Write a plain line count.`,
    );
  }

  const written = headDiff('--numstat', paths, iteration).reduce((total, line) => {
    const [added, removed] = line.split('\t');

    return total + (Number(added) || 0) + (Number(removed) || 0);
  }, 0);

  if (written > Number(budget)) {
    halt(
      `Iteration ${iteration} exceeds its declared diff budget.`,
      `Written: ${written} line(s) across ${paths.join(' ')}\nBudget: ${budget}\n\nA slice that outgrows its own estimate is no longer the slice that was reviewed and frozen. Split it, or raise max_diff in the plan deliberately — before the halt, not after it.`,
    );
  }
};

const deliveryMode = (source: string): string =>
  /^Delivery mode:\s*allow-bc-break\s*$/m.test(source) ? 'allow-bc-break' : 'no-bc-break';

const removalCheck = (source: string, paths: string[], iteration: string): void => {
  if (deliveryMode(source) === 'allow-bc-break') {
    return;
  }

  const removals = headDiff('--name-status', paths, iteration).filter((line) => /^[DR]/.test(line));

  if (removals.length > 0) {
    halt(
      `Iteration ${iteration} deletes or renames a pre-existing file under no-bc-break.`,
      `${removals.join('\n')}\n\nThe plan header declares no-bc-break — or declares no delivery mode at all, which reads the same way — so every consumer of these paths must keep working. Add beside the old path and leave it standing, or change the plan header to allow-bc-break and name what breaks.`,
    );
  }
};

const gateCommands = (declared: Map<string, string>): [string, string][] =>
  [...declared.entries()]
    .filter(([key]) => key.startsWith('gate'))
    .sort(([a], [b]) => Number(a.slice(4)) - Number(b.slice(4)));

const runGates = (
  declared: Map<string, string>,
  iteration: string,
  origin?: Map<string, string>,
): number => {
  const commands = gateCommands(declared);

  for (const [key, command] of commands) {
    const run = spawnSync(command, { shell: true, encoding: 'utf8' });

    if (run.status !== 0) {
      const detail = `Command: ${command}\nExit code: ${run.status}\n\nOutput:\n${`${run.stdout}${run.stderr}`.slice(-4000)}`;

      if (origin !== undefined) {
        halt(
          `A command iteration ${origin.get(command)} passed on fails at iteration ${iteration}.`,
          `${detail}\n\nThe regression wall replays every checked iteration's commands, so the slice that broke an earlier one halts instead of the slice that merely runs after it. The wall cannot prove a replayed command is idempotent: if it writes state — a migration, a snapshot, a generated file — it may be failing on the leftovers of its own earlier runs rather than on this slice. Declare only commands that can be run twice.`,
        );
      }

      halt(`Acceptance command ${key} failed for iteration ${iteration}.`, detail);
    }
  }

  return commands.length;
};

const DETERMINISM_RUNS = 3;

// gate1 alone, for the same reason the bite check bites it alone: R2 makes it the one
// mandatory command, where gate2..N are lints that cannot flake. runGates() already spent
// the first of the three runs.
const determinismCheck = (declared: Map<string, string>, iteration: string): void => {
  const command = declared.get('gate1') ?? '';

  for (let run = 2; run <= DETERMINISM_RUNS; run += 1) {
    const result = spawnSync(command, { shell: true, encoding: 'utf8' });

    if (result.status !== 0) {
      halt(
        `Iteration ${iteration}'s acceptance command does not pass ${DETERMINISM_RUNS} times in a row.`,
        `Command: ${command}\nRun ${run} of ${DETERMINISM_RUNS} exited ${result.status}\n\nOutput:\n${`${result.stdout}${result.stderr}`.slice(-4000)}\n\nA command that passes once and fails on a replay depends on the leftovers of its own previous run, or on something outside the tree. An unattended loop cannot tell that apart from a real failure, so it stops here.`,
      );
    }
  }
};

const blockOf = (source: string, iteration: string): Map<string, string> =>
  declaredKeys(
    gateBlock(iterationSection(source, iteration), `Iteration ${iteration}`),
    `Iteration ${iteration}`,
  );

const iterationNumbers = (source: string, ticked: boolean): string[] => {
  const lines = source.split('\n');
  const numbers: string[] = [];

  for (const line of lines) {
    const heading = /^### Iteration ([0-9]+)\b/.exec(line);

    if (heading === null) {
      continue;
    }

    const [start, end] = sectionBounds(lines, heading[1]!);
    const box = lines.slice(start, end).find((entry) => entry.startsWith('- ['));

    if (box?.startsWith(ticked ? '- [x]' : '- [ ]') === true) {
      numbers.push(heading[1]!);
    }
  }

  return numbers;
};

// The checked iterations' commands, deduplicated by command string and replayed, so a slice that
// breaks an earlier one halts where the cause is. It re-enters runGates(); the slice's own
// commands are already spent there, so they count as seen.
const regressionWall = (source: string, iteration: string, declared: Map<string, string>): void => {
  const seen = new Set(gateCommands(declared).map(([, command]) => command));
  const replay = new Map<string, string>();
  const origin = new Map<string, string>();

  for (const earlier of iterationNumbers(source, true)) {
    for (const [, command] of gateCommands(blockOf(source, earlier))) {
      if (seen.has(command)) {
        continue;
      }

      seen.add(command);
      replay.set(`gate${replay.size + 1}`, command);
      origin.set(command, earlier);
    }
  }

  runGates(replay, iteration, origin);
};

const inHead = (path: string): boolean => git('cat-file', '-e', `HEAD:${path}`).status === 0;

// A later iteration declares paths that do not exist yet, which is the normal case, so the unit
// is the parent directory and HEAD is what it is compared against: a directory present in HEAD
// and gone from the tree was renamed or moved, where a directory nobody has created yet was
// never there at all. The iteration being verified is excluded — the scope check, the budget and
// the removal check judge its own declarations, and a deletion emptying a directory the mode
// allows must not halt on itself.
const resolvabilityCheck = (source: string, iteration: string): void => {
  const unresolvable: string[] = [];

  for (const later of iterationNumbers(source, false).filter((entry) => entry !== iteration)) {
    for (const path of declaredPaths(blockOf(source, later))) {
      const parent = path.endsWith('/') ? path.slice(0, -1) : dirname(path);

      if (!existsSync(parent) && inHead(parent)) {
        unresolvable.push(`iteration ${later}: ${path} (missing directory: ${parent})`);
      }
    }
  }

  if (unresolvable.length > 0) {
    halt(
      `Iteration ${iteration} leaves a path the plan still declares unresolvable.`,
      `${unresolvable.join('\n')}\n\nThese directories exist in HEAD and no longer exist in the tree, so the iterations declaring paths inside them can no longer run. The check is made before the commit on purpose: committing first would leave a commit whose own plan is already broken. Restore the directory, or update the declarations of the iterations named above.`,
    );
  }
};

// The barrier replayed once before anything ships. Every slice gate only ever saw its own slice,
// so a run that pushed on the strength of those alone would never have run the whole suite
// against the whole branch.
const dodCheck = (source: string): void => {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^## Definition of Done\b/.test(line));

  if (start === -1) {
    halt(
      'The plan declares no global Definition of Done.',
      'No "## Definition of Done" heading found.\n\nThe DoD is the last barrier before anything is pushed: without it a run would ship on the strength of its per-slice gates alone, each of which only ever judged its own slice against its own commands.',
    );
  }

  const next = lines.slice(start + 1).findIndex((line) => /^#{2,3} /.test(line));
  const section = lines.slice(start + 1, next === -1 ? lines.length : start + 1 + next);
  const declared = declaredKeys(
    gateBlock(section, "The plan's Definition of Done"),
    "The plan's Definition of Done",
  );

  const forbidden = [...declared.keys()].filter((key) => !ALLOWED_DOD_KEY.test(key));

  if (forbidden.length > 0) {
    halt(
      "The plan's Definition of Done declares a key it may not set.",
      `Refused: ${forbidden.join(' ')}\n\nThe global block sets dod1..N and nothing else. A gate1 written here would be read by no verb at all, so the command it names would never run while the plan claimed it as a barrier.`,
    );
  }

  if ((declared.get('dod1') ?? '') === '') {
    halt(
      "The plan's Definition of Done names no command.",
      'Missing or empty: dod1\n\nA barrier that runs nothing exits 0 on anything, which is the failure this harness exists to remove. Write the commands that prove the whole plan is done, or say that the plan cannot be verified.',
    );
  }

  for (const [key, command] of [...declared.entries()].sort(([a], [b]) => Number(a.slice(3)) - Number(b.slice(3)))) {
    const run = spawnSync(command, { shell: true, encoding: 'utf8' });

    if (run.status !== 0) {
      halt(
        `The global Definition of Done fails at ${key}.`,
        `Command: ${command}\nExit code: ${run.status}\n\nOutput:\n${`${run.stdout}${run.stderr}`.slice(-4000)}\n\nEvery slice was gated green and the plan as a whole is not. Nothing has been pushed.`,
      );
    }
  }

  process.stdout.write(`OK: the global Definition of Done passed ${declared.size} command(s).\n`);
};

// betterleaks first, gitleaks second, and a refusal if neither is installed: a push nobody
// scanned is exactly how a halted branch publishes a .env. Both take `dir`, betterleaks being a
// drop-in replacement for the gitleaks CLI.
const secretScan = (): void => {
  const scanner = SCANNERS.find(
    (name) => spawnSync(`command -v ${name}`, { shell: true }).status === 0,
  );

  if (scanner === undefined) {
    halt(
      'No secret scanner is installed, so nothing may be pushed.',
      `Looked for: ${SCANNERS.join(' ')}\n\nThe guard refuses rather than degrades: a run that pushed unscanned would publish whatever the tree holds, and a halted branch is pushed too. Install one of the above, or push by hand having read the diff.`,
    );
  }

  const command = `${scanner} dir . --redact`;
  const run = spawnSync(command, { shell: true, encoding: 'utf8' });

  if (run.status !== 0) {
    halt(
      `${scanner} refuses this tree, so nothing was pushed.`,
      `Command: ${command}\nExit code: ${run.status}\n\nOutput:\n${`${run.stdout}${run.stderr}`.slice(-4000)}\n\nEither the tree holds a secret — rotate it, it is already in the local history — or the scanner does not support this invocation, which the command above tells you.`,
    );
  }

  process.stdout.write(`OK: ${scanner} found no secret.\n`);
};

type Track = {
  name: string;
  suffix: string;
  prepare: string;
  teardown: string;
  iterations: string[];
};

const trackField = (section: string[], key: string): string => {
  const pattern = new RegExp(`^[-*\\s]*(?:\\*\\*)?${key}:(?:\\*\\*)?\\s*(.*)$`);

  for (const line of section) {
    const found = pattern.exec(line);

    if (found !== null) {
      return (found[1] ?? '').trim();
    }
  }

  return '';
};

const trackList = (source: string): Track[] => {
  const lines = source.split('\n');
  const tracks: Track[] = [];

  for (const [index, line] of lines.entries()) {
    const heading = /^## Track\s+(.+?)\s*$/.exec(line);

    if (heading === null) {
      continue;
    }

    const rest = lines.slice(index + 1);
    const next = rest.findIndex((entry) => /^## /.test(entry));
    const section = next === -1 ? rest : rest.slice(0, next);

    tracks.push({
      name: heading[1]!,
      suffix: trackField(section, 'Branch suffix'),
      prepare: trackField(section, 'Prepare'),
      teardown: trackField(section, 'Teardown'),
      iterations: section.flatMap((entry) => {
        const number = /^### Iteration ([0-9]+)\b/.exec(entry);

        return number === null ? [] : [number[1]!];
      }),
    });
  }

  return tracks;
};

const overlap = (one: string[], other: string[]): string[] =>
  one.filter((entry) => other.some((path) => covers(entry, path) || covers(path, entry)));

// Independence is proven before a single worktree exists: a false track means two pull requests
// that conflict at merge, and discovering it then costs both.
const tracksCheck = (source: string): void => {
  const tracks = trackList(source);

  if (tracks.length === 0) {
    process.stdout.write('OK: the plan declares no track, so its iterations run as one sequence.\n');

    return;
  }

  for (const track of tracks) {
    if (track.suffix === '') {
      halt(
        `Track ${track.name} declares no branch suffix.`,
        'Every track needs a "Branch suffix:" line: it is what names the branch and the worktree. Without it two tracks would fight over one branch, so nothing is created.',
      );
    }

    if (track.iterations.length === 0) {
      halt(
        `Track ${track.name} declares no iteration.`,
        'A track with nothing to run would create a worktree and a branch for no work at all.',
      );
    }
  }

  const suffixes = tracks.map((track) => track.suffix);
  const collision = suffixes.filter((suffix, index) => suffixes.indexOf(suffix) !== index);

  if (collision.length > 0) {
    halt(
      'Two tracks declare the same branch suffix.',
      `Duplicated: ${[...new Set(collision)].join(' ')}\n\nThe suffix names both the branch and the worktree, so two tracks sharing one would commit into the same branch and each would judge the other's code. Give them distinct suffixes.`,
    );
  }

  const seen = new Map<string, string>();

  for (const track of tracks) {
    for (const iteration of track.iterations) {
      const owner = seen.get(iteration);

      if (owner !== undefined) {
        halt(
          `Iteration ${iteration} is declared by two tracks.`,
          `Tracks: ${owner} and ${track.name}\n\nIteration numbers are global to the plan: the gate resolves "### Iteration ${iteration}" by number, so two tracks carrying the same number would both be judged against the first one's block. Renumber them.`,
        );
      }

      seen.set(iteration, track.name);
    }
  }

  const declared = tracks.map((track) => ({
    track,
    paths: track.iterations.flatMap((iteration) => declaredPaths(blockOf(source, iteration))),
  }));

  for (const [index, one] of declared.entries()) {
    for (const other of declared.slice(index + 1)) {
      const shared = overlap(one.paths, other.paths);

      if (shared.length > 0) {
        halt(
          `Tracks ${one.track.name} and ${other.track.name} are not independent.`,
          `Shared: ${shared.join(' ')}\n\nOne file declared by two tracks and the two branches conflict at merge, however green both ran. Move the shared work into a sequential iteration before the tracks, or merge the tracks. Nothing was created.`,
        );
      }
    }
  }

  for (const { track } of declared) {
    process.stdout.write(
      `track\t${track.suffix}\t${track.name}\t${track.iterations.join(' ')}\t${track.prepare}\t${track.teardown}\n`,
    );
  }
};

const heldLocks: string[] = [];

process.on('exit', () => heldLocks.forEach((path) => rmSync(path, { recursive: true, force: true })));

const gitDir = (): string => {
  const dir = git('rev-parse', '--absolute-git-dir');

  if (dir.status !== 0) {
    halt(
      'The bite check found no git directory to hold its backup in.',
      `${dir.stderr}\n\nRun the gate from the repository, or from the track worktree.`,
    );
  }

  return dir.stdout.trim();
};

const headBlob = (path: string): Buffer => {
  const run = spawnSync('git', ['show', `HEAD:${path}`], { maxBuffer: 512 * 1024 * 1024 });

  if (run.status !== 0) {
    halt(
      `The bite check cannot read ${path} out of HEAD.`,
      `${run.stderr}\n\nNothing was set aside, so the tree is untouched.`,
    );
  }

  return run.stdout;
};

const fingerprint = (paths: string[]): string => {
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
const biteCheck = (declared: Map<string, string>, iteration: string, changed: Set<string>): void => {
  if ((declared.get('test_files') ?? '') === '') {
    process.stdout.write(
      `SKIP: iteration ${iteration} declares no test_files, so there is nothing to set aside.\n`,
    );

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

  for (const { path, inHead, present } of implementation) {
    if (present) {
      mkdirSync(dirname(join(backup, path)), { recursive: true });
      copyFileSync(path, join(backup, path));
    }

    if (inHead) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, headBlob(path));
    } else {
      rmSync(path, { force: true });
    }
  }

  const run = spawnSync(declared.get('gate1') ?? '', { shell: true, encoding: 'utf8' });

  for (const { path, present } of implementation) {
    if (present) {
      copyFileSync(join(backup, path), path);
    } else {
      rmSync(path, { force: true });
    }
  }

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

  process.stdout.write(`OK: gate1 fails without iteration ${iteration}'s implementation.\n`);
};

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

  if (subcommand === 'scan') {
    return secretScan();
  }

  if (
    plan === undefined ||
    !['check', 'verify', 'commit', 'dod', 'tracks', 'lock', 'unlock'].includes(subcommand ?? '')
  ) {
    misuse(USAGE);
  }

  if (subcommand === 'lock' || subcommand === 'unlock') {
    return runLock(subcommand, plan);
  }

  if (subcommand === 'tracks') {
    return tracksCheck(readPlan(plan));
  }

  if (subcommand === 'dod') {
    const source = readPlan(plan);

    lockedHash(plan, source, 'the Definition of Done replay', iteration);

    return dodCheck(source);
  }

  if (iteration === undefined) {
    misuse(USAGE);
  }

  if (!/^[0-9]+$/.test(iteration)) {
    misuse(`${USAGE}\niteration must be a number, got: ${iteration}`);
  }

  const source = readPlan(plan);

  const hash = lockedHash(plan, source, `iteration ${iteration}`, locked);

  const declared = blockOf(source, iteration);

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

  budgetCheck(declared, paths, iteration);
  removalCheck(source, paths, iteration);
  resolvabilityCheck(source, iteration);

  const passed = runGates(declared, iteration);

  determinismCheck(declared, iteration);
  regressionWall(source, iteration, declared);
  biteCheck(declared, iteration, changed);

  if (subcommand === 'verify') {
    process.stdout.write(
      `OK: iteration ${iteration} passed ${passed} acceptance command(s), no scope leak.\n`,
    );

    return;
  }

  commitAndTick(plan, source, iteration, declared, paths, changed);
};

main();
