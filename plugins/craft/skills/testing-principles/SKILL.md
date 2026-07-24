---
name: testing-principles
description: "ACTIVATE when writing or modifying tests, creating test classes/files, using test doubles, factories, or data providers. ACTIVATE for 'DAMP', 'spy vs mock', 'what NOT to test', 'AAA', 'test naming', 'factory test', 'parameterized test', 'interface test', 'UI test', 'assert visible content', 'locate vs assert', 'selector', 'count by class'. Covers cross-language testing principles: DAMP over DRY, AAA/GWT pattern, spy over mock, what NOT to test, factory functions, parameterized tests, structured assertions, interface tests coupling to perceivable content not technical wiring. Language-specific tooling (Prophecy, vi.fn/vi.mock, PHPUnit annotations, it.each syntax) lives in phpunit:php-test-conventions / vitest:vitest-test-conventions."
version: "1.0"
---

# Testing — Cross-Language Principles

> The **rules** below are language-agnostic. Tool-specific examples (Prophecy, `vi.fn()`, `vi.spyOn()`, PHPUnit data providers, `it.each()`, NestJS `Test.createTestingModule`) live in:
> - `phpunit:php-test-conventions`
> - `vitest:vitest-test-conventions`

## 1. Test Types

Three layers are universal:

| Layer | What it covers |
|---|---|
| **Unit** | Pure logic, no framework/container/DB |
| **Integration** | Real dependencies (DI container, real serializer, real DB) |
| **Functional / E2E** | HTTP / UI / full flow |

**Decision rule:** does the test need the framework's container or external I/O? **No** → Unit. **Yes** → Integration. **Full HTTP/UI flow?** → Functional/E2E.

## 2. What NOT to Test

Never write tests coupled to implementation without behavior. Only test classes that have behavior worth verifying.

| Worth testing | NOT worth testing |
|---|---|
| Business logic / domain rules | Simple DTOs / data containers |
| Validation logic | Events with only properties |
| Calculations / transformations | Value objects without logic |
| State machines / workflows | Entities with only getters/setters |
| Serialization / deserialization | Tests re-verifying what a higher-level test already covers |

**Rule:** if the test only verifies that a getter returns what was passed to the constructor, delete it.

**Anti-pattern — tautological assertion:** an assertion that *recomputes* the expected value the same way the code does (`expect(add(a, b)).toBe(a + b)`) passes by construction and proves nothing. Expected values must come from an **independent source of truth** — a hardcoded literal, a hand-worked example, or a known-good fixture.

**Anti-pattern — the name promises a rule the assertion doesn't show:** a test named for a business rule (`submittingTheCouponExposesTheCoupon`) that only echoes back the value it submitted proves nothing — binding input to output is a framework given. Assert what the code exposes or withholds **as a function of inputs/context** (which fields exist per case, what is dropped when a condition flips). No such rule at this layer → the test belongs elsewhere or nowhere.

## 3. Pre-Test Checklist

Before writing a new test, confront it to these **3 questions**. If you can't answer "yes" to all three, do not write the test.

1. **Does this scenario represent a valid business state?** A test for a state production can't reach tests nothing real.
2. **Is this behavior NOT already covered transitively by a higher-level test?** If the happy-path test fails when the structure breaks, a separate structural test adds no signal.
3. **Does the assertion express a behavior, not an implementation detail?**

## 4. DAMP Over DRY

Prefer **Descriptive And Meaningful Phrases** over **Don't Repeat Yourself** in tests.

- Avoid `setUp()` / `beforeEach()` for anything non-trivial. Keep the full Arrange-Act-Assert in each test.
- Read each test top-to-bottom and understand it without scrolling.
- Tests are read more often than refactored — clarity > terseness.

## 5. AAA / GWT Pattern

**Arrange — Act — Assert** (or **Given — When — Then**), separated by **blank lines, no comments**.

## 6. Spy Over Mock (verify AFTER act)

Mocks set expectations **before** the act (violates AAA). Spies verify **after** the act (respects AAA).

- Mock: `service.expect('call').withArgs(...)` → call SUT → done.
- Spy: call SUT → `expect(service.call).toHaveBeenCalledWith(...)`.

**Criterion:** if you write expectations before the act, you're using a mock; switch to a spy that asserts after.

## 7. Parameterized Tests (data provider / it.each)

