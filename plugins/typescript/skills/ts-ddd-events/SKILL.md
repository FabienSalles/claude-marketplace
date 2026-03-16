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
  readonly timestamp: Date;
  readonly version: string;      // '1.0' -- for versioning
  readonly metadata?: Record<string, string>;
  readonly data: T;              // Payload type
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

## Quick Reference

| Rule | Convention |
|------|-----------|
| Naming | Past tense (`ReceiptGenerated`) |
| Structure | `{ id, type, timestamp, version, data }` |
| Event Store | Append-only, `domain_events` table |
| Outbox | Atomic with state change |
| Status | `created` -> `in_progress` -> `processed` / `failed` |
| Retries | `numberOfRetries` + `maxNumberOfRetries` |
| Consumer | Idempotent, null-safe |
