import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import { git, logOf, PAUSED, repo, run, runDirOf } from './support/goal-run-harness.ts';

const COPILOT = { GOAL_RUN_IMPLEMENTER: 'copilot', FAKE_GATE_COMMITS: '1' };

const claudeAgents = (fixture: { dir: string }): string =>
  existsSync(join(fixture.dir, 'claude-args.txt')) ? readFileSync(join(fixture.dir, 'claude-args.txt'), 'utf8') : '';

const untouched = (fixture: { dir: string }): void => {
  assert.equal(existsSync(join(fixture.dir, '.goal')), false, 'a run record was written');
  assert.equal(git(fixture.dir, 'status', '--porcelain').stdout.trim(), '');
  assert.equal(existsSync(join(fixture.dir, 'copilot-args.txt')), false, 'copilot was spawned');
  assert.equal(claudeAgents(fixture), '', 'claude was spawned');
};

// R2 — the plan is the same file for either launch, and neither rewrites it.
test('the same locked plan is accepted by a Claude launch and by a Copilot launch', () => {
  const claude = repo();
  const copilot = repo();
  const before = readFileSync(claude.plan, 'utf8');

  assert.equal(before, readFileSync(copilot.plan, 'utf8'));
  assert.equal(run(claude, [claude.plan, '1'], { FAKE_GATE_COMMITS: '1', FAKE_CLAUDE_WRITES: join(claude.dir, 'a.txt') }).code, 0);
  assert.equal(run(copilot, [copilot.plan, '1'], { ...COPILOT, FAKE_COPILOT_WRITES: join(copilot.dir, 'a.txt') }).code, 0);
  assert.equal(readFileSync(claude.plan, 'utf8'), before);
  assert.equal(readFileSync(copilot.plan, 'utf8'), before);
});

// R3 — each faulty launch stops before anything runs, and no Claude run takes its place.
test('an unknown provider is refused naming the value and both accepted ones', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { GOAL_RUN_IMPLEMENTER: 'gemini' });

  assert.equal(code, 2, output);
  assert.match(output, /GOAL_RUN_IMPLEMENTER="gemini"/);
  assert.match(output, /claude or copilot/);
  untouched(fixture);
});

test('a malformed or out-of-range continuation cap is refused naming the value and the range', () => {
  for (const cap of ['abc', '51', '-1', '']) {
    const fixture = repo();
    const { code, output } = run(fixture, [fixture.plan, '1'], { GOAL_RUN_IMPLEMENTER: 'copilot', GOAL_RUN_COPILOT_CONTINUES: cap });

    assert.equal(code, 2, output);
    assert.match(output, /GOAL_RUN_COPILOT_CONTINUES/);

    if (cap !== '') {
      assert.match(output, new RegExp(`"${cap}"`));
      assert.match(output, /from 0 to 50/);
    }

    untouched(fixture);
  }
});

test('a misspelt setting name is refused naming the closest one', () => {
  for (const [typo, expected] of [['GOAL_RUN_IMPLEMENTERR', 'GOAL_RUN_IMPLEMENTER'], ['GOAL_RUN_COPILOT_CONTINUE', 'GOAL_RUN_COPILOT_CONTINUES']] as const) {
    const fixture = repo();
    const { code, output } = run(fixture, [fixture.plan, '1'], { [typo]: 'copilot' });

    assert.equal(code, 2, output);
    assert.match(output, new RegExp(`${typo} is not a known setting: did you mean ${expected}\\?`));
    untouched(fixture);
  }
});

test('the RUN settings line lists both settings', () => {
  const fixture = repo();
  const { output } = run(fixture, [fixture.plan, '1'], { ...COPILOT, GOAL_RUN_COPILOT_CONTINUES: '5', FAKE_COPILOT_WRITES: join(fixture.dir, 'a.txt') });
  const line = output.split('\n').find((text) => text.includes('RUN settings')) ?? '';

  assert.match(line, /GOAL_RUN_IMPLEMENTER=copilot \(environment\)/);
  assert.match(line, /GOAL_RUN_COPILOT_CONTINUES=5 \(environment\)/);
});

