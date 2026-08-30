#!/bin/bash
# Proves the target test is not vacuous. Each mutation below injects, into a core/ file, exactly
# the kind of import R2 names the dependency rule as forbidding — reaching for node:fs, for
# node:child_process, or for an adapter — the ways core/ could cross its own boundary. Every
# mutation below must turn the target test red on its own; if one does not, this script exits
# non-zero, naming which one, and the mutation harness is what failed, not the suite.
#
# The mutated file is always restored, pass or fail, before this script exits.
#
# Usage: bash plugins/goal/tests/support/mutate.sh [test-file]   (run from the repository root, as gate1 does)
# test-file defaults to plugins/goal/tests/core-purity.test.ts when omitted.

set -uo pipefail

MUTATE_TARGET="${1:-plugins/goal/tests/core-purity.test.ts}" node --input-type=module - <<'NODE'
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';

const testFile = resolve(process.env.MUTATE_TARGET);
const testFileName = basename(testFile);

if (!existsSync(testFile)) {
  console.error(`mutate.sh: target test file not found: ${testFile}`);
  process.exit(1);
}

const mutations = [
  {
    name: 'a node:fs import injected into core/result.ts',
    file: resolve('plugins/goal/src/core/result.ts'),
    find: 'export type Result',
    replacement: "import { readFileSync } from 'node:fs';\n\nexport type Result",
  },
  {
    name: 'a node:child_process import injected into core/verdict.ts',
    file: resolve('plugins/goal/src/core/verdict.ts'),
    find: 'export type Halt',
    replacement: "import { spawnSync } from 'node:child_process';\n\nexport type Halt",
  },
  {
    name: 'an adapters/ import injected into core/plan.ts',
    file: resolve('plugins/goal/src/core/plan.ts'),
    find: "import { basename } from 'node:path';",
    replacement: "import { basename } from 'node:path';\nimport { readFile } from '../adapters/fs.ts';",
  },
  {
    name: 'a node:process import injected into core/preflight.ts — a builtin no observed spelling names, but the dependency rule still forbids',
    file: resolve('plugins/goal/src/core/preflight.ts'),
    find: "import { err, ok, type Result } from './result.ts';",
    replacement: "import { cwd } from 'node:process';\nimport { err, ok, type Result } from './result.ts';",
  },
];

let failed = false;
let live;

const restore = () => {
  if (live !== undefined) {
    writeFileSync(live.file, live.original);
    live = undefined;
  }
};

process.on('exit', restore);

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    restore();
    process.exit(1);
  });
}

for (const { name, file, find, replacement } of mutations) {
  const original = readFileSync(file, 'utf8');

  if (!original.includes(find)) {
    console.error(`mutate.sh: "${find}" not found in ${file} — the mutation itself no longer applies`);
    failed = true;
    continue;
  }

  live = { file, original };
  writeFileSync(file, original.replace(find, replacement));

  const result = spawnSync(process.execPath, ['--test', testFile], {
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });

  restore();

  if (result.status === 0) {
    console.error(`mutate.sh: mutation "${name}" did NOT turn ${testFileName} red`);
    failed = true;
  } else {
    console.log(`mutate.sh: mutation "${name}" turned ${testFileName} red, as required`);
  }
}

process.exit(failed ? 1 : 0);
NODE
