---
name: php-test-conventions
description: "ACTIVATE when writing or modifying PHPUnit tests, creating test classes, using Prophecy, test factories, or data providers. ACTIVATE for 'test naming', 'test doubles', 'spy vs mock', 'serialization tests', 'deserialization tests' in PHP. Provides PHPUnit/Prophecy/Symfony-specific testing patterns; cross-language testing principles (DAMP, AAA, spy>mock, what NOT to test, factories) live in craft:testing-principles. DO NOT use for: TDD workflow/iteration process (see phpunit:php-tdd-workflow)."
version: "2.0"
---

# Test Conventions — PHP

> The **cross-language testing principles** (DAMP, AAA, spy over mock, what NOT to test, factories, structured assertions) are defined in `craft:testing-principles`. This skill keeps PHPUnit/Prophecy/Symfony-specific patterns.

> For TDD workflow / iteration process, see `php-tdd-workflow`.

## Test Types (PHPUnit + Symfony)

| Test Type | Base Class | Purpose |
|-----------|-----------|---------|
| Unit | `TestCase` | No container dependencies, pure logic |
| Unit FormType | `TypeTestCase` | Symfony form type testing |
| Integration | `KernelTestCase` | Needs Symfony container services |
| Functional / Acceptance | `WebTestCase` | HTTP request/response, E2E scenarios |

> For FormType testing details, see [references/formtype-testing.md](references/formtype-testing.md).

## Symfony-specific: What NOT to Test (Form Structure)

The `craft:testing-principles` rule "don't re-verify what a higher-level test already covers" has a frequent FormType expression:

```php
// ❌ Avoid — just re-states the FormType composition
public function transfersExposesCollectionAndAllocationsAtTopLevel(): void
{
    $form = $this->factory->create(PaymentForm::class, ...);
    self::assertTrue($form->get('transfer')->has('collection'));
    self::assertTrue($form->get('transfer')->has('allocations'));
}
```

The test `transfersCollectionAcceptsMultipleTransfersWithSingleAllocation` already fails if either sub-form is missing.

**Common false-positives** to avoid:
- Collection-empty tests when the business rule requires ≥ 1 (already caught by the clean-listener test).
- "Form exposes X" tests that just re-state the FormType composition.
- "Field has type Y" tests that just re-state the FormType configuration.

## PHP-specific: Exception Test Naming

When a test verifies an exception, the test method name **must include the exception class name**:

```php
// ❌ Avoid
public function itThrowsWhenBirthDateIsMissing(): void

// ✅ Correct
public function itThrowsMissingBuyerBirthDateWhenBirthDateIsMissing(): void
```

Pattern: `itThrows{ExceptionClassName}When{Condition}`

## PHP-specific: Test Method Naming

Check the project's convention:

```php
/** @test */
public function buyerWith100PercentProfileIsEligible(): void   // @test annotation

public function testBuyerWith100PercentProfileIsEligible(): void // test prefix
```

## PHP-specific: Spy Pattern (Prophecy)

```php
// ❌ Mock pattern (expectations before act — violates AAA)
$service->method('call')->with($arg)->shouldBeCalled();
$sut->execute();

// ✅ Spy pattern (verification after act)
$sut->execute();
$service->call($arg)->shouldHaveBeenCalled();
```

## PHP-specific: Test Doubles

Use manual stubs for simple cases, **Prophecy** for complex dependencies, **Guzzle MockHandler** for HTTP clients.

> For detailed patterns and best practices, see [references/test-doubles.md](references/test-doubles.md).

## PHP-specific: Data Providers (PHPUnit syntax)

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

## PHP-specific: SUT Naming

Use meaningful names when clear, `$sut` when generic:

```php
$specification = new IsBuyerEligibleForDiscount();  // ✅ Clear
$sut = new IsBuyerEligibleForDiscount();            // ✅ Also acceptable
```

## PHP-specific: Factory Methods

Helper methods in the test class. When duplicated across tests, extract to a dedicated Factory class:

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

## PHP-specific: Assertion Patterns

Use `assertEquals` with a complete expected object rather than multiple property assertions. For advanced patterns (computed properties, guard assertions), see [references/assertion-patterns.md](references/assertion-patterns.md).

## Symfony-specific: API Functional Tests

For API functional tests (`WebTestCase`) with deterministic data (fixtures), **assert the full JSON response directly** with `assertJsonStringEqualsJsonString` and a JSON heredoc. Do not decode the response to check individual properties.

For examples and when to use/not use, see [references/api-json-testing.md](references/api-json-testing.md).

## PHP-specific: HTTP Client Testing

When testing API clients, always use a **real serializer** to catch deserialization issues. For detailed patterns and SerializerRegistry setup, see [references/http-testing.md](references/http-testing.md).

## Quick Reference (PHP-specific)

| Situation | Approach |
|-----------|----------|
| Simple value objects | Manual stubs |
| Complex dependencies | Prophecy — see [references/test-doubles.md](references/test-doubles.md) |
| HTTP client testing | Guzzle MockHandler — see [references/http-testing.md](references/http-testing.md) |
| Verify method called (Prophecy) | `$dep->method($args)->shouldHaveBeenCalled()` |
| API JSON response (deterministic) | `assertJsonStringEqualsJsonString` with JSON heredoc — see [references/api-json-testing.md](references/api-json-testing.md) |
| FormType testing | `TypeTestCase` — see [references/formtype-testing.md](references/formtype-testing.md) |
| Advanced assertions | See [references/assertion-patterns.md](references/assertion-patterns.md) |
| Exception test naming | `itThrows{ExceptionClassName}When{Condition}` |
