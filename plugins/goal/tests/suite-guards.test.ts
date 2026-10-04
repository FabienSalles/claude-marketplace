import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { bounded } from '../src/gate/bounded.ts';
import { median, offenders, parseTests, perFile } from './support/budget.ts';
import { fixedWaits } from './support/fixed-waits.ts';
import { checkFrozen, declaredTests, frozenProblems, parseFrozen } from './support/frozen.ts';
import { tmpDir } from './support/tmp.ts';

const TESTS = resolve(import.meta.dirname);
const BUDGET = resolve(TESTS, 'support', 'budget.ts');

const frozenIn = (files: Record<string, string>, frozen: string): readonly string[] => {
  const root = tmpDir('goal-suite-guards-frozen-');

  for (const [file, body] of Object.entries(files)) {
    writeFileSync(join(root, file), body);
  }

  return frozenProblems(parseFrozen(frozen), declaredTests(root));
};

const budget = (args: string, root: string): { code: number; output: string } => {
  const run = spawnSync(bounded(`node "${BUDGET}" ${args}`), {
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, GOAL_TESTS_ROOT: root },
  });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

const fixtureRoot = (body: string): string => {
  const root = tmpDir('goal-suite-guards-budget-');

  writeFileSync(join(root, 'fixture.test.ts'), body);

  return root;
};

test('the frozen names the repository carries are all declared exactly once and none is skipped', () => {
  assert.deepEqual(checkFrozen(TESTS), []);
});

test('a frozen name that no file declares is reported missing, by name', () => {
  const problems = frozenIn({ 'a.test.ts': "test('kept', () => {});" }, 'a.test.ts\tkept\na.test.ts\tlost\n');

  assert.equal(problems.length, 1);
  assert.match(problems[0] ?? '', /missing: "lost"/);
});

test('a frozen name declared in two files is reported duplicated, naming both', () => {
  const problems = frozenIn(
    { 'a.test.ts': "test('twice', () => {});", 'b.test.ts': "test('twice', () => {});" },
    'a.test.ts\ttwice\n',
  );

  assert.equal(problems.length, 1);
  assert.match(problems[0] ?? '', /duplicated: "twice".*a\.test\.ts, b\.test\.ts/);
});

test('a frozen name declared twice in one file is reported duplicated', () => {
  const problems = frozenIn({ 'a.test.ts': "test('twice', () => {});\ntest('twice', () => {});" }, 'a.test.ts\ttwice\n');

  assert.match(problems[0] ?? '', /duplicated: "twice"/);
});

test('a frozen test that is skipped, todo-d or given a skip option is reported, whatever the spelling', () => {
  const problems = frozenIn(
    {
      'a.test.ts': [
        "test.skip('one', () => {});",
        "test.todo('two');",
        "test('three', { skip: true }, () => {});",
        "test('four', { todo: 'later' }, () => {});",
      ].join('\n'),
    },
    'a.test.ts\tone\na.test.ts\ttwo\na.test.ts\tthree\na.test.ts\tfour\n',
  );

  assert.equal(problems.length, 4);
  assert.ok(problems.every((problem) => problem.startsWith('skipped:')), problems.join('\n'));
});

test('a renamed frozen test is reported missing, and its new name is not frozen', () => {
  const problems = frozenIn({ 'a.test.ts': "test('new name', () => {});" }, 'a.test.ts\told name\n');

  assert.equal(problems.length, 1);
  assert.match(problems[0] ?? '', /missing: "old name"/);
});

test('a name that merely mentions a skip in its text is not a skipped test', () => {
  const problems = frozenIn({ 'a.test.ts': "test('a skip is refused', () => {});" }, 'a.test.ts\ta skip is refused\n');

  assert.deepEqual(problems, []);
});

test('the frozen names cover all 28 frozen files and every name in them is unique', () => {
  const frozen = parseFrozen(readFileSync(join(TESTS, 'frozen-names.txt'), 'utf8'));

  assert.equal(new Set(frozen.map(({ file }) => file)).size, 28);
  assert.equal(new Set(frozen.map(({ name }) => name)).size, frozen.length);
});

test('the stopwatch reads each result line of the runner output, in milliseconds or seconds', () => {
  const timed = parseTests(['✔ fast (12.5ms)', '✔ slow (1.5s)', 'ℹ pass 2', '    ✔ nested (3ms)'].join('\n'));

  assert.deepEqual(timed, [
    { name: 'fast', seconds: 0.0125 },
    { name: 'slow', seconds: 1.5 },
  ]);
});

