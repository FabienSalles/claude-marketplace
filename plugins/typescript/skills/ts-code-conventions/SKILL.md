---
name: ts-code-conventions
description: "ACTIVATE whenever writing or modifying TypeScript code in src/. ACTIVATE for code review, formatting, or 'coding standards'. Provides TS-specific code style examples for the cross-language rules defined in craft:code-style-principles, plus TS-specific patterns (optional chaining, nullish coalescing, template literals, no truthy/falsy). DO NOT use for: TypeScript typing rules (see ts-conventions), test conventions, domain/infra layer boundaries (see ts-layer-boundaries)."
version: "2.0"
---

# Code Conventions — TypeScript

> The **cross-language rules** (control-structure spacing, early return, continue vs if/else, parameter ordering, flatten null checks) are defined in `craft:code-style-principles`. This skill keeps TS-specific syntax (optional chaining, nullish coalescing, template literals) and pointers to the project's `references/code-examples.md`.

> See also: `ts-conventions` for typing rules (strict mode, branded types).

These conventions go beyond standard linting rules (eslint/prettier).

> **For complete worked examples** (control-structure spacing, early return, continue patterns, parameter ordering), read `references/code-examples.md`.

## TS-specific: Optional Chaining and Nullish Coalescing

Use `?.` to flatten nested null checks, and `??` for "default if null/undefined".

```typescript
// Optional chaining
if (customer.personalInfo?.usPerson === true) {
  types.push('us_person');
}

// Nullish coalescing
const name = user.displayName ?? 'Anonymous';
```

## TS-specific: No Implicit Truthy / Falsy

Use **explicit comparisons** instead of relying on JavaScript's truthy/falsy coercion.

```typescript
// ✅ Explicit checks
if (array.length > 0) { /* ... */ }
if (string === '') { /* ... */ }
if (value !== null && value !== undefined) { /* ... */ }

// ✅ Exception — booleans can be checked directly
if (isValid) { /* ... */ }
```

## TS-specific: Template Literals Over Concatenation

```typescript
const message = `Hello ${user.name}, you have ${count} items`;
```

## TS-specific: Aliasing, Build and Environment Config

> Layer boundaries themselves (the ESLint zones that enforce them) are owned by `ts-layer-boundaries`; this section covers the alias, build and env-config conventions that sit alongside them.

Layer boundaries are declared as import/no-restricted-paths zones, one zone per forbidden edge, each carrying the message of the rule it violates.

The CQRS zone is unidirectional by design: it stops Command from reading Query, never the reverse. A relative path bypasses it.

Every layer has its own alias @<Context><Layer>, and it is imported through it; a relative path is reserved for a neighbor in the same folder.

The alias table is declared four times (tsconfig, jest moduleNameMapper, tsconfig-paths at runtime, transform at build) and must stay in sync.

Compile with tspc (ts-patch) plus typescript-transform-paths, so dist needs no resolver at runtime.

process.env is read at one place per layer: a config.ts that destructures it with inline default values.

```typescript
const { PORT = '3000', DATABASE_URL = 'postgres://localhost:5432' } = process.env;
```

Tests import by alias too, @Tests/* for fixtures, because a mirrored tree has no stable relative offset, so the alias is a necessity, not a preference.

## Quick Reference (TS-specific only)

> For the cross-language quick reference (early return, continue, blank lines, parameter ordering), see `craft:code-style-principles`.

| Rule | Example |
|------|---------|
| Optional chaining | `a?.b?.c` instead of nested `if` |
| Nullish coalescing | `value ?? 'default'` |
| Explicit checks | `array.length > 0` (not `array.length`) |
| Template literals | `` `Hello ${name}` `` (not `'Hello ' + name`) |
