---
name: zod-conventions
description: "ACTIVATE when creating Zod schemas, inferring types, composing schemas, or integrating Zod with NestJS validation. ACTIVATE for 'Zod', 'z.object', 'z.infer', 'ZodValidationPipe', 'schema validation'. Covers: FooSchema naming convention, packages/shared location, schema composition (extend/pick/omit/merge), z.coerce for HTTP values, NestJS ZodValidationPipe integration, error formatting with safeParse+flatten. DO NOT use for: general TypeScript types (see ts-conventions), domain validation logic."
version: "1.1"
---

# Zod Conventions

## Naming Convention

**`FooSchema` for schema, `Foo` for inferred type:**

```typescript
import { z } from 'zod';

export const CreateReceiptSchema = z.object({
  leaseId: z.string().uuid(),
  period: z.object({
    year: z.number().int().min(2020),
    month: z.number().int().min(1).max(12),
  }),
});

export type CreateReceiptDto = z.infer<typeof CreateReceiptSchema>;
```

## Location: packages/shared

All schemas live in `packages/shared` so both `apps/api` and `apps/web` can import them:

```
packages/shared/src/
├── dto/
│   ├── receipt.dto.ts        # CreateReceiptSchema, UpdateReceiptSchema
│   ├── tenant.dto.ts         # CreateTenantSchema, LoginSchema
│   └── index.ts              # Re-exports
├── enums/
│   └── status.ts             # as const enums
└── index.ts                  # Barrel export
```

```typescript
// Usage in apps/api or apps/web
import { CreateReceiptSchema, type CreateReceiptDto } from '@quittanceme/shared';
```

## Schema Composition

### Extend / Pick / Omit

```typescript
const BaseTenantSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

// Extend
const CreateTenantSchema = BaseTenantSchema.extend({
  password: z.string().min(8),
});

// Pick
const LoginSchema = BaseTenantSchema.pick({ email: true }).extend({
  password: z.string(),
});

// Omit
const PublicTenantSchema = BaseTenantSchema.omit({ email: true });
```

### Merge

```typescript
const WithTimestamps = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const TenantResponseSchema = BaseTenantSchema.merge(WithTimestamps);
```

## Coercions

**Use `z.coerce.*`** for values from HTTP (query strings, form data) that arrive as strings:

```typescript
// ❌ AVOID - Fails on "123" from query string
const schema = z.object({
  page: z.number(),   // Rejects "123" (string)
});

// ✅ CORRECT - Coerces string to number
const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  date: z.coerce.date(),
  active: z.coerce.boolean(),
});
```

## NestJS ZodValidationPipe

```typescript
// src/infrastructure/http/pipes/zod-validation.pipe.ts
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    return result.data;
  }
}
```

### Usage in Controllers

```typescript
@Post()
async create(
  @Body(new ZodValidationPipe(CreateReceiptSchema)) dto: CreateReceiptDto,
) {
  return this.receiptService.generate(dto);
}

@Get()
async list(
  @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationDto,
) {
  return this.receiptService.findAll(query);
}
```

## Error Formatting

`safeParse` + `flatten()` produces a clean error structure:

```typescript
const result = schema.safeParse(input);

if (!result.success) {
  const errors = result.error.flatten();
  // {
  //   formErrors: [],
  //   fieldErrors: {
  //     email: ['Invalid email'],
  //     period: ['Required'],
  //   }
  // }
}
```

## Quick Reference

| Rule | Convention |
|------|-----------|
| Naming | `FooSchema` + `z.infer<typeof FooSchema>` |
| Location | `packages/shared/src/dto/` |
| Composition | `.extend()`, `.pick()`, `.omit()`, `.merge()` |
| HTTP values | `z.coerce.*` for strings from query/form |
| NestJS | `ZodValidationPipe` in `@Body()` / `@Query()` |
| Errors | `safeParse` + `flatten()` |
| Exports | Barrel file in `packages/shared` |