// R5, R8, R14, R15 — Copilot implements, the gate commits, the close stays on Claude, the log says so.
test('a Copilot run lands through the gate, closes on Claude and names its provider', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { ...COPILOT, FAKE_COPILOT_FIXTURE: 'autopilot-complete', FAKE_COPILOT_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.match(output, /^RUN stage=implementer duration_ms=\d+ exit=0$/m);
  assert.match(output, /^RUN implementer provider=copilot model=mai-code-1\.1-flash$/m);
  assert.doesNotMatch(output, /^RUN implementer provider=claude/m);
  assert.match(output, /iteration 1 landed, gate-verified/);
  assert.equal(git(fixture.dir, 'log', '-1', '--format=%an <%ae>').stdout.trim(), 'Run <run@example.com>');
  assert.doesNotMatch(git(fixture.dir, 'log', '-1', '--format=%B').stdout, /Co-Authored-By|Generated with/i);

  const claude = claudeAgents(fixture);

  assert.doesNotMatch(claude, /goal-run-implementer/);
  assert.match(claude, /goal-run-lens/);
  assert.match(claude, /goal-run-auditor/);
});

test('a Claude run names Claude as the implementer, on a line of its own', () => {
  const fixture = repo();
  const { output } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_COMMITS: '1', FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.match(output, /^RUN implementer provider=claude model=claude-sonnet-5$/m);
  assert.match(output, /^RUN stage=implementer duration_ms=\d+ exit=0$/m);
  assert.equal(existsSync(join(fixture.dir, 'copilot-args.txt')), false);
});

// R7 — the refusal is in the log and nothing moved but the tree.
test('a Copilot session told to commit ends with HEAD unchanged and the refusal in the log', () => {
  const fixture = repo();
  const head = git(fixture.dir, 'rev-parse', 'HEAD').stdout;
  const { code, output } = run(fixture, [fixture.plan, '1'], {
    GOAL_RUN_IMPLEMENTER: 'copilot',
    FAKE_COPILOT_COMMITS: '1',
    FAKE_COPILOT_FIXTURE: 'denied-git',
    FAKE_COPILOT_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.equal(git(fixture.dir, 'rev-parse', 'HEAD').stdout, head);
  assert.equal(git(fixture.dir, 'diff', '--cached', '--name-only').stdout.trim(), '');
  assert.match(readFileSync(logOf(fixture), 'utf8'), /refused.*git add b\.txt && git commit/);
});

// R10 — the cap is in the argv; a session that ends at it is judged on the tree, not trusted.
test('the continuation cap is handed to Copilot and an empty tree at the cap pauses the run', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { ...COPILOT, GOAL_RUN_COPILOT_CONTINUES: '9' });

  assert.equal(code, PAUSED, output);
  assert.match(readFileSync(join(fixture.dir, 'copilot-args.txt'), 'utf8'), /--max-autopilot-continues\n9\n/);
  assert.equal(git(fixture.dir, 'rev-list', '--count', 'HEAD').stdout.trim(), '1');
});

// R6, R8 — scope and judgement belong to the real gate, whoever wrote the tree.
const GATED = `# Spec: demo

---
Policy: commit
Remote: origin
---

### Iteration 1 — the first one
- [ ] Not done yet
- **Goal:** write a.txt

\`\`\`gate
test_files=
impl_files=a.txt
max_diff=50
commit_msg=feat: a
gate1=true
\`\`\`

## Definition of Done

\`\`\`gate
dod1=true
\`\`\`
`;

test('the real gate commits a Copilot iteration, and refuses an out-of-scope write',() => {
  const ok = repo({ planText: GATED });
  const landed = run(ok, [ok.plan, '1'], { GOAL_RUN_IMPLEMENTER: 'copilot', GOAL_GATE: undefined, FAKE_COPILOT_WRITES: join(ok.dir, 'a.txt') });

  assert.equal(landed.code, 0, landed.output);
  assert.equal(git(ok.dir, 'log', '-1', '--format=%s').stdout.trim(), 'feat: a');
  assert.doesNotMatch(git(ok.dir, 'log', '-1', '--format=%B').stdout, /Co-Authored-By|Generated with/i);

  const stray = repo({ planText: GATED });
  const viaCopilot = run(stray, [stray.plan, '1'], { GOAL_RUN_IMPLEMENTER: 'copilot', GOAL_GATE: undefined, FAKE_COPILOT_WRITES: join(stray.dir, 'a.txt'), FAKE_COPILOT_OUTSIDE: join(stray.dir, 'stray.txt') });

  assert.equal(viaCopilot.code, 1, viaCopilot.output);
  assert.match(viaCopilot.output, /iteration 1 was refused by the gate/);
  assert.equal(git(stray.dir, 'rev-list', '--count', 'HEAD').stdout.trim(), '1');
});

const ALL = { GOAL_RUN_PROVIDER: 'copilot', FAKE_GATE_COMMITS: '1', GOAL_RUN_QUOTA_SLEEP: '0' };

