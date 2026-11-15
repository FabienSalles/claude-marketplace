---
name: php-test-conventions
description: "ACTIVATE when writing or modifying PHPUnit tests, creating test classes, using Prophecy, test doubles, test factories, or data providers. ACTIVATE for 'test naming', 'test doubles', 'spy vs mock', 'serialization tests', 'deserialization tests', 'data provider', 'MockHandler' in PHP. Provides framework-agnostic PHPUnit/Prophecy patterns; cross-language testing principles (DAMP, AAA, spy over mock, what NOT to test, factories) live in craft:testing-principles. DO NOT use for: tests that boot Symfony — WebTestCase, KernelTestCase, TypeTestCase, crawler assertions, container doubles (see symfony:symfony-test-conventions), TDD workflow/iteration process (see phpunit:php-tdd-workflow)."
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

### No try-catch in a Test Body

Declare the exception with `expectException*()`, never catch it: a `try`/`catch` test stays
green when nothing is thrown, because the assertions in the `catch` never run. When the
exception carries data the `expectException*()` methods cannot reach (a list of violations),
end the `try` block with `self::fail()` so a missing exception fails the test. `try`/`finally`
without `catch` stays allowed for cleanup.

```php
// ❌ Green when parse() stops throwing
try {
    $parser->parse('ten');
} catch (InvalidAmount $exception) {
    self::assertSame('ten', $exception->input);
}

// ✅ The expectation fails the test when nothing is thrown
$this->expectExceptionObject(new InvalidAmount('ten'));

$parser->parse('ten');

// ✅ Data out of reach of expectException*(): fail() closes the try
try {
    $validator->validate($order);
    self::fail('Expected InvalidOrder');
} catch (InvalidOrder $exception) {
    self::assertSame(['amount', 'currency'], $exception->fields());
}
```

### The Act Is the Last Line After expectException

The statement right after the last `expectException*()` is the act; it throws, and PHPUnit ends
the test there. Anything after it is dead code that reads as a check. A second behaviour gets
its own test.

```php
// ❌ The assertion after the throwing act never runs
$this->expectException(AccountAlreadyClosed::class);
$account->close();
self::assertSame('CLOSED', $account->status());

// ✅ The act is the last statement
$this->expectException(AccountAlreadyClosed::class);

$account->close();
```

## PHP-specific: Test Method Naming

Check the project's convention:

```php
/** @test */
public function buyerWith100PercentProfileIsEligible(): void   // @test annotation

public function testBuyerWith100PercentProfileIsEligible(): void // test prefix
```

### Test Class Suffix

Every concrete `TestCase` subclass ends with `Test` (or the suffix the project configures):
PHPUnit collects the files ending with `Test.php`, so `CartChecks` never runs. Abstract base
classes (`OrderTestCase`) are exempt.

```php
// ❌ Skipped by the suite without a word
final class CartChecks extends TestCase

// ✅
final class CartTest extends TestCase
```

### Every Assertion Method Is Discoverable

A method holding assertions either is a test (`test` prefix, `#[Test]`, or `@test` before
PHPUnit 12) or is reached by one: called from a test, a hook such as `setUp()`, or named as a
data provider. Renaming `testSumsThePrices()` to `sumsThePrices()` without `#[Test]`, or
moving to PHPUnit 12, which no longer reads `@test`, silently disables the test. An
assertion helper called by a test is fine.

```php
// ❌ Looks like a test, never runs
public function sumsThePrices(): void
{
    self::assertSame(30, (new Cart([10, 20]))->total());
}

// ✅ Marked, or a helper that a test calls
#[Test]
public function sumsThePrices(): void
{
    $this->assertTotal(30, new Cart([10, 20]));
}
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
majority vote. When Prophecy is not installed, or cannot double the class (final class
without an interface), a hand-written double comes first; `createMock()` +
`willReturnCallback()` is the last resort, never an error to report by itself.

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

## PHP-specific: No TestCase Constructor

Never declare `__construct()` in a `TestCase`. PHPUnit instantiates the class once per test
and data set, at collection time, outside `setUp()`/`tearDown()`; whatever the constructor
builds is a hidden fixture shared by every test. PHPUnit 12 makes the constructor final; on
PHPUnit 11 the override is silently accepted. Build the scenario in each test's Arrange, the
environment in `setUp()`.

```php
// ❌ Runs at collection time, shared by every test
public function __construct(string $name)
{
    parent::__construct($name);
    $this->cart = new Cart();
}

// ✅ Built where the test reads it
public function testAddsAPrice(): void
{
    $cart = new Cart();

    $cart->add(10);

    self::assertSame(10, $cart->total());
}
```

## PHP-specific: Assertion Patterns

Use `assertEquals` with a complete expected object rather than multiple property assertions. For advanced patterns (computed properties, guard assertions), see [references/assertion-patterns.md](references/assertion-patterns.md).

## PHP-specific: HTTP Client Testing

When a test checks what an API client deserializes, use a **real serializer**, built in the test or fetched from the container, to catch deserialization issues. Mock it only when serialization is tested elsewhere, and never expect what the stub returns. For detailed patterns and SerializerRegistry setup, see [references/http-testing.md](references/http-testing.md).

## Quick Reference (PHP-specific)

| Situation | Approach |
|-----------|----------|
| Simple value objects | Manual stubs |
| Complex dependencies | Prophecy — see [references/test-doubles.md](references/test-doubles.md) |
| HTTP client testing | Guzzle MockHandler — see [references/http-testing.md](references/http-testing.md) |
| Verify method called (Prophecy) | `$dep->method($args)->shouldHaveBeenCalled()` |
| Double needing scripting/verification | Prophecy (`prophesize`); without Prophecy, a hand-written double first, `createMock` + callback last resort; never arbitrate by usage counts |
| Provider over a contract enum | Derive datasets from `::cases()` with a named exclusion; `assertSame` on enum lists |
| Anything needing a Symfony kernel | `symfony:symfony-test-conventions` — `WebTestCase` / `KernelTestCase` / `TypeTestCase`, crawler, container doubles |
| Advanced assertions | See [references/assertion-patterns.md](references/assertion-patterns.md) |
| Exception test naming | `itThrows{ExceptionClassName}When{Condition}` |
| Exception test body | `expectException*()` then the act as the last line; no `try`/`catch` unless the `try` ends with `self::fail()` |
| Test discovery | Class ends with `Test`; every method with assertions is a test or reached by one |
| TestCase constructor | Never; scenario in the Arrange, environment in `setUp()` |
