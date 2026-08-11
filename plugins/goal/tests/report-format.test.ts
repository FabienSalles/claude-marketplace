import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const auditor = () =>
  readFileSync(join(import.meta.dirname, '..', 'agents', 'goal-run-auditor.md'), 'utf8');
const supervise = () =>
  readFileSync(join(import.meta.dirname, '..', 'skills', 'supervise', 'SKILL.md'), 'utf8');

const DURATIONS_HEADER = '| Step | Implementer | Gate | Push |';
const ATTRIBUTION_HEADER =
  '| Stage | Model | Context peak | Total tokens | % cache read | Cost (list) |';

// R1 — the goal names the Technical section's exact shape: two tables, not the single wide one
// the auditor used to build. A report born in any other shape is rework for the supervisor that
// folds it.
test("the auditor's Technical section prescribes the two validated tables verbatim", () => {
  const doc = auditor();
  assert.match(doc, /### Technical/);
  assert.ok(doc.includes(DURATIONS_HEADER), 'missing the durations table header');
  assert.ok(doc.includes(ATTRIBUTION_HEADER), 'missing the attribution table header');
});

// R1 — the attribution table's own modifiers: a runner subtotal ahead of the advisory sessions,
// a total row, the peak shown only as a percentage, the effective window and the compaction
// count folded into one note instead of repeated cell by cell, and the cost priced at list rates
// by the writer rather than read off the transcript.
test("the auditor's attribution table carries its modifiers", () => {
  const doc = auditor();
  assert.match(doc, /Runner subtotal/);
  assert.match(doc, /list rate/i);
  assert.match(doc, /percentage only/i);
  assert.match(doc, /Effective window/);
  assert.match(doc, /0.{0,20}stated rather than left blank/);
});

// R1 — the supervise fold instructions carry the same two shapes as the auditor, so the
// supervisor's own rows (the runner subtotal, the supervising session) extend those tables
// instead of building a differently-shaped one of its own.
test('the supervise skill carries the same two table shapes as the auditor', () => {
  const doc = supervise();
  assert.ok(doc.includes(DURATIONS_HEADER), 'missing the durations table header');
  assert.ok(doc.includes(ATTRIBUTION_HEADER), 'missing the attribution table header');
  assert.match(doc, /Supervising session/);
  assert.match(doc, /Runner subtotal/);
});

// R1 — the business rule itself: the supervisor extends the tables the auditor already wrote,
// it never reshapes them into a table of its own design.
test('the supervise skill states that it extends the tables, never reshapes them', () => {
  const doc = supervise();
  assert.match(doc, /extend/i);
  assert.match(doc, /never reshape/i);
});
