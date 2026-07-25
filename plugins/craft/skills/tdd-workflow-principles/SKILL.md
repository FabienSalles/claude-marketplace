---
name: tdd-workflow-principles
description: "ACTIVATE when the user wants to build, implement, or develop any new feature, endpoint, or user story using TDD, test-first, or red-green-refactor methodology. ACTIVATE for '/feature-tdd-dev', 'TDD', 'test first', 'red-green-refactor' alongside building something new. Covers cross-language TDD workflow: cross-layer iterations, happy-path first, working app at each GREEN, bug-fix-first-test, mocks-hide-bugs pitfall, interface design (deep modules), tests-survive-refactor heuristic, common rationalizations. Language-specific test runner commands and module wiring (PHPUnit, vitest, NestJS modules, Symfony container) live in phpunit:php-tdd-workflow / vitest:vitest-tdd-workflow. DO NOT use for: splitting a spec or story into shippable slices, or judging whether a split is vertical or horizontal (see product:vertical-slice)."
version: "1.1"
---

# TDD Workflow — Cross-Language Principles

> The **process** below is language-agnostic. Test-runner commands and framework specifics (PHPUnit with Symfony container, vitest with NestJS modules, etc.) live in:
> - `phpunit:php-tdd-workflow`
> - `vitest:vitest-tdd-workflow`

> For test-writing conventions (DAMP, AAA, spy vs mock, factories), see `testing-principles`.

## Core Principle: Cross-Layer Iterations

The key difference from textbook TDD: each iteration cuts **across all layers** (Controller / Domain / Repository / SPI / UI), not one layer at a time.

```
Iteration 1: Controller stub + first Domain behavior
     ↓
Iteration 2: Domain logic + Repository/SPI interface
     ↓
Iteration 3: Back to Controller → complete happy path
     ↓
Iteration 4: Edge case handling
     ↓
… continue until feature complete
```

**Pattern:** happy path first (Controller → Domain → SPI → back to Controller), then edge cases.

### Anti-Pattern: Horizontal Slicing

Writing all tests up front, then all implementation, is **horizontal slicing**. It produces brittle tests because:

- Bulk-written tests verify **imagined** behavior, not real behavior — you haven't written the code yet, so you don't know what actually matters.
- Tests end up checking the **shape** of things (signatures, data structures) instead of user-facing behavior.
- You commit to a test structure before learning from the implementation.

**Correct approach: vertical slices.** One test → one minimal implementation → next test. Each cycle informs the next.

## Interface Design During TDD

TDD only forces good interfaces if you let it. Before each iteration, ask:

> **What is the smallest public surface that would let me write this test?**

Apply the **deep modules** principle (Ousterhout, _A Philosophy of Software Design_): small interface, deep implementation. A method with 1-2 parameters that does meaningful work is deeper than a method with 5 optional parameters that does the same thing.

### Signals That Your Interface Is Too Wide

- You need to mock 3+ internal collaborators to test one behavior → the unit under test is leaking implementation through its dependencies.
- The test setup has more lines than the assertion → the API forces too much ceremony.
- An options bag (`{maxRetries, backoff, onRetry, logger, …}`) grew because each new test needed a new knob → the interface is being pulled out of shape by its callers.

When you spot these, pause the RED phase, redesign the interface (often: collapse parameters into a domain object, push a decision behind a private method, replace a flag with two methods), then re-write the test against the cleaner surface.

> Testing through the public interface forces a good interface — but it's an **effect**, not an automatic outcome. The designer consciously decides the surface.

