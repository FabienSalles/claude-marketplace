---
name: tdd-workflow-principles
description: "ACTIVATE when the user wants to build, implement, or develop any new feature, endpoint, or user story using TDD, test-first, or red-green-refactor methodology. ACTIVATE for '/feature-tdd-dev', 'TDD', 'test first', 'red-green-refactor', 'iterations' alongside building something new. Covers cross-language TDD workflow: cross-layer iterations, happy-path first, working app at each GREEN, bug-fix-first-test, mocks-hide-bugs pitfall. Language-specific test runner commands and module wiring (PHPUnit, vitest, NestJS modules, Symfony container) live in php-tdd-workflow / vitest-tdd-workflow."
version: "1.0"
---

# TDD Workflow — Cross-Language Principles

> The **process** below is language-agnostic. Test-runner commands and framework specifics (PHPUnit with Symfony container, vitest with NestJS modules, etc.) live in:
> - `php-tdd-workflow`
> - `vitest-tdd-workflow`

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
- ❌ Writing all tests before any implementation.
- ❌ Using Integration when Unit suffices (no container needed).
- ❌ Writing implementation before the failing test.
- ❌ Skipping back to the entry point — always return to API regularly.
- ❌ Not running tests after each phase.
- ❌ Incomplete stubs that break the app at runtime.
- ❌ Creating new code without tests.

## Quick Reference

| Phase | Verify |
|---|---|
| RED | Test fails for the right reason |
| GREEN | Test passes AND the app starts/runs |
| REFACTOR | Suite still passes, no new duplication |
| End of iteration | App works in dev and prod |
