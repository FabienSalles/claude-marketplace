import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, cpSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { resolveArtifacts } from '../../src/artifacts.ts';

import { clock } from '../../src/adapters/clock.ts';
import { command } from '../../src/adapters/command.ts';
import { fs } from '../../src/adapters/fs.ts';
import { claudeAgentSessions } from '../../src/adapters/claude/session.ts';
import { spawnGateAdapter } from '../../src/adapters/gate.ts';
import { pauseLine } from '../../src/core/publication.ts';
import { LANDED, REFUSED } from '../../src/core/verdict.ts';
import { iterationNumbers } from '../../src/gate/plan.ts';
import { createLock } from '../../src/run/lock.ts';
import { runIteration } from '../../src/run/iteration.ts';
import { close } from '../../src/run/close.ts';
import { preflight, workIdOf } from '../../src/run/preflight.ts';
import { createPublisher, remoteNote } from '../../src/run/publish.ts';
import { runDir, type Reporter } from '../../src/run/report.ts';
import type { AgentSessions } from '../../src/ports.ts';
import { AWAIT_DEADLINE_MS } from './await-state.ts';
import { tmpDir } from './tmp.ts';

export const RUN_NODE = resolve(import.meta.dirname, '..', '..', 'scripts', 'goal-run.ts');
process.env.GOAL_LOCK_ROOT ??= tmpDir('goal-run-locks-');

const AWAIT_MARKER = resolve(import.meta.dirname, 'await-marker.sh');

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
  // Removes the `origin` every checkout carries: no base resolves anywhere.
  noRemote?: boolean;
  // `origin` declared as https://github.com/acme/demo, redirected to a local bare repository with
  // `url.<path>.insteadOf`. `parent` also builds https://github.com/up/demo as the remote
  // `upstream`: 'level' holds what the fork holds, 'ahead' holds one more commit, 'unfetchable'
  // is a remote whose repository is gone, 'no-remote' is a parent no local remote points at.
  github?: { parent?: 'level' | 'ahead' | 'unfetchable' | 'no-remote' };
};

