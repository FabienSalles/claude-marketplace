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

Prefer an existing real / null implementation when it reads cleaner (an unverified logger → `new NullLogger()`, not a mocked interface). Otherwise: **manual stubs** for simple cases, **Prophecy** for complex dependencies, **Guzzle MockHandler** for HTTP clients.

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

## Symfony-specific: Interface (HTML) Functional Tests

For interface tests (`WebTestCase` rendering an HTML page), **one rendered dataset = one success test method**. A single GET renders one page; assert everything about that page (rows, chips, links, fields, data islands, absence of orphan translation keys) inside **one** `@test` method reusing a single crawler.

Do **not** fragment one rendered response into many tiny `@test` methods that each re-issue the same request and assert one thing — it multiplies HTTP round-trips, hides that they share a dataset, and reads as many features when it is one.

**Assert the real content the user sees, not just wiring.** A functional test proves *behaviour*: the expected names, amounts, labels, field values, selected/disabled state actually render. Selectors (CSS classes, `js-*` hooks) are only there to **locate** an element — asserting element presence or counts by class alone (`assertCount(2, filter('.row'))`) tests plumbing, not function, and passes even when every row shows the wrong data. Locate with the selector, then assert what the user reads:

```php
// ❌ Technical — passes even if the row renders garbage
self::assertCount(1, $crawler->filter('.default-badge'));

// ✅ Functional — the right account is flagged default, pre-selected, with its IBAN
$default = $crawler->filter('.account-row')->eq(0);
self::assertStringContainsString('M. Jean Dupont', $default->text());
self::assertStringContainsString('IBAN : FR76…3456 - Banque Populaire', $default->text());
self::assertStringContainsString('Compte par défaut', $default->text());
self::assertNotNull($default->filter('input[type="radio"]')->attr('checked'));
```

Presence/count-by-class is acceptable only as a secondary invariant next to content assertions (e.g. "exactly one default badge on the page"), never as the whole test.

**Locate via markup production already emits — never add a hook for the test** (see `craft:testing-principles` §12). Do not add a `js-*` class, `id`, or attribute to a template/FormType *only* so the crawler can find the element. Locate by the real field name (`input[name$="[account_ownership]"]`) or a class the framework/theme genuinely renders (e.g. `.form-check-inline` produced by a `radio-inline` label). A `js-*` selector is legitimate **only** when it is a real JS hook the feature already needs; using one purely as a test anchor is production code that serves the test, and must not exist.

```php
// ❌ Avoid — one request re-issued per assertion, one @test each
public function rendersAtLeastTwoRows(): void { /* request + 1 assert */ }
public function rendersExactlyOneChip(): void { /* same request + 1 assert */ }
public function rendersOneEditLinkPerRow(): void { /* same request + 1 assert */ }

// ✅ Prefer — one dataset, one success test, one crawler, grouped assertions
/** @test */
public function displaysTheAccountsList(): void
{
    $this->logInAsCgp();

    $crawler = $this->client->request('GET', self::URL);

    self::assertResponseStatusCodeSame(200);
    $rows = $crawler->filter('.account-row');
    self::assertGreaterThanOrEqual(2, $rows->count());
    self::assertCount(1, $crawler->filter('.default-badge'));
    self::assertSame($rows->count(), $crawler->filter('.edit-link')->count());
    // …the rest of the page's contract, same crawler…
}
```

Use `$crawler->filter('.css-selector')` for class matching (requires `symfony/css-selector`, a `require-dev` in any test-bearing project). It is the whole-token `.class` match — don't hand-roll `filterXPath('//*[contains(@class, ...)]')`, whose naive substring also matches `card-header`/`cards`.

**Multiple datasets → multiple tests is correct.** Split by *scenario/state* (empty list vs populated, role A vs role B, feature flag on/off), not by *assertion*. Each distinct rendered state gets its own success test; a `@dataProvider` is fine when the states are parametric.

Business-rule traceability (Rn → assertion) lives in the spec/plan, not in per-rule test methods. Keep the interface test DAMP: descriptive local variables, no per-assertion comments.

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
