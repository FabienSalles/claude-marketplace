#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Tests for scripts/validate-anchors.sh
#
# Plants each violation in a temporary copy of the tree, on the pattern
# scripts/tests/test-validate-skills.sh already uses. Never touches the
# real tree, so nothing has to be reverted.
#
# Usage: bash scripts/tests/test-validate-anchors.sh
# ─────────────────────────────────────────────

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

failures=0
cases=0

# copy_tree DEST — a clean rsync of the working tree (minus .git) into DEST
copy_tree() {
  mkdir -p "$1"
  rsync -a --exclude='.git' "$REPO_ROOT"/ "$1"/
}

# run_case NAME MUTATE_FN EXPECTED_RC [NEEDLE]
run_case() {
  local name="$1" mutate_fn="$2" expected_rc="$3" needle="${4:-}"
  cases=$((cases + 1))

  local tmp
  tmp=$(mktemp -d)
  copy_tree "$tmp"
  "$mutate_fn" "$tmp"

  local out
  out="$( cd "$tmp" && ./scripts/validate-anchors.sh plugins/goal 2>&1 )"
  local rc=$?
  rm -rf "$tmp"

  if [[ "$rc" -ne "$expected_rc" ]]; then
    echo "✗ $name (exit $rc, expected $expected_rc)"
    failures=$((failures + 1))
    return
  fi

  if [[ -n "$needle" ]] && [[ "$out" != *"$needle"* ]]; then
    echo "✗ $name (expected output naming '$needle')"
    failures=$((failures + 1))
    return
  fi

  echo "✓ $name (exit $rc, expected $expected_rc)"
}

mutate_none() {
  :
}

mutate_line_number() {
  local tmp="$1"
  local doc="$tmp/plugins/goal/docs/loops.md"
  sed -i.bak 's/(it does, once, before sleeping: `run\/iteration.ts`)/(it does, once, before sleeping: `run\/iteration.ts:71`)/' "$doc" && rm "$doc.bak"
}

mutate_renamed_source() {
  local tmp="$1"
  mv "$tmp/plugins/goal/src/plan-guard.ts" "$tmp/plugins/goal/src/plan-guard-old.ts"
}

mutate_symbol_renamed() {
  local tmp="$1"
  local src="$tmp/plugins/goal/src/gate/bounded.ts"
  sed -i.bak 's/GOAL_CMD_TIMEOUT/GOAL_COMMAND_TIMEOUT/g' "$src" && rm "$src.bak"
}

mutate_doc_deleted_reference_kept() {
  local tmp="$1"
  rm "$tmp/plugins/goal/docs/adr/0001-shape-of-the-autonomous-loop.md"
}

run_case "unmodified tree passes"                    mutate_none                        0
run_case "line-numbered anchor fails"                 mutate_line_number                 1  "line number"
run_case "renamed source fails, naming the file"      mutate_renamed_source              1  "plan-guard.ts"
run_case "renamed symbol fails, naming the symbol"    mutate_symbol_renamed              1  "GOAL_CMD_TIMEOUT"
run_case "deleted doc leaves a dangling link"         mutate_doc_deleted_reference_kept  1  "0001-shape-of-the-autonomous-loop.md"

echo ""
if [[ $failures -gt 0 ]]; then
  echo "✗ $failures/$cases case(s) failed"
  exit 1
fi
echo "✓ $cases/$cases case(s) passed"
