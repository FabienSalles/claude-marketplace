import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { DECLARED_EXCLUSION, everyTestRuns } from '../verify/coverage.ts';
import type { Check } from '../verify/ports.ts';

const NODE_MODULES = resolve(import.meta.dirname, '..', '..', 'node_modules');

let root = '';

const write = (path: string, text = 'export {};\n'): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const tsconfig = (exclude: readonly string[]): void =>
  write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: { module: 'nodenext', noEmit: true, allowImportingTsExtensions: true },
      include: ['plugins/**/*.ts', 'scripts/**/*.ts'],
      exclude: ['node_modules', ...exclude],
    }),
  );

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'verify-coverage-')));
  spawnSync('git', ['init', '-q'], { cwd: root, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
  symlinkSync(NODE_MODULES, join(root, 'node_modules'));
  write('.gitignore', 'node_modules\n');
  tsconfig([DECLARED_EXCLUSION]);
  write('scripts/tests/one.test.ts');
  write('scripts/tests/two.test.ts');
  write('plugins/demo/tests/test-hooks.sh', '#!/bin/bash\n');
  write('plugins/demo/tests/suite.test.ts');
  write('plugins/demo/src/code.ts');
  write(DECLARED_EXCLUSION);
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

const command = (name: string, words: readonly string[], runs?: readonly string[]): Check => ({
  name,
  group: 'alpha',
  requirements: [],
  command: words,
  ...(runs === undefined ? {} : { runs }),
});

const COVERING: readonly Check[] = [
  command('scripts', ['node', '--test', 'scripts/tests/*.test.ts']),
  command('hooks', ['bash', 'plugins/demo/tests/test-hooks.sh']),
  command('suite', ['node', 'budget.ts'], ['plugins/demo/tests/*.test.ts']),
];

test('a tree where every test file runs under one check and every .ts is type-checked raises no finding', () => {
  assert.deepEqual(everyTestRuns(root, COVERING), []);
});

test('a test file no check runs is named, whether a literal path, a glob or a declared run left it out', () => {
  assert.deepEqual(everyTestRuns(root, COVERING.slice(0, 2)), ['no check runs plugins/demo/tests/suite.test.ts']);
  assert.deepEqual(everyTestRuns(root, COVERING.slice(1)), ['no check runs scripts/tests/one.test.ts', 'no check runs scripts/tests/two.test.ts']);
});

test('a test file run by two checks is named with both', () => {
  const twice = [...COVERING, command('again', ['node', '--test', 'scripts/tests/two.test.ts'])];

  assert.deepEqual(everyTestRuns(root, twice), ['scripts/tests/two.test.ts runs under 2 checks: scripts, again']);
});

test('a .ts outside the type-check scope is named, the one declared exclusion aside', () => {
  write('tools/stray.ts');

  try {
    assert.deepEqual(everyTestRuns(root, COVERING), [`tools/stray.ts is outside the type-check scope; only ${DECLARED_EXCLUSION} may be`]);
  } finally {
    rmSync(join(root, 'tools'), { recursive: true, force: true });
  }
});

test('a .ts that tsconfig.json excludes by name is named all the same', () => {
  tsconfig([DECLARED_EXCLUSION, 'plugins/demo/src/code.ts']);

  try {
    assert.deepEqual(everyTestRuns(root, COVERING), [`plugins/demo/src/code.ts is outside the type-check scope; only ${DECLARED_EXCLUSION} may be`]);
  } finally {
    tsconfig([DECLARED_EXCLUSION]);
  }
});
