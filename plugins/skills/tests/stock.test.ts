import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { computeStock } from '../src/stock.ts';

const fixture = (name: string): string => join(import.meta.dirname, 'fixtures', name);
const repoRoot = join(import.meta.dirname, '..', '..', '..');

// R6 — --stock counts the real stock: every skill directory across every plugin.
test('R6 — computeStock counts every skill in a fixture repo', () => {
  const report = computeStock(fixture('stock-repo'));

  assert.equal(report.count, 2);
});

// R6 — --stock reports the real skill count across the whole marketplace, never fewer than the
// catalog it certifies, and stays a counter (no exit path here can fail: computeStock returns a
// plain value).
test('R6 — computeStock counts at least 103 skills across the real repo', () => {
  const report = computeStock(repoRoot);

  assert.ok(report.count >= 103, `expected >= 103 skills, got ${report.count}`);
});

// R6 — repo coherence (README skill counters) is carried by the stock report as a finding, not
// as a blocking gate: a mismatch is surfaced, computeStock itself never throws or signals fail.
test('R6 — a README skill counter that diverges from the actual count is reported', () => {
  const report = computeStock(fixture('stock-repo'));
  const finding = report.findings.find((f) => f.rule === 'readme-skill-count');

  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /declares 1 skill\(s\), actual is 2/);
});

// R6 — repo coherence also covers "See also" pointers: a pointer to a skill name that does not
// resolve is reported by the stock report.
test('R6 — a "See also" pointer to a nonexistent skill is reported', () => {
  const report = computeStock(fixture('stock-repo'));
  const finding = report.findings.find((f) => f.rule === 'see-pointer-resolves');

  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /missing-skill/);
});
