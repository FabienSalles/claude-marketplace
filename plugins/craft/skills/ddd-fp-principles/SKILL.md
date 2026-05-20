---
name: ddd-fp-principles
description: "ACTIVATE when modeling DDD aggregates and domain logic using functional patterns — immutable records, curried operations, Result types, validation/enrichment pipelines, handler orchestration. ACTIVATE for 'aggregate', 'smart constructor', 'make*', 'validation pipeline', 'enrichment', 'domain handler' in a functional context. Provides cross-language functional DDD principles. For OOP-style DDD (classes, decorators, module-bounded contexts) see craft:ddd-principles. Companion examples: ddd-ts-fp."
version: "1.0"
---

# DDD — Functional Principles

> The **rules** below describe functional-style DDD (records over classes, curried operations, Result pipelines). Language-specific examples live in:
> - `ddd-ts-fp` (TypeScript with `pipe`, `chain`, `Result<T, E>`)
>
> For **OOP-style** DDD (classes, ports/adapters, module-bounded contexts), see `craft:ddd-principles`. The two styles can coexist in the same codebase (e.g. PHP/Symfony in OOP, TypeScript domain in FP) — pick the one that matches the language's idioms.

## 1. Immutable Aggregate as Type, Not Class

Model aggregates as **immutable record types** with all fields `readonly`. State changes return new instances; no in-place mutation.

- The aggregate is **data** (a record), not a stateful object with methods.
- Operations live as **separate functions** that take and return the aggregate.

## 2. Curried Operations

Each domain operation is a **curried function**: `(context) => (input) => output | Result<output, error>`.

- The outer call captures context (config, ids, clocks).
- The inner call applies the operation to the aggregate.
- Operations compose via `pipe(aggregate, op1, op2, op3)` or `pipe(..., chain(opThatCanFail))`.

**Why curried:** each `op` becomes directly usable in a `pipe` without extra wrapping.

## 3. Smart Constructors (`make*` prefix)

A smart constructor is a curried factory that:

- Takes the surrounding context (ids, clocks, configuration).
- Returns a function that takes the input command and produces the aggregate (or a `Result<aggregate, error>`).
- Encapsulates **all invariants** at construction time — once built, the aggregate is valid by construction.

Convention:

| Element | Rule |
|---|---|
| Prefix | `make` |
| Shape | `make<X>(context) => (input) => output \| Result<output, error>` |
| Return | `Result<T, E>` when validation can fail, plain `T` otherwise |
| Position in pipeline | End of pipeline (after validations) or start of workflow |

## 4. Validation Pipelines

Validation is a **chain of composable validators**: `(input) => Result<input, error>`.

- Each validator either passes the input through (success) or short-circuits (error).
- Composition stops at the first error — no need to short-circuit manually with `if`.
- Validation is for **internal constraints** (positive amount, valid period, …).

## 5. Enrichment Pipelines

Enrichment **transforms incoming data** into domain objects at the system boundary.

| Aspect | Validation | Enrichment |
|---|---|---|
| Purpose | Verify constraints | Transform / complete data |
| Source | Internal data | External data (API, message broker) |
| Position | Before business logic | At system boundary |

Both compose with the same `pipe` / `chain` machinery.

## 6. Handler Pattern

A handler **orchestrates** a use case: it is the impure shell around a pure domain core.

**Flow:**

```
validate(command)
  → load(aggregate from repository)
  → apply pure domain operations
  → persist updated aggregate
  → return result / publish events
```

- Validation, load, persist, publish: **impure** (I/O).
- Domain operations between them: **pure**.

## Quick Reference

| Rule | Convention |
|------|-----------|
| Aggregate | Immutable `readonly` record, no class |
| Operations | Pure curried functions returning new aggregates |
| Smart constructor | `make<X>(context) => (input) => output \| Result<output, error>` |
| Updates | Spread / structural sharing — never mutate |
| Composition | `pipe(aggregate, op1, op2, op3)` |
| Fallible composition | `pipe(aggregate, op1, chain(op2))` |
| Validation pipeline | Chain of `Validator<T>`; stops at first error |
| Enrichment pipeline | Transform external → domain at system boundary |
| Handler | Orchestrator: validate → load → pure domain → persist |