const copilotArgs = (fixture: { dir: string }): string => readFileSync(join(fixture.dir, 'copilot-args.txt'), 'utf8');

// R2, R7 — the implementer, the lens and the auditor run on Copilot; only the reviewer is left on Claude.
test('GOAL_RUN_PROVIDER=copilot launches the implementer, the lens and the auditor through Copilot and names each provider', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { ...ALL, FAKE_COPILOT_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.match(output, /^RUN implementer provider=copilot/m);
  assert.match(output, /^RUN lens on copilot$/m);
  assert.match(output, /^RUN auditor on copilot$/m);
  assert.match(copilotArgs(fixture), /Refute the iteration/);
  assert.match(copilotArgs(fixture), /Audit the run that just ended/);
  assert.match(copilotArgs(fixture), new RegExp(`write\\(${realpathSync(runDirOf(fixture))}/report\\.md\\)`));
  assert.doesNotMatch(claudeAgents(fixture), /goal-run-(implementer|lens|auditor)/);
});

// R7 — a Claude close names Claude.
test('a Claude close names claude beside each stage', () => {
  const fixture = repo();
  const { output } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_COMMITS: '1', FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.match(output, /^RUN lens on claude$/m);
  assert.match(output, /^RUN auditor on claude$/m);
});

// R3 — the implementer override reaches the implementer alone.
test('GOAL_RUN_IMPLEMENTER=claude under GOAL_RUN_PROVIDER=copilot keeps Claude as implementer and Copilot for the close', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], { ...ALL, GOAL_RUN_IMPLEMENTER: 'claude', FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.match(output, /^RUN implementer provider=claude/m);
  assert.match(output, /^RUN lens on copilot$/m);
  assert.match(claudeAgents(fixture), /goal-run-implementer/);
  assert.doesNotMatch(claudeAgents(fixture), /goal-run-(lens|auditor)/);
  assert.match(copilotArgs(fixture), /Refute the iteration/);
});

// R15 — a Claude implementer sleeps whatever the close uses.
test('a Claude implementer still sleeps on an exhausted quota when the close is on Copilot', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], {
    ...ALL,
    GOAL_RUN_IMPLEMENTER: 'claude',
    FAKE_CLAUDE_QUOTA_UNTIL: '1',
    FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.match(output, /the implementer looks quota-exhausted, sleeping 0s/);
  assert.doesNotMatch(output, /Copilot quota/);
});

// R16 — the Claude postmortem survives the composite.
test('a failing Claude implementer leaves its postmortem in a mixed run', () => {
  const failing = { FAKE_GATE_COMMITS: '1', FAKE_CLAUDE_FINAL_ERROR: 'API Error: Unable to connect to API (ECONNRESET)', FAKE_CLAUDE_EXIT: '1' };
  const alone = repo();
  const mixed = repo();
  const postmortems = (output: string): string[] => output.split('\n').filter((line) => line.startsWith('RUN postmortem:')).map((line) => line.replace(/output saved to .*/, ''));
  const expected = postmortems(run(alone, [alone.plan, '1'], failing).output);
  const { output } = run(mixed, [mixed.plan, '1'], { ...failing, GOAL_RUN_PROVIDER: 'copilot', GOAL_RUN_IMPLEMENTER: 'claude' });

  assert.ok(expected.length > 0);
  assert.deepEqual(postmortems(output), expected);
});

// R14 — a failing Copilot close session changes nothing about the outcome.
test('a lens that ends exhausted is named with its failure class and Copilot words, and the run still lands', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], {
    ...ALL,
    FAKE_COPILOT_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_COPILOT_FAIL_ON: 'Refute the iteration',
    FAKE_COPILOT_FAIL_FIXTURE: 'synthetic-exhausted',
  });

  assert.equal(code, 0, output);
  assert.match(output, /^RUN lens failed \(exhausted\): You have exhausted your premium request quota/m);
  assert.equal(Number(readFileSync(join(fixture.dir, 'fake-bin', 'copilot-calls'), 'utf8')), 3);
  assert.doesNotMatch(output, /sleeping|backing off/);
});

test('an auditor that crashes leaves the exit code the gate made it', () => {
  const fixture = repo();
  const { code, output } = run(fixture, [fixture.plan, '1'], {
    ...ALL,
    FAKE_COPILOT_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_COPILOT_FAIL_ON: 'Audit the run',
    FAKE_COPILOT_FAIL_FIXTURE: 'synthetic-unrecognised',
  });

  assert.equal(code, 0, output);
  assert.match(output, /^RUN auditor failed \(unrecognised\): The model stopped answering\./m);
});
