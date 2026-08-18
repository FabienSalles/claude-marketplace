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
CRAFT_TDD=plugins/craft/skills/tdd-workflow-principles/SKILL.md
VITEST_CONVENTIONS=plugins/vitest/skills/vitest-test-conventions/SKILL.md
PHP_TDD=plugins/phpunit/skills/php-tdd-workflow/SKILL.md
VITEST_TDD=plugins/vitest/skills/vitest-tdd-workflow/SKILL.md

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
echo "== Iteration 2 — the level table claims a level, not an obligation"

assert_absent "R5 no section mandates a test per artifact created" \
  'New Code Must Have Tests' "$CRAFT_TDD"

assert_absent "R5 no anti-pattern forbids writing code without a test" \
  'Creating new code without tests' "$CRAFT_TDD"

# R6 is one rule over two rows. Two literal patterns rather than the one ERE
# alternation the spec first wrote: an escaped `\|` reads as a literal pipe in
# ERE, which is how that command came to match nothing at all.
assert_absent "R6 no row mandates a test for a plain data holder" \
  '| DTO / serialization contract |' "$CRAFT_TDD"

assert_absent "R6 no row mandates a unit test for middleware" \
  '| Guard / middleware |' "$CRAFT_TDD"

echo ""
echo "== Iteration 3 — both TDD children carry their parent's framing"

assert_absent "R7 neither child frames its table as a required test" \
  'Tests Required' plugins/phpunit plugins/vitest

assert_absent "R7 neither child titles its table as a new-code obligation" \
  'New Code Tests Mapping' plugins/phpunit plugins/vitest

assert_present "R7 the PHP child defers the does-it-earn-a-test question" \
  'craft:testing-principles' "$PHP_TDD"

assert_present "R7 the NestJS child defers the does-it-earn-a-test question" \
  'craft:testing-principles' "$VITEST_TDD"

echo ""
echo "== Iteration 4 — the reference examples separate AAA with blank lines"

PHPUNIT_REFERENCES=plugins/phpunit/skills/php-test-conventions/references

assert_absent "R8 no reference example labels the arrange phase" \
  '// Arrange' "$PHPUNIT_REFERENCES"

assert_absent "R8 no reference example labels the act phase" \
  '// Act' "$PHPUNIT_REFERENCES"

assert_absent "R8 no reference example labels the assert phase" \
  '// Assert' "$PHPUNIT_REFERENCES"

echo ""
if [[ $failures -gt 0 ]]; then
  echo "✗ $failures/$cases assertion(s) failed"
  exit 1
fi
echo "✓ $cases/$cases assertion(s) passed"
