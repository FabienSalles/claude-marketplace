---
name: ts-ddd-events
description: "ACTIVATE when implementing domain events, event store, outbox pattern, or reliable event publishing in TypeScript. ACTIVATE for 'domain event', 'outbox', 'event store', 'event-driven', 'reliable publishing'. Covers: domain event structure and naming, event store (append-only), outbox pattern for reliable publishing (no dual-write), consumer pattern. DO NOT use for: aggregate modeling (see ddd-ts-fp), general async patterns, message queue configuration."
version: "1.1"
---

# Domain Events & Event Publishing

## Domain Event

**A business fact that occurred** in the past. Named in past tense, immutable:

```typescript
type ReceiptGenerated = {
  readonly receiptId: string;
  readonly tenantId: string;
  readonly landlordId: string;
  readonly period: { year: number; month: number };
  readonly amount: number;
  readonly generatedAt: Date;
};
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Type | `PascalCase` past tense | `ReceiptGenerated`, `LeaseTerminated` |
| File | `kebab-case.event.ts` | `receipt-generated.event.ts` |
| Directory | `domain/events/` | Co-located with the aggregate |

### Event Anatomy

```typescript
type DomainEvent<T> = {
  readonly id: string;           // UUID unique
  readonly type: string;         // 'receipt.generated'
  readonly payload: T;
  readonly createdAt: Date;
};
```

## Event Store

**Persist events** as source of truth. Append-only, never delete.

## Outbox Pattern

**Guarantees reliable event publishing.** The event is persisted in an `outbox` table atomically with the state change, then published asynchronously:

```
Command -> Domain Logic -> Transaction {
  1. Persist aggregate state
  2. Insert event in outbox table  <- atomic
}

Worker -> Poll outbox -> Publish event -> Mark as processed
```

Status flow: `created` -> `in_progress` -> `processed` / `failed`

> **When implementing event store persistence, outbox tables, or outbox publishers**, read `references/event-implementation-patterns.md` for complete Drizzle schemas and publisher implementations.

> **When emitting events from handlers or writing consumers**, read `references/event-implementation-patterns.md` for atomic transaction patterns and consumer examples.

## When to Use What

| Pattern | Use case |
|---------|----------|
| Domain Event | Business fact to communicate between bounded contexts |
| Event Store | Audit trail, replay, event sourcing |
| Outbox | Reliable publishing without dual-write |
| Consumer | Asynchronous reaction to an event |

## Event, Outbox & CQRS Conventions

1. Two vocabularies of event must never be confused: the transport envelope Event<T> (id/type/timestamp/version/metadata/data) and the domain event DomainEvent<U> (id/type/payload/createdAt). No file imports both.
   Measure: zero files import both a type named `Event` and a type named `DomainEvent`.
2. The event is created in the handler, never in the aggregate: without a class, the aggregate cannot carry an event buffer.
   Measure: zero methods on a domain/ aggregate file are named `emit*` or `raise*`.
3. Dispatch is a domain port typed as a bare function type, whose adapter is a Record<type, listener> table built by a make*Mapper factory.
   Cost: one `make*Mapper` factory per bounded context, never one per event type.
4. Emit either by returning the event in Result's success, or by calling the injected dispatcher: both are used, with no rule between them.
   Measure: a handler uses exactly one of the two mechanisms; none returns the event in success and also calls the dispatcher.
5. This outbox is INBOUND: it stages messages received from SQS for local consumption. It publishes nothing, so it is not the reliable publishing pattern.
   Cost: naming it `outbox` without this note costs a reader the reliable-publishing assumption; the note is the one-line fix.
6. The read model is not fed by events: both sides share one database and collection, so a write is immediately visible on read.
   Measure: zero event listeners write to the read collection; only the write side's own handlers do.
7. Only one codebase forbids Command importing Query by lint. Neither violates the rule, but the read side freely reaches into the write side.
   Measure: exactly one of the two codebases declares a Command-cannot-import-Query ESLint zone; the other declares none.
8. Domain purity holds even where CQRS does not: a single exception, a concrete logger, in the gap the zones do not cover.
   Measure: exactly one concrete infrastructure import, the logger, crosses the domain boundary.

## Quick Reference

| Rule | Convention |
|------|-----------|
| Naming | Past tense (`ReceiptGenerated`) |
| Structure | `{ id, type, payload, createdAt }` |
| Event Store | Append-only, `domain_events` table |
| Outbox | Atomic with state change |
| Status | `created` -> `in_progress` -> `processed` / `failed` |
| Retries | `numberOfRetries` + `maxNumberOfRetries` |
| Consumer | Idempotent, null-safe |
