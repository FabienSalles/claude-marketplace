import { test } from 'node:test';
import assert from 'node:assert/strict';

import { repo, run } from './support/goal-run-harness.ts';

// R1 — "no unchecked iteration" is ambiguous: every box ticked is a finished plan, no heading
// parsed at all is a plan the runner cannot read. Landing on the second is a green that shipped
// nothing, and it cost a real run before this refusal existed — a plan whose headings had been
// translated to `### Itération 1` exited 0 having attempted no iteration.
const FRENCH_HEADINGS = `# Spec: demo

---
Policy: commit
Remote: origin
---

### Itération 1 — la première
- [ ] Not done yet
- **Goal:** write a.txt

\`\`\`gate
test_files=t.txt
impl_files=a.txt
max_diff=50
commit_msg=feat: a
gate1=true
\`\`\`
`;

const ALL_TICKED = `# Spec: demo

---
Policy: commit
Remote: origin
---

### Iteration 1 — the first one
- [x] Not done yet
- **Goal:** write a.txt

\`\`\`gate
test_files=t.txt
impl_files=a.txt
max_diff=50
commit_msg=feat: a
gate1=true
\`\`\`
`;

const NO_HEADING = `# Spec: demo

---
Policy: commit
Remote: origin
---

Nothing here declares an iteration.
`;

test('it refuses a plan whose iteration headings it cannot read', () => {
  const fixture = repo({ planText: FRENCH_HEADINGS });

  const { code, output } = run(fixture, [fixture.plan]);

  assert.equal(code, 2, output);
  assert.match(output, /no iteration this runner can read/i, output);
});

test('it shows the heading it found, so the developer sees what to fix', () => {
  const fixture = repo({ planText: FRENCH_HEADINGS });

  const { output } = run(fixture, [fixture.plan]);

  assert.match(output, /### Itération 1 — la première/, output);
  assert.match(output, /### Iteration <n>/, output);
});

test('it still lands a plan whose every box is ticked', () => {
  const fixture = repo({ planText: ALL_TICKED });

  const { code, output } = run(fixture, [fixture.plan]);

  assert.equal(code, 0, output);
  assert.match(output, /no unchecked iteration remains/i, output);
});

test('it refuses a plan carrying no heading at all, and says so', () => {
  const fixture = repo({ planText: NO_HEADING });

  const { code, output } = run(fixture, [fixture.plan]);

  assert.equal(code, 2, output);
  assert.match(output, /no `### ` heading at all/i, output);
});
