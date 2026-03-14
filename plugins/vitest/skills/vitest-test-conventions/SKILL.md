---
name: vitest-test-conventions
description: This skill should be used when writing tests, creating test files, using Vitest, vi.fn(), vi.mock(), or test factories. Provides conventions for test organization, naming, and patterns.
version: "1.0"
---

# Test Conventions (Vitest)

> **See also**: `vitest-tdd-workflow` for TDD workflow and iteration patterns.

## Test Types

| Test Type | Setup | Purpose |
|-----------|-------|---------|
| Unit | No DI container, pure logic | Domain models, services |
| Integration | NestJS `Test.createTestingModule()` | Services with real dependencies |
| E2E | `supertest` + full app | HTTP request/response, full flow |

```
Does the test need NestJS container?
├─ NO → Unit test (*.spec.ts)
│
└─ YES → Does it test HTTP endpoints?
         ├─ NO → Integration test (*.integration-spec.ts)
         └─ YES → E2E test (*.e2e-spec.ts)
```

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

Respect **Arrange-Act-Assert** or **Given-When-Then** structure with blank line separators:

```typescript
it('should calculate correct receipt amount', () => {
  // Arrange
  const lease = createLeaseWithRent(850_00);
  const period = Period.of(2025, 3);

  // Act
  const receipt = Receipt.create(lease, period);

  // Assert
  expect(receipt.amount).toBe(850_00);
});
```

## Test Doubles with Vitest

### 1. vi.fn() — Simple stubs

```typescript
it('should call repository save', async () => {
  const save = vi.fn();
  const repo = { save } satisfies Pick<ReceiptRepository, 'save'>;

  const useCase = new GenerateReceipt(repo);
  await useCase.execute(leaseId);

  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    leaseId,
    amount: 850_00,
  }));
});
```

### 2. vi.spyOn() — Spy on real objects

```typescript
it('should log receipt generation', () => {
  const logger = new ConsoleLogger();
  const spy = vi.spyOn(logger, 'info');

  generateReceipt(logger, lease);

  expect(spy).toHaveBeenCalledWith('Receipt generated for lease abc-123');
});
```

### 3. vi.mock() — Module mocking

```typescript
vi.mock('../infrastructure/email-service', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(undefined),
  })),
}));
```

### Spy over Mock (AAA compliance)

**Verify AFTER the act**, not before:

```typescript
// ❌ Mock pattern — expectations before act
const repo = { save: vi.fn() };
// expectations set up in the mock...
useCase.execute();

// ✅ Spy pattern — verification after act
useCase.execute();
expect(repo.save).toHaveBeenCalledWith(expectedReceipt);
```

## What NOT to Test

| Worth testing | Not worth testing |
|---------------|-------------------|
| Business logic / domain rules | Simple DTOs with only properties |
| Validation logic | Events with only properties |
| Calculations / transformations | Data containers |
| State machines / workflows | Entities with only getters/setters |

```typescript
// ❌ Useless test — just testing properties
it('should return the tenant id', () => {
  const event = new ReceiptGenerated('tenant-123');
  expect(event.tenantId).toBe('tenant-123'); // Tests nothing useful!
});

// ✅ Worth testing — actual logic
it('should prorate rent for partial month', () => {
  const receipt = Receipt.create(lease, partialPeriod);
  expect(receipt.amount).toBe(387_10);
});
```

## it.each() for Parameterized Tests

```
Quel format it.each() utiliser ?
├─ Majorité de strings → Template literal (tableau visuel, pas de wrapping verbose)
└─ Mix de types ou majorité non-string → Object syntax (pas de ${} partout)
```

### Template literal syntax — majorité de strings

Les headers deviennent les noms des paramètres destructurés ET les variables du titre (`$input`, `$expected`). Lecture tabulaire naturelle quand les valeurs sont des strings.

```typescript
it.each`
  input          | format     | expected
  ${'2025-03-01'}| ${'short'} | ${'01/03/2025'}
  ${'2025-12-25'}| ${'long'}  | ${'25 décembre 2025'}
  ${''}          | ${'short'} | ${'—'}
`('formatDate($input, $format) → $expected', ({ input, format, expected }) => {
  expect(formatDate(input, format)).toBe(expected);
});
```

### Object syntax — mix de types ou majorité non-string

Plus lisible quand les valeurs mélangent types (nombres, booleans, strings) — évite le wrapping `${}` verbeux.

```typescript
it.each([
  { rent: '850', charges: '50', expected: 900 },
  { rent: '850.50', charges: '49.50', expected: 900 },
  { rent: '', charges: '50', expected: 50 },
  { rent: '', charges: '', expected: 0 },
])('computeTotal($rent, $charges) → $expected', ({ rent, charges, expected }) => {
  expect(computeTotal(rent, charges)).toBe(expected);
});
```

## Factory Functions

### In-test helpers

```typescript
function createLeaseWithRent(monthlyRent: number): Lease {
  return Lease.create({
    tenantId: toTenantId('tenant-123'),
    landlordId: toLandlordId('landlord-456'),
    monthlyRent,
    startDate: new Date('2025-01-01'),
  });
}
```

### Shared factory files

```typescript
// tests/factories/lease.factory.ts
export function createActiveLease(overrides?: Partial<LeaseProps>): Lease {
  return Lease.create({
    tenantId: toTenantId('tenant-123'),
    landlordId: toLandlordId('landlord-456'),
    monthlyRent: 850_00,
    startDate: new Date('2025-01-01'),
    ...overrides,
  });
}
```

## Exception Testing

```typescript
it('should throw InvalidPeriodError when end before start', () => {
  expect(() => Period.of(2025, 3, 2025, 1))
    .toThrow(InvalidPeriodError);
});

// Test name includes exception class name
it('should throw MissingLeaseError when lease not found', async () => {
  const repo = { findById: vi.fn().mockResolvedValue(null) };

  await expect(useCase.execute('unknown'))
    .rejects.toThrow(MissingLeaseError);
});
```

## NestJS Integration Tests

```typescript
describe('ReceiptService (integration)', () => {
  let service: ReceiptService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReceiptService,
        { provide: RECEIPT_REPOSITORY, useClass: InMemoryReceiptRepository },
      ],
    }).compile();

    service = module.get(ReceiptService);
  });

  it('should generate and persist receipt', async () => {
    const result = await service.generate(leaseId);
    expect(result.id).toBeDefined();
  });
});
```

## Assertion Pattern

**Prefer structured assertions** over multiple separate checks:

```typescript
// ❌ Avoid — multiple assertions
expect(receipt.tenantId).toBe('tenant-123');
expect(receipt.amount).toBe(850_00);
expect(receipt.period.month).toBe(3);

// ✅ Prefer — single assertion with expect.objectContaining
expect(receipt).toEqual(expect.objectContaining({
  tenantId: 'tenant-123',
  amount: 850_00,
  period: expect.objectContaining({ month: 3 }),
}));
```

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
