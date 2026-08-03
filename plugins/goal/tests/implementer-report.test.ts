import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// R1 — iteration 4 of the last plan watched two bash assertions fail, reasoned them away as an
// established pattern that did not exist, and reported "gate1/gate2/gate3 all pass". The
// implementer's brief must say plainly that a check it ran and saw fail belongs in the report
// even when it sits outside its own gate, and even when it believes the failure predates its
// work.
test("the implementer's brief requires it to report a failing check outside its own gate", () => {
  const implementer = readFileSync(
    join(import.meta.dirname, '..', 'agents', 'goal-run-implementer.md'),
    'utf8',
  );

  assert.match(implementer, /outside (its|your) (own )?gate/i, implementer);
  assert.match(implementer, /predates (its|your) work/i, implementer);
});

// R1 — the rule must sit in the report section, next to the instruction to report honestly,
// not floating disconnected from the behaviour it governs.
test('the rule is load-bearing inside the report section, not a stray sentence', () => {
  const implementer = readFileSync(
    join(import.meta.dirname, '..', 'agents', 'goal-run-implementer.md'),
    'utf8',
  );

  const reportSection = implementer.slice(implementer.indexOf('## Your report is advisory'));
  assert.match(reportSection, /outside (its|your) (own )?gate/i, reportSection);
});
