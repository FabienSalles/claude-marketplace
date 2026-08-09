import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { tmpDir } from './tmp.ts';

export const RUN_NODE = resolve(import.meta.dirname, '..', '..', 'scripts', 'goal-run.ts');

export const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

export const HASH = 'a'.repeat(64);

// goal-run.ts's own exit codes (see its header comment): a paused run is a clean boundary a
// relaunch resumes, distinct from a gate halt.
export const PAUSED = 3;

// Owner/repo the fake remote resolves to: its bare repo lives two path segments deep
// (`<root>/acme/demo.git`), which is exactly what `repoOf` in run/close.ts strips a remote URL
// down to. Fixed here so a test can assert against it without re-deriving the sed.
export const FAKE_REPO = 'acme/demo';

export const PLAN = `# Spec: demo

---
Policy: commit
Remote: origin
---

### Iteration 1 — the first one
- [ ] Not done yet
- **Goal:** write a.txt

\`\`\`gate
test_files=t.txt
impl_files=a.txt
max_diff=50
commit_msg=feat: a
gate1=true
\`\`\`

### Iteration 2 — the second one
- [ ] Not done yet
- **Goal:** write b.txt
`;

export type Fixture = {
  dir: string;
  bin: string;
  claudeLog: string;
  gateLog: string;
  ghLog: string;
  plan: string;
};

export type FixtureOptions = {
  planText?: string;
  planFile?: string;
  // null keeps the checkout on the branch git init leaves it on, which is not
  // `feature/<work-id>` — the shape the branch preflight check has to refuse.
  branch?: string | null;
  trackPlan?: boolean;
  staleOrigin?: boolean;
  // A remote/branch pair advanced past what this checkout knows, same shape as `staleOrigin`
  // but naming its own remote and branch — a fork the plan's `Remote:` header points to, or a
  // base a `PR base:` header names, rather than always `origin`'s default branch.
  staleBase?: { remote: string; branch: string };
  // Inserted as a `PR base:` header line right after `Remote:`, so a plan declaring one is
  // checked against it instead of `<remote>/HEAD`.
  prBase?: string;
  // A bare `origin` two path segments deep (`acme/demo.git`), so `repoOf`'s parse of a real
  // remote URL has something genuine to strip down to `acme/demo` rather than a stand-in.
  remote?: boolean;
};

