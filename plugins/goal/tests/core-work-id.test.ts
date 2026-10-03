import assert from 'node:assert/strict';
import { test } from 'node:test';

import { workIdNotice, workIdOf } from '../src/core/plan.ts';
import { featureBranch } from '../src/core/preflight.ts';

const plan = '.claude/plans/renamed-spec.md';
const withHeader = '# Spec: x\n\n---\nPolicy: commit\nWork-id: issue-42\n---\n\n## Rules\n';
const withoutHeader = '# Spec: x\n\n---\nPolicy: commit\n---\n\n## Rules\n';

test('the Work-id header wins over the file name', () => {
  assert.equal(workIdOf(plan, withHeader), 'issue-42');
});

test('the file name is the fallback when the header is absent', () => {
  assert.equal(workIdOf(plan, withoutHeader), 'renamed');
});

test('a Work-id line outside the metadata block is ignored', () => {
  assert.equal(workIdOf(plan, `${withoutHeader}\nWork-id: stray\n`), 'renamed');
});

test('a branch mismatch names both the header and the file name when they disagree', () => {
  const result = featureBranch(true, 'main', 'issue-42', 'renamed');

  assert.equal(result.ok, false);
  assert.match(String(!result.ok && result.error), /Work-id header.*issue-42/);
  assert.match(String(!result.ok && result.error), /renamed/);
});

test('a branch mismatch stays terse when header and file name agree', () => {
  const result = featureBranch(true, 'main', 'renamed', 'renamed');

  assert.equal(!result.ok && result.error, 'the checkout stands on main, not feature/renamed (or feature/renamed-...)');
});

test('a Work-id header that is not a plain path segment is ignored for the file name', () => {
  for (const unsafe of ['../escape', 'a/b', 'has space', '.hidden', '..']) {
    assert.equal(workIdOf(plan, withHeader.replace('issue-42', unsafe)), 'renamed', unsafe);
  }
});

test('a plan written with CRLF line endings still has its Work-id header read', () => {
  assert.equal(workIdOf(plan, withHeader.replace(/\n/g, '\r\n')), 'issue-42');
});

test('a header that disagrees with the file name is named, whatever the branch', () => {
  assert.match(String(workIdNotice(plan, withHeader)), /Work-id header says issue-42 while its file name says renamed/);
});

test('an unusable header is named as ignored', () => {
  assert.match(String(workIdNotice(plan, withHeader.replace('issue-42', '../escape'))), /\.\.\/escape.*ignored.*renamed/);
});

test('no notice when the header is absent or agrees with the file name', () => {
  assert.equal(workIdNotice(plan, withoutHeader), undefined);
  assert.equal(workIdNotice(plan, withHeader.replace('issue-42', 'renamed')), undefined);
});
