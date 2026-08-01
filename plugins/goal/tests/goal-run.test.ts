import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const RUN = resolve(import.meta.dirname, '..', 'scripts', 'goal-run.sh');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const HASH = 'a'.repeat(64);

const PLAN = `# Spec: demo

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

// Both binaries the script shells out to are faked first on PATH, so a test drives the whole
// orchestration without spending a token or reaching the network. Each records its argv, which is
// how "what was handed to the implementer" is asserted rather than assumed.
//
// The fake gate mimics the real one where it matters to this iteration: `check` publishes a
// plan_hash on stdout, `lock` creates the same `<plan>.run.lock` directory, `unlock` removes it.
// That makes the lock assertions real rather than a stand-in.
const repo = () => {
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

  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'run@example.com');
  git(dir, 'config', 'user.name', 'Run');
  writeFileSync(join(dir, 'README.md'), '# scratch\n');

  // The plan's directory is gitignored, which the real preflight requires and this fixture has
  // to honour: visible to git, the spec and the run's own log show up in `git status`, the tree
  // is never clean, and "the implementer wrote nothing" could never be observed.
  writeFileSync(join(dir, '.gitignore'), '.claude/\nfake-bin/\n*-args.txt\n');

  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');

  mkdirSync(join(dir, '.claude', 'plans'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'plans', 'demo-spec.md'), PLAN);

  return { dir, bin, claudeLog, gateLog, plan: join(dir, '.claude', 'plans', 'demo-spec.md') };
};

const run = (
  fixture: ReturnType<typeof repo>,
  args: string[],
  env: Record<string, string> = {},
) => {
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

const lockOf = (fixture: ReturnType<typeof repo>) => `${fixture.plan}.run.lock`;

// R4 — the plan lives in a gitignored directory outside the run's tree, and handing its path to
// the implementer is what made a real run write its whole iteration into another checkout. The
// section travels as text; the path does not travel at all.
test('it hands the implementer the iteration section, and never the plan path', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /write a\.txt/, `the section was not handed over:\n${args}`);
  assert.ok(!args.includes(fixture.plan), `the plan path reached the implementer:\n${args}`);
});

// R4 — the implementer is pinned to its own agent, in a mode that never stops to ask: nobody is
// watching, and a permission prompt nobody answers is a run that looks alive and advances nothing.
test('it pins the implementer to its own agent, in a mode that never prompts', () => {
  const fixture = repo();

  run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^--agent$/m);
  assert.match(args, /^goal:goal-run-implementer$/m);
  assert.match(args, /^--permission-mode$/m);
  assert.match(args, /^auto$/m);
});

// R2 — the hash is published by `check` and carried to `commit`. Recomputing it there would bless
// a plan that moved between the two calls, which is the one thing the hash exists to catch.
test('it carries the hash check published into the commit call', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.match(readFileSync(fixture.gateLog, 'utf8'), new RegExp(`^${HASH}$`, 'm'));
});

// R6 — an implementer that wrote nothing is not the same event as work the gate rejected, and
// reporting it as a refusal tells someone asleep their work was judged when it never existed.
test('an implementer that wrote nothing is reported as such, and no verdict is asked for', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /wrote nothing/i, output);
  assert.ok(!readFileSync(fixture.gateLog, 'utf8').includes('commit'), 'the gate was asked to commit nothing');
});

// R6 / hole H2 — an implementer that commits also leaves a clean tree, so a check reading only
// `git status` calls it "wrote nothing" about work that is right there in HEAD. Comparing HEAD
// before and after is what tells the two apart.
test('an implementer that committed is not mistaken for one that wrote nothing', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_COMMITS: '1',
  });

  assert.notEqual(code, 0);
  assert.match(output, /committed/i, output);
  assert.ok(!/wrote nothing/i.test(output), `the diagnosis is wrong:\n${output}`);
});

// R7 — the gate exits 0 for a pass and 1 for a halt. Anything else means it never really ran, and
// calling that a refusal reports a verdict that was never reached.
test('a gate that could not run is not reported as a refusal', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '2',
  });

  assert.notEqual(code, 0);
  assert.match(output, /could not be run/i, output);
  assert.ok(!/refus/i.test(output), `a non-verdict was reported as a refusal:\n${output}`);
});

test('a gate that refuses the work halts the run and says so', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '1',
  });

  assert.notEqual(code, 0);
  assert.match(output, /refused/i, output);
});

// R1 — the lock is the gate's, and a run that keeps it after dying blocks every later launch on
// a plan nobody is working on. Documented recovery is prose; a trap is a mechanism.
test('it releases the lock on the way out, whatever the outcome', () => {
  for (const [claim, env] of [
    ['the iteration lands', { FAKE_CLAUDE_WRITES: 'a.txt' }],
    ['the gate refuses', { FAKE_CLAUDE_WRITES: 'a.txt', FAKE_GATE_COMMIT_EXIT: '1' }],
    ['the implementer wrote nothing', {}],
  ] as const) {
    const fixture = repo();

    run(fixture, [fixture.plan, '1'], { ...env, ...(env.FAKE_CLAUDE_WRITES ? { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') } : {}) });

    assert.ok(!existsSync(lockOf(fixture)), `the lock survived when ${claim}`);
  }
});

// A crash is not an exit path anyone writes, which is exactly why it is the one that leaked the
// lock on a real run. SIGTERM is what Orca sends when the developer stops a run.
test('it releases the lock when the run is killed mid-implementation', () => {
  const fixture = repo();

  spawnSync(
    'bash',
    ['-c', `"${RUN}" "${fixture.plan}" 1 & pid=$!; sleep 1; kill -TERM $pid; wait $pid`],
    {
      cwd: fixture.dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        GOAL_GATE: join(fixture.bin, 'fake-gate'),
        FAKE_CLAUDE_SLEEPS: '10',
      },
    },
  );

  assert.ok(!existsSync(lockOf(fixture)), 'the lock survived a killed run');
});

// R17 — a run that says nothing is indistinguishable from one that jammed, which is the whole
// reason the developer ends up watching it. Every line declares which of the three it is.
test('every log line says whether the run is advancing or stopped', () => {
  const fixture = repo();

  const { output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  const lines = output.split('\n').filter((line) => line.trim() !== '');

  assert.ok(lines.length > 0, 'the run said nothing at all');

  for (const line of lines) {
    assert.match(line, /^(RUN|WAIT|STOP) /, `a line declares no state:\n${line}`);
  }

  assert.match(output, /^STOP /m, 'the run never said it was over');
});

test('it writes the same account to a log file beside the plan', () => {
  const fixture = repo();

  run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  const log = `${fixture.plan}.run.log`;
  assert.ok(existsSync(log), 'no log file was written');
  assert.match(readFileSync(log, 'utf8'), /^STOP /m);
});

for (const [claim, args] of [
  ['no plan is named', [] as string[]],
  ['the iteration is not a number', ['.claude/plans/demo-spec.md', 'one']],
] as const) {
  test(`it refuses when ${claim}`, () => {
    const fixture = repo();

    const { code } = run(fixture, [...args]);

    assert.notEqual(code, 0);
    assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
  });
}

// R3 — with no iteration named, the plan's unchecked boxes are surveyed and run in order: the
// same reading the gate uses, an `### Iteration N` heading then the first checkbox in its
// section.
test('it surveys the unchecked iterations and runs them in order when no iteration is named', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /write a\.txt/, `iteration 1's section was not handed over:\n${args}`);
  assert.match(args, /write b\.txt/, `iteration 2's section was not handed over:\n${args}`);
  assert.ok(
    args.indexOf('write a.txt') < args.indexOf('write b.txt'),
    `the iterations did not run in order:\n${args}`,
  );
});

