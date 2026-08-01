import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const RUN = resolve(import.meta.dirname, '..', '..', 'scripts', 'goal-run.sh');

export const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

export const HASH = 'a'.repeat(64);

export const PLAN = `# Spec: demo

Policy: commit
Remote: origin

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
};

// Both binaries the script shells out to are faked first on PATH, so a test drives the whole
// orchestration without spending a token or reaching the network. Each records its argv, which is
// how "what was handed to the implementer" is asserted rather than assumed.
//
// The fake gate mimics the real one where it matters to this suite: `check` publishes a
// plan_hash on stdout, `lock` creates the same `<plan>.run.lock` directory, `unlock` removes it.
// That makes the lock assertions real rather than a stand-in.
export const repo = (options: FixtureOptions = {}): Fixture => {
  const dir = mkdtempSync(join(tmpdir(), 'goal-run-'));
  const bin = join(dir, 'fake-bin');
  const claudeLog = join(dir, 'claude-args.txt');
  const gateLog = join(dir, 'gate-args.txt');

  mkdirSync(bin);

  writeFileSync(
    join(bin, 'claude'),
    `#!/bin/sh
printf '%s\\n' "$@" >> ${claudeLog}
[ -n "$FAKE_CLAUDE_WRITES" ] && printf 'written\\n' > "$FAKE_CLAUDE_WRITES"
[ -n "$FAKE_CLAUDE_COMMITS" ] && git add -A >/dev/null 2>&1 && git commit -qm "implementer commit"
[ -n "$FAKE_CLAUDE_SLEEPS" ] && sleep "$FAKE_CLAUDE_SLEEPS"
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
  commit) exit \${FAKE_GATE_COMMIT_EXIT:-0} ;;
esac
exit 2
`,
  );

  chmodSync(join(bin, 'claude'), 0o755);
  chmodSync(join(bin, 'fake-gate'), 0o755);

  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'run@example.com');
  git(dir, 'config', 'user.name', 'Run');
  writeFileSync(join(dir, 'README.md'), '# scratch\n');

  const planFile = options.planFile ?? 'demo-spec.md';
  const planDir = options.trackPlan ? 'plans' : '.claude/plans';

  // The plan's directory is gitignored, which the real preflight requires and this fixture has
  // to honour: visible to git, the spec and the run's own log show up in `git status`, the tree
  // is never clean, and "the implementer wrote nothing" could never be observed. `trackPlan`
  // deliberately breaks that, to exercise the check that catches it.
  writeFileSync(
    join(dir, '.gitignore'),
    options.trackPlan ? 'fake-bin/\n*-args.txt\n' : '.claude/\nfake-bin/\n*-args.txt\n',
  );

  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');

  if (options.staleOrigin) {
    const origin = mkdtempSync(join(tmpdir(), 'goal-run-origin-'));
    git(origin, 'init', '-q', '--bare', '-b', 'main');
    git(dir, 'remote', 'add', 'origin', origin);
    git(dir, 'push', '-q', 'origin', 'main');
    git(dir, 'fetch', '-q', 'origin');
    git(dir, 'remote', 'set-head', 'origin', '-a');

    // Advances origin's main past what this checkout knows, from a second clone — the shape
    // of a branch left behind while the base kept moving.
    const clone = mkdtempSync(join(tmpdir(), 'goal-run-clone-'));
    git(dir, 'clone', '-q', origin, clone);
    git(clone, 'config', 'user.email', 'ahead@example.com');
    git(clone, 'config', 'user.name', 'Ahead');
    writeFileSync(join(clone, 'ahead.txt'), 'ahead\n');
    git(clone, 'add', '-A');
    git(clone, 'commit', '-qm', 'ahead commit');
    git(clone, 'push', '-q', 'origin', 'main');
  }

  const branch = options.branch === null ? 'main' : (options.branch ?? 'feature/demo');

  if (branch !== 'main') {
    git(dir, 'checkout', '-qb', branch);
  }

  mkdirSync(join(dir, planDir), { recursive: true });
  writeFileSync(join(dir, planDir, planFile), options.planText ?? PLAN);

  if (options.trackPlan) {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'track plan');
  }

  return { dir, bin, claudeLog, gateLog, plan: join(dir, planDir, planFile) };
};

export const run = (fixture: Fixture, args: string[], env: Record<string, string> = {}) => {
  const result = spawnSync('bash', [RUN, ...args], {
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