When multiple tests have the **same Arrange-Act-Assert structure** and only differ in input data, consolidate via the language's parameterization (PHPUnit `@dataProvider`, Vitest `it.each`, etc.).

**Criterion:** no `if` should be needed in the test body — same structure, different data.

Do NOT parameterize when assertions differ or setup is specific to each case.

**Split first, consolidate after.** One test per case is fine while developing, but tests sharing the same Act+Assert and differing only in data are a smell — do a consolidation pass into one parameterized test. Split leftovers read as many features when it is one.

**Name = mechanism; keys = the rule, in domain terms.** Keep the method name plain about what it exercises (`itRetainsTheSubmittedData`), not the rule crammed in (`itRetainsTheFieldsAvailableToThePremiumCustomerContext`). Each case key carries the rule using the domain's **existing** words (`a premium customer gets free shipping`), never jargon coined for the test (`eligible`, `the good case`) — an unresolvable term just moves the unclear intent into the key. **Criterion:** name + keys make the rule legible with no prose comment.

## 8. Factory Methods / Functions

Create helper methods in the test class (or shared module) to build test fixtures. When duplicated across multiple test files, extract to a dedicated `Factory` class / file.

## 9. Structured Assertions Over Property-By-Property

Compare **complete objects** with the language's structured assertion rather than asserting field by field.

- PHP: `assertEquals` with the expected object.
- Vitest: `toEqual` with the expected object, or `expect.objectContaining`.

**Why:** a single assertion either passes or fails as a whole — easier to read failures.

## 10. Mocks Can Hide Real Bugs

When debugging a flaky/broken behavior, **prefer real dependencies** over mocks. Mocks return what you tell them — they can pass while production crashes.

Two hygiene rules when a double is unavoidable:

1. **Mirror the full structure.** A mock must reproduce the real data's complete shape. A partial mock — one field omitted — passes silently while production reads the missing field and breaks.
2. **Don't stub the behavior under test.** Never stub a high-level method whose side-effect is the very thing the test is meant to verify — observe the real behavior first. And when you must isolate a dependency, double a boundary **you own** (a port / adapter), not a third-party type you don't — a mock of what you don't own only encodes guesses about it.

## 11. Prefer a Real Implementation Over a Mocking Tool

When a real collaborator trivially substitutes — a null object, an in-memory implementation, a fixed clock — and reads cleaner, use it instead of a double. Reach for a double only when the test needs it: to verify an interaction or to script a return / throw. Otherwise pick whatever is fastest and cleanest — a manual stub, or the mocking tool.

**Criterion:** don't mock a collaborator you neither assert on nor script when a real / null implementation is available.

**Never reimplement the real logic inside the double.** A stub/mock must not copy the
collaborator's (or SUT's) production body into its factory. If the double re-encodes the
behavior, your assertions verify the *copy*, not the real code: the test goes green by
construction, proves nothing about production, and silently rots the day the real logic
changes (the copy stays, the real one drifts). This is the tautological-assertion trap
(§2) wearing a mock's clothes.

When you genuinely can't run the real module in this test — an untransformable file type,
a side-effectful global, a heavy dependency — do **one** of:
- **Default double + spy on the interaction.** Replace it with an empty stub
  (`jest.fn()`, a no-op) and assert it was *called with the right arguments* for the
  right target. The double stays behavior-free; you verify the contract you own (the call),
  not the collaborator's internals.
- **Move the behavioral assertion to where the real code lives.** The DOM/text/output the
  collaborator produces is *its* responsibility — assert it in its own test (its repo /
  its layer), not by re-deriving it here.

```
// ❌ The mock reimplements the real setTooltip — assertions test the copy
jest.mock('@theme/tooltip', () => ({
    setTooltip: (el, text) => { el.setAttribute('data-bs-title', text); /* …the real body… */ },
}));
expect(el.getAttribute('data-bs-title')).toBe('…');   // verifies the mock, not production

// ✅ Default double; assert the interaction you own
jest.mock('@theme/tooltip', () => ({ setTooltip: jest.fn() }));
import { setTooltip } from '@theme/tooltip';
expect(setTooltip).toHaveBeenCalledWith(el, 'Le compte par défaut ne peut pas être supprimé');
// …and the attribute-writing behavior is tested in the tooltip component's own repo.
```

**Criterion:** if deleting the real implementation would leave your double still
"passing" the assertion, the double has reimplemented the logic — strip it to a spy.

