import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const implementer = readFileSync(
  join(import.meta.dirname, '..', 'agents', 'goal-run-implementer.md'),
  'utf8',
);

// R11 — the contract must not ask to copy the ambient comment density.
test('the implementer contract does not ask to match the surrounding comment density', () => {
  assert.doesNotMatch(implementer, /comment density/i, implementer);
  assert.match(implementer, /no comment by default/i, implementer);
});

// R12 — an existing test is changed only for a reason, and the final report names it.
test('the implementer contract allows changing an existing test only for a named reason', () => {
  assert.match(implementer, /existing test/i, implementer);
  const reportSection = implementer.slice(implementer.indexOf('## Your report is advisory'));
  assert.match(reportSection, /existing test/i, reportSection);
});

// R13 — no instruction the implementer cannot follow: no bite command, RED by its own test,
// the git stash ban stays.
test('the implementer contract asks for no command it cannot form, and keeps the stash ban', () => {
  assert.doesNotMatch(implementer, /goal-gate\.ts/, implementer);
  assert.match(implementer, /running your own test/i, implementer);
  assert.match(implementer, /never `git stash`/i, implementer);
});
