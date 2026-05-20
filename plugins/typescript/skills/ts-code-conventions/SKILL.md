---
name: ts-code-conventions
description: "ACTIVATE whenever writing or modifying TypeScript code in src/. ACTIVATE for code review, formatting, or 'coding standards'. Provides TS-specific code style examples for the cross-language rules defined in craft:code-style-principles, plus TS-specific patterns (optional chaining, nullish coalescing, template literals, no truthy/falsy). DO NOT use for: TypeScript typing rules (see ts-conventions), test conventions."
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

## Quick Reference (TS-specific only)

> For the cross-language quick reference (early return, continue, blank lines, parameter ordering), see `craft:code-style-principles`.

| Rule | Example |
|------|---------|
| Optional chaining | `a?.b?.c` instead of nested `if` |
| Nullish coalescing | `value ?? 'default'` |
| Explicit checks | `array.length > 0` (not `array.length`) |
| Template literals | `` `Hello ${name}` `` (not `'Hello ' + name`) |
