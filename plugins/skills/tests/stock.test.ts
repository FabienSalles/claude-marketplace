import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { computeStock } from '../src/stock.ts';

const fixture = (name: string): string => join(import.meta.dirname, 'fixtures', name);

test('R6 — computeStock counts every skill in a fixture repo', () => {
  const report = computeStock(fixture('stock-repo'));

  assert.equal(report.count, 2);
});

test('R6 — a README skill counter that diverges from the actual count is reported', () => {
  const report = computeStock(fixture('stock-repo'));
  const finding = report.findings.find((f) => f.rule === 'readme-skill-count');

  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /declares 1 skill\(s\), actual is 2/);
});

test('R6 — a "See also" pointer to a nonexistent skill is reported', () => {
  const report = computeStock(fixture('stock-repo'));
  const finding = report.findings.find((f) => f.rule === 'see-pointer-resolves');

  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /missing-skill/);
});
