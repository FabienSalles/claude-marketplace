---
name: php-test-conventions
description: "ACTIVATE when writing or modifying PHPUnit tests, creating test classes, using Prophecy, test doubles, test factories, or data providers. ACTIVATE for 'test naming', 'test doubles', 'spy vs mock', 'serialization tests', 'deserialization tests', 'data provider', 'MockHandler' in PHP. Provides framework-agnostic PHPUnit/Prophecy patterns; cross-language testing principles (DAMP, AAA, spy>mock, what NOT to test, factories) live in craft:testing-principles. DO NOT use for: tests that boot Symfony — WebTestCase, KernelTestCase, TypeTestCase, crawler assertions, container doubles (see symfony:symfony-test-conventions), TDD workflow/iteration process (see phpunit:php-tdd-workflow)."
version: "3.0"
---

# Test Conventions — PHP

> The **cross-language testing principles** (DAMP, AAA, spy over mock, what NOT to test, factories, structured assertions) are defined in `craft:testing-principles`. This skill keeps the PHPUnit/Prophecy patterns that hold in any PHP project, framework or not.

> **Anything that boots Symfony** — `WebTestCase` / `KernelTestCase` / `TypeTestCase`, crawler and built-in HTTP assertions, FormType tests, container doubles — lives in `symfony:symfony-test-conventions`. Load both when the test needs a kernel.

> For TDD workflow / iteration process, see `php-tdd-workflow`.

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

Prefer an existing real / null implementation when it reads cleaner (an unverified logger → `new NullLogger()`, not a mocked interface). Otherwise: **manual stubs** for simple cases, **Prophecy** for complex dependencies, **Guzzle MockHandler** for HTTP clients.

**Prophecy is the rule, not a statistic.** A double that needs scripting or verification is
`prophesize()` — not `createMock()` + `willReturnCallback()`. Never arbitrate by counting
existing usages in the repo ("15 files use createMock"): a convention is a rule, not a
majority vote. `createMock` survives only where Prophecy technically cannot (final class
without an interface).

> For the full hierarchy and examples, see [references/test-doubles.md](references/test-doubles.md).

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

## PHP-specific: Providers That Decline a Contract Enum

When the datasets enumerate an enum's cases, **derive them from `::cases()`** — a hardcoded
list breaks at the first new case and buries which one is excluded:

```php
$everySource = SwisslifeFundSourceOption::cases();
$everySourceButTheEmploymentIncome = [];

foreach ($everySource as $source) {
    if ($source === SwisslifeFundSourceOption::EmploymentIncome) {
        continue;
    }

    $everySourceButTheEmploymentIncome[] = $source;
}
```

Assert with `assertSame` on **lists of the same enum** — map the SUT's output back with
`::from()` — never `in_array` on strings plus an arithmetic `assertCount`: only compared
lists show exactly which case went missing.

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

## PHP-specific: HTTP Client Testing

When testing API clients, always use a **real serializer** to catch deserialization issues. For detailed patterns and SerializerRegistry setup, see [references/http-testing.md](references/http-testing.md).

## Quick Reference (PHP-specific)

| Situation | Approach |
|-----------|----------|
| Simple value objects | Manual stubs |
| Complex dependencies | Prophecy — see [references/test-doubles.md](references/test-doubles.md) |
| HTTP client testing | Guzzle MockHandler — see [references/http-testing.md](references/http-testing.md) |
| Verify method called (Prophecy) | `$dep->method($args)->shouldHaveBeenCalled()` |
| Double needing scripting/verification | Prophecy (`prophesize`) — never `createMock`; never arbitrate by usage counts |
| Provider over a contract enum | Derive datasets from `::cases()` with a named exclusion; `assertSame` on enum lists |
| Anything needing a Symfony kernel | `symfony:symfony-test-conventions` — `WebTestCase` / `KernelTestCase` / `TypeTestCase`, crawler, container doubles |
| Advanced assertions | See [references/assertion-patterns.md](references/assertion-patterns.md) |
| Exception test naming | `itThrows{ExceptionClassName}When{Condition}` |