test('the median is the middle value, or the mean of the two middle ones', () => {
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test('a test is attributed to the file that declares it, template names included', () => {
  const files = perFile(
    [
      { name: 'one', seconds: 1 },
      { name: 'a 7 bite', seconds: 2 },
      { name: 'one more', seconds: 4 },
      { name: 'stranger', seconds: 8 },
    ],
    [
      { file: 'a.test.ts', name: 'one' },
      { file: 'a.test.ts', name: 'a ${label} bite' },
      { file: 'b.test.ts', name: 'one more' },
    ],
  );

  assert.deepEqual(files, [
    { name: 'a.test.ts', seconds: 3 },
    { name: 'b.test.ts', seconds: 4 },
    { name: '(undeclared)', seconds: 8 },
  ]);
});

test('every offender is named, and a ceiling left unset flags nothing', () => {
  const files = [{ name: 'a.test.ts', seconds: 3 }];
  const tests = [
    { name: 'slow one', seconds: 2 },
    { name: 'slow two', seconds: 5 },
    { name: 'fine', seconds: 0.1 },
  ];

  const failures = offenders(20, files, tests, { wall: 10, file: 2, test: 1 });

  assert.equal(failures.length, 4);
  assert.match(failures.join('\n'), /wall over 10s: the suite/);
  assert.match(failures.join('\n'), /file over 2s: a\.test\.ts/);
  assert.match(failures.join('\n'), /test over 1s: slow one/);
  assert.match(failures.join('\n'), /test over 1s: slow two/);
  assert.deepEqual(offenders(20, files, tests, {}), []);
});

test('the stopwatch reports wall, slowest file and slowest test of a green run, and exits 0 within its ceilings', () => {
  const root = fixtureRoot(
    "import { test } from 'node:test';\ntest('quick one', () => {});\ntest('the slow one', async () => { await new Promise((r) => setTimeout(r, 150)); });",
  );

  const { code, output } = budget('--runs 2 --wall 60 --test 30', root);

  assert.equal(code, 0, output);
  assert.match(output, /wall \(median of 2\): \d/);
  assert.match(output, /slowest file: /);
  assert.match(output, /slowest test: the slow one /);
});

test('a test over its ceiling fails the stopwatch, naming it', () => {
  const root = fixtureRoot(
    "import { test } from 'node:test';\ntest('the slow one', async () => { await new Promise((r) => setTimeout(r, 300)); });",
  );

  const { code, output } = budget('--runs 1 --test 0.1', root);

  assert.equal(code, 1, output);
  assert.match(output, /test over 0\.1s: the slow one/);
});

test('a suite over its wall ceiling fails the stopwatch', () => {
  const root = fixtureRoot("import { test } from 'node:test';\ntest('quick', () => {});");

  const { code, output } = budget('--runs 1 --wall 0.01', root);

  assert.equal(code, 1, output);
  assert.match(output, /wall over 0\.01s: the suite/);
});

test('a run that is not green is refused rather than timed', () => {
  const root = fixtureRoot("import { test } from 'node:test';\ntest('broken', () => { throw new Error('no'); });");

  const { code, output } = budget('--runs 2 --wall 600', root);

  assert.equal(code, 1, output);
  assert.match(output, /was not green/);
  assert.doesNotMatch(output, /wall \(median/);
});

test('--only measures the one file it names, and the file ceiling names it', () => {
  const { code, output } = budget('--runs 1 --only adapter-clock.test.ts --file 0.05', resolve(TESTS));

  assert.equal(code, 1, output);
  assert.match(output, /file over 0\.05s: adapter-clock\.test\.ts/);
  assert.doesNotMatch(output, /core-plan\.test\.ts/);
});

test('an unknown option is a misuse, not a measurement', () => {
  const { code, output } = budget('--bogus 1', resolve(TESTS));

  assert.equal(code, 2, output);
  assert.match(output, /unknown option --bogus/);
});

const fixedWaitsIn = (files: Record<string, string>): readonly string[] => {
  const root = tmpDir('goal-suite-guards-waits-');

  for (const [file, body] of Object.entries(files)) {
    writeFileSync(join(root, file), body);
  }

  return fixedWaits(root);
};

test('a fixed wait is flagged with its file and line, whatever the spelling', () => {
  const problems = fixedWaitsIn({
    'a.test.ts': ['const ok = 1;', "run('sleep 1; kill -TERM $pid');"].join('\n'),
    'b.test.ts': ["const gate = 'sleep 4';", 'await new Promise((r) => setTimeout(r, 5));'].join('\n'),
    'c.test.ts': 'Atomics.wait(cell, 0, 0, 10);\nclock.sleepSeconds(0.3);',
  });

  assert.deepEqual(problems, [
    'a.test.ts:2',
    'b.test.ts:1',
    'b.test.ts:2',
    'c.test.ts:1',
    'c.test.ts:2',
  ]);
});

test('the named exemptions and a wait on a computed duration are not flagged', () => {
  const wait = "run('sleep 1');\nsetTimeout(done, 1);";

  assert.deepEqual(
    fixedWaitsIn({
      'adapter-clock.test.ts': wait,
      'bounded.test.ts': wait,
      'suite-guards.test.ts': wait,
      'd.test.ts': 'clock.sleepSeconds(seconds);',
    }),
    [],
  );
});

test('a fixed wait in a support or fixtures directory is flagged with its relative path, the exempted support file apart', () => {
  const root = tmpDir('goal-suite-guards-waits-');

  mkdirSync(join(root, 'support'));
  mkdirSync(join(root, 'fixtures'));
  writeFileSync(join(root, 'support', 'await-state.ts'), 'setTimeout(done, 20);');
  writeFileSync(join(root, 'support', 'other.ts'), 'setTimeout(done, 20);');
  writeFileSync(join(root, 'fixtures', 'f.ts'), "spawn('sleep 2');");

  assert.deepEqual(fixedWaits(root), ['fixtures/f.ts:1', 'support/other.ts:1']);
});

test('no line of the goal tests matches a fixed-wait pattern outside the named exemptions', () => {
  assert.deepEqual(fixedWaits(TESTS), []);
});
