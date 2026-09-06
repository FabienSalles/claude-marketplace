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
  (command: AddAddressCommand): Result<Address, DomainError> => ({
    tag: 'success',
    value: {
      id: addressId,
      street: command.street,
      city: command.city,
      // …
    },
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

## TS-specific: Handler Parameter Order

```typescript
export type AddAddressHandler = (command: AddAddressCommand) => Promise<Result<Receipt, DomainError>>;

const addAddressHandler =
  (repository: ReceiptRepository, clock: Clock) =>
  (command: AddAddressCommand): Promise<Result<Receipt, DomainError>> =>
    pipe(
      command,
      validateAddAddress,
      chain(makeAddress(clock.now())),
    );
```

Dependencies (`repository`, `clock`) come first as separate arguments, never as one destructured object. The command comes last. A model-level operation instead takes its data first and the aggregate last: `addAddress(address)(receipt)`.

## TS-specific: Result vs Bare Model

An operation returns a Result only when it can fail; a total transition returns the bare model.

```typescript
// Fallible — the amount could be negative
const withAmount = (amount: number) => (receipt: Receipt): Result<Receipt, DomainError> => ...;

// Total — appending never fails
const addAddress = (address: Address) => (receipt: Receipt): Receipt => ...;
```

## TS-specific: Entity Folder and Aggregate-Only Operations

An entity carrying identity has its own Models/Entities/<Name>/ folder, and its operations take and return the aggregate, never the entity.

```typescript
// plugins/../Models/Entities/Address/updateAddress.ts
const updateAddress =
  (addressId: AddressId, patch: AddressPatch) =>
  (customer: Customer): Customer => ({
    ...customer,
    addresses: customer.addresses.map((a) => (a.id === addressId ? { ...a, ...patch } : a)),
  });
```

## TS-specific: Maker/Validator Split

The smart constructor splits in two: Validator files carry the invariants, and the maker only maps and normalizes, and never fails.

```typescript
// AddressValidator.ts
const validateAddress = (command: AddAddressCommand): Result<AddAddressCommand, DomainError> =>
  command.street.length === 0 ? failure(invalidStreet()) : success(command);

// makeAddress.ts — no conditional, only mapping and normalization
const makeAddress =
  (addressId: AddressId, createdAt: Date) =>
  (command: AddAddressCommand): Address => ({
    id: addressId,
    street: command.street.trim(),
    city: command.city.trim(),
    createdAt,
  });
```

## TS-specific: CQRS Model Copies

Each CQRS side owns its own copy of the model; the read copy is deliberately narrowed.

```typescript
// Command/Models/Address.ts — full write shape
type Address = { readonly street: string; readonly city: string; readonly geo: GeoPoint /* … */ };

// Query/Models/Address.ts — narrowed read shape
type Address = { readonly street: string; readonly city: string };
```

## TS-specific: Command DTO Duplication Across Features

The command DTO repeats per feature; two features are never factored together just because their types are identical.

```typescript
// features/onboard-customer/AddAddressCommand.ts
type AddAddressCommand = { readonly street: string; readonly city: string };

// features/relocate-customer/AddAddressCommand.ts — same shape, its own file
type AddAddressCommand = { readonly street: string; readonly city: string };
```

## TS-specific: Repository Receives the Whole Aggregate

The repository receives the whole aggregate, never a patch nor a list of fields.

```typescript
export type CustomerRepository = {
  save: (customer: Customer) => Promise<void>;
};

// ❌ AVOID — no partial-update method
// update: (id: CustomerId, patch: Partial<Customer>) => Promise<void>;
```

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
| Handler args | Dependencies positional, then the Command/Query last |
| Model args | Data first, aggregate last (`op(data)(aggregate)`) |
| Command handler type | `export type XHandler = (command: XCommand) => Promise<Result<T, E>>` |
