---
name: php-test-conventions
description: "ACTIVATE when writing or modifying PHPUnit tests, creating test classes, using Prophecy, test factories, or data providers. ACTIVATE for 'test naming', 'test doubles', 'DAMP', 'spy vs mock', 'test organization', 'serialization tests', 'deserialization tests'. Covers: DAMP over DRY, Spy over Mock (AAA), exception test naming, what NOT to test, factory methods, assertion patterns. Key rules: assertEquals with complete expected object over multiple assertSame/property assertions — read assertion-patterns.md. DO NOT use for: TDD workflow/iteration process (see php-tdd-workflow), Symfony form testing setup."
version: "1.1"
---

# Test Conventions

> For TDD workflow and iteration process, see `php-tdd-workflow`.

## Test Types

| Test Type | Base Class | Purpose |
|-----------|-----------|---------|
| Unit | `TestCase` | No container dependencies, pure logic |
| Unit FormType | `TypeTestCase` | Symfony form type testing |
| Integration | `KernelTestCase` | Needs Symfony container services |
| Functional/Acceptance | `WebTestCase` | HTTP request/response, E2E scenarios |

> For FormType testing details, see [references/formtype-testing.md](references/formtype-testing.md).

## Unit vs Integration Decision

```
Does the test need Symfony container?
├─ NO → Unit test (PHPUnit\Framework\TestCase)
└─ YES → Integration test (KernelTestCase)
```

## What NOT to Test

**Never write tests coupled to implementation without logic.** Only test classes that have behavior worth verifying:

| Worth testing | Not worth testing |
|---------------|-------------------|
| Business logic / domain rules | Simple DTOs with only getters |
| Validation logic | Events with only properties |
| Serialization / deserialization | Value objects without logic |
| Calculations / transformations | Data containers |
| State machines / workflows | Entities with only setters/getters |
| Form binding behavior (submit -> data) | Form structure (`$form->has(KEY)`, `$form->get(KEY)` for existence only) |
| Form clean/transform listeners | Tests that re-verify what a higher-level test already validates |

**Rule**: If the test only verifies that a getter returns what was passed to the constructor, delete it.

**Rule extension (Form structure)**: If a higher-level behavior test (form is valid with N items, data is cleared on submit) would fail when the structure breaks, do NOT add a separate `formExposesXAndY` test.

```php
// ❌ Avoid - just re-states the FormType composition
public function transfersExposesCollectionAndAllocationsAtTopLevel(): void
{
    $form = $this->factory->create(PaymentForm::class, ...);
    self::assertTrue($form->get('transfer')->has('collection'));
    self::assertTrue($form->get('transfer')->has('allocations'));
}
```

The test `transfersCollectionAcceptsMultipleTransfersWithSingleAllocation` already fails if either sub-form is missing.

## Pre-Test Checklist

Before writing a new test, confront it to these 3 questions. If you can't answer "yes" to all three, do not write the test.

1. **Does this scenario represent a valid business state?** A test for a state that production can't reach (e.g., empty collection when business rule mandates >= 1 item) tests nothing real.
2. **Is this behavior NOT already covered transitively by a higher-level test?** If the multi-item happy-path test would fail when the structure breaks, a separate structural test adds no signal.
3. **Does the assertion express a behavior, not an implementation detail?** `$form->has(KEY)` or `count($form) === 3` after a submit of 3 items both look like assertions, but only the second one tests behavior.

**Common false-positive cases**:
- Collection-empty cases when the business rule requires >= 1 (already caught by the clean-listener test).
- "Form exposes X" tests that just re-state the FormType composition.
- "Field has type Y" tests that just re-state the FormType configuration.

## Exception Test Naming

When a test verifies that an exception is thrown, the test method name **must include the exception class name**:

```php
// ❌ Avoid
public function itThrowsWhenBirthDateIsMissing(): void

// ✅ Correct
public function itThrowsMissingBuyerBirthDateWhenBirthDateIsMissing(): void
```

Pattern: `itThrows{ExceptionClassName}When{Condition}`

## DAMP Principle

**Prefer DAMP (Descriptive And Meaningful Phrases) over DRY in tests.**

Avoid `setUp()` methods. Keep the full test lifecycle in each test case:

```php
public function buyerWith100PercentProfileIsEligible(): void
{
    $specification = new IsBuyerEligibleForDiscount();
    $buyer = $this->createBuyerWithProfile(100);

    $result = $specification->isSatisfiedBy($buyer);

    self::assertTrue($result);
}
```

