---
name: php-tdd-workflow
description: "ACTIVATE when the user wants to build, implement, or develop any new feature, endpoint, or user story using TDD, test-first, or red-green-refactor methodology. ACTIVATE for the '/feature-dev' command. ACTIVATE whenever 'TDD', 'test first', 'red-green-refactor', or 'itérations' appears alongside building something new. Covers: breaking features into small cross-layer TDD iterations, the red-green-refactor cycle, keeping the app working after each step, bug-fix-first-test workflow. DO NOT use for: writing a single test for existing code, test naming conventions (see php-test-conventions), general PHP/Symfony questions."
version: "1.1"
---

# TDD Workflow

> For test writing conventions (DAMP, test doubles, factories, annotations), see `php-test-conventions`.

## Core Principle: Cross-Layer Iterations

The key difference from standard TDD: each iteration cuts across ALL layers (API, Domain, SPI) rather than completing one layer at a time.

```
Iteration 1: Controller stub + first Domain behavior
     ↓
Iteration 2: Domain logic + SPI interface
     ↓
Iteration 3: Back to Controller → complete happy path
     ↓
Iteration 4: Edge case handling
     ↓
...continue until feature complete
```

## Example: "New Discount" Feature

Each iteration touches whatever layer is needed next:

1. **Controller route exists** — Functional test: authenticated user gets 200. Implement: empty controller with route.
2. **Eligibility check** — Functional test: ineligible user redirected. Implement: inject specification, add redirect.
3. **Specification logic** — Unit test: 100% completion returns true. Implement: `IsBuyerEligibleForDiscount`.
4. **Wire it up** — Functional test: full flow works. Implement: connect specification to controller.
5. **Edge case** — Unit test: one eligible buyer suffices. Implement: update specification.
6. **Twig component** — Integration test: `canApplyDiscount()` returns correct value. Implement: component method.

Pattern: Happy path first (Controller -> Domain -> SPI -> back to Controller), then edge cases.

## Refactor Phase (After GREEN)

After each GREEN, check for duplication in both code **and** tests.

**Data providers**: When multiple tests have the **same AAA structure** and only differ in input data, consolidate. Criterion: no `if` needed in the test body.

```php
// Same structure, different data → data provider
/**
 * @test
 * @dataProvider provideValidSelections
 */
public function formIsValid(array $selection): void
{
    $form = $this->factory->create(MyForm::class);
    $form->submit(['type' => $selection]);
    self::assertTrue($form->isValid());
}

public static function provideValidSelections(): \Generator
{
    yield 'initialPaymentOnly' => ['selection' => ['initial_payment']];
    yield 'scheduledPaymentOnly' => ['selection' => ['scheduled_payment']];
}
```

Do NOT use a data provider when assertions differ between cases or setup is specific to each case.

## Working Application at Each Iteration

At the end of each GREEN iteration, the app MUST work in dev AND prod. This is the most common mistake: tests pass but the app is broken.

```php
// WRONG: referencing a non-existent template — test passes, app crashes
return new Response($this->twig->render('order/page.html.twig'));

// CORRECT: return empty Response OR create the template (even empty)
return new Response('');
```

**GREEN checklist**: template referenced? create the file. Service injected? declare in services.yaml. Interface used? implement or create a stub. Route added? verify with `debug:router`.

```bash
# After each GREEN, verify the app starts
docker compose exec php bin/console cache:clear
docker compose exec php bin/console lint:container
```

## Always Run Tests

After each phase (RED or GREEN), run the specific test:
- After writing test (RED): confirm it FAILS
- After implementation (GREEN): confirm it PASSES

```bash
docker compose run --rm php ./vendor/bin/phpunit path/to/YourTest.php
# For vendor/acme/* packages:
cd vendor/acme/<package>/ && docker compose run --rm php ./vendor/bin/phpunit tests/Path/To/YourTest.php
```

## Bug Fix Workflow

When something is broken, follow this order **before any code change**:

1. **Find existing tests** — Does a test exist? Why does it pass if behavior is broken? Are mocks hiding the real problem?
2. **Write a failing test** that reproduces the problem using REAL dependencies (not mocks)
3. **Run it** — verify it FAILS
4. **Fix the implementation** — the failing test guides the solution
5. **Run it** — verify it PASSES

```php
// Mocks hide real issues:
$serializer = $this->prophesize(SerializerInterface::class);
$serializer->deserialize(...)->willReturn($expectedResponse); // Always passes!

// Real dependencies expose them:
$serializer = $this->createSerializer();
$result = $httpClient->__invoke(); // Fails if deserialization is broken
```

## New Code Must Have Tests

| Code Created | Tests Required |
|--------------|----------------|
| Feature class | Unit test for business logic |
| Controller | Functional test for endpoint |
| Repository | Integration test with database |
| Specification | Unit test for each rule |
| DTO/Contract | Serialization test (in package) |

## Anti-Patterns

- Completing one layer before starting the next — move between layers in small iterations
- All tests before any implementation — one test, implement, repeat
- Using Integration when Unit suffices — no container needed? use `tests/Unit/`
- Writing implementation before test — always write failing test first
- Skipping back to entry point — return to API layer regularly
- Not running tests after each phase — always verify RED/GREEN
- Incomplete stubs breaking the app — never reference non-existent templates/services

## Commands

```bash
make php/tests                                           # All tests
docker compose exec php ./vendor/bin/phpunit path/to/Test.php  # Specific file
docker compose exec php ./vendor/bin/phpunit --filter=name     # Filter by name
```
