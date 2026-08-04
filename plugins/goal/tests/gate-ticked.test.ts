import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';
import { repo, run } from './support/goal-run-harness.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const GATE_BLOCK = [
  'test_files=',
  'impl_files=a.txt',
  'max_diff=50',
  'commit_msg=feat: a',
  'gate1=true',
];

type Slice = { readonly ticked: boolean; readonly lines: readonly string[] };

const planWith = (slices: readonly Slice[]): string =>
  slices
    .flatMap(({ ticked, lines }, index) => [
      `### Iteration ${index + 1} — a slice`,
      `- [${ticked ? 'x' : ' '}] Not done yet`,
      '',
      '```gate',
      ...lines,
      '```',
      '',
    ])
    .join('\n');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const fixture = (slices: readonly Slice[]): { repo: string; plan: string } => {
  const dir = tmpDir('goal-gate-ticked-');
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'gate@example.com');
  git(dir, 'config', 'user.name', 'Gate');
  writeFileSync(join(dir, 'a.txt'), 'a\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');

  const plan = join(tmpDir('goal-gate-ticked-plan-'), 'spec.md');
  writeFileSync(plan, planWith(slices));

  return { repo: dir, plan };
};

const runGate = (repo: string, ...args: string[]): { code: number; output: string } => {
  const result = spawnSync('node', [GATE, ...args], { cwd: repo, encoding: 'utf8' });

  return { code: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
};

const touchDeclared = (repo: string): void => writeFileSync(join(repo, 'a.txt'), 'a2\n');

const hashOf = (repo: string, plan: string, iteration: string): string =>
  /^plan_hash=([0-9a-f]*)$/m.exec(runGate(repo, 'check', plan, iteration).output)![1]!;

// R3 — `check` publishes the plan's currently ticked iterations beside plan_hash=.
test('check publishes the ticked set beside plan_hash=', () => {
  const { repo, plan } = fixture([
    { ticked: true, lines: GATE_BLOCK },
    { ticked: true, lines: GATE_BLOCK },
    { ticked: false, lines: GATE_BLOCK },
  ]);

  const { code, output } = runGate(repo, 'check', plan, '3');

  assert.equal(code, 0, output);
  assert.match(output, /^ticked=1,2$/m);
});

test('check publishes an empty ticked set when nothing is ticked yet', () => {
  const { repo, plan } = fixture([{ ticked: false, lines: GATE_BLOCK }]);

  const { code, output } = runGate(repo, 'check', plan, '1');

  assert.equal(code, 0, output);
  assert.match(output, /^ticked=$/m);
});

// R3/R4 — `commit` refuses when the set it is handed is not a superset of what the plan
// currently ticks: an untick between check and commit must not slip past the hash, which a
// tick or untick leaves unchanged by design.
test('commit refuses when a locked iteration was unticked before the commit', () => {
  const { repo, plan } = fixture([
    { ticked: true, lines: GATE_BLOCK },
    { ticked: false, lines: GATE_BLOCK },
  ]);
  const hash = hashOf(repo, plan, '2');
  touchDeclared(repo);
  writeFileSync(plan, readFileSync(plan, 'utf8').replace('- [x]', '- [ ]'));

  const { code, output } = runGate(repo, 'commit', plan, '2', hash, '1');

  assert.equal(code, 1, output);
  assert.match(output, /ticked/i);
  assert.match(output, /Missing: 1/);
  assert.equal(git(repo, 'log', '-1', '--pretty=%s').stdout.trim(), 'init');
});

test('commit passes when the ticked set handed to it is still a subset of what the plan ticks', () => {
  const { repo, plan } = fixture([
    { ticked: true, lines: GATE_BLOCK },
    { ticked: false, lines: GATE_BLOCK },
  ]);
  const hash = hashOf(repo, plan, '2');
  touchDeclared(repo);

  const { code, output } = runGate(repo, 'commit', plan, '2', hash, '1');

  assert.equal(code, 0, output);
});

// R4 — the argument is optional: a caller carrying no ticked set (the frozen bash runner) gets
// no monotonicity check at all, which is what keeps unticking to replay an iteration working
// between runs.
test('commit is unaffected by an untick when it is handed no ticked set', () => {
  const { repo, plan } = fixture([
    { ticked: true, lines: GATE_BLOCK },
    { ticked: false, lines: GATE_BLOCK },
  ]);
  const hash = hashOf(repo, plan, '2');
  touchDeclared(repo);
  writeFileSync(plan, readFileSync(plan, 'utf8').replace('- [x]', '- [ ]'));

  const { code, output } = runGate(repo, 'commit', plan, '2', hash);

  assert.equal(code, 0, output);
});

// The ticked set travels by argument only. It used to fall back to GOAL_RUN_TICKED, and a
// declared command that spawns gates of its own — the suite does — read the outer run's lock as
// its own: three tests red on the first run that ever locked with a non-empty set (2026-08-04).
test('commit ignores a ticked set parked in the environment', () => {
  const { repo, plan } = fixture([
    { ticked: true, lines: GATE_BLOCK },
    { ticked: false, lines: GATE_BLOCK },
  ]);
  const hash = hashOf(repo, plan, '2');
  touchDeclared(repo);
  writeFileSync(plan, readFileSync(plan, 'utf8').replace('- [x]', '- [ ]'));

  const result = spawnSync('node', [GATE, 'commit', plan, '2', hash], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GOAL_RUN_TICKED: '1' },
  });

  assert.equal(result.status ?? -1, 0, `${result.stdout}${result.stderr}`);
});

// A plan with iteration 1 already landed and iteration 2 next up, used by both runners: `claude`
// is faked to write iteration 2's declared file, then untick iteration 1's box — the plan lives
// in a gitignored directory, so rewriting it never shows up as a scope leak.
const RUN_PLAN_TWO = `# Spec: demo

Policy: commit
Remote: origin

### Iteration 1 — first
- [x] Landed
- **Goal:** already shipped

\`\`\`gate
test_files=
impl_files=a.txt
max_diff=50
commit_msg=feat: a
gate1=true
\`\`\`

### Iteration 2 — second
- [ ] Not done yet
- **Goal:** write b.txt

\`\`\`gate
test_files=
impl_files=b.txt
max_diff=50
commit_msg=feat: b
gate1=true
\`\`\`

## Definition of Done

\`\`\`gate
dod1=true
\`\`\`
`;

const fakeClaude = (plan: string): string =>
  `#!/bin/sh\nprintf 'b\\n' > b.txt\nnode -e "const fs=require('node:fs');const p=process.argv[1];fs.writeFileSync(p, fs.readFileSync(p,'utf8').replace('- [x]','- [ ]'))" ${JSON.stringify(plan)}\n`;

// R3/R4 — the runner carries the ticked set the way it carries the hash: a real run refuses to
// commit an iteration once an earlier, already-landed one was unticked while it ran.
test('a run refuses to commit once an earlier landed iteration was unticked while it ran', () => {
  const fixture = repo({ planText: RUN_PLAN_TWO });
  writeFileSync(join(fixture.bin, 'claude'), fakeClaude(fixture.plan));
  chmodSync(join(fixture.bin, 'claude'), 0o755);

  const { code } = run(fixture, [fixture.plan, '2'], { GOAL_GATE: `node ${GATE}` });

  assert.notEqual(code, 0);
  assert.match(readFileSync(`${fixture.plan}.run.log`, 'utf8'), /ticked than this run locked/);
});