## Test Method Naming

Check the project's convention:

```php
/** @test */
public function buyerWith100PercentProfileIsEligible(): void   // @test annotation

public function testBuyerWith100PercentProfileIsEligible(): void // test prefix
```

## AAA/GWT Pattern

Respect **Arrange-Act-Assert** or **Given-When-Then** structure without comments:

```php
public function buyerWith100PercentProfileIsEligible(): void
{
    $specification = new IsBuyerEligibleForDiscount();
    $buyer = $this->createBuyerWithProfile(100);

    $result = $specification->isSatisfiedBy($buyer);

    self::assertTrue($result);
}
```

**Spy over Mock** to respect AAA (verify after act):

```php
// ❌ Mock pattern (expectations before act)
$service->method('call')->with($arg)->shouldBeCalled();
$sut->execute();

// ✅ Spy pattern (verification after act)
$sut->execute();
$service->call($arg)->shouldHaveBeenCalled();
```

## Test Doubles

Use manual stubs for simple cases, Prophecy for complex dependencies, Guzzle MockHandler for HTTP clients.

For detailed patterns and best practices, see [references/test-doubles.md](references/test-doubles.md).

## Data Providers

Use data providers when scenarios differ only by input/output:

```php
/**
 * @dataProvider provideProfileAndExpectedEligibility
 */
public function isSatisfiedByDependingOnProfile(
    int $profilePercentage,
    bool $expectedEligibility,
): void {
    $specification = new IsBuyerEligibleForDiscount();
    $buyer = $this->createBuyerWithProfile($profilePercentage);

    self::assertSame($expectedEligibility, $specification->isSatisfiedBy($buyer));
}

public static function provideProfileAndExpectedEligibility(): \Generator
{
    yield '0% - not eligible' => [
        'profilePercentage' => 0,
        'expectedEligibility' => false,
    ];

    yield '100% - eligible' => [
        'profilePercentage' => 100,
        'expectedEligibility' => true,
    ];
}
```

## SUT Naming

Use meaningful names when clear, `$sut` when generic:

```php
$specification = new IsBuyerEligibleForDiscount();  // ✅ Clear
$sut = new IsBuyerEligibleForDiscount();            // ✅ Also acceptable
```

## Factory Methods

Create helper methods in the test class. When duplicated across tests, extract to a dedicated Factory class:

```php
private function createBuyerWithProfile(int $percentage): Buyer
{
    $profileCompletion = ProfileCompletionFactory::createAtPercentage($percentage);
    $profile = new Profile();
    $profile->setProfileCompletion($profileCompletion);
    $buyer = new Buyer();
    $buyer->setProfile($profile);

    return $buyer;
}
```

## Assertion Patterns

Use `assertEquals` with a complete expected object rather than multiple property assertions. For advanced patterns (computed properties, guard assertions), see [references/assertion-patterns.md](references/assertion-patterns.md).

## API Functional Tests — Assert the Full JSON Response

For API functional tests (`WebTestCase`) with deterministic data (fixtures), **assert the full JSON response directly** with `assertJsonStringEqualsJsonString` and a JSON heredoc. Do not decode the response to check individual properties, and do not `json_encode` a PHP array.

For examples and when to use/not use, see [references/api-json-testing.md](references/api-json-testing.md).

## HTTP Client Testing

When testing API clients, always use a **real serializer** to catch deserialization issues. For detailed patterns and SerializerRegistry setup, see [references/http-testing.md](references/http-testing.md).

## Quick Reference

| Situation | Approach |
|-----------|----------|
| Simple value objects | Manual stubs |
| Complex dependencies | Prophecy — see [references/test-doubles.md](references/test-doubles.md) |
| HTTP client testing | Guzzle MockHandler — see [references/http-testing.md](references/http-testing.md) |
| Same logic, different data | Data provider |
| Duplicated factory | Factory class |
| Verify method called | Spy (`shouldHaveBeenCalled`) |
| Setup code | In test method (DAMP) |
| Compare objects | `assertEquals` with expected object |
| API JSON response (deterministic) | `assertJsonStringEqualsJsonString` with JSON heredoc — see [references/api-json-testing.md](references/api-json-testing.md) |
| FormType testing | `TypeTestCase` — see [references/formtype-testing.md](references/formtype-testing.md) |
| Advanced assertions | See [references/assertion-patterns.md](references/assertion-patterns.md) |
