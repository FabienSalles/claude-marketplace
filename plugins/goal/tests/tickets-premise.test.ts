import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const skill = () =>
  readFileSync(join(import.meta.dirname, '..', 'skills', 'tickets', 'SKILL.md'), 'utf8');

const reconcileMode = (doc: string) =>
  doc.slice(doc.indexOf('## Reconcile mode'), doc.indexOf('## Rules'));

// rule: R1 — la re-mesure a l'armement
test('reconcile mode re-measures the premise of the ticket moving ← next before arming it', () => {
  const section = reconcileMode(skill());

  assert.match(
    section,
    /re-measure the premise.{0,400}before arming/is,
    section,
  );
  assert.match(
    section,
    /moved.{0,200}requalify the ticket/is,
    section,
  );
});

// rule: R2 — un ticket ne du reliquat d'un autre porte ce que ce parent a livre
test('a ticket born from another ticket\'s leftover carries what that parent delivered and verified, not a bare percentage', () => {
  const section = reconcileMode(skill());

  assert.match(
    section,
    /born from another ticket's\s+leftover.{0,400}delivered.{0,100}verified/is,
    section,
  );
  assert.match(
    section,
    /never a bare completion percentage/is,
    section,
  );
});
