#!/bin/bash
# Runs the goal gate suite.
#
# `node --test` exits 0 on a glob that matches nothing — verified. A barrier that
# passes on an empty suite is the exact failure this harness exists to remove, so
# this wrapper additionally requires at least one passing test and no failure.
#
# Usage: bash plugins/goal/tests/run.sh

set -uo pipefail

TESTS="$(cd "$(dirname "$0")" && pwd)"
cd "$TESTS/../../.."

out=$(node --test 'plugins/goal/tests/*.test.ts' 2>&1)
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
