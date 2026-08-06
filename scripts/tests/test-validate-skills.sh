#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Tests for scripts/validate-skills.sh
#
# Plants each violation in a temporary copy of the tree, on the pattern
# plugins/goal/tests/ already uses. Never touches the real tree, so
# nothing has to be reverted.
#
# Usage: bash scripts/tests/test-validate-skills.sh
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

# run_case NAME MUTATE_FN EXPECTED_RC
run_case() {
  local name="$1" mutate_fn="$2" expected_rc="$3"
  cases=$((cases + 1))

  local tmp
  tmp=$(mktemp -d)
  copy_tree "$tmp"
  "$mutate_fn" "$tmp"

  ( cd "$tmp" && ./scripts/validate-skills.sh > /dev/null 2>&1 )
  local rc=$?
  rm -rf "$tmp"

  if [[ "$rc" -eq "$expected_rc" ]]; then
    echo "✓ $name (exit $rc, expected $expected_rc)"
  else
    echo "✗ $name (exit $rc, expected $expected_rc)"
    failures=$((failures + 1))
  fi
}

mutate_none() {
  :
}

mutate_frontmatter_removed() {
  local tmp="$1"
  local skill="$tmp/plugins/git/skills/git/SKILL.md"
  tail -n +2 "$skill" > "$skill.tmp" && mv "$skill.tmp" "$skill"
}

mutate_name_mismatch() {
  local tmp="$1"
  local skill="$tmp/plugins/git/skills/git/SKILL.md"
  sed -i.bak 's/^name: git$/name: not-git/' "$skill" && rm "$skill.bak"
}

mutate_name_uppercase() {
  local tmp="$1"
  local skill="$tmp/plugins/git/skills/git/SKILL.md"
  sed -i.bak 's/^name: git$/name: Git/' "$skill" && rm "$skill.bak"
}

mutate_readme_count_off() {
  local tmp="$1"
  local readme="$tmp/plugins/git/README.md"
  sed -i.bak 's/^## Skills (1)$/## Skills (999)/' "$readme" && rm "$readme.bak"
}

mutate_dead_pointer() {
  local tmp="$1"
  local skill="$tmp/plugins/git/skills/git/SKILL.md"
  sed -i.bak 's/(see Eres marketplace)/(see nope:nothing)/' "$skill" && rm "$skill.bak"
}

run_case "unmodified tree passes"           mutate_none                  0
run_case "frontmatter block removed fails"  mutate_frontmatter_removed   1
run_case "name != directory fails"          mutate_name_mismatch         1
run_case "uppercase in name fails"          mutate_name_uppercase        1
run_case "README count off by one fails"    mutate_readme_count_off     1
run_case "dead pointer fails"               mutate_dead_pointer          1

echo ""
if [[ $failures -gt 0 ]]; then
  echo "✗ $failures/$cases case(s) failed"
  exit 1
fi
echo "✓ $cases/$cases case(s) passed"
