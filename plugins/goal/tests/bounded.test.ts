import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { bounded, ceilingFor } from '../scripts/gate/bounded.ts';

const RUN = resolve(import.meta.dirname, 'run.sh');

// Every command a plan declares, and the implementer itself, run under a process ceiling. A single
// recursion in a test wrapper cost 114 056 leaked fixtures and a machine pegged through a reboot,
// so the guard is not a convention the thing being guarded can opt out of.
//
// This suite is itself run under a ceiling when the base sweep plays `dod1`, so every assertion
// below has to hold in both contexts. Anything that reads "the prefix is always there" is false in
// the nested one, and asserting it is what let the regression below through.

test('a declared command is either prefixed with a ceiling or already under one', () => {
  assert.match(bounded('true'), /^(ulimit -u [0-9]+ \|\| exit 1\n)?true$/);
});

// The regression that took the whole suite red on 2026-08-03, 35 failures for one cause:
// `ulimit -u` lowers the hard limit as well as the soft one, so a command already running under a
// ceiling cannot set another — EPERM — and the `|| exit 1` turned every nested gate command into a
// failure. The gate is a descendant of its own bounded commands, so nesting is the normal case and
// not an edge one.
test('a ceiling already in force is not re-set', () => {
  assert.equal(ceilingFor(500, 900), '', 'a ceiling equal to the inherited one was re-set');
  assert.equal(ceilingFor(600, 900), '', 'a ceiling above the inherited one was attempted');
});

test('a ceiling that genuinely lowers the inherited limit is emitted', () => {
  assert.equal(ceilingFor(500, 10666), 'ulimit -u 900 || exit 1');
  assert.equal(ceilingFor(500, 901), 'ulimit -u 900 || exit 1', 'one process of headroom is still headroom');
});

test('nothing running under the ceiling can raise it back', () => {
  const run = spawnSync(bounded('ulimit -u 99999 2>/dev/null; ulimit -u'), { shell: true, encoding: 'utf8' });

  assert.notEqual(
    Number(run.stdout.trim()),
    99999,
    `a command raised the ceiling the gate set on it:\n${run.stdout}${run.stderr}`,
  );
});

// The prefix is joined with a newline and never `&&`, so the command still parses as its author
// wrote it — a leading `!` negation and a pipeline are both things the plans in this repository use.
test('a command keeps its own shape under the ceiling', () => {
  assert.equal(spawnSync(bounded('! false'), { shell: true }).status, 0, 'a negated failure did not pass');
  assert.equal(spawnSync(bounded('! true'), { shell: true }).status, 1, 'a negated success did not fail');
  assert.equal(
    spawnSync(bounded("printf 'a\\nb\\n' | grep -c b"), { shell: true, encoding: 'utf8' }).stdout.trim(),
    '1',
    'a pipeline lost its shape',
  );
});

test('a command that cannot be run still fails rather than escaping the ceiling', () => {
  assert.notEqual(spawnSync(bounded('exit 7'), { shell: true }).status, 0);
  assert.equal(spawnSync(bounded('exit 7'), { shell: true }).status, 7, 'the exit code was not the command own');
});

// Driven under `bounded()` on purpose: if the refusal below ever regresses, the nested call would
// run the real suite from inside the real suite, and the ceiling is what keeps that a failed fork
// rather than a frozen machine.
test('run.sh refuses to re-enter itself', () => {
  const run = spawnSync(bounded(`GOAL_TESTS_DEPTH=1 bash "${RUN}"`), { shell: true, encoding: 'utf8' });

  assert.equal(run.status, 1, `re-entry was not refused:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /Refusing to re-enter/, run.stderr);
});

// The case that made the first attempt at this guard useless. `git stash push -- run.sh`, and the
// gate's own bite check, both put the HEAD version of this file back before re-running the test that
// drives it — and that version reads no fixture root, so a caller declaring one is ignored and the
// real glob runs anyway. An exemption keyed on the caller's word opens the guard in the one case it
// exists for.
test('a caller declaring a fixture root does not earn an exemption from this version', () => {
  const run = spawnSync(bounded(`GOAL_TESTS_DEPTH=1 GOAL_TESTS_ROOT=/tmp bash "${RUN}"`), {
    shell: true,
    encoding: 'utf8',
  });

  assert.equal(run.status, 1, `a declared fixture root re-opened the guard:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /Refusing to re-enter/, run.stderr);
});
