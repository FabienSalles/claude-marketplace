---
name: ts-functional
description: "ACTIVATE when writing functional-style TypeScript: pipe, compose, currying, Result types, railway-oriented programming, or AsyncResult. ACTIVATE for 'pipe', 'Result type', 'railway', 'functional', 'chain'. Covers: type-safe pipe implementation, currying patterns, Result<T,E> type, railway-oriented error handling, AsyncResult for async pipelines. DO NOT use for: DDD aggregate modeling (see ddd-ts-fp), OOP patterns (see ts-oop), imperative code."
version: "1.1"
---

# Functional Programming Patterns (TypeScript)

## Pipe

Chain transformations left-to-right for readable data flow:

```typescript
function pipe<T>(value: T, ...fns: Array<(arg: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), value);
}

const result = pipe(rawInput, validate, normalize, enrichWithDefaults, toDomain);
```

## Currying

**Transform a multi-argument function into a chain of single-argument functions**, useful for partial application and composition:

```typescript
const calculateTax = (rate: number) => (amount: number): number =>
  amount * rate;

const applyVAT = calculateTax(0.2);
applyVAT(100); // 20
```

## Railway-Oriented Programming (Result Type)

**Model operations that can fail as a `Result` type** instead of throwing exceptions. Errors travel along the "failure track" without try/catch.

> This is the canonical `Result<T, E>` definition. Other skills that need a fallible-operation type point here rather than declaring their own shape.

```typescript
type Result<T, E = Error> =
  | { tag: 'success'; value: T }
  | { tag: 'failure'; value: E };

function success<T>(value: T): Result<T, never> { return { tag: 'success', value }; }
function failure<E>(value: E): Result<never, E> { return { tag: 'failure', value }; }

function isSuccess<T, E>(result: Result<T, E>): result is Extract<Result<T, E>, { tag: 'success' }> {
  return result.tag === 'success';
}

function isFailure<T, E>(result: Result<T, E>): result is Extract<Result<T, E>, { tag: 'failure' }> {
  return result.tag === 'failure';
}

// Chain a fallible operation onto a Result, short-circuiting on failure
const chain =
  <T, S, E>(f: (value: T) => Result<S, E>) =>
  <F>(result: Result<T, F>): Result<S, E | F> =>
    isSuccess(result) ? f(result.value) : result;
```

## AsyncResult

**Extends the Result type to async operations**: `AsyncResult<T, E> = Promise<Result<T, E>>`.

Provides `chain` (async fallible), `tee` (side-effect), and `wrap` (adapt sync to async).

> **When implementing type-safe pipe overloads, currying+pipe composition, or validation pipelines**, read `references/fp-pattern-examples.md` for complete implementations.

> **When building an AsyncResult with chain/tee/wrap**, read `references/fp-pattern-examples.md` for the full implementation and handler usage patterns.

## Error and Composition Conventions

- throw is reserved for a state the type system allows but the domain declares impossible; an expected business failure returns failure() instead.
- chain and AsyncResult.chain are two distinct functions sharing one name; a sync pipe calls the bare chain, an async pipe calls AsyncResult.chain, and the two are never mixed in a single pipe call.
  Measure: no pipe call in this skill's own examples passes a bare chain(...) step to a pipe that also carries an AsyncResult.chain(...) step.
- A handler returns an AsyncResult only when its caller must branch on a business failure; otherwise it returns a plain Promise.
- tee never returns a new value: it is reserved for a side effect (persist, log, notify) that the pipeline's result must survive unchanged.
  Measure: tee's own signature returns AsyncResult<T, E>, the same T and E it received, never a narrower or wider type.
- The port method's name encodes the absence contract: find* returns Promise<T | null> and the caller decides, get* returns AsyncResult<T, DomainError> and the port supplies the typed error.
- Compose Results with pipe and chain only when synchronous; in async code, unwrap imperatively with if (isFailure(x)) return x;.
- wrap exists only to lift a synchronous Result-returning function into an async pipe; a function that already returns AsyncResult is passed to chain directly, never re-wrapped.
  Measure: no example in this skill calls AsyncResult.wrap on a function whose own return type is already AsyncResult.
- Calling AsyncResult.chain, tee, or wrap from a domain handler reads as ordinary async tooling, exactly the confusion rule 5 exists to prevent.
  Measure: this costs a reader the assumption that AsyncResult.chain, tee, or wrap is safe wherever a Promise is expected, when it is reserved to the worker's composition root.
- AsyncResult.wrap, chain, and tee belong only to infrastructure orchestration, at the top of a worker.
- pipe is a general composition tool, not a Result-only tool, and infrastructure is its heaviest consumer.
- the Quick Reference and When to Use tables never list AsyncResult.chain, AsyncResult.tee, or AsyncResult.wrap without their infrastructure-orchestration scope, so a reader scanning a table alone cannot mistake them for domain-layer tooling.
  Measure: every AsyncResult.chain/tee/wrap row in this file's tables carries the words "infrastructure orchestration only".
- a Workflow, Listener, or Consumer that needs to chain fallible async steps is exactly the infrastructure orchestration rule 5 names; a handler reaching for AsyncResult.chain is a sign the composition belongs one level up.
  Measure: no handler example in this skill or in ddd-ts-fp calls AsyncResult.chain, AsyncResult.tee, or AsyncResult.wrap directly.
- pipe alone, without AsyncResult.chain, tee, or wrap, is what a domain handler or a maker composes with; the moment a step turns async, composition moves to the infrastructure file that owns the worker.
  Measure: the handler examples in this skill and in ddd-ts-fp call pipe with domain functions only, never with an AsyncResult.chain/tee/wrap step.
- In tests, assert the boolean guard, then result.value; never compare against a reconstructed success(...).

## When to Use What

| Pattern | Use case |
|---------|----------|
| Pipe | Sequential transformations on data |
| Currying | Create specialized functions from general ones |
| Result type | Sync operations that can fail -- replace try/catch in domain |
| AsyncResult | Async operations that can fail, infrastructure orchestration only (DB, API, I/O) |
| Railway | Chain multiple fallible operations cleanly |
| Exceptions | Infrastructure errors (DB down, network failure) |

> **Rule of thumb**: if the caller is expected to handle the failure as a normal case, use `Result`. If it's an unexpected crash, let it throw.

## Quick Reference

| Pattern | Key idea |
|---------|----------|
| `pipe(value, fn1, fn2, fn3)` | Left-to-right transformation chain |
| `const specialized = general(config)` | Currying for partial application |
| `Result<T, E>` | Success or failure without exceptions |
| `isSuccess(result)` / `isFailure(result)` | Narrow a `Result` to its success or failure arm |
| `chain(fn)` | Chain a fallible operation, short-circuiting on failure |
| `AsyncResult<T, E>` | Async Result: `Promise<Result<T, E>>` |
| `AsyncResult.chain(fn)` | Chain async fallible operations, infrastructure orchestration only |
| `AsyncResult.tee(fn)` | Side-effect without altering the Result, infrastructure orchestration only |
| `AsyncResult.wrap(fn)` | Adapt sync Result function to async pipeline, infrastructure orchestration only |
