---
name: ddd-ts-fp
description: "ACTIVATE when modeling DDD aggregates, domain logic, or business rules in TypeScript using functional patterns. ACTIVATE for 'aggregate', 'smart constructor', 'make', 'validation pipeline', 'enrichment', 'domain handler'. Covers: immutable aggregates as readonly types (not classes), curried domain operations, smart constructors (make* prefix), validation/enrichment pipelines, handler orchestration pattern. DO NOT use for: infrastructure code, general FP patterns (see ts-functional), OOP modeling (see ts-oop)."
version: "1.1"
---

# DDD Functional Patterns

## Immutable Aggregate

**Model aggregates as immutable types** with pure curried functions, not classes with methods:

```typescript
// Immutable type + curried functions
type Receipt = {
  readonly id: ReceiptId;
  readonly tenantId: TenantId;
  readonly addresses: readonly Address[];
  readonly period: Period;
  readonly amount: number;
  readonly createdAt: Date;
};

const addAddress =
  (address: Address) =>
  (receipt: Receipt): Receipt => ({
    ...receipt,
    addresses: [...receipt.addresses, address],
  });
```

Each operation is a **curried function** that returns a new aggregate (or a `Result`). Compose with `pipe` and `chain`.

> **When implementing aggregate operations, pipe composition, or nested immutable updates**, read `references/ddd-functional-examples.md` for complete patterns with pure and fallible transformations.

## Smart Constructor

**`make` prefix**: curried factory function that captures context and returns a specialized function, usable directly in a `pipe`:

```typescript
const makeAddress =
  (addressId: string, createdAt: Date) =>
  (command: AddAddressCommand): Result<Address, DomainError> =>
    ok({ id: addressId, street: command.street, city: command.city, ... });
```

| Rule | Convention |
|------|-----------|
| Prefix | `make` |
| Signature | `make*(context) => (input) => output` |
| Return | Often `Result<T, E>`, sometimes `T` directly |
| Position | End of pipeline (after validations) or start of workflow |

> **When creating smart constructors for domain objects**, read `references/ddd-functional-examples.md` for complete examples and pipeline integration.

## Validation Pipeline

**Validate incoming data** via a chain of composable validators. Stops at first error:

```typescript
type Validator<T> = (input: T) => Result<T, DomainError>;

// Composition
const validateCreateReceipt = (cmd) =>
  pipe(cmd, validatePeriod, chain(validateAmount), chain(validateLease));
```

## Enrichment Pipeline

**Transform external data into domain objects** via progressive enrichment. Each step enriches or transforms the command.

| Aspect | Validation | Enrichment |
|--------|-----------|------------|
| Purpose | Verify constraints | Transform / complete data |
| Source | Internal data (domain) | External data (API, message broker) |
| Position | Before business logic | At system boundary |

> **When building validation or enrichment pipelines**, read `references/ddd-functional-examples.md` for complete pipeline implementations with enrichers.

## Handler Pattern

**The handler orchestrates**: retrieval, validation, transformation, persistence.

Flow: validate -> load aggregate -> domain logic (pure) -> persist.

> **When writing domain handlers**, read `references/ddd-functional-examples.md` for the complete handler pattern with error handling.

## Quick Reference

| Rule | Convention |
|------|-----------|
| Aggregate | Immutable `readonly` type, no class |
| Operations | Pure curried functions |
| Smart Constructor | `make*(context) => (input) => output` |
| Updates | Spread operator, never mutate |
| Composition | `pipe(aggregate, op1, op2, op3)` |
| Fallible operations | `pipe(aggregate, op1, chain(op2))` |
| Validation | Composable `Validator<T>` pipeline |
| Enrichment | Pipeline at system boundary |
| Handler | Orchestrator: validate -> load -> domain -> persist |
