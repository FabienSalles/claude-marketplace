import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const skill = () =>
  readFileSync(join(import.meta.dirname, '..', 'skills', 'plan', 'SKILL.md'), 'utf8');

// rule: R6 — le rejeu de la reproduction et la route de faute de premisse
test('Phase 1 replays the contract Reproduction block and routes a mismatch as a premise fault', () => {
  const doc = skill();
  const phase1 = doc.slice(doc.indexOf('## Phase 1'), doc.indexOf('## Phase 2'));

  assert.match(
    phase1,
    /### Replay the contract's reproduction[\s\S]*## Reproduction/,
    phase1,
  );
  assert.match(
    phase1,
    /reproduces the recorded value.{0,200}continue in silence/s,
    phase1,
  );
  assert.match(
    phase1,
    /reproduces a different value.{0,400}premise\s+fault.{0,400}STOP/s,
    phase1,
  );
});

// rule: R7 — la commande disparue est une faute, pas un plantage
test('a vanished command is routed as a premise fault, not a crash', () => {
  const doc = skill();
  const phase1 = doc.slice(doc.indexOf('## Phase 1'), doc.indexOf('## Phase 2'));

  assert.match(
    phase1,
    /no longer exists.{0,400}premise\s+fault/s,
    phase1,
  );
});

// rule: R8 — un contrat sans bloc reste planifiable
test('a contract with no Reproduction block stays planable', () => {
  const doc = skill();
  const phase1 = doc.slice(doc.indexOf('## Phase 1'), doc.indexOf('## Phase 2'));

  assert.match(
    phase1,
    /No `## Reproduction` block.{0,300}still\s+planable/s,
    phase1,
  );
});
