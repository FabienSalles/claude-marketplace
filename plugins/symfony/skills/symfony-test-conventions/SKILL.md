---
name: symfony-test-conventions
description: "ACTIVATE when writing or modifying a test that boots Symfony — WebTestCase, KernelTestCase, TypeTestCase, functional/interface tests, FormType tests, or container service doubles. ACTIVATE for 'crawler', 'assertSelectorTextContains', 'assertResponseRedirects', 'assertSelectorExists', 'followRedirect', 'disableReboot', 'getContainer()->set', 'TypeTestCase', 'functional test', 'test fonctionnel', 'test d'interface'. Covers: which base class to pick, built-in WebTestCase assertions over hand-rolled crawler reads, one-dataset-one-test for HTML pages, full-JSON assertion for API endpoints, FormType testing, and container-double traps. DO NOT use for: PHPUnit/Prophecy patterns independent of Symfony — doubles, data providers, test naming, factories (see phpunit:php-test-conventions), TDD workflow (see phpunit:php-tdd-workflow), FormType design itself (see symfony:symfony-form)."
version: "1.0"
---

# Test Conventions — Symfony

Everything here needs a **Symfony base class or the container**. The framework-agnostic
PHPUnit discipline — test doubles, Prophecy, data providers, naming, factories, assertion
patterns — lives in `phpunit:php-test-conventions`, and the cross-language principles (DAMP,
AAA, spy over mock, what NOT to test) in `craft:testing-principles`. Load this one *alongside*
them, not instead.

## Picking a base class

| Test type | Base class | Purpose |
|---|---|---|
| Unit | `TestCase` | No container, pure logic — no Symfony needed |
| Unit FormType | `TypeTestCase` | FormType in isolation |
| Integration | `KernelTestCase` | Needs container services |
| Functional / Acceptance | `WebTestCase` | HTTP request/response, E2E scenarios |

Pick the **cheapest** one that exercises the behaviour. Booting a kernel to observe a pure
function is the most common overspend — a transformation from a projection to form data is a
`TestCase`, even though both types come from a Symfony-shaped layer.

> FormType testing details: [references/formtype-testing.md](references/formtype-testing.md).

## Where a form rule's assertion lives

The table above says what boots; this one says **which test owns which assertion**. The
governing principle is `craft:testing-principles` §14 — the level where the business intent
reads best; the deciding class is the last resort when no higher level stays legible.

| The rule | Its test |
|---|---|
| an option / constraint of the form type | `TypeTestCase` on the **real** type that carries it — never a test-only concrete subclass |
| which business context sets the option | unit test of the orchestrator (strategy / handler): `prophesize` the `FormFactoryInterface`, assert the options passed to `create()` with `Argument::withEntry(...)` |
| the full chain | **one** `WebTestCase` path per observable effect — the request reaches (or not) the port, the field carries the error |

The placement smell: **re-reading through the crawler a list a lower level owns** (`<option>`
extraction, select states). That assertion scrapes a consequence instead of naming the rule —
keep the crawler for what only the rendered page can show.

## What NOT to test: FormType structure

The `craft:testing-principles` rule "don't re-verify what a higher-level test already covers"
has a frequent FormType expression:

```php
// ❌ Avoid — just re-states the FormType composition
public function transfersExposesCollectionAndAllocationsAtTopLevel(): void
{
    $form = $this->factory->create(PaymentForm::class, ...);
    self::assertTrue($form->get('transfer')->has('collection'));
    self::assertTrue($form->get('transfer')->has('allocations'));
}
```

The test `transfersCollectionAcceptsMultipleTransfersWithSingleAllocation` already fails if
either sub-form is missing.

**Common false-positives** to avoid:
- Collection-empty tests when the business rule requires ≥ 1 (already caught by the clean-listener test).
- "Form exposes X" tests that just re-state the FormType composition.
- "Field has type Y" tests that just re-state the FormType configuration.

## Interface (HTML) functional tests

### Use the built-in assertions before the crawler

`WebTestCase` ships a full assertion vocabulary. Nearly every hand-rolled crawler read has a
one-line equivalent that reads better **and** fails better — it names the selector and the
expectation in the failure message, and bundles the existence check you would otherwise
forget.

```php
// ❌ Hand-rolled — errors with "The current node list is empty" when absent,
//    and the trim() duplicates what the constraint already does
self::assertSame('Déclaration enregistrée.', trim($crawler->filter('.alert-success')->text()));

// ✅ Built-in — asserts the selector exists AND the text matches
self::assertSelectorTextContains('.alert-success', 'Déclaration enregistrée.');
```

The full catalogue — response/routing, content, form state, mail — is in
[references/interface-assertions.md](references/interface-assertions.md). Keep the crawler
only for assertions **scoped to a sub-tree** (`$rows->eq(2)`), since the built-ins always
query the whole document.

### One rendered dataset = one success test method

A single GET renders one page; assert everything about that page (rows, chips, links, fields,
data islands, absence of orphan translation keys) inside **one** `@test` method reusing a
single crawler.

