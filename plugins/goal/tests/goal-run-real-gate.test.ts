import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { git, logOf, repo, run } from './support/goal-run-harness.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

// Every discipline this suite otherwise proves against the fake gate, proved once more here
// against the real one, on the default path a run actually takes: `GOAL_GATE` unset, so
// goal-run.ts resolves `node goal-gate.ts` itself rather than the fixture's stand-in.
const linesFollowDiscipline = (output: string): void => {
  const lines = output.split('\n').filter((line) => line.trim() !== '');

  assert.ok(lines.length > 0, 'the run said nothing at all');

  for (const line of lines) {
    assert.match(line, /^(RUN|WAIT|STOP) /, `a line declares no state:\n${line}`);
  }
};

// A plan with iteration 1 already landed and iteration 2 next up: `claude` is faked to write
// iteration 2's declared file, then untick iteration 1's box while the run is still going —
// the plan lives in a gitignored directory, so rewriting it never shows up as a scope leak.
const TAMPER_PLAN = `# Spec: demo

---
Policy: commit
Remote: origin
---

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

const fakeClaudeThatUntics = (plan: string): string =>
  `#!/bin/sh\nprintf 'b\\n' > b.txt\nnode -e "const fs=require('node:fs');const p=process.argv[1];fs.writeFileSync(p, fs.readFileSync(p,'utf8').replace('- [x]','- [ ]'))" ${JSON.stringify(plan)}\n`;

// R3 — a locked iteration unticked mid-run is caught at commit time, and refused, through the
// gate a run resolves by default rather than one the fixture stands in for.
test('a real gate resolved with no GOAL_GATE override refuses to commit once an earlier landed iteration was unticked while the run was going', () => {
  const fixture = repo({ planText: TAMPER_PLAN });
  writeFileSync(join(fixture.bin, 'claude'), fakeClaudeThatUntics(fixture.plan));
  chmodSync(join(fixture.bin, 'claude'), 0o755);

  const { code, output } = run(fixture, [fixture.plan, '2'], { GOAL_GATE: undefined });

  assert.notEqual(code, 0, output);
  assert.match(readFileSync(logOf(fixture), 'utf8'), /ticked than this run locked/);
  linesFollowDiscipline(output);
});

const DOD_FAILS_PLAN = `# Spec: demo

---
Policy: commit
Remote: origin
---

### Iteration 1 — first
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
dod1=test ! -f a.txt
\`\`\`
`;

// R3 — the whole-branch Definition of Done is the run's own certification: every slice can gate
// green and the branch still not ship, held behind that one barrier and reported as a refusal
// rather than a silent pass. The command only turns false once the iteration below has actually
// written a.txt, so this proves the barrier's own refusal rather than the base sweep's earlier
// one. Proved here through the default gate, not the fixture's stand-in.
test('a real gate resolved with no GOAL_GATE override refuses to certify a run whose Definition of Done fails', () => {
  const fixture = repo({ planText: DOD_FAILS_PLAN });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_GATE: undefined,
  });

  assert.equal(code, 1, output);
  assert.match(output, /Definition of Done refused this run/);
  assert.equal(git(fixture.dir, 'log', '-1', '--pretty=%s').stdout.trim(), 'feat: a');
});

// R4 — `GOAL_GATE` is the one seam a run lets an external gate stand in through, at all: pinned
// here by driving that seam explicitly (the fixture's fake, rather than the default this file's
// other tests exercise) and checking the protocol still carries end to end — the ticked set
// `check` publishes reaches the `commit` call unchanged, whichever gate answers on the seam.
test('an explicit GOAL_GATE still carries the ticked set check published through to the commit it drives', () => {
  const fixture = repo();

  run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_TICKED: '3,4',
  });

  const calls = readFileSync(fixture.gateLog, 'utf8');
  const commitCall = calls.split(/^commit$/m).at(-1);

  assert.ok(commitCall, `no commit call was recorded:\n${calls}`);
  assert.match(commitCall!, /^3,4$/m, `the ticked set never reached commit:\n${calls}`);
});