const FAKE_BINARIES: Readonly<Record<string, string>> = {
  claude: `#!/bin/sh
d=$(dirname "$0")/..
printf '%s\\n' "$@" >> "$d/claude-args.txt"
printf 'env DISABLE_AUTOUPDATER=%s\\n' "$DISABLE_AUTOUPDATER" >> "$d/claude-args.txt"
if [ -n "$FAKE_CLAUDE_LAUNCH_LOG" ]; then
  FAKE_CLAUDE_ULIMIT=$(ulimit -u) node -e 'require("node:fs").appendFileSync(process.env.FAKE_CLAUDE_LAUNCH_LOG, JSON.stringify({ argv: process.argv.slice(1), env: process.env, ulimit: process.env.FAKE_CLAUDE_ULIMIT }) + "\\n")' -- "$@"
fi
# Fails quota-shaped for the first FAKE_CLAUDE_QUOTA_UNTIL calls, tracked in a counter file
# because each call is a fresh process. Lets a test prove a bounded number of relaunches
# without waiting on a real 5-hour window.
if [ -n "$FAKE_CLAUDE_QUOTA_UNTIL" ]; then
  n=$(cat "$FAKE_CLAUDE_QUOTA_COUNTER" 2>/dev/null || echo 0)
  if [ "$n" -lt "$FAKE_CLAUDE_QUOTA_UNTIL" ]; then
    echo $((n + 1)) > "$FAKE_CLAUDE_QUOTA_COUNTER"
    printf '{"type":"result","is_error":true,"result":"%s"}\\n' "\${FAKE_CLAUDE_QUOTA_MESSAGE:-Claude AI usage limit reached|1735689600}"
    exit 1
  fi
fi
# Announces that the session is running, then waits for a signal instead of a fixed sleep: a test
# synchronises on the marker file and ends the session by signalling the runner.
if [ -n "$FAKE_CLAUDE_MARKER" ]; then
  : > "$FAKE_CLAUDE_MARKER"
  trap 'kill "$spid" 2>/dev/null; exit 143' TERM INT
  tail -f /dev/null &
  spid=$!
  wait "$spid"
fi
# Appended, not overwritten: a second call against the same target has to leave a real diff
# behind it, or a resumed iteration reads as "the implementer wrote nothing".
[ -n "$FAKE_CLAUDE_WRITES" ] && printf 'written %s\\n' "\${FAKE_CLAUDE_WRITE_TAG:-$$-$RANDOM}" >> "$FAKE_CLAUDE_WRITES"
if [ -n "$FAKE_CLAUDE_EXEC" ]; then
  case "$*" in *goal-run-implementer*) sh "$FAKE_CLAUDE_EXEC" ;; esac
fi
[ -n "$FAKE_CLAUDE_COMMITS" ] && git add -A >/dev/null 2>&1 && git commit -qm "implementer commit"
# Opt-in, symmetric to FAKE_CLAUDE_COMMITS: bash's tests never set it, so the shared fake claude
# stays untouched for them. Commits, pushes that commit to origin's current branch, which is what
# moves the local remote-tracking ref this guard watches, then moves HEAD back so R1 stays quiet.
[ -n "$FAKE_CLAUDE_PUSHES" ] && { git commit --allow-empty -qm "implementer work" && git push -q origin "HEAD:$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null; git reset -q --soft HEAD~1; }
if [ -n "$FAKE_CLAUDE_RELEASE" ]; then
  : > "$FAKE_CLAUDE_STARTED"
  sh "${AWAIT_MARKER}" "$FAKE_CLAUDE_RELEASE" ${AWAIT_DEADLINE_MS} || exit 1
fi
if [ -n "$FAKE_CLAUDE_RENDEZVOUS" ]; then
  case "$*" in
    *goal-run-lens*)     me=lens;     other=reviewer ;;
    *goal-run-reviewer*) me=reviewer; other=lens ;;
    *)                   me= ;;
  esac
  if [ -n "$me" ]; then
    d="$FAKE_CLAUDE_RENDEZVOUS"
    ms="\${FAKE_CLAUDE_RENDEZVOUS_DEADLINE_MS:-${AWAIT_DEADLINE_MS}}"
    if [ -e "$d/$other.verdict" ]; then
      text="the lens and reviewer never ran concurrently: the $other had finished before the $me started"
      printf '%s\\n' "$text" > "$d/$other.verdict"
      printf '%s\\n' "$text" > "$d/$me.verdict"
    else
      : > "$d/$me.arrived"
      if sh "${AWAIT_MARKER}" "$d/$other.arrived" "$ms" 2>/dev/null; then
        printf 'met\\n' > "$d/$me.verdict"
      else
        printf 'the %s is missing: it never started within %s ms of the %s, so they never ran concurrently\\n' "$other" "$ms" "$me" > "$d/$me.verdict"
      fi
    fi
  fi
fi
# Only when the caller passed --output-format stream-json does the fixture answer in JSON: the
# bash runner never asks for it and keeps grepping this same fixture's plain prose for a quota
# window, so emitting JSON unconditionally would break the frozen reference's own tests. The
# implementer and the advisory agents (lens, reviewer, auditor) all ask for stream-json now, so one
# branch answers both: an assistant event carrying the served model and a per-call usage block (for
# narrate()'s context-peak extraction), an optional compact-boundary marker, then the terminal
# result event carrying the four token classes, the prose (for the advisory agents) and modelUsage
# (an alternate way the served model is named).
# Opt-in noise on stderr, beside whatever the case below still answers on stdout: proves a
# caller that captures the two streams separately never lets this leak into the parsed envelope.
[ -n "$FAKE_CLAUDE_STDERR_NOISE" ] && printf '%s\n' "$FAKE_CLAUDE_STDERR_NOISE" >&2
case "$*" in
  *"stream-json"*)
    sid="\${FAKE_CLAUDE_SESSION_ID:-fake-session-id}"
    model="\${FAKE_CLAUDE_MODEL:-claude-sonnet-5}"
    [ -n "$FAKE_CLAUDE_TOOL_NAME" ] &&
      printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"%s","input":{"file_path":"%s"}}]}}\\n' "$FAKE_CLAUDE_TOOL_NAME" "$FAKE_CLAUDE_TOOL_ARG"
    printf '{"type":"assistant","message":{"model":"%s","usage":{"input_tokens":%s,"output_tokens":100,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}\\n' "$model" "\${FAKE_CLAUDE_CONTEXT_TOKENS:-50000}"
    [ -n "$FAKE_CLAUDE_RAW_LINE" ] && printf '%s\\n' "$FAKE_CLAUDE_RAW_LINE"
    [ -n "$FAKE_CLAUDE_MIDSTREAM" ] &&
      printf '{"type":"user","message":{"content":[{"type":"tool_result","content":"%s"}]}}\\n' "$FAKE_CLAUDE_MIDSTREAM"
    [ -n "$FAKE_CLAUDE_COMPACT" ] && printf '{"type":"system","subtype":"compact_boundary"}\\n'
    [ -n "$FAKE_CLAUDE_OUTPUT_BYTES" ] && { head -c "$FAKE_CLAUDE_OUTPUT_BYTES" /dev/zero | tr '\\0' 'x'; printf '\\n'; }
    if [ -n "$FAKE_CLAUDE_FINAL_ERROR" ]; then
      printf '{"type":"result","is_error":true,"session_id":"%s","result":"%s"}\\n' "$sid" "$FAKE_CLAUDE_FINAL_ERROR"
    else
      printf '{"type":"result","session_id":"%s","result":"fake advisory finding","usage":{"input_tokens":10,"output_tokens":20,"cache_creation_input_tokens":30,"cache_read_input_tokens":40},"modelUsage":{"%s":{}}}\\n' "$sid" "$model"
    fi
    ;;
esac
# Dies by the named signal, on the call whose argv carries FAKE_CLAUDE_KILL_ON (the implementer
# by default), after everything above has been written.
if [ -n "$FAKE_CLAUDE_KILL_SIGNAL" ]; then
  case "$*" in
    *"\${FAKE_CLAUDE_KILL_ON:-goal-run-implementer}"*) kill -s "$FAKE_CLAUDE_KILL_SIGNAL" $$ ;;
  esac
fi
# The closing sequence hands the same binary a lens call and an audit call, each identified by
# the agent it is pinned to — an exit code of its own is what proves neither can block the run.
case "$*" in
  *goal-run-lens*)    exit \${FAKE_CLAUDE_LENS_EXIT:-0} ;;
  *goal-run-auditor*) exit \${FAKE_CLAUDE_AUDIT_EXIT:-0} ;;
esac
exit \${FAKE_CLAUDE_EXIT:-0}
`,
  'fake-gate': `#!/bin/sh
d=$(dirname "$0")/..
printf '%s\\n' "$@" >> "$d/gate-args.txt"
case "$1" in
  check)  printf 'OK\\nplan_hash=${HASH}\\nticked=%s\\n' "$FAKE_GATE_TICKED"; [ -n "$FAKE_GATE_CHECK_FAIL_N" ] && [ "$3" = "$FAKE_GATE_CHECK_FAIL_N" ] && exit 1; exit \${FAKE_GATE_CHECK_EXIT:-0} ;;
  lock)   mkdir "$2.run.lock" 2>/dev/null; exit 0 ;;
  unlock) rm -rf "$2.run.lock"; exit 0 ;;
  scan)   exit \${FAKE_GATE_SCAN_EXIT:-0} ;;
  dod)    exit \${FAKE_GATE_DOD_EXIT:-0} ;;
  commit)
    # Opt-in: existing callers of this fixture never set FAKE_GATE_COMMITS, and their tests
    # never look at HEAD, so leaving the tree uncommitted stays their behaviour untouched.
    if [ -n "$FAKE_GATE_COMMITS" ]; then
      git add -A >/dev/null 2>&1
      subject="$FAKE_GATE_COMMIT_MSG"
      if [ -z "$subject" ] && [ -n "$FAKE_GATE_COMMIT_FROM_PLAN" ]; then
        subject=$(sed -n "/^### Iteration $3 /,/^### Iteration [0-9]* /p" "$2" | sed -n 's/^commit_msg=//p' | head -1)
      fi
      git commit -qm "\${subject:-iteration $3}" >/dev/null 2>&1
    fi
    exit \${FAKE_GATE_COMMIT_EXIT:-0}
    ;;
esac
exit 2
`,
  gh: `#!/bin/sh
d=$(dirname "$0")/..
{ printf -- '--- call ---\\n'; printf '%s\\n' "$@"; } >> "$d/gh-args.txt"
case "$1 $2" in
  "repo view")
    [ "\${FAKE_GH_REPO_VIEW_EXIT:-0}" != 0 ] && exit "$FAKE_GH_REPO_VIEW_EXIT"
    if [ -n "$FAKE_GH_FORK_PARENT" ]; then
      printf '{"isFork":true,"parent":{"name":"%s","owner":{"login":"%s"}}}\\n' "\${FAKE_GH_FORK_PARENT#*/}" "\${FAKE_GH_FORK_PARENT%/*}"
    else
      printf '{"isFork":false,"parent":null}\\n'
    fi
    exit 0
    ;;
  "pr view")
    [ -n "$FAKE_GH_PR_EXISTS" ] && { printf '{"number":%s,"state":"%s","isDraft":%s}\\n' "\${FAKE_GH_PR_NUMBER:-1}" "\${FAKE_GH_PR_STATE:-OPEN}" "\${FAKE_GH_PR_DRAFT:-false}"; exit 0; }
    [ -n "$FAKE_GH_VIEW_FAILS" ] && { printf 'error connecting to api.github.com\\n' >&2; exit 1; }
    printf 'no pull requests found for branch "%s"\\n' "$3" >&2
    exit 1
    ;;
  "pr create") exit \${FAKE_GH_CREATE_EXIT:-0} ;;
  "pr edit")   exit \${FAKE_GH_EDIT_EXIT:-0} ;;
  "pr ready")  exit \${FAKE_GH_READY_EXIT:-0} ;;
esac
exit 0
`,
};