## 12. Never Add Production Code for Tests

Production code must serve **production**. Never add anything to production code — a
CSS class, `js-*` hook, `id`, attribute, getter, or method — whose only purpose is to
give a test something to locate or assert. This kind of code should never exist.

**Only exception:** what is strictly required for the environment to run or the test to
boot — e.g. a test-only DI alias exposing a private service so it can be substituted.
A test **locator** is never covered by this exception.

**Instead:** locate via markup/API the production code already exposes for a production
reason — the real field name, a class the framework/theme actually emits. If no clean
locator exists without adding test-only production code, do **not** add it — find
another assertion.

## 13. Interface Tests — Couple to Perceivable Function, Not Wiring

An interface / UI test proves **behavior**: the text, values, labels, and state a user
actually perceives render correctly. Couple **maximally** to elements that carry
functional meaning and are visible; avoid coupling to purely technical elements.

**Selectors only LOCATE — assertions express FUNCTION.** A CSS class, `js-*` hook, test
id, or XPath is just an address to reach an element. Once located, assert what the user
reads or perceives there: the visible text, the field value, the selected / checked /
disabled state. Never let the *technical address* be the thing you assert.

- **Prefer functional anchors to locate:** the real field name, the visible label text,
  an accessible role/name, the rendered content — over volatile styling/layout classes
  (`.form-check-inline`, `.card`, wrapper `div`s) that carry no functional meaning and
  change with a restyle.
- **Count-by-technical-class is plumbing, not function.** `assertCount(2, '.form-check-inline')`
  passes even when every option renders the wrong text. Presence/count-by-class is
  acceptable only as a *secondary* invariant next to content assertions, never as the
  whole test.
- **Don't assert framework defaults.** "No option is pre-selected" when nothing was set,
  "the field is empty" on a fresh form — the framework guarantees these. Assert the
  behavior *your code* owns, not the framework's baseline.

```
// ❌ Technical — passes even if the labels render garbage
assertCount(2, page.filter('.form-check-inline'))
assertNull(radios[0].attr('checked'))          // framework default: nothing set → nothing checked

// ✅ Functional — locate by the field the app owns, assert the visible labels
options = page.filter('input[name$="[shipping_method]"] + label')
assertCount(2, options)
assertSame("Standard delivery", options[0].text())
assertSame("Express delivery",  options[1].text())
```

**Rule:** locate with any selector you like; assert only what a user could see or perceive.
If your assertion would still pass with the wrong text/value/state on screen, it tests
wiring — rewrite it against perceivable content.

## Quick Reference

| Rule | Principle |
|------|-----------|
| Test type | Unit (no container) / Integration (real deps) / Functional (full flow) |
| What not to test | No tests on data containers / pure getters |
| Tautological assertion | Expected value comes from an independent source, never recomputed like the code |
| Name over-promises | A test named for a rule but only echoing its input back proves nothing — assert what the code exposes/withholds as a function of inputs & context |
| Pre-test checklist | Valid state? Not covered already? Behavior, not impl? |
| DAMP > DRY | Full AAA in each test, no `setUp`/`beforeEach` for non-trivial logic |
| AAA / GWT | Blank lines between Arrange/Act/Assert, no comments |
| Spy > Mock | Verify after act, not before |
| Parameterized tests | Same structure + different data → data provider / it.each |
| Consolidation pass | Split-per-case is fine in dev; same Act+Assert differing only in data must be merged into one parameterized test |
| Name vs keys | Method name = mechanism tested (`itRetainsTheSubmittedData`); provider keys = the business rule, in existing domain terms, no invented jargon |
| Factories | Helper methods, extract when duplicated |
| Structured assert | Compare complete object, not field by field |
| Real over mock | When debugging, use real dependencies — mocks hide bugs |
| Mock hygiene | Mirror the real data's full shape; never stub the behavior under test; double a boundary you own, not a third-party type |
| Real over double | Use a null-object / in-memory / fake when you don't verify or script the collaborator |
| No logic in the double | Never reimplement the real body in a mock — use a default stub + spy on the call, or assert the behavior in the collaborator's own test |
| No prod code for tests | Never add a class/`js-*`/id/attribute to production solely as a test locator — locate via real production markup |
| Interface tests | Selectors only locate; assert perceivable content (text/value/state), not technical classes or framework defaults |
