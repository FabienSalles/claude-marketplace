---
name: vitest-test-conventions
description: "ACTIVATE when writing Vitest tests, creating test files, using vi.fn()/vi.mock()/vi.spyOn(), or test factories. ACTIVATE for 'Vitest', 'it.each', 'NestJS testing module', 'supertest', 'vi.fn', 'vi.mock', 'spyOn'. Provides Vitest/NestJS-specific testing patterns; cross-language testing principles (DAMP, AAA, spy over mock, what NOT to test) live in craft:testing-principles. DO NOT use for: node:test files (a file importing node:test) or a project whose tests run under node --test (see node-test:node-test-conventions), TDD workflow/iterations (see vitest:vitest-tdd-workflow), PHP/PHPUnit tests (see phpunit:php-test-conventions)."
---

# Test Conventions — Vitest

> The **cross-language testing principles** (DAMP, AAA, spy over mock, what NOT to test, factories, structured assertions) are defined in `craft:testing-principles`. This skill keeps Vitest / NestJS-specific patterns.

> See also: `vitest-tdd-workflow` for TDD workflow and iteration patterns.

## Test Types (Vitest + NestJS)

| Test Type | Setup | File pattern |
|-----------|-------|--------------|
| Unit | No DI container, pure logic | `*.spec.ts` |
| Integration | NestJS `Test.createTestingModule()` | `*.integration-spec.ts` |
| E2E | `supertest` + full app | `*.e2e-spec.ts` |

## Vitest-specific: Test Doubles

```typescript
vi.fn()    // Standalone callback or function double; a port gets an in-memory stub instead
vi.spyOn() // Wraps one method of a real object, leaving the rest real
vi.mock()  // Module-level replacement, for what cannot be injected
```

> When writing test doubles, parameterized tests, or factory functions, read `references/test-examples.md` for complete `vi.fn`/`spyOn`/`mock` patterns, `it.each` examples, and factory patterns.

## Vitest-specific: `it.each()` Format Selection

- **Majority of strings** → template literal syntax (tabular reading).
- **Mix of types or majority non-string** → object syntax (avoids verbose `${}`).

> When writing exception tests or NestJS integration tests, read `references/test-examples.md` for `toThrow` patterns and `Test.createTestingModule` setup.

## Vitest-specific: Structured Assertions

```typescript
// Compare full object
expect(result).toEqual({ id: 1, name: 'Alice' });

// Partial match
expect(result).toEqual(expect.objectContaining({ id: 1 }));
```

## NestJS-specific: Integration Test Setup

```typescript
// references/test-examples.md has the complete pattern
const module = await Test.createTestingModule({
  providers: [ReceiptService, { provide: RepositoryToken, useClass: InMemoryRepo }],
}).compile();

const service = module.get(ReceiptService);
```

## Vitest-specific: Characterization Pin

Before changing behaviour no test pins, freeze the inputs and compare today's output, quirks included, to a committed golden file. The order, the gates and the retirement rules live in `craft:testing-principles` §16.

```typescript
it('keeps today\'s summaries, quirk included', () => {
  const frozen = [summarize('R-1', [10, 2.5, 0]), summarize('R-0', [])];
  const golden = readFileSync(new URL('./receipt-summary.golden.txt', import.meta.url), 'utf8');

  expect(`${frozen.join('\n')}\n`).toBe(golden);
});
```

The golden file is plain text read with `node:fs`: no snapshot API.

## Quick Reference (Vitest-specific)

| Situation | Approach |
|-----------|----------|
| Simple value objects | Direct instantiation |
| Port dependency | In-memory stub that is its own spy |
| Spy on real method | `vi.spyOn()` |
| Module replacement | `vi.mock()` |
| Same logic, different data | `it.each()` (object or template literal) |
| Verify method called | `expect(spy).toHaveBeenCalledWith(...)` after act |
| Compare objects | `toEqual` + `expect.objectContaining` |
