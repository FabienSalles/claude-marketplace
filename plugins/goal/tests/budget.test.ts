import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { bounded } from '../src/gate/bounded.ts';
import { tmpDir } from './support/tmp.ts';

const BUDGET = resolve(import.meta.dirname, 'budget.sh');
const LOOSE = { wall_total_ms: '100000', longest_file_ms: '100000', longest_test_ms: '100000' };

const sleeper = (name: string, ms: number): string =>
  `import { test } from 'node:test';\ntest(${JSON.stringify(name)}, async () => {\n  await new Promise((r) => setTimeout(r, ${ms}));\n});\n`;

const trivial = (name: string): string => `import { test } from 'node:test';\ntest(${JSON.stringify(name)}, () => {});\n`;

// Driven under `bounded()`, same as the suite wrapper it sits beside: the fixture spawns real
// `node --test` processes of its own.
const fixture = (files: Record<string, string>, ceilings: Record<string, string>, names: string[]): { code: number; output: string } => {
  const root = tmpDir('goal-budget-');
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, name), body);
  writeFileSync(join(root, 'budget.txt'), Object.entries(ceilings).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  writeFileSync(join(root, 'test-names.txt'), [...names].sort().join('\n') + (names.length > 0 ? '\n' : ''));

  const env = {
    GOAL_TESTS_ROOT: root,
    GOAL_BUDGET_FILE: join(root, 'budget.txt'),
    GOAL_TEST_NAMES_FILE: join(root, 'test-names.txt'),
  };
  const run = spawnSync(bounded(`bash "${BUDGET}"`), { shell: true, encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

// R1 — a suite whose total run time exceeds the declared wall budget is refused, naming the
// figure and the ceiling it broke, rather than passing silently on a slow day.
test('a wall budget lowered under any real run refuses, naming the wall figure', () => {
  const { code, output } = fixture({ 'fixture.test.ts': trivial('a trivial test') }, { ...LOOSE, wall_total_ms: '1' }, ['a trivial test']);
  assert.equal(code, 1, output);
  assert.match(output, /HALT: the suite took \d+ms, over the 1ms wall budget/, output);
});

// R2 — a single file whose own tests sum past the declared per-file budget is refused, even
// though the whole suite's wall time still fits comfortably.
test('a longest-file budget under a slow file refuses, naming the file figure', () => {
  const files = { 'slow.test.ts': sleeper('a slow test', 150), 'fast.test.ts': trivial('a fast test') };
  const { code, output } = fixture(files, { ...LOOSE, longest_file_ms: '50' }, ['a slow test', 'a fast test']);
  assert.equal(code, 1, output);
  assert.match(output, /HALT: the slowest file took \d+ms, over the 50ms longest-file budget/, output);
});

// R3 — a single test whose own duration exceeds the declared per-test budget is refused, even
// when the file holding it and the whole suite both still fit under their own budgets.
test('a longest-test budget under a slow test refuses, naming the test figure', () => {
  const { code, output } = fixture({ 'slow.test.ts': sleeper('a slow test', 150) }, { ...LOOSE, longest_test_ms: '50' }, ['a slow test']);
  assert.equal(code, 1, output);
  assert.match(output, /HALT: the slowest test took \d+ms, over the 50ms longest-test budget/, output);
});

// A fixture within every declared ceiling, and whose fingerprint matches exactly, is the tool's
// baseline: it passes, and reports the figures it measured.
test('a fixture within every ceiling and matching fingerprint passes', () => {
  const { code, output } = fixture({ 'fixture.test.ts': trivial('a trivial test') }, LOOSE, ['a trivial test']);
  assert.equal(code, 0, output);
  assert.match(output, /^OK: wall \d+ms/, output);
});

// R4 — a test name the fingerprint still carries but the suite no longer produces is a
// disappearance, and it is refused, naming exactly the test that vanished.
test('a test name missing from the suite but still in the fingerprint refuses, naming the disappearance', () => {
  const names = ['a trivial test', 'a test that no longer exists'];
  const { code, output } = fixture({ 'fixture.test.ts': trivial('a trivial test') }, LOOSE, names);
  assert.equal(code, 1, output);
  assert.match(output, /Disappeared:/, output);
  assert.match(output, /a test that no longer exists/, output);
});

// R5 — a test name the suite now produces but the fingerprint never recorded is refused too,
// under a distinct label from a disappearance, so review can tell an addition from a loss.
test('a test name new to the suite but absent from the fingerprint refuses, labeled as an addition', () => {
  const { code, output } = fixture({ 'fixture.test.ts': trivial('a brand new test') }, LOOSE, []);
  assert.equal(code, 1, output);
  assert.match(output, /Added \(update the fingerprint/, output);
  assert.match(output, /a brand new test/, output);
});
