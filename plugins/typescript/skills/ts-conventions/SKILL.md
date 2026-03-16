---
name: ts-conventions
description: "ACTIVATE when writing TypeScript types, generics, branded types, discriminated unions, or configuring tsconfig. ACTIVATE for 'type vs interface', 'enum alternative', 'branded type', 'satisfies', 'strict mode'. Covers: strict mode policy, no-any/no-enum rules, type over interface, discriminated unions, satisfies operator, branded types for ID safety, utility types. DO NOT use for: code formatting (see ts-code-conventions), functional patterns (see ts-functional)."
version: "1.1"
---

# TypeScript Conventions

## Strict Mode

**`strict: true` is mandatory** in `tsconfig.json`. No exceptions.

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## No `any` — Use `unknown` + Narrowing

```typescript
// ❌ AVOID - any bypasses all type checking
function parse(input: any): string {
  return input.name; // No error, but crashes if input has no name
}

// ✅ CORRECT - unknown forces explicit narrowing
function parse(input: unknown): string {
  if (typeof input === 'object' && input !== null && 'name' in input) {
    return String(input.name);
  }

  throw new Error('Invalid input');
}
```

## No Inline `typeof import(...)` — Use `import type`

```typescript
// ❌ AVOID - Inline typeof import is unreadable and bypasses proper imports
const service = new MyService(
  mock as unknown as InstanceType<
    typeof import('../path/to/repository').Repository
  >,
);

// ✅ CORRECT - Import the type at the top of the file
import type { Repository } from '../path/to/repository';

const service = new MyService(
  mock as unknown as Repository,
);
```

## No `enum` — Use `as const`

```typescript
// ❌ AVOID - TypeScript enums have quirks (reverse mapping, runtime code)
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

// ✅ CORRECT - as const + type union
const STATUS = {
  Active: 'active',
  Inactive: 'inactive',
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS]; // 'active' | 'inactive'
```

## `type` vs `interface`

**Use `type` by default.** Use `interface` only when declaration merging or `extends` is needed (e.g., for NestJS class-based DI).

```typescript
// ✅ type — for most cases
type Receipt = {
  id: string;
  amount: number;
  period: Period;
};

// ✅ interface — when merging or extending is needed
interface ReceiptRepository {
  findById(id: string): Promise<Receipt | null>;
  save(receipt: Receipt): Promise<void>;
}
```

## Discriminated Unions

**Model exclusive states explicitly** — no impossible combinations:

```typescript
// ❌ AVOID - Both fields optional = 4 possible states, only 2 are valid
type Result = {
  data?: Receipt;
  error?: string;
};

// ✅ CORRECT - Discriminated union = only valid states
type Result =
  | { success: true; data: Receipt }
  | { success: false; error: string };

function handle(result: Result) {
  if (result.success) {
    console.log(result.data); // TypeScript knows data exists
  } else {
    console.error(result.error); // TypeScript knows error exists
  }
}
```

## `satisfies` Operator

**Use `satisfies` to validate a value matches a type without widening it:**

```typescript
type RouteConfig = Record<string, { path: string; auth: boolean }>;

// ❌ Type annotation widens — loses literal types
const routes: RouteConfig = {
  home: { path: '/', auth: false },
  dashboard: { path: '/dashboard', auth: true },
};
routes.home.path; // type: string (widened)

// ✅ satisfies — validates AND preserves literal types
const routes = {
  home: { path: '/', auth: false },
  dashboard: { path: '/dashboard', auth: true },
} satisfies RouteConfig;
routes.home.path; // type: '/' (preserved)
```

## Branded Types

**Prevent accidental swaps** of primitive types that represent different concepts:

```typescript
type TenantId = string & { readonly __brand: 'TenantId' };
type LandlordId = string & { readonly __brand: 'LandlordId' };

// Factory functions
function toTenantId(id: string): TenantId {
  return id as TenantId;
}

function toLandlordId(id: string): LandlordId {
  return id as LandlordId;
}

// ❌ Compile error — cannot mix branded types
function getReceipts(landlordId: LandlordId): Receipt[] { ... }
const tenantId = toTenantId('abc');
getReceipts(tenantId); // Type error!
```

> **See also**: `ts-oop` rule #5 for branded types in value objects.

## Utility Types

```typescript
// Pick specific properties
type TenantSummary = Pick<Tenant, 'id' | 'email' | 'firstName'>;

// Omit properties
type CreateTenant = Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>;

// Make all properties optional
type PartialTenant = Partial<Tenant>;

// Make all properties required
type RequiredTenant = Required<Tenant>;

// Read-only
type FrozenTenant = Readonly<Tenant>;

// Record
type TenantMap = Record<TenantId, Tenant>;
```

## Generics

```typescript
// ✅ CORRECT - Constrained generics
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

// ✅ CORRECT - Generic with default
type ApiResponse<T = unknown> = {
  data: T;
  meta: { timestamp: string };
};
```

## Nullability Patterns

```typescript
// ✅ Explicit return types for nullable
function findTenant(id: string): Tenant | null { ... }

// ✅ Non-null assertion only when truly guaranteed
const element = document.getElementById('root')!; // Only in entry points

// ❌ AVOID - Non-null assertion to silence compiler
const tenant = findTenant(id)!; // Use narrowing instead

// ✅ CORRECT - Narrowing
const tenant = findTenant(id);

if (tenant === null) {
  throw new NotFoundException('Tenant not found');
}

// tenant is now Tenant (narrowed)
```

## Quick Reference

| Rule | Convention |
|------|-----------|
| Strict mode | `strict: true`, always |
| No `any` | Use `unknown` + narrowing |
| No `typeof import(...)` | Use `import type` at top of file |
| No `enum` | Use `as const` + type union |
| type vs interface | `type` by default, `interface` for merging/extends |
| Exclusive states | Discriminated unions |
| Value validation | `satisfies` to preserve literal types |
| ID safety | Branded types (`string & { __brand }`) |
| Subsets | `Pick`, `Omit`, `Partial`, `Required` |
| Nullability | Explicit `| null`, narrowing over `!` |
