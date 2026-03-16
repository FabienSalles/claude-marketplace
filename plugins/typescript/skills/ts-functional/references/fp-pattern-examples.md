# Functional Programming Pattern Examples

## Table of Contents
- [Type-safe Pipe Implementation](#type-safe-pipe-implementation)
- [Currying Patterns](#currying-patterns)
- [Result Type Implementation](#result-type-implementation)
- [Railway-Oriented Programming](#railway-oriented-programming)
- [AsyncResult Implementation](#asyncresult-implementation)

## Type-safe Pipe Implementation

```typescript
function pipe<A, B>(value: A, fn1: (a: A) => B): B;
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
function pipe<A, B, C, D>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D): D;
function pipe(value: unknown, ...fns: Array<(arg: any) => any>): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}
```

## Currying Patterns

### Basic Currying

```typescript
// Transform a multi-argument function into a chain of single-argument functions
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
); // "102,00 EUR"
```

## Result Type Implementation

### Core Types

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

### Validation Pipeline Example

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

## Railway-Oriented Programming

### pipeResult

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
  // Handle error -- no try/catch needed
  return { error: result.error };
}

// result.value is the validated, normalized, unique email
```

## AsyncResult Implementation

### Definition

```typescript
type AsyncResult<T, E> = Promise<Result<T, E>>;

const AsyncResult = {
  // Chain an async fallible operation
  chain:
    <T, S, E>(f: (a: T) => AsyncResult<S, E>) =>
    async <F>(asyncResult: AsyncResult<T, F>): AsyncResult<S, E | F> => {
      const result = await asyncResult;
      return result.ok ? f(result.value) : result;
    },

  // Side-effect without altering the result (persist, log, notify)
  tee:
    <T, E>(f: (a: T) => Promise<void>) =>
    async (asyncResult: AsyncResult<T, E>): AsyncResult<T, E> => {
      const result = await asyncResult;
      if (result.ok) {
        await f(result.value);
      }
      return result;
    },

  // Convert a sync Result function to async
  wrap:
    <T, E>(fn: (...args: unknown[]) => Result<T, E>) =>
    async (...args: unknown[]): AsyncResult<T, E> =>
      fn(...args),
};
```

### Usage in a Handler

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

### Usage with pipe

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