See also: `craft:oop-principles` (Tell-Don't-Ask, encapsulation), `craft:ddd-principles` (aggregates as natural deep modules).

## Red — Green — Refactor

Each iteration follows the strict cycle:

1. **RED** — write **one** failing test for the next behavior.
2. **RUN** — execute the test, confirm it FAILS.
3. **GREEN** — write the **minimum** code to make the test pass.
4. **RUN** — execute the test, confirm it PASSES.
5. **REFACTOR** — clean up production AND test code if needed.
6. **RUN** the suite — confirm everything still passes.

**Never assume a test passes without running it.**

## Working Application at Each Iteration

At the end of each GREEN, the app **must work** in dev and prod. The most common mistake: tests pass but the app is broken.

### End-of-Iteration GREEN Checklist

| Check | Action |
|---|---|
| Template / view referenced? | Create the file (even empty) |
| Service injected? | Register in DI container / module |
| Repository used? | Implement or stub it |
| Module imported? | Add to parent module |
| Guard / middleware added? | Register in module / pipeline |
| Route added? | Verify routing (`debug:router` / equivalent) |

## Refactor Phase — Check Both Code AND Tests

After each GREEN, look for duplication in **both** production code and tests.

- **Same test structure, different data?** → parameterize (data provider / `it.each`).
- **Duplicated fixture setup?** → factory method/function.
- **Production duplication?** → extract function/class.

Do NOT parameterize when assertions differ or setup is specific.

## Bug-Fix Workflow

When something is broken, follow this order **before any code change**:

1. **Find existing tests** — does a test exist? Why does it pass if the behavior is broken? Are mocks hiding the real problem?
2. **Write a failing test** that reproduces the bug with **REAL** dependencies (not mocks).
3. **Run it** — verify it FAILS.
4. **Fix the implementation** — the failing test guides the solution.
5. **Run it** — verify it PASSES.

### Mocks Hide Real Issues

```
// Mock pattern — always passes regardless of real bug
service.method('x').willReturn(expectedResponse)

// Real pattern — exposes the bug
realService = createServiceWithRealDeps()
result = realService.method('x')  // fails when real impl is broken
```

## New Code Must Have Tests

Every new code unit has at least one test:

| Created | Test required |
|---|---|
| Domain model / specification / use case | Unit test |
| Controller / endpoint | Functional / E2E test |
| Repository / adapter | Integration test |
| DTO / serialization contract | Serialization test |
| Guard / middleware | Unit test for access rules |

## Anti-Patterns

- ❌ Completing one layer entirely before starting the next.
- ❌ Writing all tests before any implementation (**horizontal slicing**).
- ❌ Using Integration when Unit suffices (no container needed).
- ❌ Writing implementation before the failing test.
- ❌ Skipping back to the entry point — always return to API regularly.
- ❌ Not running tests after each phase.
- ❌ Incomplete stubs that break the app at runtime.
- ❌ Creating new code without tests.

### Warning Sign: Tests That Don't Survive Refactor

> **If you rename an internal function/method (without changing its behavior) and a test breaks, that test was checking the implementation, not the behavior.**

Rewrite it in terms of the public API before continuing. A test should only break when an observable behavior changes.

Concrete examples:

- You extract a private `calculateTaxFromGross()` from a public `submit()` → if `submit_appliesTax` breaks, it was coupled to the old internal layout.
- You replace an internal `Collection<Order>` with an `OrderBook` → if a test asserts on the internal type/structure instead of the business outcome, it breaks for no good reason.
- You move logic from a `Controller` to a `UseCase` → a functional test exercising the route should **not** break (same HTTP behavior).

## Common Rationalizations

When you catch yourself saying one of these, treat it as a signal — not an excuse:

| Excuse | Reality |
|---|---|
| "Too simple to deserve a test" | Simple code breaks too. The test takes 30 seconds; the prod bug costs an hour. |
| "I'll test after, I'm just coding quickly right now" | Tests written after pass immediately. Passing immediately proves nothing — they may verify wrong behavior, implementation, or miss requirements. |
| "I already tested it manually" | Manual = ad-hoc, no trace, not replayable at the next refactor. Automated tests run the same way every time. |
| "Deleting X hours of code would be wasteful" | Sunk cost fallacy. Keeping code whose test you never saw fail is technical debt. Rewriting test-first takes X hours; picking up the bug three months later takes X × 5. |
| "I keep the code as reference and write the test after" | You'll adapt it instead of rediscovering the design. That's tests-after in disguise. Delete means delete. |
| "It's an exception, I know what I'm doing" | All exceptions look the same. If it happens twice, it's the rule, not the exception. |
| "The spec is clear, no need for RED" | RED isn't there to clarify the need; it's there to prove the test will catch a regression. Skipping RED means the test may pass by accident. |

**If you catch yourself coding before the failing test → delete the code and start over test-first. No adaptation, no "reference".**

## Quick Reference

| Phase | Verify |
|---|---|
| RED | Test fails for the right reason |
| GREEN | Test passes AND the app starts/runs |
| REFACTOR | Suite still passes, no new duplication |
| End of iteration | App works in dev and prod |
