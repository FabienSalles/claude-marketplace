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

A **validator** owns the invariants and returns a **narrower type**; a **maker** builds the aggregate from that narrower type and cannot fail.

| Element | Rule |
|---|---|
| Validator | `(raw) => Result<Validated<X>, error>` — owns the invariants, returns a type the raw input does not satisfy |
| Prefix | `make` |
| Shape | `make<X>(context) => (validated) => aggregate` |
| Return | The aggregate. A maker is total, and its input type is what earns that |
| Position in pipeline | After the validator, applied to the narrowed value |

Every maker is paired with a named validator that owns its invariants, and the two are separate units: the validator is fallible and narrows the type, the maker is total because its input already carries that proof.

**A maker that takes the raw input is not total — it is partial and silent.** `Raw -> Aggregate` is total only when every `Raw` yields a valid aggregate. When some do not, the invariant lives outside the types and nothing stops `make(neverValidated)` from compiling: the split then costs a step and buys no guarantee, because the ordering is a promise rather than a compile error.

**Why not a single fallible constructor?** That is the canonical form and it is correct — `create: (raw) => Result<T, error>` makes illegal states unrepresentable in one step (Wlaschin, *Domain Modeling Made Functional*). Split it in two only for a reason: to accumulate every error instead of short-circuiting at the first, or to keep construction context (ids, clocks) out of the invariants. Without one of those two, the fallible constructor is simpler and just as safe.

**Totality is not purity.** A function returning `Result<T, error>` is pure — `Result` is a value, not an effect. Never reach for a total maker in the name of purity: both forms are pure, and only the narrowed input type buys anything.

**Earning the narrower type.** Prefer a shape that is genuinely narrower and therefore *constructed*, because a construction is checked and needs no assertion. A phantom brand adds no data, so it can only ever be asserted: when it is the right tool, mint it through one helper outside the domain rather than at each site. A type predicate is not a third option — the language never checks that its body proves its claim, so it is the same assertion with no word left to grep for.

## 4. Validation Pipelines — parse, don't validate

A validator that returns its own input type throws away what it just proved: once it succeeds you hold the type you started with, and the compiler knows nothing it did not know before. Return a **narrower** type instead, so the proof travels with the value (Alexis King, *Parse, don't validate*, 2019).

Validation is a **chain of composable validators**: `(raw) => Result<narrower, error>`.

- Each validator either produces the narrowed value (success) or short-circuits (error).
- Composition stops at the first error — no need to short-circuit manually with `if`.
- Validation is for **internal constraints** (positive amount, valid period, …).
- The narrowed type is what the next stage demands, which turns a call-order convention into a compile error.

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
| Validator | Fallible; owns the invariants and narrows the type |
| Maker | Total; takes the narrowed type, which is what earns the totality |
| Updates | Spread / structural sharing — never mutate |
| Composition | `pipe(aggregate, op1, op2, op3)` |
| Fallible composition | `pipe(aggregate, op1, chain(op2))` |
| Validation pipeline | Chain of `(raw) => Result<narrower, e>`; stops at first error |
| Enrichment pipeline | Transform external → domain at system boundary |
| Handler | Orchestrator: validate → load → pure domain → persist |
| Dependency group | Positional arguments, never a destructured object or container |
| Argument order | Handler: deps then data. Model: data then subject, aggregate last |
| Curry scope | Only what is partially applied or piped; ports/predicates/mappers stay single-stage |
| Handler type | `export type XHandler` for Command, never for Query |
| Handler composition | Never handler-to-handler; compose in a Workflow/Listener/Router/Consumer |
| Handler return | `Result` when failable, `Promise<void>` when fire-and-forget |
| Data stage input | One `XCommand`/`XQuery` object, never a list of primitives |
