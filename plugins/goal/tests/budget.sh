#!/bin/bash
# Enforces the suite's three declared time ceilings and its test-name fingerprint.
#
# Usage: bash plugins/goal/tests/budget.sh
# Fixture usage: GOAL_TESTS_ROOT=<dir of *.test.ts> GOAL_BUDGET_FILE=<file> GOAL_TEST_NAMES_FILE=<file> \
#   bash plugins/goal/tests/budget.sh

set -uo pipefail

TESTS="$(cd "$(dirname "$0")" && pwd)"
cd "$TESTS/../../.."

ROOT="${GOAL_TESTS_ROOT:-plugins/goal/tests}"
BUDGET_FILE="${GOAL_BUDGET_FILE:-$TESTS/budget.txt}"
NAMES_FILE="${GOAL_TEST_NAMES_FILE:-$TESTS/test-names.txt}"

for f in "$BUDGET_FILE" "$NAMES_FILE"; do
  if [ ! -f "$f" ]; then
    printf 'HALT: %s does not exist.\n' "$f" >&2
    exit 1
  fi
done

wall_ceiling=$(sed -n 's/^wall_total_ms=//p' "$BUDGET_FILE")
file_ceiling=$(sed -n 's/^longest_file_ms=//p' "$BUDGET_FILE")
test_ceiling=$(sed -n 's/^longest_test_ms=//p' "$BUDGET_FILE")

if [ -z "$wall_ceiling" ] || [ -z "$file_ceiling" ] || [ -z "$test_ceiling" ]; then
  printf 'HALT: %s is missing wall_total_ms, longest_file_ms or longest_test_ms.\n' "$BUDGET_FILE" >&2
  exit 1
fi

xml=$(mktemp)
names=$(mktemp)
trap 'rm -f "$xml" "$names" "$xml.stats"' EXIT
start=$(date +%s%N)
out=$(env -u NODE_TEST_CONTEXT FORCE_COLOR=0 NO_COLOR=1 node --test --test-reporter=junit "$ROOT"/*.test.ts 2>&1)
rc=$?
end=$(date +%s%N)
wall_total_ms=$(( (end - start) / 1000000 ))
if [ "$rc" -ne 0 ]; then
  printf 'HALT: the suite exited %s while measuring the budget.\n%s\n' "$rc" "$out" >&2
  exit 1
fi
printf '%s\n' "$out" > "$xml"

# `time`/`name`/`file` are in a fixed attribute order in node's own junit reporter; the
# name attribute is used as-is, XML entities and all, since it only ever feeds a diff.
awk -F'"' '
  /<testcase / {
    ms = ($4 + 0) * 1000
    print $2
    if (ms > maxtest) maxtest = ms
    filesum[$8] += ms
  }
  END {
    for (f in filesum) if (filesum[f] > maxfile) maxfile = filesum[f]
    printf "%.0f %.0f\n", maxtest, maxfile > "/dev/stderr"
  }
' "$xml" > "$names" 2> "$xml.stats"
read -r longest_test_ms longest_file_ms < "$xml.stats"
if [ "$wall_total_ms" -gt "$wall_ceiling" ]; then
  printf 'HALT: the suite took %sms, over the %sms wall budget declared in %s.\n' "$wall_total_ms" "$wall_ceiling" "$BUDGET_FILE" >&2
  exit 1
fi
if [ "$longest_file_ms" -gt "$file_ceiling" ]; then
  printf 'HALT: the slowest file took %sms, over the %sms longest-file budget declared in %s.\n' "$longest_file_ms" "$file_ceiling" "$BUDGET_FILE" >&2
  exit 1
fi
if [ "$longest_test_ms" -gt "$test_ceiling" ]; then
  printf 'HALT: the slowest test took %sms, over the %sms longest-test budget declared in %s.\n' "$longest_test_ms" "$test_ceiling" "$BUDGET_FILE" >&2
  exit 1
fi

sort -u "$names" -o "$names"
diff_out=$(diff "$NAMES_FILE" "$names")

if [ -n "$diff_out" ]; then
  printf 'HALT: the test-name fingerprint at %s no longer matches the suite.\n' "$NAMES_FILE" >&2

  disappeared=$(printf '%s\n' "$diff_out" | sed -n 's/^< //p')
  [ -n "$disappeared" ] && printf 'Disappeared:\n%s\n' "$disappeared" >&2

  added=$(printf '%s\n' "$diff_out" | sed -n 's/^> //p')
  [ -n "$added" ] && printf 'Added (update the fingerprint once this is reviewed):\n%s\n' "$added" >&2

  exit 1
fi

printf 'OK: wall %sms (budget %sms), longest file %sms (budget %sms), longest test %sms (budget %sms), %s test name(s) fingerprinted.\n' \
  "$wall_total_ms" "$wall_ceiling" "$longest_file_ms" "$file_ceiling" "$longest_test_ms" "$test_ceiling" "$(wc -l < "$NAMES_FILE" | tr -d ' ')"
