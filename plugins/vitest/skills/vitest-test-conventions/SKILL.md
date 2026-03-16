---
name: vitest-test-conventions
description: "ACTIVATE when writing Vitest tests, creating test files, using vi.fn()/vi.mock()/vi.spyOn(), or test factories. ACTIVATE for 'Vitest', 'test convention', 'it.each', 'test double', 'DAMP test', 'spy vs mock'. Covers: DAMP over DRY, AAA pattern, vi.fn()/vi.spyOn()/vi.mock() patterns, spy over mock, what NOT to test, it.each() format selection (template vs object), factory functions, exception testing, NestJS integration test setup, structured assertions. DO NOT use for: TDD workflow/iterations (see vitest-tdd-workflow), PHP/PHPUnit tests (see php-test-conventions)."
version: "1.1"
---

# Test Conventions (Vitest)

> **See also**: `vitest-tdd-workflow` for TDD workflow and iteration patterns.

## Test Types

| Test Type | Setup | Purpose |
|-----------|-------|---------|
| Unit | No DI container, pure logic | Domain models, services |
| Integration | NestJS `Test.createTestingModule()` | Services with real dependencies |
| E2E | `supertest` + full app | HTTP request/response, full flow |

## DAMP Principle

**Prefer DAMP (Descriptive And Meaningful Phrases) over DRY in tests.**

Avoid `beforeEach()`. Keep the full test lifecycle in each test case:

```typescript
it('should mark tenant as eligible when lease is active', () => {
  const lease = createActiveLease();
  const specification = new IsTenantEligible();

  const result = specification.isSatisfiedBy(lease);

  expect(result).toBe(true);
});
```

## AAA / GWT Pattern

Respect **Arrange-Act-Assert** or **Given-When-Then** structure with blank line separators.

## Test Doubles: Spy over Mock

**Verify AFTER the act**, not before (AAA compliance):

- `vi.fn()` -- Simple stubs for dependencies
- `vi.spyOn()` -- Spy on real objects
- `vi.mock()` -- Module-level mocking

## What NOT to Test

| Worth testing | Not worth testing |
|---------------|-------------------|
| Business logic / domain rules | Simple DTOs with only properties |
| Validation logic | Events with only properties |
| Calculations / transformations | Data containers |
| State machines / workflows | Entities with only getters/setters |

## it.each() Format Selection

- **Majority of strings** -> Template literal syntax (tabular reading)
- **Mix of types or majority non-string** -> Object syntax (avoids verbose `${}`)

> **When writing test doubles, parameterized tests, or factory functions**, read `references/test-examples.md` for complete vi.fn/spyOn/mock patterns, it.each examples, and factory patterns.

> **When writing exception tests or NestJS integration tests**, read `references/test-examples.md` for toThrow patterns and Test.createTestingModule setup.

## Quick Reference

| Situation | Approach |
|-----------|----------|
| Simple value objects | Direct instantiation |
| Complex dependencies | `vi.fn()` stubs |
| Spy on real method | `vi.spyOn()` |
| Module replacement | `vi.mock()` |
| Same logic, different data | `it.each()` (object or template literal) |
| Duplicated factory | Shared factory file |
| Verify method called | Spy after act |
| Setup code | In test body (DAMP) |
| Compare objects | `toEqual` + `expect.objectContaining` |

| Test Type | File pattern | Base setup |
|-----------|-------------|-----------|
| Unit | `*.spec.ts` | None |
| Integration | `*.integration-spec.ts` | `Test.createTestingModule()` |
| E2E | `*.e2e-spec.ts` | `supertest` + app |
