#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Coherence assertions for the skill pack
#
# Two skills that load into the same session must never give opposite
# instructions for the same situation. Each assertion pins one contradiction
# that was removed, so it cannot come back. Grouped by the iteration that
# removed it.
#
# Usage: bash scripts/tests/test-skill-coherence.sh
# ─────────────────────────────────────────────

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

CRAFT_TESTING=plugins/craft/skills/testing-principles/SKILL.md
VITEST_CONVENTIONS=plugins/vitest/skills/vitest-test-conventions/SKILL.md

failures=0
cases=0

# assert_absent NAME PATTERN TARGET… — PATTERN must appear in no TARGET
assert_absent() {
  local name="$1" pattern="$2"
  shift 2
  cases=$((cases + 1))

  if grep -rq -- "$pattern" "$@"; then
    echo "✗ $name"
    grep -rn -- "$pattern" "$@" | sed 's/^/    /'
    failures=$((failures + 1))
  else
    echo "✓ $name"
  fi
}

# assert_present NAME PATTERN TARGET… — PATTERN must appear in some TARGET
assert_present() {
  local name="$1" pattern="$2"
  shift 2
  cases=$((cases + 1))

  if grep -rq -- "$pattern" "$@"; then
    echo "✓ $name"
  else
    echo "✗ $name"
    echo "    '$pattern' found in none of: $*"
    failures=$((failures + 1))
  fi
}

echo "== Iteration 1 — the spy/mock rule has exactly one owner"

assert_absent "R1 no bare double is labelled an AAA violation" \
  'Setup expectations before act' plugins

assert_present "R2 craft §6 names the tooling-vocabulary trap" \
  'mock function' "$CRAFT_TESTING"

assert_absent "R3 the vitest child holds no spy-over-mock section" \
  'Spy Over Mock' "$VITEST_CONVENTIONS"

assert_absent "R3 the vitest child ranks no double as preferred" \
  '— preferred' "$VITEST_CONVENTIONS"

assert_absent "R4 the vitest catalogue advertises no craft-owned rule" \
  'spy over mock' plugins/vitest/README.md

echo ""
if [[ $failures -gt 0 ]]; then
  echo "✗ $failures/$cases assertion(s) failed"
  exit 1
fi
echo "✓ $cases/$cases assertion(s) passed"