const verifiedFake = (path: string, script: string): string => {
  const entry = lstatSync(path);

  if (!entry.isFile() || entry.uid !== process.getuid?.() || (entry.mode & 0o777) !== 0o555 || readFileSync(path, 'utf8') !== script) {
    throw new Error(`${path} is not the read-only fake this harness wrote, or it changed since: delete it and rerun`);
  }

  return path;
};

export const sharedFake = (script: string): string => {
  const path = join(tmpdir(), `goal-fake-${process.getuid?.() ?? 'u'}-${createHash('sha256').update(script).digest('hex')}`);

  if (existsSync(path)) {
    return verifiedFake(path, script);
  }

  const staging = `${path}.${process.pid}`;

  rmSync(staging, { force: true });
  writeFileSync(staging, script, { flag: 'wx' });
  chmodSync(staging, 0o555);

  try {
    linkSync(staging, path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  } finally {
    rmSync(staging);
  }

  return verifiedFake(path, script);
};

let sharedOriginDir: string | undefined;

const sharedOrigin = (seed: string): string => {
  if (sharedOriginDir === undefined) {
    sharedOriginDir = join(tmpDir('goal-run-shared-origin-'), 'origin.git');
    spawnSync('git', ['init', '-q', '--bare', '-b', 'main', sharedOriginDir]);
    git(seed, 'push', '-q', sharedOriginDir, 'HEAD:main');
    writeFileSync(join(sharedOriginDir, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n');
    chmodSync(join(sharedOriginDir, 'hooks', 'pre-receive'), 0o755);
  }

  return sharedOriginDir;
};

let checkoutTemplate: string | undefined;

const initialCheckout = (): string => {
  if (checkoutTemplate === undefined) {
    const dir = tmpDir('goal-run-checkout-');

    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'run@example.com');
    git(dir, 'config', 'user.name', 'Run');
    // A detached `git maintenance --auto` after the commit below writes and removes a lock under
    // .git/objects while repo() copies this template, which surfaces as ENOENT on a random test.
    git(dir, 'config', 'maintenance.auto', 'false');
    writeFileSync(join(dir, 'README.md'), '# scratch\n');

    writeFileSync(join(dir, '.gitignore'), '.claude/\n.goal/runs/\n*.run.lock/\n*.tick.lock/\nfake-bin/\n*-args.txt\n');

    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'init');
    git(dir, 'remote', 'add', 'origin', sharedOrigin(dir));
    git(dir, 'fetch', '-q', 'origin');
    git(dir, 'remote', 'set-head', 'origin', '-a');
    checkoutTemplate = dir;
  }

  return checkoutTemplate;
};

// Both binaries the script shells out to are faked first on PATH, so a test drives the whole
// orchestration without spending a token or reaching the network. Each records its argv, which is
// how "what was handed to the implementer" is asserted rather than assumed.
//
// The fake gate mimics the real one where it matters to this suite: `check` publishes a
// plan_hash and a ticked= line on stdout (empty unless FAKE_GATE_TICKED says otherwise), `lock`
// creates the same `<plan>.run.lock` directory, `unlock` removes it. That makes the lock
// assertions, and the ticked set a caller wires from `check` through to `commit`, real rather
// than a stand-in.
export const repo = (options: FixtureOptions = {}): Fixture => {
  const dir = tmpDir('goal-run-');
  const bin = join(dir, 'fake-bin');
  const claudeLog = join(dir, 'claude-args.txt');
  const gateLog = join(dir, 'gate-args.txt');
  const ghLog = join(dir, 'gh-args.txt');

  mkdirSync(bin);

  for (const [name, script] of Object.entries(FAKE_BINARIES)) {
    symlinkSync(sharedFake(script), join(bin, name));
  }

  cpSync(initialCheckout(), dir, { recursive: true });

  const planFile = options.planFile ?? 'demo-spec.md';
  const planDir = options.trackPlan === true ? 'plans' : '.claude/plans';

  if (options.remote === true) {
    const root = tmpDir('goal-run-remote-');
    const originDir = join(root, 'acme', 'demo.git');
    mkdirSync(join(root, 'acme'), { recursive: true });
    spawnSync('git', ['init', '-q', '--bare', '-b', 'main', originDir]);
    git(dir, 'remote', 'remove', 'origin');
    git(dir, 'remote', 'add', 'origin', originDir);
    git(dir, 'push', '-q', 'origin', 'HEAD:refs/seed/main');
    git(dir, 'config', '--add', 'remote.origin.fetch', '^refs/heads/main');
    git(dir, 'config', '--add', 'remote.origin.fetch', '+refs/seed/main:refs/remotes/origin/main');
    git(dir, 'fetch', '-q', 'origin');
    git(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
  }

  if (options.noRemote === true) {
    git(dir, 'remote', 'remove', 'origin');
  }

  if (options.github !== undefined) {
    const root = tmpDir('goal-run-github-');
    const bareAt = (slug: string): string => {
      const path = join(root, slug);
      mkdirSync(join(path, '..'), { recursive: true });
      spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path]);
      git(dir, 'push', '-q', path, 'HEAD:main');

      return path;
    };

    git(dir, 'config', `url.${root}/.insteadOf`, 'https://github.com/');
    git(dir, 'remote', 'remove', 'origin');
    bareAt('acme/demo');
    git(dir, 'remote', 'add', 'origin', 'https://github.com/acme/demo');
    git(dir, 'fetch', '-q', 'origin');
    git(dir, 'remote', 'set-head', 'origin', '-a');

    const parent = options.github.parent;

    if (parent !== undefined) {
      const parentDir = bareAt('up/demo');

      if (parent === 'ahead') {
        const clone = tmpDir('goal-run-clone-');
        git(dir, 'clone', '-q', parentDir, clone);
        git(clone, 'config', 'user.email', 'ahead@example.com');
        git(clone, 'config', 'user.name', 'Ahead');
        writeFileSync(join(clone, 'ahead.txt'), 'ahead\n');
        git(clone, 'add', '-A');
        git(clone, 'commit', '-qm', 'parent commit');
        git(clone, 'push', '-q', 'origin', 'main');
      }

      if (parent !== 'no-remote') {
        git(dir, 'remote', 'add', 'upstream', 'https://github.com/up/demo');
        git(dir, 'fetch', '-q', 'upstream');
        git(dir, 'remote', 'set-head', 'upstream', '-a');
      }

      if (parent === 'unfetchable') {
        rmSync(parentDir, { recursive: true, force: true });
      }
    }
  }

  // Advances <remoteName>/<branchName> past what this checkout knows, from a second clone — the
  // shape of a branch left behind while the base it forked from kept moving.
  const advanceBase = (remoteName: string, branchName: string) => {
    const remoteDir = tmpDir('goal-run-origin-');
    git(remoteDir, 'init', '-q', '--bare', '-b', branchName);

    if (remoteName === 'origin') {
      git(dir, 'remote', 'remove', 'origin');
    }

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

    if (remoteName !== 'origin') {
      git(dir, 'fetch', '-q', remoteName);
    }
  };

  if (options.staleOrigin === true) {
    advanceBase('origin', 'main');
  }

  if (options.staleBase !== undefined) {
    advanceBase(options.staleBase.remote, options.staleBase.branch);
  }

  const branch = options.branch === null ? 'main' : (options.branch ?? 'feature/demo');

  if (branch !== 'main') {
    git(dir, 'checkout', '-qb', branch);
  }

  let planText = options.planText ?? PLAN;

  if (options.prBase !== undefined && options.prBase !== '') {
    planText = planText.replace(/^Remote:.*$/m, (line) => `${line}\nPR base: ${options.prBase}`);
  }

  mkdirSync(join(dir, planDir), { recursive: true });
  writeFileSync(join(dir, planDir, planFile), planText);

  if (options.trackPlan === true) {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'track plan');
  }

  return { dir, bin, claudeLog, gateLog, ghLog, plan: join(dir, planDir, planFile) };
};