// Both binaries the script shells out to are faked first on PATH, so a test drives the whole
// orchestration without spending a token or reaching the network. Each records its argv, which is
// how "what was handed to the implementer" is asserted rather than assumed.
//
// The fake gate mimics the real one where it matters to this suite: `check` publishes a
// plan_hash on stdout, `lock` creates the same `<plan>.run.lock` directory, `unlock` removes it.
// That makes the lock assertions real rather than a stand-in.
export const repo = (options: FixtureOptions = {}): Fixture => {
  const dir = tmpDir('goal-run-');
  const bin = join(dir, 'fake-bin');
  const claudeLog = join(dir, 'claude-args.txt');
  const gateLog = join(dir, 'gate-args.txt');
  const ghLog = join(dir, 'gh-args.txt');

  mkdirSync(bin);

  writeFileSync(
    join(bin, 'claude'),
    `#!/bin/sh
printf '%s\\n' "$@" >> ${claudeLog}
# Fails quota-shaped for the first FAKE_CLAUDE_QUOTA_UNTIL calls, tracked in a counter file
# because each call is a fresh process. Lets a test prove a bounded number of relaunches
# without waiting on a real 5-hour window.
if [ -n "$FAKE_CLAUDE_QUOTA_UNTIL" ]; then
  n=$(cat "$FAKE_CLAUDE_QUOTA_COUNTER" 2>/dev/null || echo 0)
  if [ "$n" -lt "$FAKE_CLAUDE_QUOTA_UNTIL" ]; then
    echo $((n + 1)) > "$FAKE_CLAUDE_QUOTA_COUNTER"
    printf '%s\\n' "\${FAKE_CLAUDE_QUOTA_MESSAGE:-Claude AI usage limit reached|1735689600}"
    exit 1
  fi
fi
# Appended, not overwritten: a second call against the same target has to leave a real diff
# behind it, or a resumed iteration reads as "the implementer wrote nothing".
[ -n "$FAKE_CLAUDE_WRITES" ] && printf 'written %s\\n' "$$-$RANDOM" >> "$FAKE_CLAUDE_WRITES"
[ -n "$FAKE_CLAUDE_COMMITS" ] && git add -A >/dev/null 2>&1 && git commit -qm "implementer commit"
# Opt-in, symmetric to FAKE_CLAUDE_COMMITS: bash's tests never set it, so the shared fake claude
# stays untouched for them. Pushes HEAD to origin's current branch, which is what moves the local
# remote-tracking ref this guard watches.
[ -n "$FAKE_CLAUDE_PUSHES" ] && git push -q origin "HEAD:$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null
# Records the sleep's start/end instants (node, not BSD date -%N, for millisecond precision) into
# a per-invocation file, so a concurrency test can assert the lens and reviewer intervals overlap
# instead of budgeting a wall-clock ceiling that machine load can blow.
if [ -n "$FAKE_CLAUDE_SLEEPS" ]; then
  case "$*" in
    *goal-run-lens*)     out="$FAKE_CLAUDE_LENS_TIMING" ;;
    *goal-run-reviewer*) out="$FAKE_CLAUDE_REVIEWER_TIMING" ;;
    *)                   out= ;;
  esac
  start=$(node -e 'console.log(Date.now())')
  sleep "$FAKE_CLAUDE_SLEEPS"
  [ -n "$out" ] && printf '%s %s\n' "$start" "$(node -e 'console.log(Date.now())')" > "$out"
fi
# Only when the caller passed --output-format stream-json does the fixture answer in stream-json:
# the bash runner never asks for it and keeps grepping this same fixture's plain prose for a
# quota window, so emitting JSON unconditionally would break the frozen reference's own tests.
case "$*" in
  *"stream-json"*)
    sid="\${FAKE_CLAUDE_SESSION_ID:-fake-session-id}"
    [ -n "$FAKE_CLAUDE_TOOL_NAME" ] &&
      printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"%s","input":{"file_path":"%s"}}]}}\\n' "$FAKE_CLAUDE_TOOL_NAME" "$FAKE_CLAUDE_TOOL_ARG"
    printf '{"type":"result","session_id":"%s"}\\n' "$sid"
    ;;
esac
# The closing sequence hands the same binary a lens call and an audit call, each identified by
# the agent it is pinned to — an exit code of its own is what proves neither can block the run.
case "$*" in
  *goal-run-lens*)    exit \${FAKE_CLAUDE_LENS_EXIT:-0} ;;
  *goal-run-auditor*) exit \${FAKE_CLAUDE_AUDIT_EXIT:-0} ;;
esac
exit \${FAKE_CLAUDE_EXIT:-0}
`,
  );

  writeFileSync(
    join(bin, 'fake-gate'),
    `#!/bin/sh
printf '%s\\n' "$@" >> ${gateLog}
case "$1" in
  check)  printf 'OK\\nplan_hash=${HASH}\\n'; [ -n "$FAKE_GATE_CHECK_FAIL_N" ] && [ "$3" = "$FAKE_GATE_CHECK_FAIL_N" ] && exit 1; exit \${FAKE_GATE_CHECK_EXIT:-0} ;;
  lock)   mkdir "$2.run.lock" 2>/dev/null; exit 0 ;;
  unlock) rm -rf "$2.run.lock"; exit 0 ;;
  scan)   exit \${FAKE_GATE_SCAN_EXIT:-0} ;;
  dod)    exit \${FAKE_GATE_DOD_EXIT:-0} ;;
  commit)
    # Opt-in: existing callers of this fixture never set FAKE_GATE_COMMITS, and their tests
    # never look at HEAD, so leaving the tree uncommitted stays their behaviour untouched.
    if [ -n "$FAKE_GATE_COMMITS" ]; then
      git add -A >/dev/null 2>&1
      git commit -qm "\${FAKE_GATE_COMMIT_MSG:-iteration $3}" >/dev/null 2>&1
    fi
    exit \${FAKE_GATE_COMMIT_EXIT:-0}
    ;;
esac
exit 2
`,
  );

  writeFileSync(
    join(bin, 'gh'),
    `#!/bin/sh
{ printf -- '--- call ---\\n'; printf '%s\\n' "$@"; } >> ${ghLog}
case "$1 $2" in
  "pr view")
    [ -n "$FAKE_GH_PR_EXISTS" ] && { printf '{"number":%s}\\n' "\${FAKE_GH_PR_NUMBER:-1}"; exit 0; }
    exit 1
    ;;
  "pr create") exit \${FAKE_GH_CREATE_EXIT:-0} ;;
  "pr edit")   exit \${FAKE_GH_EDIT_EXIT:-0} ;;
  "pr ready")  exit \${FAKE_GH_READY_EXIT:-0} ;;
esac
exit 0
`,
  );

  chmodSync(join(bin, 'claude'), 0o755);
  chmodSync(join(bin, 'fake-gate'), 0o755);
  chmodSync(join(bin, 'gh'), 0o755);

  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'run@example.com');
  git(dir, 'config', 'user.name', 'Run');
  writeFileSync(join(dir, 'README.md'), '# scratch\n');

  const planFile = options.planFile ?? 'demo-spec.md';
  const planDir = options.trackPlan ? 'plans' : '.claude/plans';

  // The plan's directory is gitignored, which the real preflight requires and this fixture has
  // to honour: visible to git, the spec and the run's own log show up in `git status`, the tree
  // is never clean, and "the implementer wrote nothing" could never be observed. `trackPlan`
  // deliberately breaks that for the plan's own directory, to exercise the check that catches it
  // — `.claude/` stays ignored either way, since that is where a run's own records land now,
  // never inside the plan's directory.
  writeFileSync(join(dir, '.gitignore'), '.claude/\nfake-bin/\n*-args.txt\n');

  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');

  if (options.remote) {
    const root = tmpDir('goal-run-remote-');
    const originDir = join(root, 'acme', 'demo.git');
    mkdirSync(join(root, 'acme'), { recursive: true });
    spawnSync('git', ['init', '-q', '--bare', '-b', 'main', originDir]);
    git(dir, 'remote', 'add', 'origin', originDir);
  }

  // Advances <remoteName>/<branchName> past what this checkout knows, from a second clone — the
  // shape of a branch left behind while the base it forked from kept moving.
  const advanceBase = (remoteName: string, branchName: string) => {
    const remoteDir = tmpDir('goal-run-origin-');
    git(remoteDir, 'init', '-q', '--bare', '-b', branchName);
    git(dir, 'remote', 'add', remoteName, remoteDir);
    git(dir, 'push', '-q', remoteName, `HEAD:${branchName}`);
    git(dir, 'fetch', '-q', remoteName);
    git(dir, 'remote', 'set-head', remoteName, '-a');

    const clone = tmpDir('goal-run-clone-');
    git(dir, 'clone', '-q', remoteDir, clone);
    git(clone, 'config', 'user.email', 'ahead@example.com');
    git(clone, 'config', 'user.name', 'Ahead');
    writeFileSync(join(clone, 'ahead.txt'), 'ahead\n');
    git(clone, 'add', '-A');
    git(clone, 'commit', '-qm', 'ahead commit');
    git(clone, 'push', '-q', 'origin', branchName);
  };

  if (options.staleOrigin) {
    advanceBase('origin', 'main');
  }

  if (options.staleBase) {
    advanceBase(options.staleBase.remote, options.staleBase.branch);
  }

  const branch = options.branch === null ? 'main' : (options.branch ?? 'feature/demo');

  if (branch !== 'main') {
    git(dir, 'checkout', '-qb', branch);
  }

  let planText = options.planText ?? PLAN;

  if (options.prBase) {
    planText = planText.replace(/^Remote:.*$/m, (line) => `${line}\nPR base: ${options.prBase}`);
  }

  mkdirSync(join(dir, planDir), { recursive: true });
  writeFileSync(join(dir, planDir, planFile), planText);

  if (options.trackPlan) {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'track plan');
  }

  return { dir, bin, claudeLog, gateLog, ghLog, plan: join(dir, planDir, planFile) };
};

