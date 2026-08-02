import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const LAUNCH = resolve(import.meta.dirname, '..', 'scripts', 'goal-launch.sh');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

// A fake `tmux` first on PATH: the launcher's last act is handed to it, so recording its
// arguments is how the session it would have opened is asserted without opening one.
const repo = (): { dir: string; tmuxLog: string } => {
  const dir = tmpDir('goal-launch-');
  const bin = join(dir, 'fake-bin');
  const tmuxLog = join(dir, 'tmux-args.txt');

  mkdirSync(bin);
  writeFileSync(join(bin, 'tmux'), `#!/bin/sh\nprintf '%s\\n' "$@" > ${tmuxLog}\n`);
  chmodSync(join(bin, 'tmux'), 0o755);

  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'launch@example.com');
  git(dir, 'config', 'user.name', 'Launch');
  writeFileSync(join(dir, 'README.md'), '# scratch\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');

  mkdirSync(join(dir, '.claude', 'plans'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'plans', 'demo-spec.md'), 'Policy: commit\nRemote: origin\n');

  return { dir, tmuxLog };
};

const launch = (dir: string, ...args: string[]) => {
  const run = spawnSync('bash', [LAUNCH, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(dir, 'fake-bin')}:${process.env.PATH ?? ''}` },
  });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

// R8 — one command creates the worktree, names the branch and opens the session
test('it creates the worktree and names the branch after the plan', () => {
  const { dir } = repo();

  const { code, output } = launch(dir, '.claude/plans/demo-spec.md');

  assert.equal(code, 0, output);
  assert.ok(existsSync(join(dir, '.worktrees', 'demo')), `no worktree:\n${output}`);
  assert.match(git(dir, 'branch', '--list', 'feature/demo').stdout, /feature\/demo/);
});

// The plan lives in a gitignored directory, so it is absent from the worktree the launcher
// just made: a relative path would resolve against a tree that holds no plans at all.
test('it hands the session an absolute plan path', () => {
  const { dir, tmuxLog } = repo();

  const { code, output } = launch(dir, '.claude/plans/demo-spec.md');

  assert.equal(code, 0, output);
  const args = readFileSync(tmuxLog, 'utf8');
  assert.match(args, /\/goal:auto \//, `plan path is not absolute:\n${args}`);
  assert.match(args, /demo-spec\.md/);
});

test('the session runs in the worktree, not in the checkout it was launched from', () => {
  const { dir, tmuxLog } = repo();

  launch(dir, '.claude/plans/demo-spec.md');

  assert.match(readFileSync(tmuxLog, 'utf8'), /\.worktrees\/demo/);
});

for (const [claim, args] of [
  ['no plan is named', [] as string[]],
  ['the named plan does not exist', ['.claude/plans/absent-spec.md']],
] as const) {
  test(`it refuses when ${claim}`, () => {
    const { dir } = repo();

    const { code } = launch(dir, ...args);

    assert.notEqual(code, 0);
    assert.ok(!existsSync(join(dir, '.worktrees')), 'a worktree was created on a refusal');
  });
}

// A run that refuses at preflight — an absent `Remote:` line, a policy the mode forbids — leaves
// the worktree and the branch behind having written nothing. The developer's next gesture is the
// same command, so it has to be the same command: refusing on leftovers of its own making turns
// every preflight refusal into a manual `worktree remove` + `branch -D`.
test('it reclaims a worktree and branch left by a run that wrote nothing', () => {
  const { dir } = repo();

  assert.equal(launch(dir, '.claude/plans/demo-spec.md').code, 0);
  const { code, output } = launch(dir, '.claude/plans/demo-spec.md');

  assert.equal(code, 0, output);
  assert.ok(existsSync(join(dir, '.worktrees', 'demo')), `no worktree:\n${output}`);
  assert.match(git(dir, 'branch', '--list', 'feature/demo').stdout, /feature\/demo/);
});

// Reclaiming is safe only while there is nothing to lose. Uncommitted work in the worktree is
// the developer's, and no launcher gets to decide it was disposable.
test('it refuses to reclaim a worktree holding uncommitted work', () => {
  const { dir } = repo();

  assert.equal(launch(dir, '.claude/plans/demo-spec.md').code, 0);
  writeFileSync(join(dir, '.worktrees', 'demo', 'scratch.txt'), 'unsaved\n');

  const { code, output } = launch(dir, '.claude/plans/demo-spec.md');

  assert.notEqual(code, 0, `it removed a dirty worktree:\n${output}`);
  assert.ok(existsSync(join(dir, '.worktrees', 'demo', 'scratch.txt')), 'the work was destroyed');
});

// A halted run pushes its branch before it stops, so its commits survive the branch being
// deleted. One that could not push has commits reachable from nowhere else, and `branch -D`
// is the only way left to lose them.
test('it refuses to reclaim a branch carrying commits no remote has', () => {
  const { dir } = repo();

  assert.equal(launch(dir, '.claude/plans/demo-spec.md').code, 0);
  const tree = join(dir, '.worktrees', 'demo');
  writeFileSync(join(tree, 'landed.txt'), 'iteration 1\n');
  git(tree, 'add', '-A');
  git(tree, 'commit', '-qm', 'feat: iteration 1');

  const { code, output } = launch(dir, '.claude/plans/demo-spec.md');

  assert.notEqual(code, 0, `it deleted unpushed commits:\n${output}`);
  assert.match(git(dir, 'branch', '--list', 'feature/demo').stdout, /feature\/demo/);
});

// A run nobody watches must never sit on a permission prompt: that is not a stalled run, it is a
// run that looks alive and advances no iteration. The mode is the launcher's job because the
// developer who types `Shift+Tab` before every launch eventually forgets one.
test('it opens the session in a mode that never prompts', () => {
  const { dir, tmuxLog } = repo();

  assert.equal(launch(dir, '.claude/plans/demo-spec.md').code, 0);

  assert.match(readFileSync(tmuxLog, 'utf8'), /--permission-mode auto/);
});
