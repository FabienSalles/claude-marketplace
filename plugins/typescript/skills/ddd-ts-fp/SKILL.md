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

## TS-specific: Validation Pipeline

A single check keeps the type; the **composition** is what mints the branded one. That is where the proof enters the type system, so nothing downstream has to trust a call order.

```typescript
type Check<T> = (input: T) => Result<T, DomainError>;
type Validator<Raw, Valid extends Raw> = (input: Raw) => Result<Valid, DomainError>;

// Each check keeps the type; the last step BUILDS the narrower shape out of the
// primitives it just proved, so the pipeline narrows by construction, never by assertion.
const validateCreateReceipt: Validator<CreateReceiptCommand, ValidCreateReceiptCommand> = (cmd) =>
  pipe(
    cmd,
    validatePeriod,
    chain(validateAmount),
    chain(validateLease),
    chain(buildValidCreateReceipt),
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
  (clock: Clock) =>
  async (command: AddAddressCommand): Promise<Result<Receipt, DomainError>> => {
    const validated = validateAddAddress(command);
    if (isFailure(validated)) return validated;

    return buildReceipt(clock.now())(validated.value);
  };
```

Dependencies (`clock`) come first as separate arguments, never as one destructured object. The command comes last. A model-level operation instead takes its data first and the aggregate last: `addAddress(address)(receipt)`.

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

## TS-specific: Validator and Maker

Validator files carry the invariants and return a branded command; the maker maps and normalizes a value the type system already proves valid, so it never fails.

```typescript
// ValidAddAddressCommand.ts — a real shape, not a tag on the raw one
type ValidAddAddressCommand = {
  readonly street: NonEmptyString;
  readonly city: NonEmptyString;
};

// AddressValidator.ts — fallible, and it builds the narrower value rather than asserting it
const validateAddress = (command: AddAddressCommand): Result<ValidAddAddressCommand, DomainError> =>
  pipe(
    nonEmpty(command.street),
    chain((street) => map(nonEmpty(command.city), (city) => ({ street, city }))),
  );

// makeAddress.ts — curried on its context, total because its input is the proof
const makeAddress =
  (addressId: AddressId, createdAt: Date) =>
  (command: ValidAddAddressCommand): Address => ({
    id: addressId,
    street: command.street,
    city: command.city,
    createdAt,
  });
```

`makeAddress(addressId, createdAt)(rawCommand)` does not compile, and that is the entire point of the split. A maker that accepted `AddAddressCommand` would be total in its signature only — the invariant would live in a call-order convention nothing enforces. See `craft:ddd-fp-principles` §3 for why a single fallible constructor is the default, and what justifies splitting it.

The object literal is **constructed**, so the compiler checks it and the validator asserts nothing. Every remaining assertion sits in the primitive's own constructor — `nonEmpty` returns `Brand<string, 'NonEmptyString'>`, minted once in the kernel (`ts-conventions` — Branded Types). That is what keeps `as` out of the domain, per C138, instead of widening the rule to admit it.

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
| Validator | Fallible; owns the invariants and returns a branded type |
| Maker | Total; takes the branded type, which is what earns the totality |
| Updates | Spread operator, never mutate |
| Composition | `pipe(aggregate, op1, op2, op3)` |
| Fallible composition | `pipe(aggregate, op1, chain(op2))` |
| Validation | Composable `Validator<Raw, Valid>` pipeline; narrows the type |
| Enrichment | Pipeline at system boundary |
| Handler | Orchestrator: validate → load → domain → persist |
| Handler args | Dependencies positional, then the Command/Query last |
| Model args | Data first, aggregate last (`op(data)(aggregate)`) |
| Command handler type | `export type XHandler = (command: XCommand) => Promise<Result<T, E>>` |
