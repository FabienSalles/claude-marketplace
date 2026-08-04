import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { bounded } from '../scripts/gate/bounded.ts';
import { tmpDir } from './support/tmp.ts';

const RUN = resolve(import.meta.dirname, 'run.sh');

// Driven under `bounded()` on purpose: the fixture spawns real `node --test` processes of its own,
// and the ceiling turns a mistake in the guard into a failed fork rather than a pegged machine.
const runWith = (env: Record<string, string>): { code: number; output: string } => {
  const run = spawnSync(bounded(`bash "${RUN}"`), { shell: true, encoding: 'utf8', env: { ...process.env, ...env } });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

const fixture = (root: string, body: string): void => writeFileSync(join(root, 'fixture.test.ts'), body);

// R2 — a skipped test is an unknown result exactly as a missing summary is, so the wrapper must
// refuse it exactly as it refuses a failure rather than let it pass out of sight.
test('a fixture with one pass and one skip is refused, not silently accepted', () => {
  const root = tmpDir('goal-suite-wrapper-skip-');
  fixture(
    root,
    "import { test } from 'node:test';\ntest('a fixture test passes', () => {});\ntest('a fixture test is skipped', { skip: true }, () => {});",
  );

  const { code, output } = runWith({ GOAL_TESTS_ROOT: root });

  assert.equal(code, 1, output);
  assert.match(output, /skipped/i, output);
});

// R1 — the suite must run once per runner in the list: a fixture test that records a marker
// proves the runner actually ran by reading the record back.
test('the suite runs once per runner, recorded', () => {
  const root = tmpDir('goal-suite-wrapper-runners-');
  const record = join(tmpDir('goal-suite-wrapper-record-'), 'runners.txt');
  writeFileSync(record, '');
  fixture(
    root,
    `import { test } from 'node:test';\nimport { appendFileSync } from 'node:fs';\ntest('records its run', () => {\n  appendFileSync(${JSON.stringify(record)}, 'ran\\n');\n});`,
  );

  const { code, output } = runWith({ GOAL_TESTS_ROOT: root });

  assert.equal(code, 0, output);
  const runners = readFileSync(record, 'utf8').trim().split('\n');
  assert.deepEqual(runners, ['ran'], `the runner was not exercised:\n${output}`);
});

// The read of GOAL_TESTS_ROOT only relaxes the re-entry guard for a root that actually holds a
// fixture suite of its own — a declared root with nothing in it earns no exemption.
test('a declared root only earns an exemption when it holds a fixture', () => {
  const empty = runWith({ GOAL_TESTS_DEPTH: '1', GOAL_TESTS_ROOT: tmpDir('goal-suite-wrapper-empty-') });

  assert.equal(empty.code, 1, `an empty root re-opened the guard:\n${empty.output}`);
  assert.match(empty.output, /Refusing to re-enter/, empty.output);

  const root = tmpDir('goal-suite-wrapper-nested-');
  fixture(root, "import { test } from 'node:test';\ntest('nested fixture passes', () => {});");
  const held = runWith({ GOAL_TESTS_DEPTH: '1', GOAL_TESTS_ROOT: root });

  assert.equal(held.code, 0, `a declared fixture root was refused:\n${held.output}`);
});