// `undefined` in `env` deletes the default it would otherwise override — GOAL_GATE, chiefly, so
// a caller can drop back to the gate goal-run.ts resolves on its own rather than the fixture's.
export const run = (fixture: Fixture, args: string[], env: Record<string, string | undefined> = {}) => {
  const result = spawnSync('node', [RUN_NODE, ...args], {
    cwd: fixture.dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GOAL_ROOT_PATH: undefined,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GOAL_GATE: `${join(fixture.bin, 'fake-gate')}`,
      ...env,
    },
  });

  return { code: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
};

// Thrown by the process.exit() stand-in below, and by the pilot's own reporter.stop(): a pilot
// run stays inside this process, so neither can be allowed to actually end it the way a spawned
// CLI's own exit would.
class PilotExit {
  code: number;

  constructor(code: number) {
    this.code = code;
  }
}

// A recording pass-through over the one CommandRunner close(), runIteration() and publish() all
// call through: every argv a pilot run hands to git, claude or gh is logged here and still
// answered by the real adapter underneath, against the same fake binaries `run()` spawns for —
// installed and torn down around one pilot call, the double proves the seam is real without a
// second implementation of the shell to keep in sync with the real one.
const doubleCommand = (): { calls: { cmd: string; args: string[] }[]; restore: () => void } => {
  const calls: { cmd: string; args: string[] }[] = [];
  const realRun = command.run;
  const realRunBinary = command.runBinary;
  const realSpawn = command.spawn;

  command.run = (cmd, args, options) => {
    calls.push({ cmd, args });

    return realRun(cmd, args, options);
  };
  command.spawn = (cmd, args, options) => {
    calls.push({ cmd, args });

    return realSpawn(cmd, args, options);
  };
  command.runBinary = (cmd, args, options) => {
    calls.push({ cmd, args });

    return realRunBinary(cmd, args, options);
  };

  return {
    calls,
    restore: () => {
      command.run = realRun;
      command.runBinary = realRunBinary;
      command.spawn = realSpawn;
    },
  };
};

