---
name: testing-principles
description: "ACTIVATE when writing or modifying tests, creating test classes/files, using test doubles, factories, or data providers. ACTIVATE for 'DAMP', 'spy vs mock', 'what NOT to test', 'AAA', 'test naming', 'factory test', 'parameterized test'. Covers cross-language testing principles: DAMP over DRY, AAA/GWT pattern, spy over mock, what NOT to test, factory functions, parameterized tests, structured assertions. Language-specific tooling (Prophecy, vi.fn/vi.mock, PHPUnit annotations, it.each syntax) lives in php-test-conventions / vitest-test-conventions."
version: "1.0"
---

# Testing — Cross-Language Principles

> The **rules** below are language-agnostic. Tool-specific examples (Prophecy, `vi.fn()`, `vi.spyOn()`, PHPUnit data providers, `it.each()`, NestJS `Test.createTestingModule`) live in:
> - `php-test-conventions`
> - `vitest-test-conventions`

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

## 8. Factory Methods / Functions

Create helper methods in the test class (or shared module) to build test fixtures. When duplicated across multiple test files, extract to a dedicated `Factory` class / file.

## 9. Structured Assertions Over Property-By-Property

Compare **complete objects** with the language's structured assertion rather than asserting field by field.

- PHP: `assertEquals` with the expected object.
- Vitest: `toEqual` with the expected object, or `expect.objectContaining`.

**Why:** a single assertion either passes or fails as a whole — easier to read failures.

## 10. Mocks Can Hide Real Bugs

When debugging a flaky/broken behavior, **prefer real dependencies** over mocks. Mocks return what you tell them — they can pass while production crashes.

## Quick Reference

| Rule | Principle |
|------|-----------|
| Test type | Unit (no container) / Integration (real deps) / Functional (full flow) |
| What not to test | No tests on data containers / pure getters |
| Pre-test checklist | Valid state? Not covered already? Behavior, not impl? |
| DAMP > DRY | Full AAA in each test, no `setUp`/`beforeEach` for non-trivial logic |
| AAA / GWT | Blank lines between Arrange/Act/Assert, no comments |
| Spy > Mock | Verify after act, not before |
| Parameterized tests | Same structure + different data → data provider / it.each |
| Factories | Helper methods, extract when duplicated |
| Structured assert | Compare complete object, not field by field |
| Real over mock | When debugging, use real dependencies — mocks hide bugs |
