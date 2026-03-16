---
name: drizzle-conventions
description: "ACTIVATE when defining database schemas, writing queries, creating migrations, or implementing repositories with Drizzle ORM. ACTIVATE for 'Drizzle', 'pgTable', 'drizzle-kit', 'db.query', 'db.select', '$inferSelect', 'migration'. Covers: schema definition with pgTable, relations, type inference ($inferSelect/$inferInsert), Query API vs Select API vs raw SQL decision tree, repository pattern with toDomain/toPersistence, migration workflow (always drizzle-kit generate first, never manual journal). DO NOT use for: Doctrine/PHP queries (see php-sql-conventions), general SQL formatting."
version: "1.1"
---

# Drizzle Conventions

## Schema Definition

Define tables with `pgTable()` and typed columns:

```typescript
// src/infrastructure/persistence/schema/tenant.schema.ts
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

## Relations (Declared Separately)

```typescript
// src/infrastructure/persistence/schema/relations.ts
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema';
import { leases } from './lease.schema';

export const tenantsRelations = relations(tenants, ({ many }) => ({
  leases: many(leases),
}));

export const leasesRelations = relations(leases, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leases.tenantId],
    references: [tenants.id],
  }),
}));
```

## Type Inference

Use `$inferSelect` and `$inferInsert` for type safety:

```typescript
import { tenants } from './schema/tenant.schema';

// Inferred types from schema
type Tenant = typeof tenants.$inferSelect;       // SELECT result type
type NewTenant = typeof tenants.$inferInsert;     // INSERT input type
```

## Query API vs Select API vs Raw SQL

Drizzle offers three abstraction levels. **Prefer the highest level possible** to maximize type safety and refactoring protection.

### Query API (preferred) — `db.query.*`

Type-safe with automatic relations. The return is fully typed, including nested objects:

```typescript
// ✅ PREFERRED - Type-safe, auto-joined relations, refactoring-safe
const tenantWithLeases = await db.query.tenants.findFirst({
  where: eq(tenants.id, tenantId),
  with: {
    leases: true, // JOIN generated automatically, returns Tenant & { leases: Lease[] }
  },
});
```

### Select API — `db.select().from()`

For queries without relations or complex cases (aggregations, subqueries):

```typescript
// ✅ CORRECT - Type-safe, but no declarative relations
const activeTenants = await db
  .select()
  .from(tenants)
  .where(eq(tenants.isActive, true));

// Aggregations
const counts = await db
  .select({ count: sql<number>`count(*)` })
  .from(tenants)
  .groupBy(tenants.isActive);
```

### Raw SQL — `sql` template tag (last resort)

No return typing, no refactoring protection. **Only for cases Drizzle does not cover** (CTEs, window functions, very specific queries):

```typescript
import { sql } from 'drizzle-orm';

// ✅ CORRECT - Parameterized via template tag
const result = await db.execute(
  sql`SELECT * FROM tenants WHERE email = ${email}`
);

// ❌ AVOID - String interpolation (SQL injection risk)
const result = await db.execute(
  `SELECT * FROM tenants WHERE email = '${email}'`
);
```

### Decision Tree

```
Need nested relations?
├─ YES → Query API (db.query.*.findFirst/findMany)
│
└─ NO → Simple query or aggregation?
         ├─ YES → Select API (db.select().from())
         └─ NO → CTE / window / exotic SQL?
                  └─ Raw SQL (sql`...`) as last resort
```

## Insert / Update / Delete

```typescript
// Insert
const [newTenant] = await db
  .insert(tenants)
  .values({ email, firstName, lastName })
  .returning();

// Update
await db
  .update(tenants)
  .set({ isActive: false, updatedAt: new Date() })
  .where(eq(tenants.id, tenantId));

// Delete
await db
  .delete(tenants)
  .where(eq(tenants.id, tenantId));
```

## Repository Pattern

```typescript
// domain/port/tenant-repository.ts (interface)
export interface TenantRepository {
  findById(id: TenantId): Promise<Tenant | null>;
  findByEmail(email: string): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<Tenant>;
}

export const TENANT_REPOSITORY = Symbol('TenantRepository');
```

```typescript
// infrastructure/persistence/drizzle-tenant-repository.ts
@Injectable()
export class DrizzleTenantRepository implements TenantRepository {
  constructor(@Inject('DRIZZLE') private readonly db: DrizzleDatabase) {}

  async findById(id: TenantId): Promise<Tenant | null> {
    const result = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, id),
    });

    return result ? this.toDomain(result) : null;
  }

  async save(tenant: Tenant): Promise<Tenant> {
    const [row] = await this.db
      .insert(tenants)
      .values(this.toPersistence(tenant))
      .onConflictDoUpdate({
        target: tenants.id,
        set: this.toPersistence(tenant),
      })
      .returning();

    return this.toDomain(row);
  }

  private toDomain(row: typeof tenants.$inferSelect): Tenant { ... }
  private toPersistence(tenant: Tenant): typeof tenants.$inferInsert { ... }
}
```

> **See also**: `nest-ddd-conventions` for the ports & adapters pattern.

## Migrations

**IMPORTANT: Always start with `drizzle-kit generate`** to produce the 3 artifacts (SQL, journal entry, snapshot). Never manually write the journal (`_journal.json`) or snapshots — this causes desynchronizations: inconsistent timestamps, missing snapshots, silently ignored migrations. However, **the generated SQL can be modified** after generation (adding indexes, syntax cleanup, etc.).

```bash
# 1. Modify the schema (.schema.ts)
# 2. Generate the migration (produces SQL + snapshot + journal entry)
pnpm drizzle-kit generate
# 3. (Optional) Improve the generated SQL (indexes, constraints, etc.)
# 4. Apply migrations
pnpm drizzle-kit migrate

# Open Drizzle Studio (DB browser)
pnpm drizzle-kit studio
```

## Quick Reference

| Rule | Convention |
|------|-----------|
| Schema | `pgTable()` with typed columns |
| Relations | Declared separately from tables |
| Type inference | `$inferSelect` / `$inferInsert` |
| Queries with relations | Query API (`db.query.*`) — preferred |
| Simple queries / aggregations | Select API (`db.select().from()`) |
| Raw SQL | `sql` template tag — last resort |
| Repository | Domain interface + Drizzle implementation |
| Mapping | `toDomain()` / `toPersistence()` in repository |
| Migrations | `drizzle-kit generate` + `drizzle-kit migrate` — **never manual journal/snapshots**, SQL editable |
