import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { git, logOf, PAUSED, repo, run } from './support/goal-run-harness.ts';

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
  assert.doesNotMatch(output, /provider=claude/);
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
