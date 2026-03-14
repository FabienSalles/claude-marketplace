---
name: ts-functional
description: This skill should be used when writing functional-style TypeScript code, using pipe, compose, currying, railway-oriented programming, or Result types. Provides functional programming patterns.
version: "1.0"
---

# Functional Programming Patterns (TypeScript)

## Pipe

**Chain transformations left-to-right** for readable data flow:

```typescript
// Simple pipe implementation
function pipe<T>(value: T, ...fns: Array<(arg: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), value);
}

// Usage
const result = pipe(
  rawInput,
  validate,
  normalize,
  enrichWithDefaults,
  toDomain,
);
```

### Type-safe pipe (overloads)

```typescript
function pipe<A, B>(value: A, fn1: (a: A) => B): B;
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
function pipe<A, B, C, D>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D): D;
function pipe(value: unknown, ...fns: Array<(arg: any) => any>): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}
```

## Currying

**Transform a multi-argument function into a chain of single-argument functions**, useful for partial application and composition:

```typescript
// ❌ AVOID - Repeated argument threading
function calculateTax(rate: number, amount: number): number {
  return amount * rate;
}
calculateTax(0.2, 100);
calculateTax(0.2, 200);
calculateTax(0.2, 350);

// ✅ CORRECT - Curry to create specialized functions
const calculateTax = (rate: number) => (amount: number): number =>
  amount * rate;

const applyVAT = calculateTax(0.2);
const applyReducedVAT = calculateTax(0.055);

applyVAT(100);      // 20
applyReducedVAT(100); // 5.5
```

### Currying + Pipe

```typescript
const formatCurrency = (locale: string) => (cents: number): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })
    .format(cents / 100);

const formatEUR = formatCurrency('fr-FR');

const result = pipe(
  receipt.amount,
  applyVAT,
  Math.round,
  formatEUR,
); // "102,00 €"
```

## Railway-Oriented Programming (Result Type)

**Model operations that can fail as a `Result` type** instead of throwing exceptions. Errors travel along the "failure track" without try/catch.

### Result Type

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

### Chaining with map / flatMap

```typescript
function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}
```

### Example: Validation Pipeline

```typescript
type ValidationError = { field: string; message: string };

function validateEmail(input: string): Result<string, ValidationError> {
  return input.includes('@')
    ? ok(input)
    : err({ field: 'email', message: 'Invalid email' });
}

function validateMinLength(min: number) {
  return (input: string): Result<string, ValidationError> =>
    input.length >= min
      ? ok(input)
      : err({ field: 'password', message: `Min ${min} characters` });
}

function createTenant(dto: CreateTenantDto): Result<Tenant, ValidationError> {
  const email = validateEmail(dto.email);

  if (!email.ok) {
    return email;
  }

  const password = validateMinLength(8)(dto.password);

  if (!password.ok) {
    return password;
  }

  return ok(Tenant.create(email.value, password.value));
}
```

### Railway + Pipe

```typescript
function pipeResult<T, E>(
  initial: Result<T, E>,
  ...fns: Array<(value: any) => Result<any, E>>
): Result<any, E> {
  return fns.reduce(
    (acc, fn) => (acc.ok ? fn(acc.value) : acc),
    initial,
  );
}

const result = pipeResult(
  ok(rawInput),
  validateEmail,
  normalizeEmail,
  checkUniqueness,
);

if (!result.ok) {
  // Handle error — no try/catch needed
  return { error: result.error };
}

// result.value is the validated, normalized, unique email
```

## AsyncResult — Async Railway-Oriented Programming

**Etend le Result type aux operations asynchrones** : `AsyncResult<T, E> = Promise<Result<T, E>>`.

### Definition

```typescript
type AsyncResult<T, E> = Promise<Result<T, E>>;

const AsyncResult = {
  // Chaine une operation async faillible
  chain:
    <T, S, E>(f: (a: T) => AsyncResult<S, E>) =>
    async <F>(asyncResult: AsyncResult<T, F>): AsyncResult<S, E | F> => {
      const result = await asyncResult;
      return result.ok ? f(result.value) : result;
    },

  // Side-effect sans alterer le resultat (persist, log, notify)
  tee:
    <T, E>(f: (a: T) => Promise<void>) =>
    async (asyncResult: AsyncResult<T, E>): AsyncResult<T, E> => {
      const result = await asyncResult;
      if (result.ok) {
        await f(result.value);
      }
      return result;
    },

  // Convertit une fonction sync Result en async
  wrap:
    <T, E>(fn: (...args: unknown[]) => Result<T, E>) =>
    async (...args: unknown[]): AsyncResult<T, E> =>
      fn(...args),
};
```

### Usage dans un Handler

```typescript
const addAddressHandler =
  (
    customerRepository: CustomerRepository,
    idGenerator: IdGenerator,
  ) =>
  async (customerId: string, command: AddAddressCommand): AsyncResult<Customer, DomainError> => {
    const customerResult = await customerRepository.getById(customerId);

    if (!customerResult.ok) {
      return customerResult;
    }

    const addressId = idGenerator.generate();
    const customer = addAddress(addressId, command)(customerResult.value);

    if (!customer.ok) {
      return customer;
    }

    await customerRepository.update(customer.value);
    return customer;
  };
```

### Usage avec pipe

```typescript
const processEvent =
  (handler: UpdateHandler, formatter: CommandFormatter) =>
  async (rawEvent: string | undefined): Promise<void> => {
    if (rawEvent === undefined) return;

    await pipe(
      rawEvent,
      AsyncResult.wrap(formatter),
      AsyncResult.tee(handler),
    );
  };
```

## When to Use What

| Pattern | Use case |
|---------|----------|
| Pipe | Sequential transformations on data |
| Currying | Create specialized functions from general ones |
| Result type | Sync operations that can fail — replace try/catch in domain |
| AsyncResult | Async operations that can fail (DB, API, I/O) |
| Railway | Chain multiple fallible operations cleanly |
| Exceptions | Infrastructure errors (DB down, network failure) |

### Result vs Exceptions

```typescript
// ✅ Result — for expected domain failures (validation, business rules)
function createReceipt(dto: CreateReceiptDto): Result<Receipt, DomainError> { ... }

// ✅ Exceptions — for unexpected infrastructure failures
async function save(receipt: Receipt): Promise<void> {
  // Let DB errors throw — they're unexpected
  await db.insert(receipts).values(toPersistence(receipt));
}
```

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
