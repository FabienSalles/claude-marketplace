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
echo "== Iteration 5 — the symfony child locates by what the app owns"

assert_absent "R9 the symfony child blesses no layout class as a locator" \
  'form-check-inline' plugins/symfony/skills/symfony-test-conventions/SKILL.md

echo ""
echo "== Iteration 6 — the base layer stops refusing PHP and TypeScript"

CRAFT_STYLE=plugins/craft/skills/code-style-principles/SKILL.md

assert_absent "R1 the craft base layer excludes no language with a dedicated skill" \
  'in a language with no dedicated conventions skill' "$CRAFT_STYLE"

assert_present "R2 the exclusion clause names the syntax it defers, not the whole language" \
  'DO NOT use for: language-specific syntax already covered by' "$CRAFT_STYLE"

echo ""
echo "== Iteration 7 — the orphaned rows follow their parent, the dead pointer resolves"

assert_absent "R3 the PHP child mandates no test for a plain DTO" \
  '| DTO / Contract | Serialization test (in package) |' "$PHP_TDD"

assert_absent "R3 the NestJS child mandates no unconditional unit test for a guard" \
  '| Guard | Unit test for access rules |' "$VITEST_TDD"

assert_absent "R5 systematic-debugging points to no test-driven-development skill under superpowers" \
  'superpowers:test-driven-development' plugins/superpowers/skills/systematic-debugging/SKILL.md

assert_present "R5 systematic-debugging defers to the real cross-language TDD skill" \
  'craft:tdd-workflow-principles' plugins/superpowers/skills/systematic-debugging/SKILL.md

echo ""
echo "== Iteration 3 — readonly placement, first-class callables, named arguments each have one owner"

PHP_OOP=plugins/php/skills/php-oop/SKILL.md
TWIG_CONVENTIONS=plugins/symfony/skills/twig-conventions/SKILL.md
HTTP_TESTING=plugins/phpunit/skills/php-test-conventions/references/http-testing.md

assert_absent "R1 php-oop prints no per-property readonly on an all-readonly value object" \
  'public readonly FileTypeEnum' "$PHP_OOP"

assert_absent "R1 php-oop names no unneeded argument under the four-argument threshold" \
  'addFromDocument(document: ' "$PHP_OOP"

assert_absent "R1 twig-conventions registers no TwigFunction with an array callable" \
  "\[\$this, 'getCurrentYear'\]" "$TWIG_CONVENTIONS"

assert_absent "R1 the http-testing reference names no positional null before a named argument" \
  'new ObjectNormalizer(null, null, null,' "$HTTP_TESTING"

echo ""
echo "== Iteration 4 — one Result, one domain shape, one deletion test"

TS_OOP=plugins/typescript/skills/ts-oop/SKILL.md
TS_CONVENTIONS=plugins/typescript/skills/ts-conventions/SKILL.md
TS_FUNCTIONAL=plugins/typescript/skills/ts-functional/SKILL.md
CRAFT_REFACTORING=plugins/craft/skills/refactoring-principles/SKILL.md
DDD_TS_FP_EXAMPLES=plugins/typescript/skills/ddd-ts-fp/references/ddd-functional-examples.md

assert_absent "R1 ts-conventions declares no competing Result shape" \
  'success: true; data: Receipt' "$TS_CONVENTIONS"

assert_present "R2 ts-conventions points to ts-functional for Result" \
  'ts-functional' "$TS_CONVENTIONS"

assert_present "R2 ts-functional names itself as the canonical Result owner" \
  'canonical' "$TS_FUNCTIONAL"

assert_present "R2 ts-oop defers to frontend-clean-architecture for domain models under features/" \
  'frontend-clean-architecture' "$TS_OOP"

assert_present "R4 the deletion test exempts architecture-mandated seams" \
  'Exemption' "$CRAFT_REFACTORING"

assert_present "R2 the ddd-ts-fp examples point to ts-functional for Result and pipe" \
  'ts-functional' "$DDD_TS_FP_EXAMPLES"

echo ""
echo "== Iteration 5 — the DI example resolves, the paradigm skills route instead of compete"

NEST_CONVENTIONS=plugins/nest/skills/nest-conventions/SKILL.md
CRAFT_OOP=plugins/craft/skills/oop-principles/SKILL.md

assert_absent "R1 nest-conventions' constructor injection example is not left unresolvable" \
  'constructor(private readonly repo: ReceiptRepository) {}' "$NEST_CONVENTIONS"

assert_present "R1 nest-conventions' constructor injection example carries the token it needs to resolve" \
  'constructor(@Inject(RECEIPT_REPOSITORY) private readonly repo: ReceiptRepository) {}' "$NEST_CONVENTIONS"

assert_present "R2 the craft parent gains a DO-NOT clause it had none of today" \
  'DO NOT use for' "$CRAFT_OOP"

assert_present "R2 the deference pointer names the owner of the functional aggregate" \
  'ddd-fp-principles' "$CRAFT_OOP"

echo ""
echo "== Iteration 6 — one voice per situation across jquery, symfony-frontend, and astro"

JQUERY_SKILL=plugins/jquery/skills/jquery/SKILL.md
JQUERY_TEMPLATE=plugins/jquery/skills/jquery/references/module-template.md
JQUERY_ANTIPATTERNS=plugins/jquery/skills/jquery/references/anti-patterns.md
ASTRO_BASICS=plugins/astro/skills/astro-basics/SKILL.md
ASTRO_SEO_REFERENCE=plugins/astro/skills/astro-seo/references/seo-components-and-structured-data.md

assert_absent "R1 no jquery example delegates a click that isn't dynamic content" \
  "\$block.on('click', EDIT_" "$JQUERY_SKILL" "$JQUERY_TEMPLATE"

assert_absent "R1 the anti-patterns rewrite no longer offers FormType attr as a hook fallback" \
  'or via FormType `attr` if no other choice' "$JQUERY_ANTIPATTERNS"

assert_present "R2 the anti-patterns rewrite defers hook placement to symfony-frontend" \
  'symfony:symfony-frontend' "$JQUERY_ANTIPATTERNS"

assert_absent "R1 astro-basics no longer names the collection-schema file config.ts" \
  '└── config.ts   # Collection schemas' "$ASTRO_BASICS"

assert_present "R2 astro-basics' tree points to astro-content-collections for the schema file" \
  'astro-content-collections' "$ASTRO_BASICS"

assert_absent "R1 the astro-seo reference no longer prints its own hreflang link tags" \
  'hreflang="fr"' "$ASTRO_SEO_REFERENCE"

assert_present "R2 the astro-seo reference names astro-i18n as the hreflang emitter" \
  'astro-i18n. emits the hreflang' "$ASTRO_SEO_REFERENCE"

echo ""
if [[ $failures -gt 0 ]]; then
  echo "✗ $failures/$cases assertion(s) failed"
  exit 1
fi
echo "✓ $cases/$cases assertion(s) passed"
