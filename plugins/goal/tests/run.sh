#!/bin/bash
# Runs the goal gate suite.
#
# `node --test` exits 0 on a glob that matches nothing — verified. A barrier that
# passes on an empty suite is the exact failure this harness exists to remove, so
# this wrapper additionally requires at least one passing test, no failure, and no
# skipped test: a silent skip is how the Node runner went uncovered while the frozen
# bash one stayed green.
#
# Usage: bash plugins/goal/tests/run.sh
# Fixture usage: GOAL_TESTS_ROOT=<dir of *.test.ts> bash plugins/goal/tests/run.sh

set -uo pipefail

TESTS="$(cd "$(dirname "$0")" && pwd)"

# This wrapper runs a glob that contains the tests which invoke it, so a nested call re-enters it
# and forks the whole harness again at every level: ~200 nested runs, 114 056 leaked fixtures, once.
# The refusal stays unconditional unless GOAL_TESTS_ROOT names a root that already holds a fixture
# suite of its own — a caller with nothing there is refused exactly as before, so a `git stash` of
# this file, or the gate's own bite check, cannot reopen the real recursion by accident.
if [ -n "${GOAL_TESTS_DEPTH:-}" ]; then
  fixture=0
  for candidate in "${GOAL_TESTS_ROOT:-}"/*.test.ts; do
    if [ -e "$candidate" ]; then
      fixture=1
    fi
    break
  done

  if [ "$fixture" -eq 0 ]; then
    printf 'HALT: this wrapper is already running, and it runs a glob containing the tests that invoke it. Refusing to re-enter.\n' >&2
    exit 1
  fi
fi
export GOAL_TESTS_DEPTH=1

cd "$TESTS/../../.."

if [ -n "${GOAL_TESTS_ROOT:-}" ]; then
  GLOB="$GOAL_TESTS_ROOT/*.test.ts"
else
  GLOB='plugins/goal/tests/*.test.ts'
fi

# Iterating a list, rather than running the default once, is what turns "delete the frozen bash
# reference" into removing one entry, later, instead of rewriting this wrapper.
RUNNERS="bash node"

total_pass=0

for impl in $RUNNERS; do
  # FORCE_COLOR/NO_COLOR: a caller exporting FORCE_COLOR makes node emit `\033[34mℹ pass 79\033[39m`,
  # which the anchored sed below stops matching. NODE_TEST_CONTEXT is unset for this child alone:
  # the guard above already stops the real glob recursing, so node's own nested-run protection is
  # redundant here — and, left set, is what made an honoured fixture print no summary at all.
  out=$(env -u NODE_TEST_CONTEXT FORCE_COLOR=0 NO_COLOR=1 GOAL_RUN_IMPL="$impl" node --test "$GLOB" 2>&1)
  rc=$?

  printf '%s\n' "$out"

  pass=$(printf '%s' "$out" | sed -n 's/^ℹ pass \([0-9]*\)$/\1/p' | tail -1)
  fail=$(printf '%s' "$out" | sed -n 's/^ℹ fail \([0-9]*\)$/\1/p' | tail -1)
  skipped=$(printf '%s' "$out" | sed -n 's/^ℹ skipped \([0-9]*\)$/\1/p' | tail -1)

  if [ "$rc" -ne 0 ]; then
    printf '\nHALT: the suite exited %s under GOAL_RUN_IMPL=%s.\n' "$rc" "$impl" >&2
    exit 1
  fi

  if [ -z "$pass" ] || [ -z "$fail" ] || [ -z "$skipped" ]; then
    printf '\nHALT: the suite printed no pass/fail/skipped summary under GOAL_RUN_IMPL=%s, so its result is unknown.\n' "$impl" >&2
    exit 1
  fi

  if [ "$fail" -ne 0 ]; then
    printf '\nHALT: %s test(s) failed under GOAL_RUN_IMPL=%s.\n' "$fail" "$impl" >&2
    exit 1
  fi

  # node --test prints the reason beside each skip: `﹣ name (0ms) # <reason>`. A skip declared
  # via `{ skip: true }` or `t.skip()` with no message carries node's own default reason, the
  # literal word SKIP, indistinguishable from forgetting to declare one at all, so it is refused
  # exactly as a failure. Any other reason is a declared divergence and is let through.
  undeclared=$(printf '%s' "$out" | grep -c '^﹣ .* # SKIP$')

  if [ "$undeclared" -ne 0 ]; then
    printf '\nHALT: %s test(s) skipped under GOAL_RUN_IMPL=%s with no reason declared. A skip is an unknown result unless it says why.\n' "$undeclared" "$impl" >&2
    exit 1
  fi

  if [ "$pass" -eq 0 ]; then
    printf '\nHALT: the suite ran no test under GOAL_RUN_IMPL=%s. An empty glob exits 0, which would pass on nothing.\n' "$impl" >&2
    exit 1
  fi

  total_pass=$((total_pass + pass))
done

printf '\nOK: %s test(s) passed, across %s runner(s).\n' "$total_pass" "$(echo $RUNNERS | wc -w | tr -d ' ')"
