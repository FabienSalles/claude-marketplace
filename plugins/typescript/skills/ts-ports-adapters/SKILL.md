---
name: ts-ports-adapters
description: "ACTIVATE when a TypeScript codebase with no dependency-injection container has to declare a port and wire its adapter — a repository, a clock, an id generator, an event dispatcher the domain depends on. ACTIVATE for 'port', 'adapter', 'SPI', 'dependency inversion', 'composition root', 'inject without a container'. Covers: the port as a type of functions in the domain layer, the adapter as an object literal annotated with it, the handler that takes its dependencies first and its data second, the composition root in the infrastructure layer, and the in-memory stub that substitutes for the adapter in a unit test. DO NOT use for: container-based DI with decorators and tokens (see nest-ddd-conventions), aggregate operations and smart constructors (see ddd-ts-fp), the Result type itself (see ts-functional)."
version: "1.0"
---

# Ports & Adapters Without a Container

Injection here is a function parameter and nothing else. There is no container to register an
implementation with, and no decorator to mark one — so the seam has to be carried by the types and
by where each piece is applied.

> `Result<T, E>` and `AsyncResult<T, E>` are `ts-functional`'s; the aggregate operations a handler
> pipes are `ddd-ts-fp`'s. When a container *is* present, the same seam is declared with a token and
> a decorated class instead — that shape belongs to `nest-ddd-conventions`, not here.

## The port is a type of functions, declared in the domain

```typescript
// src/Command/Domain/SPI/ReceiptRepository.ts
export type ReceiptRepository = {
  getById: (receiptId: string) => AsyncResult<Receipt, DomainError>;
  save: (receipt: Receipt) => Promise<void>;
};
```

Each field is a **property typed as an arrow function**, not method shorthand.
Zero ports across the reference codebases declare a field with method shorthand. Method syntax is the
form a class `implements`, and it invites the container-shaped reflex of making the adapter a class;
an object literal cannot satisfy a contract it was never asked to extend.

A port with one operation needs no object around it:

```typescript
// src/Command/Domain/SPI/EventDispatcher.ts
export type EventDispatcher = (domainEvent: DomainEvent) => Promise<void>;
```

| Rule | Convention |
|---|---|
| Shape | `type` whose fields are arrow-typed properties — never an `interface` of methods |
| Location | the domain layer: `Domain/SPI/`, or `domain/ports/` |
| Naming | the role, never the technology — `ReceiptRepository`, not `MongoReceiptRepository` |
| Imports | domain types only; a port importing its driver has stopped being a port |
| Granularity | one port per collaborator, not one per feature — the handler names the ones it uses |

## The adapter is an object literal annotated with the port

```typescript
// src/Command/Infrastructure/MongoDB/Receipts/ReceiptRepository.ts
const getById = async (receiptId: string): AsyncResult<Receipt, DomainError> => {
  const document = await receiptCollection().findOne<ReceiptDocument>({ _id: receiptId });

  if (document === null) {
    return failure(receiptNotFound(receiptId));
  }

  return success(toReceipt(document));
};

const save = async (receipt: Receipt): Promise<void> => {
  await receiptCollection().replaceOne({ _id: receipt.id }, toDocument(receipt), { upsert: true });
};

const receiptRepository: ReceiptRepository = { getById, save };

export default receiptRepository;
```

The annotation is what binds the adapter to the port: drop a field or drift a signature and the
compiler refuses the object. Every adapter in the reference codebases carries this annotation, with
zero adapters left untyped. Use the annotation rather than `satisfies` — the port is exactly the
type the consumer wants, so there are no literal types worth preserving. No adapter in either
reference codebase is declared with `satisfies` in place of the port annotation.

## The handler takes its dependencies first, its data second

```typescript
// src/Command/Domain/Features/GenerateReceipt/GenerateReceiptHandler.ts
export type GenerateReceiptHandler = (command: GenerateReceiptCommand) => AsyncResult<Receipt, DomainError>;

export const generateReceiptHandler =
  (receiptRepository: ReceiptRepository, eventDispatcher: EventDispatcher): GenerateReceiptHandler =>
  async (command) => {
    const receipt = await receiptRepository.getById(command.receiptId);

    if (isFailure(receipt)) {
      return receipt;
    }

    await receiptRepository.save(receipt.value);
    await eventDispatcher(receiptGenerated(receipt.value));

    return receipt;
  };
```

The outer call takes every port and returns the named handler type; the inner call takes the
command. Every handler in the reference codebases follows this two-call shape, with zero handlers
taking their dependencies and their data in a single parameter list. Dependencies are resolved
once, at startup, and the inner function is what the rest of the
application holds — so nothing downstream ever needs to know what a `ReceiptRepository` really is.

## The composition root lives in the infrastructure

Applying a handler to its adapters is an infrastructure act.
Zero domain files in the reference codebases apply a handler to its adapters; every application
happens in a controller, a worker, or a CLI entry point. It happens at the entry point that owns
the process — a controller, a worker, a CLI — and never inside the domain, which must stay ignorant
of which adapter it runs against.

