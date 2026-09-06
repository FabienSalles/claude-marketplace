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

# assert_pins NAME PATTERN TARGET… — fails if the pattern is absent from the target set,
# shorter than 40 characters, or found anywhere in plugins/ outside that set.
assert_pins() {
  local name="$1" pattern="$2"
  shift 2
  local targets=("$@")
  cases=$((cases + 1))

  if [[ ${#pattern} -lt 40 ]]; then
    echo "✗ $name (pattern is only ${#pattern} chars, prose could satisfy it)"
    failures=$((failures + 1))
    return
  fi

  if ! grep -rq -- "$pattern" "${targets[@]}"; then
    echo "✗ $name"
    echo "    '$pattern' found in none of: ${targets[*]}"
    failures=$((failures + 1))
    return
  fi

  local stray
  stray=$(grep -rl -- "$pattern" plugins/ 2>/dev/null | while IFS= read -r f; do
    local inside=0
    for t in "${targets[@]}"; do
      case "$f" in "$t"*) inside=1 ;; esac
    done
    [[ $inside -eq 0 ]] && echo "$f"
  done)

  if [[ -n "$stray" ]]; then
    echo "✗ $name (pattern also found outside the target set)"
    echo "$stray" | sed 's/^/    /'
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
echo "== Iteration 7 — the goal pipeline stops giving its own agents opposite orders"

SUPERVISE_SKILL=plugins/goal/skills/supervise/SKILL.md
NEXT_SKILL=plugins/goal/skills/next/SKILL.md
VERTICAL_SLICE=plugins/product/skills/vertical-slice/SKILL.md

assert_absent "R1 supervise no longer points to the nonexistent /goal:run-issue command" \
  '/goal:run-issue' "$SUPERVISE_SKILL"

assert_present "R2 supervise's no-plan STOP names /goal:plan, the command that creates one" \
  'Run `/goal:plan` first' "$SUPERVISE_SKILL"

assert_absent "R1 vertical-slice no longer schedules cleanup as the last slice of this plan" \
  'Keep the cleanup slice separate and last' "$VERTICAL_SLICE"

assert_present "R2 vertical-slice defers cleanup scheduling to product:delivery, its owner" \
  'never a slice of this plan' "$VERTICAL_SLICE"

assert_absent "R1 the checkpoint no longer carves its own git-restore exception into the index" \
  'unstage only what was wrongly added' "$NEXT_SKILL"

assert_present "R2 the checkpoint defers manual-mode index handling to git:git, its owner" \
  'git:git' "$NEXT_SKILL"

echo ""
echo "== Iteration 2 — the DDD examples construct and branch on the canonical Result"

DDD_TS_FP=plugins/typescript/skills/ddd-ts-fp
TS_DDD_EVENTS=plugins/typescript/skills/ts-ddd-events

assert_absent "R3 no DDD example branches on the retired boolean .ok field" \
  '\.ok' "$DDD_TS_FP" "$TS_DDD_EVENTS"

cases=$((cases + 1))
if grep -rqE '[^a-zA-Z](ok|err)\(' "$DDD_TS_FP" "$TS_DDD_EVENTS"; then
  echo "✗ R5 no DDD example calls the hand-rolled ok/err constructors"
  grep -rnE '[^a-zA-Z](ok|err)\(' "$DDD_TS_FP" "$TS_DDD_EVENTS" | sed 's/^/    /'
  failures=$((failures + 1))
else
  echo "✓ R5 no DDD example calls the hand-rolled ok/err constructors"
fi

# The pattern must be one prose cannot satisfy. Its first form was `success(`, which went green on
# the sentence at the top of ddd-functional-examples.md while every construction site in the file was
# still a hand-built literal, so the assertion passed through the very defect it was written to catch.
# `if (isSuccess(` appears in code and nowhere else.
cases=$((cases + 1))
if grep -rqE 'if \(is(Success|Failure)\(' "$DDD_TS_FP"; then
  echo "✓ R3 the ddd-ts-fp examples branch with the canonical isSuccess/isFailure"
else
  echo "✗ R3 the ddd-ts-fp examples branch with the canonical isSuccess/isFailure"
  failures=$((failures + 1))
fi

echo ""
echo "== Iteration 4 — every construction site goes through success(...) / failure(...)"

TS_FUNCTIONAL_DIR=plugins/typescript/skills/ts-functional
DDD_EXAMPLES=plugins/typescript/skills/ddd-ts-fp/references/ddd-functional-examples.md
FP_EXAMPLES=plugins/typescript/skills/ts-functional/references/fp-pattern-examples.md

cases=$((cases + 1))
if grep -rqE '[^a-zA-Z](ok|err)\(' "$TS_FUNCTIONAL_DIR"; then
  echo "✗ R1 ts-functional's own examples keep no retired ok/err constructor call"
  grep -rnE '[^a-zA-Z](ok|err)\(' "$TS_FUNCTIONAL_DIR" | sed 's/^/    /'
  failures=$((failures + 1))
else
  echo "✓ R1 ts-functional's own examples keep no retired ok/err constructor call"
fi

assert_absent "R7 no example across the three skills carries the retired error: field" \
  'error:' "$TS_FUNCTIONAL_DIR" "$DDD_TS_FP" "$TS_DDD_EVENTS"

cases=$((cases + 1))
if grep -rqE "\{ *tag: .(success|failure)., " "$FP_EXAMPLES" "$DDD_EXAMPLES"; then
  echo "✗ R3 no example rebuilds the tagged shape by hand instead of calling the constructor"
  grep -rnE "\{ *tag: .(success|failure)., " "$FP_EXAMPLES" "$DDD_EXAMPLES" | sed 's/^/    /'
  failures=$((failures + 1))
else
  echo "✓ R3 no example rebuilds the tagged shape by hand instead of calling the constructor"
fi

cases=$((cases + 1))
if grep -qE "(return|\? |: )failure\(" "$DDD_EXAMPLES"; then
  echo "✓ R3 the ddd-ts-fp examples construct failures with failure("
else
  echo "✗ R3 the ddd-ts-fp examples construct failures with failure("
  failures=$((failures + 1))
fi

cases=$((cases + 1))
if grep -rqE "(^|[^c])Result\.(chain|tee)" "$TS_FUNCTIONAL_DIR"; then
  echo "✗ R5 no example calls the Result.chain/Result.tee namespace the module does not export"
  grep -rnE "(^|[^c])Result\.(chain|tee)" "$TS_FUNCTIONAL_DIR" | sed 's/^/    /'
  failures=$((failures + 1))
else
  echo "✓ R5 no example calls the Result.chain/Result.tee namespace the module does not export"
fi

assert_present "R1 ts-functional's SKILL.md names the success<T> constructor" \
  'success<T>' "$TS_FUNCTIONAL"

assert_present "R1 ts-functional's SKILL.md names the failure<E> constructor" \
  'failure<E>' "$TS_FUNCTIONAL"

echo ""
echo "== Iteration 1 — a port and its adapter, without a DI container"

PORTS_ADAPTERS=plugins/typescript/skills/ts-ports-adapters/SKILL.md

assert_present "R2 the skill declares a port as an exported type" \
  'export type [A-Za-z]*\(Repository\|Dispatcher\|Generator\|Clock\|Formatter\) =' "$PORTS_ADAPTERS"

assert_absent "R2 the skill declares no port as an interface of methods" \
  'interface [A-Za-z]*\(Repository\|Dispatcher\|Generator\|Clock\)' "$PORTS_ADAPTERS"

assert_present "R2 the skill situates the port in the domain layer" \
  'Domain/SPI\|domain/ports' "$PORTS_ADAPTERS"

# The port's fields are arrow-typed properties. Method shorthand is the container-era form a
# class implements, and the reference codebases use it in none of their 17 ports.
cases=$((cases + 1))
if grep -qE '^ +[a-z][A-Za-z]*: \([^)]*\) =>' "$PORTS_ADAPTERS"; then
  echo "✓ R2 the port's fields are arrow-typed properties, not method shorthand"
else
  echo "✗ R2 the port's fields are arrow-typed properties, not method shorthand"
  failures=$((failures + 1))
fi

# R3 and R4 are the two greps that returned zero across the whole pack and are the reason this
# skill exists. They run here verbatim, against the skill, where they must now match.
cases=$((cases + 1))
if grep -qE "^(const|export const) [a-z][A-Za-z]*(Repository|Store|Dispatcher|Generator|Clock|Service) *(:[^=]*)?= *\{" "$PORTS_ADAPTERS"; then
  echo "✓ R3 the skill constructs an adapter bound to its port"
else
  echo "✗ R3 the skill constructs an adapter bound to its port"
  failures=$((failures + 1))
fi

cases=$((cases + 1))
if grep -qE "[a-zA-Z]+Handler\([a-zA-Z]" "$PORTS_ADAPTERS"; then
  echo "✓ R4 the skill applies a handler to its dependencies"
else
  echo "✗ R4 the skill applies a handler to its dependencies"
  failures=$((failures + 1))
fi

cases=$((cases + 1))
if grep -qE '@Injectable|@Inject\(|@Module|Symbol\(|useClass' "$PORTS_ADAPTERS"; then
  echo "✗ R5 the skill's mechanism names no container"
  grep -nE '@Injectable|@Inject\(|@Module|Symbol\(|useClass' "$PORTS_ADAPTERS" | sed 's/^/    /'
  failures=$((failures + 1))
else
  echo "✓ R5 the skill's mechanism names no container"
fi

assert_absent "R5 the skill silences no compiler error with a non-null assertion" \
  'process\.env\.[A-Z_]*!' "$PORTS_ADAPTERS"

assert_present "R6 the skill defers the doubles doctrine to craft:testing-principles" \
  'craft:testing-principles' "$PORTS_ADAPTERS"

assert_present "R7 the skill defers the Result type to ts-functional" \
  'ts-functional' "$PORTS_ADAPTERS"

assert_present "R8 the skill names nest-ddd-conventions as the owner of container-based DI" \
  'nest-ddd-conventions' "$PORTS_ADAPTERS"

echo ""
echo "== Iteration 2 — ts-conventions no longer illustrates interface with a port"

assert_absent "R9 ts-conventions' interface example is not a repository port" \
  'interface ReceiptRepository' "$TS_CONVENTIONS"

echo ""
echo "== Iteration 8 — the six SPI port conventions the reference code proves"

assert_pins "C4 a CQRS-split aggregate keeps its write and read ports disjoint" \
  "A CQRS-split aggregate carries a homonymous write port and read port whose operations never overlap." \
  "$PORTS_ADAPTERS"

assert_pins "C7 the adapter is a default-exported lowerCamel const annotated by its port" \
  "The adapter is a lowerCamel const annotated by its port and exported as the module's default." \
  "$PORTS_ADAPTERS"

assert_pins "C11 only non-determinism and I/O sit behind a port" \
  "Only the clock, id generation, persistence, dispatch, and feature flags sit behind a port; everything else is reached directly." \
  "$PORTS_ADAPTERS"

assert_pins "C14 every domain port lives under SPI/, stated as a decision" \
  "Every domain port lives under SPI/, with no port left outside it by convention." \
  "$PORTS_ADAPTERS"

assert_pins "C17 each port ships a hand-written InMemory or Stub double" \
  "Each port keeps a hand-written double: InMemory for one that holds state, Stub for one that returns a deterministic sequence." \
  "$PORTS_ADAPTERS"

assert_pins "C20 a port with no domain consumer has no reason to live in SPI" \
  "A port that only circulates between two infrastructure files has no reason to live in SPI." \
  "$PORTS_ADAPTERS"

echo ""
echo "== Iteration 9 — the nine boundary conventions land in one skill, ESLint zones over review"

LAYER_BOUNDARIES=plugins/typescript/skills/ts-layer-boundaries/SKILL.md
TS_CODE_CONVENTIONS=plugins/typescript/skills/ts-code-conventions/SKILL.md

assert_pins "C73 *Worker.ts is the sole async composition root with a module-level side effect" \
  "The async composition root is \*Worker.ts, the only file in the worker tree allowed a module-level side effect." \
  "$LAYER_BOUNDARIES"

assert_pins "C74 the consumer is a curried factory that never imports a concrete adapter" \
  "The consumer is a curried factory receiving handlers, formatters, and ports; it never imports a concrete adapter." \
  "$LAYER_BOUNDARIES"

assert_pins "C76 the Router wires command endpoints, adapters in, handler applied once" \
  "The Router wires command endpoints: it imports the adapters, applies the handler once at load time, and passes the curried controller when registering the route." \
  "$LAYER_BOUNDARIES"

assert_pins "C78 a controller performs exactly five gestures" \
  "A controller performs five gestures: read the request, build the Command or Query, await the handler, branch on the Result, set the status or envelope." \
  "$LAYER_BOUNDARIES"

assert_pins "C80 #77 the domain never imports infrastructure, declared in ESLint zones" \
  "The domain never imports infrastructure, and the boundary is declared in ESLint zones rather than left to code review." \
  "$LAYER_BOUNDARIES"

assert_pins "C87 an infrastructure-only collaborator has its port declared in infrastructure" \
  "A collaborator used only by infrastructure has its port declared in infrastructure, beside its adapter, never in Domain/SPI." \
  "$LAYER_BOUNDARIES"

assert_pins "C92 every declared port keeps a hand-written in-memory double" \
  "Every declared port keeps a hand-written in-memory double, so the test becomes its own composition root." \
  "$LAYER_BOUNDARIES"

assert_pins "C96 the read side may reach the write side, never the reverse, stated as a decision" \
  "The read side may reach the write side, never the reverse; codebase B forbids both directions and pays it back in duplication." \
  "$LAYER_BOUNDARIES"

assert_pins "C102 a read endpoint goes through a domain handler, never the repository directly" \
  "A read endpoint goes through a domain handler: no direct repository call from the controller, no persistence type on the wire." \
  "$LAYER_BOUNDARIES"

assert_present "R1 the catalogue names ts-layer-boundaries as the boundary rule's one owner" \
  'ts-layer-boundaries' plugins/typescript/README.md

assert_absent "R2 ts-code-conventions makes no boundary claim now owned by ts-layer-boundaries" \
  'infrastructure' "$TS_CODE_CONVENTIONS"

assert_present "R2 ts-code-conventions defers layer boundaries to their one owner" \
  'ts-layer-boundaries' "$TS_CODE_CONVENTIONS"

echo ""
echo "== Iteration 3 — the seven currying and parameter-order conventions"

CRAFT_DDD_FP=plugins/craft/skills/ddd-fp-principles

assert_pins "C22 the dependency group is positional, never a destructured object or a container" \
  "The dependency group is positional, never a destructured object nor a container." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C23 dependencies then data at the handler, data then subject at the model: the aggregate is last" \
  "Dependencies then data at the handler level, but data then subject at the model level: the aggregate is always the last curried argument." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C25 curry only what will be partially applied or piped" \
  "Curry only what will be partially applied or piped; adapters, ports, predicates, and mappers stay single-stage." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C28 publish export type XHandler beside a Command handler, never for a Query" \
  "Publish export type XHandler beside a Command handler and annotate the factory with it; never do so for a Query." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C30 a handler never calls another handler, composition moves up a level" \
  "A handler never calls another handler: composition moves up a level, into a Workflow, a Listener, a Router, or a Consumer." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C31 Result when a business rule can fail, Promise<void> for fire-and-forget, never a bare domain value" \
  "Return Result when a business rule can fail, Promise<void> for fire-and-forget; never a bare domain value." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C32 the data stage takes a single XCommand or XQuery object, never a list of primitives" \
  "The data stage takes a single XCommand or XQuery object, never a list of primitives." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

echo ""
echo "== Iteration 4 — the seven modelling conventions, including the maker/validator split"

assert_pins "C38 a Result only for a fallible operation, the bare model for a total transition" \
  "An operation returns a Result only when it can fail; a total transition returns the bare model." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C43 an entity's operations take and return the aggregate, never the entity itself" \
  "An entity carrying identity has its own Models/Entities/<Name>/ folder, and its operations take and return the aggregate, never the entity." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C44 the smart constructor splits into Validator files and a never-failing maker" \
  "The smart constructor splits in two: Validator files carry the invariants, and the maker only maps and normalizes, and never fails." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C45 a closed set is a triplet in one file: as const object, derived union, predicate" \
  "A closed set is written as a triplet in a single file: the as const object, the derived union, and the predicate." \
  "$TS_CONVENTIONS"

assert_pins "C46 each CQRS side owns its model copy, the read copy deliberately narrowed" \
  "Each CQRS side owns its own copy of the model; the read copy is deliberately narrowed." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C47 the command DTO repeats per feature, never factored across features by shape" \
  "The command DTO repeats per feature; two features are never factored together just because their types are identical." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

assert_pins "C49 the repository receives the whole aggregate, never a patch nor a field list" \
  "The repository receives the whole aggregate, never a patch nor a list of fields." \
  "$DDD_TS_FP" "$CRAFT_DDD_FP"

echo ""
echo "== Iteration 5 — the seven error and composition conventions, C57 stays absent"

assert_pins "C58 throw is for the type-allowed-but-domain-impossible state, failure() for the expected business failure" \
  "throw is reserved for a state the type system allows but the domain declares impossible; an expected business failure returns failure() instead." \
  "$TS_FUNCTIONAL"

assert_pins "C62 a handler returns an AsyncResult only when its caller must branch on a business failure" \
  "A handler returns an AsyncResult only when its caller must branch on a business failure; otherwise it returns a plain Promise." \
  "$TS_FUNCTIONAL"

assert_pins "C63 the port method's name encodes the absence contract, find* versus get*" \
  "The port method's name encodes the absence contract: find\* returns Promise<T | null> and the caller decides, get\* returns AsyncResult<T, DomainError> and the port supplies the typed error." \
  "$TS_FUNCTIONAL"

assert_pins "C64 compose Results with pipe and chain only when synchronous, unwrap imperatively in async" \
  "Compose Results with pipe and chain only when synchronous; in async code, unwrap imperatively with if (isFailure(x)) return x;." \
  "$TS_FUNCTIONAL"

assert_pins "C66 AsyncResult.wrap, chain, and tee belong only to infrastructure orchestration atop a worker" \
  "AsyncResult.wrap, chain, and tee belong only to infrastructure orchestration, at the top of a worker." \
  "$TS_FUNCTIONAL"

assert_pins "C67 pipe is a general composition tool, not a Result-only tool, and infrastructure consumes it most" \
  "pipe is a general composition tool, not a Result-only tool, and infrastructure is its heaviest consumer." \
  "$TS_FUNCTIONAL"

assert_pins "C71 in test, assert the boolean guard then result.value, never compare against a reconstructed success" \
  "In tests, assert the boolean guard, then result.value; never compare against a reconstructed success(...)." \
  "$TS_FUNCTIONAL"

assert_absent "C57 stays deferred, no canonical DomainError shape unified between A and B" \
  "the domain error shape of A and B is unified into one canonical DomainError type" \
  plugins

echo ""
echo "== Iteration 6 — the eight event, outbox and CQRS conventions, starting with the two vocabularies"

assert_pins "C103 #79 two vocabularies of event must never be confused, no file imports both" \
  "Two vocabularies of event must never be confused: the transport envelope Event<T> (id/type/timestamp/version/metadata/data) and the domain event DomainEvent<U> (id/type/payload/createdAt). No file imports both." \
  "$TS_DDD_EVENTS"

assert_pins "C107 the event is created in the handler, never in the aggregate" \
  "The event is created in the handler, never in the aggregate: without a class, the aggregate cannot carry an event buffer." \
  "$TS_DDD_EVENTS"

assert_pins "C108 dispatch is a domain port typed as a bare function type, its adapter a make*Mapper table" \
  "Dispatch is a domain port typed as a bare function type, whose adapter is a Record<type, listener> table built by a make\*Mapper factory." \
  "$TS_DDD_EVENTS"

assert_pins "C109 emit by returning the event in success or by calling the injected dispatcher, no rule between them" \
  "Emit either by returning the event in Result's success, or by calling the injected dispatcher: both are used, with no rule between them." \
  "$TS_DDD_EVENTS"

assert_pins "C112 #79 this outbox is INBOUND, it publishes nothing" \
  "This outbox is INBOUND: it stages messages received from SQS for local consumption. It publishes nothing, so it is not the reliable publishing pattern." \
  "$TS_DDD_EVENTS"

assert_pins "C120 the read model is not fed by events, both sides share one database and collection" \
  "The read model is not fed by events: both sides share one database and collection, so a write is immediately visible on read." \
  "$TS_DDD_EVENTS"

assert_pins "C121 only one codebase forbids Command importing Query by lint, the read side still reaches into the write side" \
  "Only one codebase forbids Command importing Query by lint. Neither violates the rule, but the read side freely reaches into the write side." \
  "$TS_DDD_EVENTS"

assert_pins "C122 domain purity holds even where CQRS does not, a single concrete logger exception" \
  "Domain purity holds even where CQRS does not: a single exception, a concrete logger, in the gap the zones do not cover." \
  "$TS_DDD_EVENTS"

echo ""
echo "== Iteration 7 — the seven typing conventions are stated in ts-conventions"

assert_pins "C128 #77 type-over-interface is locked by ESLint, not by review" \
  "The type-over-interface convention is enforced by ESLint's naming-convention rule, not by code review." \
  "$TS_CONVENTIONS"

assert_pins "C133 the discriminant is named tag, exposed through isX predicates" \
  "The discriminant field is always named tag, and callers use isX predicates instead of comparing tag directly." \
  "$TS_CONVENTIONS"

assert_pins "C135 satisfies checks a rendered or collected literal's shape without widening it" \
  "satisfies checks a rendered or collected object literal's shape without widening it; it is never used to validate an untyped value." \
  "$TS_CONVENTIONS"

assert_pins "C136 as const serves exactly two purposes" \
  "as const serves exactly two purposes: freezing a closed set to derive a union, and pinning a module constant to its literal type." \
  "$TS_CONVENTIONS"

assert_pins "C138 as is tolerated only at infrastructure boundaries" \
  "as is tolerated only at infrastructure boundaries: external payloads, JSON.parse, SDK calls, empty accumulators; inside the domain it is debt." \
  "$TS_CONVENTIONS"

assert_pins "C146 absence in a domain type is an explicit | null, not ?" \
  "Absence in a domain type is written as an explicit | null; ? is reserved for external payload shapes and partial update commands." \
  "$TS_CONVENTIONS"

assert_pins "C148 Command publishes a named handler type alias, Query lets it infer" \
  "On the Command side, publish a named function-type alias after the handler's file and annotate the factory with it; on the Query side, let it infer." \
  "$TS_CONVENTIONS"

echo ""
echo "== Iteration 8 — the ten test-strategy conventions are stated in craft:testing-principles"

assert_pins "C154 jest.mock is only a module-level dependency injector redirecting to a hand-written stub" \
  "\`jest.mock\` exists only as a module-level dependency injector, to redirect an infrastructure singleton to a hand-written stub." \
  "$CRAFT_TESTING"

assert_pins "C155 never a jest double for a port, an in-memory stub applied to the curried handler" \
  "Never a jest double for a port: write an in-memory stub in tests/Helpers and apply it to the curried handler." \
  "$CRAFT_TESTING"

assert_pins "C156 the stub is typed Port & test accessors, its own spy, asserted on state" \
  "it is its own spy, and you assert on its state rather than a call registry." \
  "$CRAFT_TESTING"

assert_pins "C157 the stub resets in beforeEach on Jest, a tagged Before/After hook on Cucumber" \
  "The stub's state resets in \`beforeEach\` on the Jest side, and through a tagged Before/After hook on the Cucumber side." \
  "$CRAFT_TESTING"

assert_pins "C159 determinism comes from injected stub generators, never useFakeTimers" \
  "Determinism comes from stub generators injected over a fixed list, never from \`useFakeTimers\`." \
  "$CRAFT_TESTING"

assert_pins "C160 node:assert in Cucumber, expect everywhere else" \
  "Two assertion vocabularies stay strictly separated by runner: \`node:assert\` in Cucumber, \`expect\` everywhere else." \
  "$CRAFT_TESTING"

assert_pins "C163 AAA separated by blank lines, Result guard before the payload, several assertions allowed" \
  "AAA stays separated by blank lines, a Result guard precedes the payload assertion, and several assertions per test are allowed." \
  "$CRAFT_TESTING"

assert_pins "C164 toMatchSnapshot only on a whole value, always paired with a discrete assertion" \
  "\`toMatchSnapshot\` applies only to a whole value (an aggregate, an HTTP body, a rendered template) and is always paired with a discrete assertion in the same test." \
  "$CRAFT_TESTING"

assert_pins "C166 Gherkin owns business acceptance criteria, steps run handlers against stubs, no HTTP or DB" \
  "Gherkin owns the business acceptance criteria: Feature/Scenario/Given-When-Then in English with data tables, and steps that run the handlers against stubs, with no HTTP and no database." \
  "$CRAFT_TESTING"

assert_pins "C169 the Pact suite stays outside the normal run" \
  "The Pact suite stays outside the normal run: a \`\*.pact.spec.ts\` suffix, a dedicated script, a CI job in \`allow_failure\`, and a published, versioned pact." \
  "$CRAFT_TESTING"

echo ""
echo "== Iteration 9 — the seven aliasing, build and environment-config conventions"

assert_pins "C174 #77 layer boundaries are declared as zones, one per forbidden edge, each named for its rule" \
  "Layer boundaries are declared as import/no-restricted-paths zones, one zone per forbidden edge, each carrying the message of the rule it violates." \
  "$TS_CODE_CONVENTIONS"

assert_pins "C175 #77 the CQRS zone is unidirectional by design and a relative path bypasses it" \
  "The CQRS zone is unidirectional by design: it stops Command from reading Query, never the reverse. A relative path bypasses it." \
  "$TS_CODE_CONVENTIONS"

assert_pins "C176 every layer has its own alias @<Context><Layer>, a relative path is reserved for same-folder neighbors" \
  "Every layer has its own alias @<Context><Layer>, and it is imported through it; a relative path is reserved for a neighbor in the same folder." \
  "$TS_CODE_CONVENTIONS"

assert_pins "C177 the alias table is declared four times and must stay in sync" \
  "The alias table is declared four times (tsconfig, jest moduleNameMapper, tsconfig-paths at runtime, transform at build) and must stay in sync." \
  "$TS_CODE_CONVENTIONS"

assert_pins "C178 compile with tspc plus typescript-transform-paths so dist needs no runtime resolver" \
  "Compile with tspc (ts-patch) plus typescript-transform-paths, so dist needs no resolver at runtime." \
  "$TS_CODE_CONVENTIONS"

assert_pins "C183 process.env is read at one place per layer, a config.ts destructuring with inline defaults" \
  "process.env is read at one place per layer: a config.ts that destructures it with inline default values." \
  "$TS_CODE_CONVENTIONS"

assert_pins "C190 tests import by alias too, @Tests/* for fixtures, because a mirrored tree has no stable relative offset" \
  "Tests import by alias too, @Tests/\* for fixtures, because a mirrored tree has no stable relative offset, so the alias is a necessity, not a preference." \
  "$TS_CODE_CONVENTIONS"

echo ""
echo "== Iteration 1 — the maker/validator split is stated as the cross-language rule"

assert_pins "R1 ddd-fp-principles states the maker/validator pairing as a cross-language rule" \
  "Every maker is paired with a named validator that owns its invariants, and the two are separate units: the validator is fallible, the maker is total and returns the aggregate." \
  "$CRAFT_DDD_FP"

assert_pins "R2 ddd-fp-principles states the total-vs-fallible composition criterion" \
  "Total operations compose bare in a pipe; only a fallible operation needs chain, because chain requires a function that returns a Result." \
  "$CRAFT_DDD_FP"

cases=$((cases + 1))
DDD_TS_FP_SKILL="$DDD_TS_FP/SKILL.md"
line136=$(sed -n '136p' "$DDD_TS_FP_SKILL")
if [[ "$line136" == "The smart constructor splits in two: Validator files carry the invariants, and the maker only maps and normalizes, and never fails." ]]; then
  echo "✓ R3 ddd-ts-fp:136 keeps its sentence byte-for-byte unchanged"
else
  echo "✗ R3 ddd-ts-fp:136 keeps its sentence byte-for-byte unchanged"
  echo "    line 136 is now: $line136"
  failures=$((failures + 1))
fi

assert_present "R4 the craft quick-ref carries a Validator row" '| Validator |' "$CRAFT_DDD_FP"

assert_present "R4 the craft quick-ref carries a Maker row" '| Maker |' "$CRAFT_DDD_FP"

assert_present "R4 the ddd-ts-fp quick-ref carries a Validator row" '| Validator |' "$DDD_TS_FP"

assert_present "R4 the ddd-ts-fp quick-ref carries a Maker row" '| Maker |' "$DDD_TS_FP"

echo ""
echo "== Iteration 2 (#75) — the two composition examples compose, the fused term retires"

assert_absent "I1 no example composes a total function with chain via chain(make" \
  'chain(make' "$DDD_TS_FP/SKILL.md" "$DDD_TS_FP/references/ddd-functional-examples.md"

assert_present "I2 the reference pipe stays on the command, the maker applies with its full arity after the guard" \
  'makeAddress(addressId, createdAt)(validated.value)' "$DDD_TS_FP/references/ddd-functional-examples.md"

assert_present "I2 the sync pipe's declared result is the validated command, not the model" \
  'const validated: Result<AddAddressCommand, DomainError> = pipe(' "$DDD_TS_FP/references/ddd-functional-examples.md"

assert_present "I3 the handler example unwraps validation imperatively" \
  'if (isFailure(validated)) return validated;' "$DDD_TS_FP/SKILL.md"

assert_absent "I3 the handler example carries no dependency it never uses" \
  'ReceiptRepository' "$DDD_TS_FP/SKILL.md"

assert_absent "I4 the retired term is gone from the ddd-ts-fp heading" \
  '## TS-specific: Smart Constructor' "$DDD_TS_FP/SKILL.md"

assert_absent "I4 the retired term is gone from the ddd-ts-fp pointer at :53" \
  'creating smart constructors' "$DDD_TS_FP/SKILL.md"

assert_absent "I4 the retired term is gone from the ddd-ts-fp quick-ref" \
  '| Smart constructor |' "$DDD_TS_FP/SKILL.md"

assert_absent "I4 the retired term is gone from the reference examples heading" \
  '## Smart Constructor Examples' "$DDD_TS_FP/references/ddd-functional-examples.md"

assert_absent "I4 the retired term is gone from README.md:26" \
  'smart constructors' plugins/typescript/README.md

assert_present "I4 the retired term is kept in the ddd-ts-fp description" \
  "'smart constructor'" "$DDD_TS_FP/SKILL.md"

echo ""
if [[ $failures -gt 0 ]]; then
  echo "✗ $failures/$cases assertion(s) failed"
  exit 1
fi
echo "✓ $cases/$cases assertion(s) passed"
