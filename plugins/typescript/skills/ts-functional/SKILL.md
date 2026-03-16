---
name: ts-functional
description: "ACTIVATE when writing functional-style TypeScript: pipe, compose, currying, Result types, railway-oriented programming, or AsyncResult. ACTIVATE for 'pipe', 'Result type', 'railway', 'functional', 'chain', 'flatMap'. Covers: type-safe pipe implementation, currying patterns, Result<T,E> type, railway-oriented error handling, AsyncResult for async pipelines. DO NOT use for: DDD aggregate modeling (see ddd-ts-fp), OOP patterns (see ts-oop), imperative code."
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

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> { return { ok: true, value }; }
function err<E>(error: E): Result<never, E> { return { ok: false, error }; }
```

## AsyncResult

**Extends the Result type to async operations**: `AsyncResult<T, E> = Promise<Result<T, E>>`.

Provides `chain` (async fallible), `tee` (side-effect), and `wrap` (adapt sync to async).

> **When implementing type-safe pipe overloads, currying+pipe composition, or validation pipelines**, read `references/fp-pattern-examples.md` for complete implementations.

> **When building an AsyncResult with chain/tee/wrap**, read `references/fp-pattern-examples.md` for the full implementation and handler usage patterns.

## When to Use What

| Pattern | Use case |
|---------|----------|
| Pipe | Sequential transformations on data |
| Currying | Create specialized functions from general ones |
| Result type | Sync operations that can fail -- replace try/catch in domain |
| AsyncResult | Async operations that can fail (DB, API, I/O) |
| Railway | Chain multiple fallible operations cleanly |
| Exceptions | Infrastructure errors (DB down, network failure) |

> **Rule of thumb**: if the caller is expected to handle the failure as a normal case, use `Result`. If it's an unexpected crash, let it throw.

## Quick Reference

| Pattern | Key idea |
|---------|----------|
| `pipe(value, fn1, fn2, fn3)` | Left-to-right transformation chain |
| `const specialized = general(config)` | Currying for partial application |
| `Result<T, E>` | Success or failure without exceptions |
| `map(result, fn)` | Transform success value, skip on error |
| `flatMap(result, fn)` | Chain fallible operations |
| `pipeResult(ok(x), fn1, fn2)` | Railway: pipe that stops on first error |
| `AsyncResult<T, E>` | Async Result: `Promise<Result<T, E>>` |
| `AsyncResult.chain(fn)` | Chain async fallible operations |
| `AsyncResult.tee(fn)` | Side-effect without altering the Result |
| `AsyncResult.wrap(fn)` | Adapt sync Result function to async pipeline |
