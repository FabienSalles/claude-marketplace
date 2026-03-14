---
name: nest-ddd-conventions
description: This skill should be used when writing domain code in NestJS. Enforces Domain-Driven Design principles by forbidding infrastructure dependencies in the domain layer.
version: "1.0"
---

# DDD Conventions (NestJS)

> **See also**: `php-ddd-conventions` for the same principles in PHP/Symfony context.

## Domain Layer Purity

The domain layer MUST NOT depend on infrastructure concerns.

### Forbidden in Domain Layer

- **NestJS decorators**: `@Injectable()`, `@Controller()`, `@Module()`, `@Inject()`
- **HTTP-related**: `Request`, `Response`, `@Body()`, `@Param()`, `@Query()`
- **ORM/Database**: Drizzle schemas (`pgTable`), Drizzle query builders, `PrismaClient`
- **Framework services**: `ConfigService`, `HttpService`, `Logger` (NestJS)
- **External libraries**: anything tied to infrastructure

### Allowed in Domain Layer

- Pure TypeScript types (`string`, `number`, `Date`, `Record`, etc.)
- Domain value objects (classes with no framework dependencies)
- Domain interfaces (defined in domain, implemented in infrastructure)
- DTOs from `packages/shared` (Zod schemas + inferred types)
- Enums and `as const` objects
- Branded types

### Architecture

```
src/
├── domain/                    # PURE — no framework imports
│   ├── model/                 # Entities, value objects, aggregates
│   ├── port/                  # Interfaces (repository contracts)
│   ├── service/               # Domain services (pure logic)
│   └── error/                 # Domain exceptions
│
├── application/               # Use cases — orchestration
│   └── use-case/              # May use @Injectable() for DI
│
└── infrastructure/            # Framework & external — implements ports
    ├── persistence/           # Drizzle repositories (implements port/)
    ├── http/                  # Controllers, guards, pipes
    └── config/                # NestJS module, providers
```

### Bounded Contexts = NestJS Modules

Each bounded context maps to a NestJS module:

```typescript
// ✅ CORRECT - One module per bounded context
@Module({
  controllers: [ReceiptController],
  providers: [
    GenerateReceiptUseCase,
    { provide: RECEIPT_REPOSITORY, useClass: DrizzleReceiptRepository },
  ],
})
export class ReceiptModule {}
```

### Dependency Rule

```
Controllers → Use Cases → Domain Services → Domain Ports
                                                ↑
Infrastructure Adapters ────────────────────────┘
  (implement domain ports)
```

**Domain NEVER imports from infrastructure. Infrastructure imports from domain.**

### Example: Domain Port + Infrastructure Adapter

```typescript
// ✅ domain/port/receipt-repository.ts — pure interface
export interface ReceiptRepository {
  findByTenantId(tenantId: TenantId): Promise<Receipt[]>;
  save(receipt: Receipt): Promise<void>;
}

export const RECEIPT_REPOSITORY = Symbol('ReceiptRepository');
```

```typescript
// ✅ infrastructure/persistence/drizzle-receipt-repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { ReceiptRepository } from '../../domain/port/receipt-repository';

@Injectable()
export class DrizzleReceiptRepository implements ReceiptRepository {
  constructor(@Inject('DRIZZLE') private readonly db: DrizzleDatabase) {}

  async findByTenantId(tenantId: TenantId): Promise<Receipt[]> {
    // Drizzle query here — infrastructure concern
  }

  async save(receipt: Receipt): Promise<void> {
    // Drizzle insert here
  }
}
```

## Quick Reference

| Layer | Can import from | Cannot import from |
|-------|----------------|-------------------|
| Domain | Pure TS, shared DTOs | NestJS, Drizzle, HTTP, any framework |
| Application | Domain, NestJS DI | Infrastructure directly |
| Infrastructure | Domain, NestJS, Drizzle | — |

| Rule | Principle |
|------|-----------|
| Domain purity | No decorators, no ORM, no HTTP in domain |
| Ports & adapters | Interfaces in domain, implementations in infrastructure |
| Bounded context | 1 NestJS module = 1 bounded context |
| Dependency direction | Always inward: infra → application → domain |
