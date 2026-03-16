# Event Implementation Patterns

## Table of Contents
- [Event Store Implementation](#event-store-implementation)
- [Outbox Pattern Implementation](#outbox-pattern-implementation)
- [Outbox Publisher](#outbox-publisher)
- [Handler with Event Emission](#handler-with-event-emission)
- [Consumer Pattern](#consumer-pattern)
- [Outbox vs Direct Publishing](#outbox-vs-direct-publishing)

## Event Store Implementation

### Port Definition

```typescript
// domain/ports/event-store.port.ts
type EventStore = {
  append: <T>(event: DomainEvent<T>) => Promise<void>;
  getByAggregateId: (aggregateId: string) => Promise<DomainEvent<unknown>[]>;
};
```

### Drizzle Implementation

```typescript
// infrastructure/persistence/drizzle-event-store.ts
const events = pgTable('domain_events', {
  id: uuid('id').primaryKey(),
  type: varchar('type', { length: 255 }).notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  version: varchar('version', { length: 10 }).notNull(),
  metadata: jsonb('metadata'),
  data: jsonb('data').notNull(),
});

const append = async <T>(event: DomainEvent<T>): Promise<void> => {
  await db.insert(events).values({
    id: event.id,
    type: event.type,
    aggregateId: event.data.aggregateId,
    timestamp: event.timestamp,
    version: event.version,
    metadata: event.metadata ?? {},
    data: event.data,
  });
};
```

## Outbox Pattern Implementation

### Outbox Schema

```typescript
const OUTBOX_STATUS = {
  Created: 'created',
  InProgress: 'in_progress',
  Processed: 'processed',
  Failed: 'failed',
} as const;

type OutboxStatus = (typeof OUTBOX_STATUS)[keyof typeof OUTBOX_STATUS];

type OutboxEntry<T> = {
  readonly id: string;
  readonly eventType: string;
  readonly timestamp: Date;
  readonly recipient: string;         // 'email-service', 'notification-service'
  readonly status: OutboxStatus;
  readonly numberOfRetries: number;
  readonly maxNumberOfRetries: number;
  readonly data: T;
};
```

### Outbox Table (Drizzle)

```typescript
const outbox = pgTable('outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: varchar('event_type', { length: 255 }).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('created'),
  numberOfRetries: integer('number_of_retries').notNull().default(0),
  maxNumberOfRetries: integer('max_number_of_retries').notNull().default(3),
  data: jsonb('data').notNull(),
});
```

## Outbox Publisher

```typescript
// infrastructure/outbox/outbox-publisher.ts
const processOutbox = async (
  outboxRepository: OutboxRepository,
  eventPublisher: EventPublisher,
): Promise<void> => {
  const pending = await outboxRepository.findByStatus('created');

  for (const entry of pending) {
    await outboxRepository.updateStatus(entry.id, 'in_progress');

    try {
      await eventPublisher.publish(entry.eventType, entry.data);
      await outboxRepository.updateStatus(entry.id, 'processed');
    } catch {
      const retries = entry.numberOfRetries + 1;

      await outboxRepository.update(entry.id, {
        status: retries >= entry.maxNumberOfRetries ? 'failed' : 'created',
        numberOfRetries: retries,
      });
    }
  }
};
```

## Handler with Event Emission

```typescript
const generateReceiptHandler =
  (
    receiptRepository: ReceiptRepository,
    outboxRepository: OutboxRepository,
  ) =>
  async (command: GenerateReceiptCommand): AsyncResult<Receipt, DomainError> => {
    const receipt = createReceipt(command);

    if (!receipt.ok) {
      return receipt;
    }

    // Atomic transaction: persist + outbox
    await receiptRepository.save(receipt.value);
    await outboxRepository.insert({
      eventType: 'receipt.generated',
      recipient: 'notification-service',
      data: {
        receiptId: receipt.value.id,
        tenantId: receipt.value.tenantId,
        period: receipt.value.period,
        amount: receipt.value.amount,
        generatedAt: receipt.value.generatedAt,
      },
    });

    return receipt;
  };
```

## Consumer Pattern

```typescript
// infrastructure/workers/receipt-notification.consumer.ts
const receiptNotificationConsumer =
  (
    notificationService: NotificationService,
    incomingEventHandler: IncomingEventHandler,
  ) =>
  async (rawEvent: string | undefined): Promise<void> => {
    if (rawEvent === undefined) return;

    await incomingEventHandler(rawEvent);

    const event: ReceiptGenerated = JSON.parse(rawEvent);
    await notificationService.sendReceiptNotification(event);
  };
```

## Outbox vs Direct Publishing

```typescript
// AVOID -- Dual write: if publish fails, inconsistent state
await receiptRepository.save(receipt);
await eventBus.publish(receiptGeneratedEvent);  // Can fail!

// CORRECT -- Outbox: atomic, then async publish
await transaction(async (tx) => {
  await receiptRepository.save(receipt, tx);
  await outboxRepository.insert(outboxEntry, tx);
});
// The worker then publishes idempotently
```
