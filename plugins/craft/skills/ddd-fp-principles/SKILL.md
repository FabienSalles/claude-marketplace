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

Total operations compose bare in a pipe; only a fallible operation needs chain, because chain requires a function that returns a Result.

## 3. Validators and Makers (`make*` prefix)

A smart constructor is a curried factory that:

- Takes the surrounding context (ids, clocks, configuration).
- Returns a function that takes the input command and produces the aggregate.

Convention:

| Element | Rule |
|---|---|
| Prefix | `make` |
| Shape | `make<X>(context) => (input) => output \| Result<output, error>` |
| Return | The aggregate. A maker is total and never returns a failure |
| Position in pipeline | After the validation pipeline, applied to the validated command outside the pipe |

Every maker is paired with a named validator that owns its invariants, and the two are separate units: the validator is fallible, the maker is total and returns the aggregate.

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

## 7. Parameter Order and Curry Conventions

- **Dependency positioning.** The dependency group is positional, never a destructured object nor a container. A curried factory takes its dependencies as separate leading arguments, not as one bag.
- **Argument order.** Dependencies then data at the handler level, but data then subject at the model level: the aggregate is always the last curried argument. This keeps `pipe(aggregate, op1(deps), op2(deps))` shaped consistently.
- **What gets curried.** Curry only what will be partially applied or piped; adapters, ports, predicates, and mappers stay single-stage. Currying a member that is always called fully applied only adds indirection.
- **Handler type export.** Publish export type XHandler beside a Command handler and annotate the factory with it; never do so for a Query. Queries return their result directly and gain nothing from the named type.
- **No handler-to-handler calls.** A handler never calls another handler: composition moves up a level, into a Workflow, a Listener, a Router, or a Consumer. A handler importing another handler's implementation is a sign the composition belongs one layer higher.
- **Return type by failure mode.** Return Result when a business rule can fail, Promise<void> for fire-and-forget; never a bare domain value. A bare value hides whether the operation could have failed.
- **Single input object.** The data stage takes a single XCommand or XQuery object, never a list of primitives. Adding a field never changes the call site's arity.

## Quick Reference

| Rule | Convention |
|------|-----------|
| Aggregate | Immutable `readonly` record, no class |
| Operations | Pure curried functions returning new aggregates |
| Validator | Fallible; owns the invariants |
| Maker | Total; maps and normalizes, never fails |
| Updates | Spread / structural sharing — never mutate |
| Composition | `pipe(aggregate, op1, op2, op3)` |
| Fallible composition | `pipe(aggregate, op1, chain(op2))` |
| Validation pipeline | Chain of `Validator<T>`; stops at first error |
| Enrichment pipeline | Transform external → domain at system boundary |
| Handler | Orchestrator: validate → load → pure domain → persist |
| Dependency group | Positional arguments, never a destructured object or container |
| Argument order | Handler: deps then data. Model: data then subject, aggregate last |
| Curry scope | Only what is partially applied or piped; ports/predicates/mappers stay single-stage |
| Handler type | `export type XHandler` for Command, never for Query |
| Handler composition | Never handler-to-handler; compose in a Workflow/Listener/Router/Consumer |
| Handler return | `Result` when failable, `Promise<void>` when fire-and-forget |
| Data stage input | One `XCommand`/`XQuery` object, never a list of primitives |
