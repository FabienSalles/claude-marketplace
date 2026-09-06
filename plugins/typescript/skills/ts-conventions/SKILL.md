---
name: ts-conventions
description: "ACTIVATE when writing TypeScript types, generics, branded types, discriminated unions, or configuring tsconfig. ACTIVATE for 'type vs interface', 'enum alternative', 'branded type', 'satisfies', 'strict mode'. Covers: strict mode policy, no-any/no-enum rules, type over interface, discriminated unions, satisfies operator, branded types for ID safety, utility types. DO NOT use for: code formatting (see ts-code-conventions), functional patterns (see ts-functional)."
version: "1.1"
---

# TypeScript Conventions

## Strict Mode

**`strict: true` is mandatory** in `tsconfig.json`: without it, the whole convention set below is unenforceable — `no any`, discriminated unions, branded types all rely on the compiler actually checking null, implicit any, and type narrowing. No exceptions.

```jsonc
{
  "compilerOptions": {
    "strict": true,
    // Array/object index access returns `T | undefined` instead of `T`,
    // so a missing key fails to compile instead of crashing at runtime.
    "noUncheckedIndexedAccess": true,
    // An optional property (`foo?: string`) can no longer be set to
    // `undefined` explicitly — it must be omitted, catching typos like
    // `{ foo: undefined }` where `foo` was meant to be left out.
    "exactOptionalPropertyTypes": true
  }
}
```

`strict: true` is set once, at the repo root, and no package's own `tsconfig.json` may set it back to `false` to relax the check for that package alone.

Cost: a package `tsconfig.json` that relaxes `strict` silently loses `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` along with it, so a missing array index compiles clean inside that package and only crashes once another package imports it.

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

`unknown` replaces `any` only at a boundary that receives untyped data — a parsed HTTP body, `JSON.parse`, a third-party callback — never inside code the domain already typed.

Cost: an `any` that survives past the parse boundary propagates through every function it touches, so the narrowing done three call sites downstream stops meaning anything.

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

`import type` applies to every import kept only for its type, not just the `typeof import(...)` pattern shown above.

Cost: a value import kept only for its type still pulls the whole module into the runtime bundle — the compiler considers it used, so tree-shaking cannot remove it.

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

as const serves exactly two purposes: freezing a closed set to derive a union, and pinning a module constant to its literal type.

## Closed Set as a Triplet

A closed set is written as a triplet in a single file: the as const object, the derived union, and the predicate.

```typescript
const RECEIPT_STATUS = {
  Draft: 'draft',
  Sent: 'sent',
} as const;

type ReceiptStatus = (typeof RECEIPT_STATUS)[keyof typeof RECEIPT_STATUS];

const isReceiptStatus = (value: string): value is ReceiptStatus =>
  Object.values(RECEIPT_STATUS).includes(value as ReceiptStatus);
```

## `type` vs `interface`

**Use `type` by default.** Use `interface` only when declaration merging or `extends` is needed (e.g., for NestJS class-based DI). The type-over-interface convention is enforced by ESLint's naming-convention rule, not by code review.

```typescript
// ✅ type — for most cases
type Receipt = {
  id: string;
  amount: number;
  period: Period;
};

// ✅ interface — when merging or extending is needed
interface CreateTenantDto {
  email: string;
  firstName: string;
}

interface UpdateTenantDto extends Partial<CreateTenantDto> {
  id: string;
}
```

## Discriminated Unions

**Model exclusive states explicitly** — no impossible combinations:

```typescript
// ❌ AVOID - Both fields optional = 4 possible states, only 2 are valid
type Receipt = {
  data?: ReceiptData;
  error?: string;
};

// ✅ CORRECT - Discriminated union = only valid states
type Receipt =
  | { fetched: true; data: ReceiptData }
  | { fetched: false; error: string };

function handle(receipt: Receipt) {
  if (receipt.fetched) {
    console.log(receipt.data); // TypeScript knows data exists
  } else {
    console.error(receipt.error); // TypeScript knows error exists
  }
}
```

The discriminant field is always named tag, and callers use isX predicates instead of comparing tag directly.

> **The `Result<T, E>` discriminated union for fallible operations is owned by `ts-functional`** — do not redefine it here.

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

satisfies checks a rendered or collected object literal's shape without widening it; it is never used to validate an untyped value.

## Branded Types

**Prevent accidental swaps** of primitive types that represent different concepts. A brand adds no data, so it can only ever be asserted — which is why the assertion is written **once**, in the kernel, and never in the domain:

```typescript
// kernel/brand.ts — the one place in the codebase that asserts a brand
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };
export const mint = <B extends string>() => <T>(value: T): Brand<T, B> => value as Brand<T, B>;
```

```typescript
// domain — no `as` here, and nothing outside can forge one
type TenantId = Brand<string, 'TenantId'>;
type LandlordId = Brand<string, 'LandlordId'>;

const toTenantId = mint<'TenantId'>();
const toLandlordId = mint<'LandlordId'>();

// ❌ Compile error — cannot mix branded types
function getReceipts(landlordId: LandlordId): Receipt[] { ... }
getReceipts(toTenantId('abc')); // Type error!
```

The brand key is a `unique symbol` that is never exported, so no caller can hand-write `{ ...value, __brand: 'TenantId' }` and forge the proof. A string-literal key such as `string & { readonly __brand: 'TenantId' }` is addressable, which makes passing through the factory optional — and a proof that is optional is not a proof.

as is tolerated only at infrastructure boundaries: external payloads, JSON.parse, SDK calls, empty accumulators; inside the domain it is debt.

> **See also**: `ts-oop`'s "TS-specific: Branded Types for Primitive Identifiers" heading for branded types in value objects.

## Utility Types

`Pick`, `Omit`, and `Partial` derive a DTO or a command shape from an aggregate; the aggregate itself is never expressed as a `Partial`.

Cost: an aggregate typed as `Partial<Tenant>` for a command payload lets a caller construct it missing the very fields the constructor was written to guarantee, moving the invariant back to code review.

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

An unconstrained `<T>` is reserved to structural containers such as `ApiResponse` above; a domain function's generic always carries a semantic constraint (`extends { id: string }`, `extends DomainError`, …).

Cost: an unconstrained `<T>` on a domain function accepts any shape at all, so a typo'd field name on the call site fails at runtime instead of at the call.

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

Absence in a domain type is written as an explicit | null; ? is reserved for external payload shapes and partial update commands.

The non-null assertion `!` is reserved to a framework entry point — application bootstrap, DI container resolution — never to a domain handler or service.

## Command and Query Handler Typing

On the Command side, publish a named function-type alias after the handler's file and annotate the factory with it; on the Query side, let it infer.

The exported handler type alias lives in the handler's own file, never centralized in a shared `types.ts` barrel.

```typescript
// createReceipt.ts
export type CreateReceiptHandler = (command: CreateReceiptCommand) => AsyncResult<Receipt, DomainError>;

const createReceipt: CreateReceiptHandler = (command) => { ... };

// findReceiptById.ts — Query, no alias, inferred return type
const findReceiptById = (query: FindReceiptByIdQuery) => { ... };
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
| ID safety | `Brand<T, B>`, minted once in the kernel, never asserted in the domain |
| Subsets | `Pick`, `Omit`, `Partial`, `Required` |
| Nullability | Explicit `| null`, narrowing over `!` |