// R5 — every unchecked iteration is proven runnable before any of them is implemented, so a
// plan that would fail on its second iteration never spends the first.
test('it proves every unchecked iteration runnable before implementing any', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_GATE_CHECK_FAIL_N: '2',
  });

  assert.notEqual(code, 0);
  assert.ok(
    !existsSync(fixture.claudeLog),
    `iteration 1 was implemented before iteration 2 was proven runnable:\n${output}`,
  );
});

// R3 — the survey stops dead at the first gate refusal, and never attempts what follows it.
test('it stops at the first iteration the gate refuses, and never attempts the next', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_EXIT: '1',
  });

  assert.notEqual(code, 0);
  assert.match(output, /refused/i, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /write a\.txt/);
  assert.ok(!args.includes('write b.txt'), `iteration 2 was attempted after iteration 1 was refused:\n${args}`);
});

// R3 — the single-iteration form still runs exactly the one named, which is what makes a
// halted plan resumable by hand.
test('with an iteration named, only that one runs', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '2'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'b.txt'),
  });

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /write b\.txt/);
  assert.ok(!args.includes('write a.txt'), `iteration 1 was attempted though only 2 was named:\n${args}`);
});

// The plan is read before the lock is taken, so a run that cannot be started leaves nothing to
// clean up — and the refusal names the tree rather than a lock the developer now has to free.
test('a plan the gate refuses to check never reaches an implementer', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_CHECK_EXIT: '1' });

  assert.notEqual(code, 0);
  assert.ok(!existsSync(fixture.claudeLog), `an implementer ran on an unrunnable iteration:\n${output}`);
  assert.ok(!existsSync(lockOf(fixture)), 'a lock was left behind by a run that never started');
});
