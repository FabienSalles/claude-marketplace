---
name: php-tdd-workflow
description: "ACTIVATE when the user wants to build, implement, or develop any new feature, endpoint, or user story using TDD in PHP/Symfony. ACTIVATE for the '/feature-tdd-dev' command alongside PHP context. Provides PHP/Symfony/PHPUnit-specific TDD examples and commands; cross-language TDD workflow (cross-layer iterations, RED-GREEN-REFACTOR, working app at each GREEN, bug-fix-first-test) lives in craft:tdd-workflow-principles. DO NOT use for: test writing conventions (see phpunit:php-test-conventions), general PHP questions."
version: "2.0"
---

# TDD Workflow — PHP / Symfony

> The **cross-language TDD process** (cross-layer iterations, RED-GREEN-REFACTOR, working-app-at-each-GREEN, bug-fix workflow, mocks-hiding-bugs) is defined in `craft:tdd-workflow-principles`. This skill keeps PHP/Symfony/PHPUnit-specific examples and commands.

> For test writing conventions (DAMP, Prophecy, factories), see `php-test-conventions`.

## Symfony-specific: Iteration Example

**"New Discount" feature** — each iteration touches whatever layer is needed next:

1. **Controller route exists** — Functional test (`WebTestCase`): authenticated user gets 200. Implement: empty controller with route.
2. **Eligibility check** — Functional test: ineligible user redirected. Implement: inject specification, add redirect.
3. **Specification logic** — Unit test: 100% completion returns `true`. Implement: `IsBuyerEligibleForDiscount`.
4. **Wire it up** — Functional test: full flow works. Implement: connect specification to controller.
5. **Edge case** — Unit test: one eligible buyer suffices. Implement: update specification.
6. **Twig component** — Integration test: `canApplyDiscount()` returns correct value. Implement: component method.

## PHP-specific: Refactor with Data Providers

After GREEN, when multiple tests have the **same AAA structure** and only differ in input data, consolidate. Criterion: no `if` in the test body.

```php
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
    yield 'initialPaymentOnly'  => ['selection' => ['initial_payment']];
    yield 'scheduledPaymentOnly' => ['selection' => ['scheduled_payment']];
}
```

## Symfony-specific: End-of-Iteration GREEN Checklist

At the end of each GREEN, in addition to the cross-language checklist (see `craft:tdd-workflow-principles`):

| Check | PHP/Symfony action |
|-------|--------------------|
| Template referenced? | Create the file (even empty) |
| Service injected? | Declare in `services.yaml` |
| Interface used? | Implement or create a stub |
| Route added? | Verify with `bin/console debug:router` |

```bash
# After each GREEN, verify the app starts
docker compose exec php bin/console cache:clear
docker compose exec php bin/console lint:container
```

## PHP-specific: Mocks Hiding Bugs (Prophecy example)

```php
// Mocks hide real issues
$serializer = $this->prophesize(SerializerInterface::class);
$serializer->deserialize(...)->willReturn($expectedResponse); // Always passes

// Real dependencies expose them
$serializer = $this->createSerializer();
$result = $httpClient->__invoke(); // Fails if deserialization is broken
```

## PHP-specific: Default Test Level

Whether a unit earns a test at all is `craft:testing-principles`' call, not this table's. Once a test **is** earned, these are the PHP/Symfony defaults:

| Code Created | Default level |
|--------------|----------------|
| Feature class | Unit test for business logic |
| Controller | Functional test (`WebTestCase`) for endpoint |
| Repository | Integration test with database (`KernelTestCase`) |
| Specification | Unit test for each rule |
| DTO / Contract | Serialization test (in package) |

## PHP-specific: Commands

```bash
# All tests
make php/tests

# Specific test file
docker compose exec php ./vendor/bin/phpunit path/to/Test.php

# Filter by test name
docker compose exec php ./vendor/bin/phpunit --filter=name

# Verify a test fails (RED) before implementing
docker compose run --rm php ./vendor/bin/phpunit path/to/YourTest.php

# Vendor packages (e.g. vendor/acme/*)
cd vendor/acme/<package>/ && docker compose run --rm php ./vendor/bin/phpunit tests/Path/To/YourTest.php
```
