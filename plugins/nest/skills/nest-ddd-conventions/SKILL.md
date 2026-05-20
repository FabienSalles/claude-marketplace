---
name: nest-ddd-conventions
description: "ACTIVATE when writing domain layer code in a NestJS project, defining ports/adapters, or structuring bounded contexts as NestJS modules. ACTIVATE for 'domain layer', 'DDD NestJS', 'port', 'adapter', 'bounded context', 'domain purity' in TypeScript/NestJS. Provides NestJS-specific examples for cross-language OOP DDD principles defined in craft:ddd-principles. DO NOT use for: NestJS module/controller setup (see nest-conventions), functional TypeScript DDD (see ddd-ts-fp)."
version: "2.0"
---

# DDD Conventions — NestJS

> The **cross-language OOP DDD principles** (domain purity, ports & adapters, dependency direction, bounded contexts, aggregates) are defined in `craft:ddd-principles`. This skill keeps NestJS-specific patterns.

## NestJS-specific: Forbidden in Domain Layer

- **NestJS decorators**: `@Injectable()`, `@Controller()`, `@Module()`, `@Inject()`
- **HTTP-related**: `Request`, `Response`, `@Body()`, `@Param()`, `@Query()`
- **ORM / database**: Drizzle schemas (`pgTable`), Drizzle query builders, `PrismaClient`
- **Framework services**: `ConfigService`, `HttpService`, NestJS `Logger`

## NestJS-specific: Allowed in Domain Layer

- Pure TypeScript types (`string`, `number`, `Date`, `Record`, etc.)
- Domain value objects (classes with no framework dependencies)
- Domain interfaces (defined in `domain/`, implemented in `infrastructure/`)
- DTOs from `packages/shared` (Zod schemas + inferred types)
- Enums, `as const` objects, branded types

## NestJS-specific: Directory Structure

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

## NestJS-specific: Bounded Context = NestJS Module

Each bounded context maps to a NestJS module:

```typescript
// ✅ One module per bounded context
@Module({
  controllers: [ReceiptController],
  providers: [
    GenerateReceiptUseCase,
    { provide: RECEIPT_REPOSITORY, useClass: DrizzleReceiptRepository },
  ],
})
export class ReceiptModule {}
```

## NestJS-specific: Port + Adapter (Symbol Token DI)

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
    // Drizzle query — infrastructure concern
  }

  async save(receipt: Receipt): Promise<void> {
    // Drizzle insert
  }
}
```

## Quick Reference (NestJS-specific)

| Layer | Can import from | Cannot import from |
|-------|----------------|--------------------|
| Domain | Pure TS, shared DTOs | NestJS, Drizzle, HTTP, any framework |
| Application | Domain, NestJS DI | Infrastructure directly |
| Infrastructure | Domain, NestJS, Drizzle | — |

| NestJS pattern | Convention |
|----------------|------------|
| Bounded context | 1 NestJS module per context |
| Port DI token | `Symbol('PortName')` exported alongside interface |
| Adapter | `@Injectable()` class implementing the port |
| Use case | `@Injectable()` orchestrator in `application/use-case/` |
