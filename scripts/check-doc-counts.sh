#!/usr/bin/env bash
# Recomputes every numeric claim in README.md / docs/open-questions.md from the tree,
# never from a constant written here. Usage: check-doc-counts.sh <root>  # plugins/goal

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_ARG="${1:?usage: check-doc-counts.sh <root>}"
TARGET_DIR="$REPO_ROOT/$ROOT_ARG"
README="$TARGET_DIR/README.md"
OPEN_QUESTIONS="$TARGET_DIR/docs/open-questions.md"
[[ -f "$README" ]] || { echo "✗ no such file: $ROOT_ARG/README.md"; exit 1; }
[[ -f "$OPEN_QUESTIONS" ]] || { echo "✗ no such file: $ROOT_ARG/docs/open-questions.md"; exit 1; }

errors=0
check() {
  if [[ "$2" -ne "$3" ]]; then echo "✗ $1: doc says $2, the tree has $3"; errors=$((errors + 1))
  else echo "✓ $1: $3"; fi
}

run_lines=$(cat "$TARGET_DIR"/scripts/goal-run.ts "$TARGET_DIR"/src/run/*.ts | wc -l | tr -d ' ')
run_modules=$(ls "$TARGET_DIR"/src/run/*.ts | wc -l | tr -d ' ')
gate_lines=$(cat "$TARGET_DIR"/scripts/goal-gate.ts "$TARGET_DIR"/src/gate/*.ts | wc -l | tr -d ' ')
gate_modules=$(ls "$TARGET_DIR"/src/gate/*.ts | wc -l | tr -d ' ')
total_lines=$(find "$TARGET_DIR/scripts" "$TARGET_DIR/src" -name '*.ts' -exec cat {} + | wc -l | tr -d ' ')
total_files=$(find "$TARGET_DIR/scripts" "$TARGET_DIR/src" -name '*.ts' | wc -l | tr -d ' ')
test_files=$(find "$TARGET_DIR/tests" -maxdepth 1 -name '*.test.ts' | wc -l | tr -d ' ')
test_out=$(bash "$TARGET_DIR/tests/run.sh" 2>&1)
test_count=$(echo "$test_out" | grep -oE 'OK: [0-9]+ test' | grep -oE '[0-9]+')
[[ -n "$test_count" ]] || { echo "✗ could not recompute the test count"; exit 1; }

NUM='[0-9]+(,[0-9]{3})*'

nums=($(grep -F "The runner:" "$README" | grep -oE "$NUM" | head -2 | tr -d ','))
check "README runner lines" "${nums[0]}" "$run_lines"
check "README runner modules" "${nums[1]}" "$run_modules"
nums=($(grep -F "the only committer:" "$README" | grep -oE "$NUM" | head -2 | tr -d ','))
check "README gate lines" "${nums[0]}" "$gate_lines"
check "README gate modules" "${nums[1]}" "$gate_modules"
nums=($(grep -F "tests across" "$README" | grep -oE "$NUM" | head -2 | tr -d ','))
check "README test count" "${nums[0]}" "$test_count"
check "README test files" "${nums[1]}" "$test_files"

# Same order as the sentence, joined across its wrapped lines.
nums=($(awk '/now stands at/{f=1} f{print} /passing tests\./{f=0}' "$OPEN_QUESTIONS" | tr '\n' ' ' | grep -oE "$NUM" | tr -d ','))
check "open-questions runner lines" "${nums[0]}" "$run_lines"
check "open-questions runner files" "${nums[1]}" "$((run_modules + 1))"
check "open-questions gate lines" "${nums[2]}" "$gate_lines"
check "open-questions gate files" "${nums[3]}" "$((gate_modules + 1))"
check "open-questions total lines" "${nums[4]}" "$total_lines"
check "open-questions total files" "${nums[5]}" "$total_files"
check "open-questions test files" "${nums[6]}" "$test_files"
check "open-questions test count" "${nums[7]}" "$test_count"

[[ $errors -eq 0 ]] || { echo "✗ $errors doc count error(s)"; exit 1; }
echo "✓ all doc counts match the tree"