```typescript
// src/Command/Infrastructure/Http/Controllers/GenerateReceiptController.ts
import { generateReceiptHandler } from '@CommandDomain/Features/GenerateReceipt/GenerateReceiptHandler';
import receiptRepository from '@CommandInfrastructure/MongoDB/Receipts/ReceiptRepository';
import sqsEventDispatcher from '@CommandInfrastructure/SQS/EventDispatcher';

const generateReceipt = generateReceiptHandler(receiptRepository, sqsEventDispatcher);

const generateReceiptController = async (request: Request, response: Response): Promise<void> => {
  const receipt = await generateReceipt(toGenerateReceiptCommand(request));

  response.status(isFailure(receipt) ? UNPROCESSABLE_ENTITY : CREATED).send();
};
```

Declaring a port and then importing the concrete adapter everywhere is the failure mode this shape
exists to prevent: it keeps the type and loses the seam. No consumer file in the reference
codebases imports a concrete adapter while a port of the same name exists. If a consumer imports
the adapter instead of receiving the port, the port is decoration.

## The substitution that proves the port pays

The same call site takes an in-memory stub.
Every port in the reference codebases has at least one test exercising this substitution. Nothing
in the domain changes, and no mocking library is involved — the stub records what it was given and
answers what the test needs.

```typescript
// tests/Unit/Command/Domain/Features/generateReceiptHandler.spec.ts
const savedReceipts: Receipt[] = [];

const inMemoryReceiptRepository: ReceiptRepository = {
  getById: async (receiptId) => success(aReceipt({ id: receiptId })),
  save: async (receipt) => {
    savedReceipts.push(receipt);
  },
};

await generateReceiptHandler(inMemoryReceiptRepository, async () => {})(aGenerateReceiptCommand());

assert.deepStrictEqual(savedReceipts.length, 1);
```

Because the stub is an ordinary value, it doubles as the spy — asserting on `savedReceipts` reads
better than asserting on a recorded call. Zero tests in the reference codebases pair a hand-written
stub with a separate spy assertion. Which double to reach for, and what does not deserve a
test at all, is `craft:testing-principles`'s subject, not this skill's.

## A CQRS split keeps the write port and the read port disjoint

A CQRS-split aggregate carries a homonymous write port and read port whose operations never overlap.
The two ports live in their own slice — `Command/Domain/SPI/ReceiptRepository.ts` writes,
`Query/Domain/SPI/ReceiptRepository.ts` reads — and neither one grows an operation that belongs to
the other:

```typescript
// src/Command/Domain/SPI/ReceiptRepository.ts
export type ReceiptRepository = {
  getById: (receiptId: string) => AsyncResult<Receipt, DomainError>;
  save: (receipt: Receipt) => Promise<void>;
};

// src/Query/Domain/SPI/ReceiptRepository.ts
export type ReceiptRepository = {
  findByCustomer: (customerId: string) => Promise<ReceiptView[]>;
};
```

A `save` on the read side, or a `findByCustomer` on the write side, is the two slices leaking into
each other through a shared name.

## The adapter is exported as its slice's default

The adapter is a lowerCamel const annotated by its port and exported as the module's default.
`export default receiptRepository;` is not decoration on the earlier example — it is the shape
every adapter in the reference codebase takes, and the composition root imports that default,
never a named export scavenged from the module.

## Behind a port: only what is non-deterministic or I/O

Only the clock, id generation, persistence, dispatch, and feature flags sit behind a port; everything else is reached directly.
A pure computation — pricing a receipt, validating a command's shape, deriving a discount — never
gets a port of its own; wrapping it behind one adds indirection a unit test never needed and a
call site never wanted.

## Every port lives under SPI/ — stated as a decision, not smoothed over

Every domain port lives under SPI/, with no port left outside it by convention. The two reference
codebases disagree here: one keeps all of its ports under `Domain/SPI/`, the other leaves several
of them scattered next to the features that use them. This skill takes the first codebase's side
and states it as the rule — a port declared outside `SPI/` is a deviation to fix, not a second
valid layout to tolerate.

## Each port ships a hand-written double

Each port keeps a hand-written double: InMemory for one that holds state, Stub for one that returns a deterministic sequence.
`InMemoryReceiptRepository` accumulates what it is given and answers from what it holds;
`StubClock` answers the same instant every time it is called. Neither double is generated by a
mocking library — both are ordinary values a test constructs by hand.

## A port must be consumed by the domain

A port that only circulates between two infrastructure files has no reason to live in SPI. If
nothing in `Domain/Features/` takes the port as a parameter, there is no seam to preserve — the
type is infrastructure talking to infrastructure, and belongs next to the adapters that use it,
not under `SPI/`.

## Quick Reference

| Element | Convention |
|---|---|
| Port | `type` of arrow-typed properties, in the domain |
| Port with one operation | a bare call signature, no wrapping object |
| Adapter | `const x: Port = { … }`, in the infrastructure |
| Binding | the type annotation — never a token, a decorator or a registration |
| Handler | `(…ports) => (data)`, dependencies first |
| Composition | the infrastructure entry point, never the domain |
| Test double | an in-memory object of the same port, doubling as the spy |
| CQRS ports | homonymous write/read ports, disjoint operations |
| Adapter export | default export of a lowerCamel const |
| Port candidate | non-deterministic or I/O only — never a pure computation |
| Port location | `SPI/`, without exception |
| Hand-written double | InMemory if stateful, Stub if a deterministic sequence |
| Port consumer | the domain — never infrastructure alone |