export const run = (fixture: Fixture, args: string[], env: Record<string, string> = {}) => {
  const result = spawnSync('node', [RUN_NODE, ...args], {
    cwd: fixture.dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GOAL_GATE: `${join(fixture.bin, 'fake-gate')}`,
      ...env,
    },
  });

  return { code: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
};

export const lockOf = (fixture: Fixture) => `${fixture.plan}.run.lock`;

// Mirrors preflight.ts's own derivation of a plan's work-id from its filename.
export const workIdOf = (plan: string): string => {
  const base = basename(plan);

  if (base.endsWith('-cleanup-spec.md')) {
    return base.slice(0, -'-cleanup-spec.md'.length);
  }

  if (base.endsWith('-spec.md')) {
    return base.slice(0, -'-spec.md'.length);
  }

  return base.replace(/\.md$/, '');
};

// The one run directory a fixture's single launch wrote under `.claude/goal-runs/<work-id>/`.
export const runDirOf = (fixture: Fixture): string => {
  const root = join(fixture.dir, '.claude', 'goal-runs', workIdOf(fixture.plan));
  const [runId] = readdirSync(root);

  return join(root, runId!);
};

export const logOf = (fixture: Fixture) => join(runDirOf(fixture), '.run.log');

export const jsonlOf = (fixture: Fixture) => join(runDirOf(fixture), '.run.jsonl');

export const sessionOf = (fixture: Fixture) => join(runDirOf(fixture), '.run.session');
