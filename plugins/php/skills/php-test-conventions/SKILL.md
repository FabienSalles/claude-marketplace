---
name: php-test-conventions
description: "ACTIVATE when writing or modifying PHPUnit tests, creating test classes, using Prophecy, test factories, or data providers. ACTIVATE for 'test naming', 'test doubles', 'DAMP', 'spy vs mock', 'test organization'. Covers: DAMP over DRY, Spy over Mock (AAA), exception test naming, what NOT to test, factory methods, assertion patterns. DO NOT use for: TDD workflow/iteration process (see php-tdd-workflow), Symfony form testing setup."
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

**Rule**: If the test only verifies that a getter returns what was passed to the constructor, delete it.

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
| FormType testing | `TypeTestCase` — see [references/formtype-testing.md](references/formtype-testing.md) |
| Advanced assertions | See [references/assertion-patterns.md](references/assertion-patterns.md) |
