---
name: vitest-tdd-workflow
description: "ACTIVATE when building new features, endpoints, or user stories using TDD with Vitest. ACTIVATE for '/feature-dev', 'TDD', 'test first', 'red-green-refactor', 'iterations' in a TypeScript/NestJS context. Covers: cross-layer TDD iterations (Controller/Domain/Repository), working app at each GREEN, bug-fix-first-test workflow, mocks-hiding-bugs pitfall. DO NOT use for: test writing conventions (see vitest-test-conventions), PHP TDD (see php-tdd-workflow)."
version: "1.1"
---

# TDD Workflow (Vitest)

This skill documents the Test-Driven Development workflow for Quittance.me.

> **See also**: `vitest-test-conventions` for test writing conventions (DAMP, test doubles, factories).

## Philosophy

**Test First, Always.** Every feature follows TDD with small iterations:
1. Write ONE failing test (Red)
2. Write minimal code to pass (Green)
3. Refactor if needed
4. Return to entry point (API) for next iteration

## Feature Development Process

### Phase 1: Analysis

Analyze the complete feature before coding:
- Understand all requirements
- Identify layers involved (Controller, Domain, Repository)
- Plan test cases
- Identify happy path and edge cases

**Output**: Complete understanding, but implementation is iterative.

### Phase 2: Iterative Implementation

**Key principle**: Small iterations across all layers, not layer-by-layer completion.

```
Iteration 1: Controller stub + first Domain behavior
     ↓
Iteration 2: Domain logic + Repository interface
     ↓
Iteration 3: Back to Controller → complete happy path
     ↓
Iteration 4: Edge case handling
     ↓
...continue until feature complete
```

Each iteration can touch Controller, Domain, and Repository as needed.

## Iteration Pattern

### Example: "Generate Receipt" feature

**Iteration 1: Controller route exists**
```
Test: E2E → authenticated user gets 200
Implement: Empty controller with route
```

**Iteration 2: Eligibility check**
```
Test: E2E → tenant without lease gets 403
Implement: Guard or check in controller
```

**Iteration 3: Domain logic**
```
Test: Unit → receipt calculates correct amount
Implement: Receipt domain model
```

**Iteration 4: Back to controller — wire it up**
```
Test: E2E → verify full flow works
Implement: Connect domain to controller
```

**Iteration 5: Edge case**
```
Test: Unit → partial month prorates correctly
Implement: Update calculation logic
```

### Flow Pattern

```
┌──────────────────────────────────────────────────┐
│                   Happy Path                      │
│  Controller → Domain → Repository → Controller   │
├──────────────────────────────────────────────────┤
│                   Edge Cases                      │
│  Add tests for each edge case, implement fixes   │
└──────────────────────────────────────────────────┘
```

## CRITICAL: Application Must Work After Each Iteration

**MANDATORY**: At the end of each GREEN iteration, the application MUST be functional.

### The Incomplete Stub Trap

```typescript
// ❌ FORBIDDEN: referencing a non-existent service
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly service: ReceiptService) {} // Not registered!
}
// → Test may pass with mocks, but app crashes at runtime!

// ✅ CORRECT: register the service or use a stub
@Module({
  providers: [ReceiptService], // Registered
})
export class ReceiptModule {}
```

### Golden Rule

> **Tests pass AND the application works** at each iteration.

### End-of-Iteration GREEN Checklist

| Check | Action |
|-------|--------|
| Service injected? | Register in module providers |
| Repository used? | Implement or create a stub |
| Module imported? | Add to parent module imports |
| Guard added? | Register in module |

## CRITICAL: Always Run Tests

**MANDATORY**: After each phase (RED or GREEN), run the specific test:

1. **After writing a test (RED)**: Run it to confirm it FAILS
2. **After writing implementation (GREEN)**: Run it to confirm it PASSES

```bash
# Run specific test file
pnpm test src/receipt/receipt.service.spec.ts

# Run tests matching a pattern
pnpm vitest run --reporter=verbose receipt

# Run all tests
pnpm test
```

**Never assume a test passes without running it.**

## Bug Fix Workflow

**CRITICAL**: When something is broken, follow this workflow **before any code change**:

### Step 1: Find existing tests

```bash
# Search for test class related to the broken component
pnpm vitest run --reporter=verbose receipt
```

Ask yourself:
- Does a test exist for this behavior?
- If yes, why does it pass when the behavior is broken?
- Is the test using mocks that hide the real problem?

### Step 2: Write a failing test first

```typescript
it('should calculate prorated amount for partial month', () => {
  // Use REAL dependencies (not mocks) to expose the issue
  const receipt = Receipt.create(lease, partialPeriod);

  // This assertion should FAIL with the current implementation
  expect(receipt.amount).toBe(387_10); // cents
});
```

### Step 3: Run the test — verify it FAILS

```bash
pnpm vitest run src/receipt/receipt.spec.ts
```

If the test passes, your test doesn't reproduce the issue. Investigate further.

### Step 4: Fix the implementation

Only now write the fix. The failing test guides the solution.

### Step 5: Run the test — verify it PASSES

### Common Mistake: Mocks Hiding Real Issues

```typescript
// ❌ This test passes but hides a calculation bug
const repo = { findLease: vi.fn().mockResolvedValue(mockLease) };

// ✅ Use real domain objects to catch real problems
const lease = Lease.create(realLeaseData);
const receipt = Receipt.create(lease, period);
```

## CRITICAL: New Code Must Have Tests

| Code Created | Tests Required |
|--------------|----------------|
| Domain model | Unit test for business logic |
| Controller | E2E test for endpoint |
| Repository | Integration test with database |
| Use case | Unit test with mocked ports |
| Guard | Unit test for access rules |

## Anti-Patterns

- ❌ Completing one layer before starting the next
- ❌ All tests for a feature before any implementation
- ❌ Using integration when unit suffices
- ❌ Writing implementation before test
- ❌ Skipping back to entry point
- ❌ Not running tests after each phase
- ❌ Creating code without tests
- ❌ Incomplete stubs breaking the application

## Commands

```bash
# All tests
pnpm test

# Specific test file
pnpm vitest run src/receipt/receipt.service.spec.ts

# Watch mode
pnpm vitest src/receipt/

# Filter by test name
pnpm vitest run -t "prorated amount"
```
