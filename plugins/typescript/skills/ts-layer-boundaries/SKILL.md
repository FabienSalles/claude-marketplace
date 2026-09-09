---
name: ts-layer-boundaries
description: "ACTIVATE when wiring a Worker entry point, a Router, a controller, or a domain event consumer in a TypeScript CQRS codebase, or when deciding where a port belongs. ACTIVATE for 'composition root', 'layer boundary', 'ESLint zones', 'domain must not import infrastructure'. Covers: the *Worker.ts composition root, the curried consumer, Router wiring of command endpoints, the five-gesture controller, the domain-to-infrastructure import boundary enforced by ESLint, infrastructure-only ports, in-memory doubles for every port, the read-can-reach-write asymmetry, and read endpoints going through a domain handler. DO NOT use for: the port's own shape and adapter binding (see ts-ports-adapters), the Result type (see ts-functional), domain event structure (see ts-ddd-events)."
version: "1.0"
---

# Layer Boundaries — Domain, Application, Infrastructure

Twelve conventions the reference codebases agree on (or, once, disagree on and state as a decision)
for where a side effect, an import, or a call is allowed to sit. Each one is a boundary the compiler
or the linter can hold — the point of writing it here is that none of them is left to code review.

> The port's shape and its adapter binding are `ts-ports-adapters`'s subject. This skill is about
> which layer gets to import which, and which file gets to wire what.

## *Worker.ts is the sole async composition root

The async composition root is *Worker.ts, the only file in the worker tree allowed a module-level side effect.
Every other file in the tree — handlers, consumers, formatters — stays a pure declaration until
something calls it. `ReceiptWorker.ts` connects to the broker, builds the adapters, and starts the
consumer; nothing beside it opens a socket, a connection pool, or a subscription at import time.
Zero files besides *Worker.ts under the worker tree execute code at module scope.

## The consumer is a curried factory, never an adapter importer

The consumer is a curried factory receiving handlers, formatters, and ports; it never imports a concrete adapter.
```typescript
export const receiptCreatedConsumer =
  (handler: ReceiptCreatedHandler) =>
  (formatter: ReceiptFormatter) =>
  (ports: { repository: ReceiptRepository }) =>
  async (message: DomainEvent): Promise<void> => {
    // ...
  };
```
Every dependency arrives as a parameter. A consumer that reaches for `import receiptRepository from
'../Infrastructure/...'` has stopped being testable without the real adapter behind it.
no consumer file contains an import statement targeting a path under Infrastructure/.

## The Router wires command endpoints

The Router wires command endpoints: it imports the adapters, applies the handler once at load time, and passes the curried controller when registering the route.
```typescript
const handler = createReceiptHandler(receiptRepository)(eventDispatcher);
router.post('/receipts', createReceiptController(handler));
```
The handler is applied exactly once, at module load, so every request replays the same closure.
Nothing downstream of the Router imports an adapter again.
each handler is applied exactly once per route registration, at module load, never re-created inside a request callback.

## A controller performs five gestures

A controller performs five gestures: read the request, build the Command or Query, await the handler, branch on the Result, set the status or envelope.
A sixth gesture — a repository call, a persistence type, a second branch on something other than the
Result — belongs to the handler or the mapper, not the controller.
a controller body executes exactly five gestures, no sixth statement performing a repository call or a second branch.

## The domain never imports infrastructure, declared in ESLint zones

The domain never imports infrastructure, and the boundary is declared in ESLint zones rather than left to code review.
```json
{
  "rules": {
    "boundaries/element-types": [
      "error",
      { "default": "disallow", "rules": [{ "from": "domain", "disallow": ["infrastructure"] }] }
    ]
  }
}
```
A reviewer catching a stray `import ... from '../Infrastructure/...'` in a domain file is the rule
failing, not the rule working — the zone declaration is what makes the import a build failure
instead of a comment on a pull request.
zero domain files import a path under infrastructure/; the ESLint zone rule fails the build on the first one that does.