const bindClock = (bound: AbortSignal): { restore: () => void } => {
  const realSleep = clock.sleep;

  clock.sleep = async (seconds, signal) => {
    await realSleep(seconds, signal === undefined ? bound : AbortSignal.any([signal, bound]));
    bound.throwIfAborted();
  };

  return {
    restore: () => {
      clock.sleep = realSleep;
    },
  };
};

// The in-process pilot: drives goal-run.ts's own orchestration — preflight, the gate.check
// loop, the lock, runIteration() per iteration, the mid-run publish, close() — against the real
// modules, in this process, rather than spawning a second Node process to parse the whole CLI
// again. `command` is doubled for the call's own duration (see doubleCommand above); `clock` and
// `fs` are the real adapters throughout, since neither this family asks them to do anything a
// fixture's tmp tree does not already answer in microseconds. Same signature as `run()`, so a
// caller reads its {code, output} the same way regardless of which channel it took.
export const runInProcess = async (
  fixture: Fixture,
  args: string[],
  env: Record<string, string | undefined> = {},
  agents: AgentSessions = claudeAgentSessions(),
  signal?: AbortSignal,
): Promise<{ code: number; output: string }> => {
  const [plan, iterationArg] = args;
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;
  const originalExit = process.exit;
  const touched = Object.entries({ GOAL_ROOT_PATH: undefined, ...env });
  const saved = new Map(touched.map(([key]) => [key, process.env[key]]));

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  for (const [key, value] of touched) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  let output = '';
  let jsonl = '';
  let sessionPath = '';
  const emit = (event: string, fields: Record<string, unknown>): void => {
    if (jsonl !== '') {
      appendFileSync(jsonl, `${JSON.stringify({ v: 1, ts: new Date().toISOString(), event, ...fields })}\n`);
    }
  };
  const reporter: Reporter = {
    say: (message) => {
      output += `${message}\n`;
      emit('say', { message });
    },
    record: (text) => {
      if (text.trim() !== '') {
        output += `${text}\n`;
        emit('record', { payload: text });
      }
    },
    stop: (message, code) => {
      output += `STOP ${message}\n`;
      emit('stop', { message: `STOP ${message}`, exit: code });
      throw new PilotExit(code);
    },
    setLog: (dir) => {
      jsonl = join(dir, '.run.jsonl');
      sessionPath = join(dir, '.run.session');
    },
    session: (id) => {
      if (sessionPath !== '') {
        appendFileSync(sessionPath, `${id}\n`);
        emit('session', { payload: id });
      }
    },
  };

  process.exit = (code?: number) => {
    throw new PilotExit(code ?? 0);
  };

  const gateLabel = env.GOAL_GATE ?? join(fixture.bin, 'fake-gate');
  const gate = spawnGateAdapter(gateLabel);
  const double = doubleCommand();
  const clockBinding = signal === undefined ? undefined : bindClock(signal);
  let lock: ReturnType<typeof createLock> | undefined;

  try {
    if (!fs.exists(plan!) || !fs.isFile(plan!)) {
      reporter.stop(`the plan is not readable: ${plan}`, REFUSED);
    }

    if (iterationArg !== undefined && !/^[0-9]+$/.test(iterationArg)) {
      reporter.stop(`the iteration must be a number, got: ${iterationArg}`, REFUSED);
    }

    const artifacts = resolveArtifacts(process.cwd(), process.env);

    if (!artifacts.ok) reporter.stop(artifacts.error, REFUSED);

    const dir = runDir(artifacts.value.runs, workIdOf(plan!, fs.readFile(plan!)));
    reporter.setLog(dir);
    reporter.say(`RUN writing this run's records to ${dir}`);

    const source = fs.readFile(plan!);

    if (iterationArg !== undefined && iterationNumbers(source, true).includes(iterationArg)) {
      reporter.stop(`iteration ${iterationArg} is already ticked in ${plan}, so nothing was attempted`, REFUSED);
    }

    const preflightStart = Date.now();
    const { policy, remote } = preflight(plan!, source, reporter, gateLabel, agents, artifacts.value.runs);
    reporter.say(`RUN stage=preflight duration_ms=${Date.now() - preflightStart} exit=0`);

    const iterations = iterationArg !== undefined ? [iterationArg] : iterationNumbers(source, false);

    const publisher = createPublisher(plan!, source, policy, remote, reporter, gate);
    const closing = iterations.length === 0;

    if (closing && publisher.isComplete()) {
      reporter.stop(`no unchecked iteration remains in ${plan}`, LANDED);
    }

    const hashes = new Map<string, string>();
    const tickedSets = new Map<string, string>();

    const checking = closing ? iterationNumbers(source, true).slice(-1) : iterations;
    const lastIteration = checking[checking.length - 1]!;

    for (const n of checking) {
      const checked = gate.check(plan!, n);
      const checkedOutput = `${checked.stdout}${checked.stderr}`;

      if (checked.status !== 0) {
        reporter.say(`STOP the gate will not run iteration ${n}, so nothing was attempted:`);
        reporter.say(checkedOutput);
        process.exit(REFUSED);
      }

      const hash = /^plan_hash=([0-9a-f]*)$/m.exec(checkedOutput)?.[1];

      if (hash === undefined || hash === '') {
        reporter.say(`STOP the gate published no plan_hash for iteration ${n}, so nothing locks the contract:`);
        reporter.say(checkedOutput);
        process.exit(REFUSED);
      }

      hashes.set(n, hash);

      const ticked = /^ticked=(.*)$/m.exec(checkedOutput)?.[1];

      if (ticked !== undefined) {
        tickedSets.set(n, ticked);
      }
    }

    lock = createLock(gate, plan!);

    if (!lock.acquire()) {
      reporter.stop(`another run holds this plan. Wait for it, or free it with: ${gateLabel} unlock ${plan}`, REFUSED);
    }

    if (!closing && publisher.state.publishes && iterationNumbers(source, true).length > 0) {
      const refusal = publisher.publish();

      if (refusal !== undefined) {
        reporter.stop(pauseLine(refusal, publisher.state.landed, publisher.state.onRemote), PAUSED);
      }
    }
    const landed: string[] = [];
    const noted = new Set<string>();

    for (const n of iterations) {
      await runIteration(plan!, source, n, hashes.get(n)!, tickedSets.get(n) ?? '', gate, agents, dir, reporter, publisher, noted);
      landed.push(n);

      if (n !== iterations[iterations.length - 1]) {
        const pushStart = Date.now();
        const refusal = publisher.publish(n);
        reporter.say(`RUN stage=push duration_ms=${Date.now() - pushStart} exit=${refusal === undefined ? 0 : 1}`);

        if (refusal !== undefined) {
          reporter.stop(pauseLine(refusal, publisher.state.landed, publisher.state.onRemote), PAUSED);
        }
      }
    }

    const exitCode = await close(plan!, gate, hashes.get(lastIteration)!, remote, publisher, landed, dir, reporter, agents);

    if (exitCode === LANDED) {
      reporter.say(
        closing
          ? `STOP every iteration was already ticked, the close ran.${remoteNote(publisher)}`
          : `STOP ${iterations.length} iteration(s) landed, gate-verified.${remoteNote(publisher)}`,
      );
    }

    return { code: exitCode, output };
  } catch (error) {
    if (error instanceof PilotExit) {
      return { code: error.code, output };
    }

    throw error;
  } finally {
    lock?.release();
    double.restore();
    clockBinding?.restore();
    process.exit = originalExit;
    process.chdir(originalCwd);
    process.env.PATH = originalPath;

    for (const [key] of touched) {
      const value = saved.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

export const lockOf = (fixture: Fixture) => `${fixture.plan}.run.lock`;

export { REFUSED, workIdOf };

export const runDirOf = (fixture: Fixture): string => {
  const root = join(fixture.dir, '.goal', 'runs', workIdOf(fixture.plan, fs.readFile(fixture.plan)));
  const [runId] = readdirSync(root);

  return join(root, runId!);
};

export const logOf = (fixture: Fixture) => join(runDirOf(fixture), '.run.log');

export const jsonlOf = (fixture: Fixture) => join(runDirOf(fixture), '.run.jsonl');

export const sessionOf = (fixture: Fixture) => join(runDirOf(fixture), '.run.session');

export type LaunchRecord = { argv: string[]; env: Record<string, string>; ulimit: string };

const SHELL_MANAGED = new Set(['_', 'SHLVL', 'PWD', 'OLDPWD', 'FAKE_CLAUDE_ULIMIT']);

// One record per fake `claude` call, the env reduced to what the runner added or changed against
// the baseline the test handed the run.
export const launchesOf = (log: string, baseline: Record<string, string | undefined>): LaunchRecord[] =>
  readFileSync(log, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const raw = JSON.parse(line) as LaunchRecord;
      const env: Record<string, string> = {};

      for (const key of Object.keys(raw.env).sort()) {
        if (!SHELL_MANAGED.has(key) && raw.env[key] !== baseline[key]) {
          env[key] = raw.env[key]!;
        }
      }

      return { argv: raw.argv, env, ulimit: raw.ulimit };
    });
