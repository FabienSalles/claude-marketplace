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

> `Result<T, E>` is defined once, in `SKILL.md`'s Railway-Oriented Programming section. The examples
> below build on that definition rather than redeclaring it.

### Validation Pipeline Example

```typescript
type ValidationError = { field: string; message: string };

function validateEmail(input: string): Result<string, ValidationError> {
  return input.includes('@')
    ? success(input)
    : failure({ field: 'email', message: 'Invalid email' });
}

function validateMinLength(min: number) {
  return (input: string): Result<string, ValidationError> =>
    input.length >= min
      ? success(input)
      : failure({ field: 'password', message: `Min ${min} characters` });
}

function createTenant(dto: CreateTenantDto): Result<Tenant, ValidationError> {
  const email = validateEmail(dto.email);

  if (isFailure(email)) {
    return email;
  }

  const password = validateMinLength(8)(dto.password);

  if (isFailure(password)) {
    return password;
  }

  return success(Tenant.create(email.value, password.value));
}
```

## Railway-Oriented Programming

### Chaining with chain

```typescript
const result = pipe(
  success(rawInput),
  chain(validateEmail),
  chain(normalizeEmail),
  chain(checkUniqueness),
);

if (isFailure(result)) {
  return failure(result.value);
}

// result.value is the validated, normalized, unique email
```

## AsyncResult Implementation

> pipe is a general composition tool, not a Result-only tool, and infrastructure is its heaviest consumer: every AsyncResult.wrap/chain/tee call below sits inside an infrastructure file, never a domain handler.

### Definition

```typescript
type AsyncResult<T, E> = Promise<Result<T, E>>;

const AsyncResult = {
  // Chain an async fallible operation
  chain:
    <T, S, E>(f: (a: T) => AsyncResult<S, E>) =>
    async <F>(asyncResult: AsyncResult<T, F>): AsyncResult<S, E | F> => {
      const result = await asyncResult;
      return isSuccess(result) ? f(result.value) : result;
    },

  // Side-effect without altering the result (persist, log, notify)
  tee:
    <T, E>(f: (a: T) => Promise<void>) =>
    async (asyncResult: AsyncResult<T, E>): AsyncResult<T, E> => {
      const result = await asyncResult;
      if (isSuccess(result)) {
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

    if (isFailure(customerResult)) {
      return customerResult;
    }

    const addressId = idGenerator.generate();
    const customer = addAddress(addressId, command)(customerResult.value);

    if (isFailure(customer)) {
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
