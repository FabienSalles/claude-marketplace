# Test Convention Examples

## Table of Contents
- [Test Doubles with Vitest](#test-doubles-with-vitest)
- [it.each() Parameterized Tests](#iteach-parameterized-tests)
- [Factory Functions](#factory-functions)
- [Exception Testing](#exception-testing)
- [NestJS Integration Tests](#nestjs-integration-tests)
- [Assertion Patterns](#assertion-patterns)

## Test Doubles with Vitest

### vi.fn() -- Simple stubs

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

### vi.spyOn() -- Spy on real objects

```typescript
it('should log receipt generation', () => {
  const logger = new ConsoleLogger();
  const spy = vi.spyOn(logger, 'info');

  generateReceipt(logger, lease);

  expect(spy).toHaveBeenCalledWith('Receipt generated for lease abc-123');
});
```

### vi.mock() -- Module mocking

```typescript
vi.mock('../infrastructure/email-service', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(undefined),
  })),
}));
```

### Spy over Mock (AAA compliance)

```typescript
// Verify AFTER the act, not before:

// Spy pattern -- verification after act
useCase.execute();
expect(repo.save).toHaveBeenCalledWith(expectedReceipt);
```

## it.each() Parameterized Tests

### Template literal syntax -- majority of strings

Headers become destructured parameter names AND title variables (`$input`, `$expected`). Natural tabular reading when values are strings.

```typescript
it.each`
  input          | format     | expected
  ${'2025-03-01'}| ${'short'} | ${'01/03/2025'}
  ${'2025-12-25'}| ${'long'}  | ${'25 decembre 2025'}
  ${''}          | ${'short'} | ${'--'}
`('formatDate($input, $format) -> $expected', ({ input, format, expected }) => {
  expect(formatDate(input, format)).toBe(expected);
});
```

### Object syntax -- mix of types or majority non-string

More readable when values mix types (numbers, booleans, strings).

```typescript
it.each([
  { rent: '850', charges: '50', expected: 900 },
  { rent: '850.50', charges: '49.50', expected: 900 },
  { rent: '', charges: '50', expected: 50 },
  { rent: '', charges: '', expected: 0 },
])('computeTotal($rent, $charges) -> $expected', ({ rent, charges, expected }) => {
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

## Assertion Patterns

### Structured assertions over multiple checks

```typescript
// Prefer single assertion with expect.objectContaining
expect(receipt).toEqual(expect.objectContaining({
  tenantId: 'tenant-123',
  amount: 850_00,
  period: expect.objectContaining({ month: 3 }),
}));
```
