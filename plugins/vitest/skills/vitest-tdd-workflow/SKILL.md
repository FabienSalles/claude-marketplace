---
name: vitest-tdd-workflow
description: "ACTIVATE when building new features, endpoints, or user stories using TDD with Vitest in a TypeScript/NestJS context. ACTIVATE for '/feature-tdd-dev', 'TDD', 'red-green-refactor' in TS context. Provides Vitest/NestJS-specific TDD examples and commands; cross-language TDD workflow (cross-layer iterations, RED-GREEN-REFACTOR, working app, bug-fix-first-test, mocks-hiding-bugs) lives in craft:tdd-workflow-principles. DO NOT use for: test writing conventions (see vitest:vitest-test-conventions), PHP TDD (see phpunit:php-tdd-workflow)."
version: "2.0"
---

# TDD Workflow — Vitest / NestJS

> The **cross-language TDD process** (cross-layer iterations, RED-GREEN-REFACTOR, working-app-at-each-GREEN, bug-fix workflow, mocks-hiding-bugs) is defined in `craft:tdd-workflow-principles`. This skill keeps Vitest/NestJS-specific examples and commands.

> See also: `vitest-test-conventions` for test writing conventions (DAMP, doubles, factories).

## NestJS-specific: Iteration Example

**"Generate Receipt" feature** — each iteration can touch Controller, Domain, and Repository as needed:

**Iteration 1: Controller route exists**
```
Test:      E2E → authenticated user gets 200
Implement: Empty controller with route
```

**Iteration 2: Eligibility check**
```
Test:      E2E → tenant without lease gets 403
Implement: Guard or check in controller
```

**Iteration 3: Domain logic**
```
Test:      Unit → receipt calculates correct amount
Implement: Receipt domain model
```

**Iteration 4: Wire it up**
```
Test:      E2E → full flow works
Implement: Connect domain to controller
```

**Iteration 5: Edge case**
```
Test:      Unit → partial month prorates correctly
Implement: Update calculation logic
```

## NestJS-specific: The Incomplete Stub Trap

```typescript
// ❌ FORBIDDEN — referencing a non-registered service
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly service: ReceiptService) {} // Not registered!
}
// → Test may pass with mocks, but app crashes at runtime

// ✅ CORRECT — register the service
@Module({
  providers: [ReceiptService],
})
export class ReceiptModule {}
```

## NestJS-specific: End-of-Iteration GREEN Checklist

In addition to the cross-language checklist (see `craft:tdd-workflow-principles`):

| Check | NestJS action |
|-------|---------------|
| Service injected? | Register in module `providers` |
| Repository used? | Implement or create a stub, register provider |
| Module imported? | Add to parent module `imports` |
| Guard added? | Register in module |

## Vitest-specific: Mocks Hiding Bugs

```typescript
// ❌ This test passes but hides a calculation bug
const repo = { findLease: vi.fn().mockResolvedValue(mockLease) };

// ✅ Use real domain objects to catch real problems
const lease = Lease.create(realLeaseData);
const receipt = Receipt.create(lease, period);
```

## NestJS-specific: New Code Tests Mapping

| Code Created | Tests Required |
|--------------|----------------|
| Domain model | Unit test for business logic |
| Controller | E2E test (`supertest`) for endpoint |
| Repository | Integration test with database |
| Use case | Unit test with mocked ports |
| Guard | Unit test for access rules |

## Vitest-specific: Commands

```bash
# All tests
pnpm test

# Specific test file
pnpm vitest run src/receipt/receipt.service.spec.ts

# Watch mode
pnpm vitest src/receipt/

# Filter by test name
pnpm vitest run -t "prorated amount"

# Verbose for debugging
pnpm vitest run --reporter=verbose receipt
```
