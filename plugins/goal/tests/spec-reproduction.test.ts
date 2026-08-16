import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const skill = () =>
  readFileSync(join(import.meta.dirname, '..', 'skills', 'spec', 'SKILL.md'), 'utf8');

// rule: R3 — la reproduction precede le grill et est ecrite dans le contrat
test('the problem is reproduced in Phase 1, before the Phase 3 grill, and the contract carries a Reproduction block', () => {
  const doc = skill();

  const phase1 = doc.slice(doc.indexOf('## Phase 1'), doc.indexOf('## Phase 2'));
  assert.match(
    phase1,
    /### Reproduce the problem[\s\S]*Record each command run and the value it produced/,
    phase1,
  );

  const phase4 = doc.slice(doc.indexOf('## Phase 4'), doc.indexOf('## Phase 5'));
  const reproductionIdx = phase4.indexOf('## Reproduction');
  const scopeInIdx = phase4.indexOf('## Scope IN');
  assert.ok(reproductionIdx > -1, phase4);
  assert.ok(reproductionIdx < scopeInIdx, phase4);
  assert.match(phase4.slice(reproductionIdx, scopeInIdx), /commands run in Phase 1/, phase4);
});

// rule: R4 — le STOP sur non-reproduction
test('Phase 2 stops the session, and writes no contract, when the problem does not reproduce', () => {
  const doc = skill();
  const phase2 = doc.slice(doc.indexOf('## Phase 2'), doc.indexOf('## Phase 3'));

  assert.match(
    phase2,
    /Problem does not reproduce.{0,400}STOP\. Say what changed since the source was written, and do not write a contract/s,
    phase2,
  );
});

// rule: R5 — la ligne bloquante du tableau de phase 2
test('the non-reproducing-problem row of the Phase 2 table is a blocker, not a warning', () => {
  const doc = skill();
  const phase2 = doc.slice(doc.indexOf('## Phase 2'), doc.indexOf('## Phase 3'));

  assert.match(
    phase2,
    /\| \*\*Problem does not reproduce\*\*.*\| ❌ blocker \|/,
    phase2,
  );
});