## An infrastructure-only collaborator gets an infrastructure port

A collaborator used only by infrastructure has its port declared in infrastructure, beside its adapter, never in Domain/SPI.
A retry policy, a connection pool wrapper, or a metrics client that no domain handler ever takes as
a parameter is infrastructure talking to infrastructure — giving it a `Domain/SPI` type borrows the
domain's authority for a seam the domain never crosses.
no port used by zero domain handlers is declared under Domain/SPI; it is declared beside its own adapter in infrastructure instead.

## Every port ships an in-memory double

Every declared port keeps a hand-written in-memory double, so the test becomes its own composition root.
A test that wires `InMemoryReceiptRepository` and `StubClock` by hand, instead of reaching for a
mocking library, is composing the same way the Worker does — the test *is* the composition root for
the scenario it covers.
zero ports in the reference codebases are doubled with a mocking library call; every double is a hand-written InMemory or Stub object.

## The read side may reach the write side, never the reverse

The read side may reach the write side, never the reverse; codebase B forbids both directions and pays it back in duplication.
Codebase A lets a Query handler call into a Command-side repository when the read model has no view
of its own yet; codebase B refuses that crossing outright and re-declares the same shape on both
sides instead. Neither is free — A risks a read path that quietly depends on write-side locking, B
pays in duplicated types. This skill takes A's side and states the asymmetry as the rule: a Command
handler reaching into `Query/` is the one direction that never happens.
zero Command-side files import a path under Query/; a Query-side file importing Command/ is the only direction this rule allows.

## A read endpoint goes through a domain handler

A read endpoint goes through a domain handler: no direct repository call from the controller, no persistence type on the wire.
A controller that calls `receiptRepository.findByCustomer(...)` directly, or returns a Mongo
document instead of a view the handler shaped, has skipped the handler that every write endpoint
already goes through.
zero read controllers call a repository method directly; every read response is shaped by the handler before it reaches the controller.

## Orchestration coordinates handlers, it decides nothing on its own

A Workflow, Listener, or Consumer orchestrates calls to handlers; it never contains a business branch of its own.
A Consumer that reads `if (message.amount > threshold)` and only then calls the handler has moved a
business decision out of the domain and into wiring code, where no test for that decision lives.
zero orchestration files contain an if statement branching on a domain value; every branch on business state lives inside a handler.

## A third-party SDK is reached from infrastructure alone

Only Infrastructure imports a third-party SDK; Domain and Application import nothing beyond their own ports.
The AWS SDK, a payment provider's client, an ORM — each is wrapped by an adapter behind a port, and
nothing above infrastructure imports the package that ships it.
zero files outside infrastructure/ contain an import from a package other than the project's own ports and models.

## A DTO shaped for the wire lives in Infrastructure/Http

A DTO shaped for the wire lives in Infrastructure/Http, never re-exported from Domain.
The controller's request and response shapes belong to the transport, not to the domain; a domain
file that exports one has let an HTTP concern leak into a layer that has no reason to know about it.
zero Domain files export a type whose name ends in Dto or Response; that shape is declared once, in Infrastructure/Http.

## Quick Reference

| Element | Convention |
|---|---|
| Composition root | `*Worker.ts`, the only file with a module-level side effect |
| Consumer | curried factory: handlers, formatters, ports — never a concrete adapter import |
| Router | imports adapters, applies the handler once, registers the curried controller |
| Controller | five gestures: read, build, await, branch, respond |
| Domain → infrastructure | disallowed, enforced by ESLint zones, not review |
| Infrastructure-only port | declared in infrastructure, beside its adapter |
| Port double | a hand-written in-memory object, every time |
| Read ↔ write | read may call write; write never calls read |
| Read endpoint | goes through a domain handler, never the repository directly |
| Orchestration | coordinates handlers only, no business branch of its own |
| Third-party SDK | reached from infrastructure alone, wrapped behind a port |
| Wire DTO | declared once, in Infrastructure/Http, never re-exported from Domain |