Do **not** fragment one rendered response into many tiny `@test` methods that each re-issue
the same request and assert one thing — it multiplies HTTP round-trips, hides that they share
a dataset, and reads as many features when it is one.

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

    self::assertResponseIsSuccessful();
    $rows = $crawler->filter('.account-row');
    self::assertGreaterThanOrEqual(2, $rows->count());
    self::assertSelectorCount(1, '.default-badge');
    self::assertSame($rows->count(), $crawler->filter('.edit-link')->count());
    // …the rest of the page's contract, same crawler…
}
```

**Multiple datasets → multiple tests is correct.** Split by *scenario/state* (empty list vs
populated, role A vs role B, feature flag on/off), not by *assertion*. Each distinct rendered
state gets its own success test; a `@dataProvider` is fine when the states are parametric.

### Assert the content the user sees, not the wiring

A functional test proves *behaviour*: the expected names, amounts, labels, field values,
selected/disabled state actually render. Selectors are only there to **locate** an element —
asserting presence or counts by class alone tests plumbing, and passes even when every row
shows the wrong data.

```php
// ❌ Technical — passes even if the row renders garbage
self::assertSelectorCount(1, '.default-badge');

// ✅ Functional — the right account is flagged default, pre-selected, with its IBAN
$default = $crawler->filter('.account-row')->eq(0);
self::assertStringContainsString('M. Jean Dupont', $default->text());
self::assertStringContainsString('IBAN : FR76…3456 - Banque Populaire', $default->text());
self::assertStringContainsString('Compte par défaut', $default->text());
self::assertCheckboxChecked('payment_information[account_ownership]');
```

Presence/count-by-class is acceptable only as a secondary invariant next to content
assertions ("exactly one default badge on the page"), never as the whole test.

### Locate via markup production already emits

Never add a hook for the test (see `craft:testing-principles` §12). Do not add a `js-*` class,
`id`, or attribute to a template/FormType *only* so the crawler can find the element. Locate
by the real field name (`input[name$="[account_ownership]"]`) or a class the framework/theme
genuinely renders (e.g. `.form-check-inline` produced by a `radio-inline` label). A `js-*`
selector is legitimate **only** when it is a real JS hook the feature already needs; used
purely as a test anchor it is production code serving the test, and must not exist.

Use `$crawler->filter('.css-selector')` for class matching (requires `symfony/css-selector`, a
`require-dev` in any test-bearing project). It is the whole-token `.class` match — don't
hand-roll `filterXPath('//*[contains(@class, ...)]')`, whose naive substring also matches
`card-header`/`cards`.

Business-rule traceability (Rn → assertion) lives in the spec/plan, not in per-rule test
methods. Keep the interface test DAMP: descriptive local variables, no per-assertion comments.

## API (JSON) functional tests

For API functional tests (`WebTestCase`) with deterministic data (fixtures), **assert the full
JSON response directly** with `assertJsonStringEqualsJsonString` and a JSON heredoc. Do not
decode the response to check individual properties.

> Examples and when to use / not use: [references/api-json-testing.md](references/api-json-testing.md).

## Container doubles

Substitute a service with `self::getContainer()->set('alias', $double)`. Two traps, both of
which produce failures that point nowhere near the cause:

- **One `set()` per service per test.** A second call on the same alias throws *"service is
  already initialized, you cannot replace it"*. When several tests need the same double,
  install it from a single shared helper that takes the payload as a parameter.
- **`KernelBrowser` reboots the kernel between requests**, discarding every double. A test
  that submits and then calls `followRedirect()` re-issues the GET against the **real**
  services and blows up somewhere unrelated. Call `$this->client->disableReboot()` before the
  submission, in that test only.

A service is only substitutable if it is **public in the test environment**. The usual shape
is a `when@test` block republishing each private service under a `test.*` public alias:

```yaml
when@test:
    services:
        test.feature.get_fund_source:
            alias: feature.get_fund_source
            public: true
```

Prefer a plain hand-written double (public properties, no Prophecy) for these — see
`phpunit:php-test-conventions` for the doubles hierarchy.

## Quick reference

| Situation | Approach |
|---|---|
| Pure function, no container | `TestCase` — don't boot a kernel |
| Which test owns a form rule | Option → `TypeTestCase` on the real type; who sets it → orchestrator unit test (prophesized factory, `Argument::withEntry`); full chain → one `WebTestCase` per effect |
| FormType in isolation | `TypeTestCase` — see [references/formtype-testing.md](references/formtype-testing.md) |
| HTML page content, redirect, form state | Built-in assertions — see [references/interface-assertions.md](references/interface-assertions.md) |
| API JSON response (deterministic) | `assertJsonStringEqualsJsonString` + heredoc — see [references/api-json-testing.md](references/api-json-testing.md) |
| Replace a service | `getContainer()->set()` on a `test.*` public alias, once per test |
| Follow a redirect with doubles installed | `$this->client->disableReboot()` first |
| Doubles, Prophecy, data providers, naming | `phpunit:php-test-conventions` |
