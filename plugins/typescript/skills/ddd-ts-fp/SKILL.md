---
name: ddd-ts-fp
description: "ACTIVATE when modeling DDD aggregates and domain logic in TypeScript using functional patterns. ACTIVATE for 'aggregate', 'smart constructor', 'make*', 'validation pipeline', 'enrichment', 'domain handler' in TypeScript. Provides TypeScript-specific examples for cross-language functional DDD principles defined in craft:ddd-fp-principles. DO NOT use for: infrastructure code, general FP patterns (see ts-functional), OOP modeling (see ts-oop)."
version: "2.0"
---

# DDD Functional Patterns — TypeScript

> The **cross-language functional DDD principles** (immutable aggregates, curried operations, smart constructors, validation/enrichment pipelines, handler orchestration) are defined in `craft:ddd-fp-principles`. This skill keeps TypeScript-specific syntax and patterns.

## TS-specific: Immutable Aggregate as `readonly` Type

```typescript
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

Each operation is a **curried function** returning a new aggregate (or a `Result`). Compose with `pipe` and `chain`.

> When implementing aggregate operations, pipe composition, or nested immutable updates, read `references/ddd-functional-examples.md` for complete patterns.

## TS-specific: Smart Constructor

`make` prefix — curried factory that captures context and returns a specialized function usable directly in a `pipe`:

```typescript
const makeAddress =
  (addressId: string, createdAt: Date) =>
  (command: AddAddressCommand): Result<Address, DomainError> =>
    ok({
      id: addressId,
      street: command.street,
      city: command.city,
      // …
    });
```

> When creating smart constructors for domain objects, read `references/ddd-functional-examples.md` for complete examples and pipeline integration.

## TS-specific: Validation Pipeline

```typescript
type Validator<T> = (input: T) => Result<T, DomainError>;

// Composition
const validateCreateReceipt = (cmd) =>
  pipe(
    cmd,
    validatePeriod,
    chain(validateAmount),
    chain(validateLease),
  );
```

> When building validation or enrichment pipelines, read `references/ddd-functional-examples.md` for complete pipeline implementations.

## TS-specific: Enrichment Pipeline

Same pipe/chain machinery, applied at the system boundary to **transform external data into domain objects**.

> When building enrichment pipelines, read `references/ddd-functional-examples.md` for examples with enrichers.

## TS-specific: Handler Pattern

The handler orchestrates: retrieval, validation, transformation, persistence.

```
validate(command)
  → load(aggregate)
  → pure domain operations
  → persist
```

> When writing domain handlers, read `references/ddd-functional-examples.md` for the complete handler pattern with error handling.

## Quick Reference (TS-specific FP)

| Element | Convention |
|---------|------------|
| Aggregate | Immutable `readonly` type, no class |
| Operations | Pure curried functions |
| Smart constructor | `make<X>(context) => (input) => output \| Result<output, error>` |
| Updates | Spread operator, never mutate |
| Composition | `pipe(aggregate, op1, op2, op3)` |
| Fallible composition | `pipe(aggregate, op1, chain(op2))` |
| Validation | Composable `Validator<T>` pipeline |
| Enrichment | Pipeline at system boundary |
| Handler | Orchestrator: validate → load → domain → persist |
