#!/bin/bash
# Proves gate-captures.test.ts is not vacuous. Each mutation below moves either the HALT envelope
# or the scanner's own scope — the two ways R1 names as what a capture built on a fixture blind to
# argv (`gate-ship.test.ts`'s own `#!/bin/sh\nexit 0`) could never notice. Every mutation below
# must turn `node --test gate-captures.test.ts` red on its own; if one does not, this script exits
# non-zero, naming which one, and the mutation harness is what failed, not the suite.
#
# The mutated file is always restored, pass or fail, before this script exits.
#
# Usage: bash plugins/goal/tests/support/mutate.sh   (run from the repository root, as gate1 does)

set -uo pipefail

node --input-type=module - <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const testFile = resolve('plugins/goal/tests/gate-captures.test.ts');

const mutations = [
  {
    name: 'the HALT envelope reworded (src/gate/halt.ts)',
    file: resolve('plugins/goal/src/gate/halt.ts'),
    find: '`HALT\\n\\nREASON:',
    replacement: '`HALTED\\n\\nREASON:',
  },
  {
    name: "the scanner's scope widened from git history to the working directory (src/gate/ship.ts)",
    file: resolve('plugins/goal/src/gate/ship.ts'),
    find: '`${scanner} git . --redact`',
    replacement: '`${scanner} dir . --redact`',
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
    console.error(`mutate.sh: mutation "${name}" did NOT turn gate-captures.test.ts red`);
    failed = true;
  } else {
    console.log(`mutate.sh: mutation "${name}" turned gate-captures.test.ts red, as required`);
  }
}

process.exit(failed ? 1 : 0);
NODE
