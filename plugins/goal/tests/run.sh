#!/bin/bash
# Runs the goal gate suite.
#
# `node --test` exits 0 on a glob that matches nothing — verified. A barrier that
# passes on an empty suite is the exact failure this harness exists to remove, so
# this wrapper additionally requires at least one passing test and no failure.
#
# Usage: bash plugins/goal/tests/run.sh

set -uo pipefail

# This wrapper runs a glob that contains the tests which invoke it, so a nested call re-enters it
# and forks the whole harness again at every level. Measured once, on 2026-08-02: ~200 nested runs,
# 114 056 leaked fixtures, and a machine that stayed pegged through a reboot.
#
# The refusal is unconditional, and an exemption keyed on a caller-declared variable would be worse
# than none. This version runs one hardcoded glob, so a caller asking for a fixture suite is
# ignored and the real one runs anyway — which is exactly the case a `git stash` of this file, or
# the gate's own bite check, produces. Whichever commit teaches this wrapper to read a fixture root
# is the commit that may relax this, and not before.
if [ -n "${GOAL_TESTS_DEPTH:-}" ]; then
  printf 'HALT: this wrapper is already running, and it runs a glob containing the tests that invoke it. Refusing to re-enter.\n' >&2
  exit 1
fi
export GOAL_TESTS_DEPTH=1

TESTS="$(cd "$(dirname "$0")" && pwd)"
cd "$TESTS/../../.."

# The summary is parsed below, so the child must not colour it: a caller exporting FORCE_COLOR
# makes node emit `\033[34mℹ pass 79\033[39m`, the anchored sed stops matching, and this wrapper
# declares the result unknown on a green suite.
out=$(FORCE_COLOR=0 NO_COLOR=1 node --test 'plugins/goal/tests/*.test.ts' 2>&1)
rc=$?

printf '%s\n' "$out"

pass=$(printf '%s' "$out" | sed -n 's/^ℹ pass \([0-9]*\)$/\1/p' | tail -1)
fail=$(printf '%s' "$out" | sed -n 's/^ℹ fail \([0-9]*\)$/\1/p' | tail -1)

if [ "$rc" -ne 0 ]; then
  printf '\nHALT: the suite exited %s.\n' "$rc" >&2
  exit 1
fi

if [ -z "$pass" ] || [ -z "$fail" ]; then
  printf '\nHALT: the suite printed no pass/fail summary, so its result is unknown.\n' >&2
  exit 1
fi

if [ "$fail" -ne 0 ]; then
  printf '\nHALT: %s test(s) failed.\n' "$fail" >&2
  exit 1
fi

if [ "$pass" -eq 0 ]; then
  printf '\nHALT: the suite ran no test. An empty glob exits 0, which would pass on nothing.\n' >&2
  exit 1
fi

printf '\nOK: %s test(s) passed.\n' "$pass"
