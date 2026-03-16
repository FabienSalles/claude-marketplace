---
name: ts-code-conventions
description: "ACTIVATE whenever writing or modifying TypeScript code in src/. ACTIVATE for code review, formatting, or 'coding standards'. Covers: project-specific spacing rules around control structures (blank lines before/after if/for/while), early return pattern, continue vs if/else in loops, explicit checks (no truthy/falsy), parameter ordering. These go BEYOND standard linting. DO NOT use for: TypeScript typing rules (see ts-conventions), test conventions."
version: "1.1"
---

# Code Conventions (TypeScript)

> See also: `ts-conventions` for typing rules (strict mode, branded types, etc.).

Project-specific conventions that go beyond standard linting rules.

## Control Structure Spacing

**IMPORTANT**: Always add blank lines before and after control structures (`for`, `for...of`, `while`, `if`, `switch`) when they are not at the start or end of a block.

**Exception**: No blank line needed when the control structure is at the start or end of a function.

> **When applying control structure spacing rules**, read `references/code-examples.md` for for...of, if, and start/end-of-block examples.

## Early Return Pattern

**Always use early return** to handle edge cases and invalid conditions first.

When `return` is preceded by other statements in a block, add a blank line before it.

> **When refactoring nested conditions**, read `references/code-examples.md` for before/after early return examples.

## If Continue Pattern in Loops

`continue` in a loop is the equivalent of early return in a function. **Use `continue` only when the exit condition is simple and the main logic is more complex**.

When both branches have comparable complexity, prefer a classic `if/else` for readability.

> **When choosing between continue and if/else**, read `references/code-examples.md` for side-by-side comparisons.

## Optional Chaining and Nullish Coalescing

**Use optional chaining (`?.`) and nullish coalescing (`??`)** to flatten nested null checks.

```typescript
// Flat with optional chaining
if (customer.personalInfo?.usPerson === true) {
  types.push('us_person');
}

// Nullish coalescing
const name = user.displayName ?? 'Anonymous';
```

## No Implicit Truthy/Falsy Checks

**Use explicit comparisons** instead of relying on JavaScript's truthy/falsy coercion.

```typescript
// Explicit checks
if (array.length > 0) { ... }
if (string === '') { ... }
if (value !== null && value !== undefined) { ... }
```

> **Exception**: Booleans can be checked directly: `if (isValid)` is fine.

## Template Literals over Concatenation

```typescript
const message = `Hello ${user.name}, you have ${count} items`;
```

## Parameter Ordering

**Mandatory parameters before optional ones.**

> **When ordering parameters in functions or constructors**, read `references/code-examples.md` for correct ordering examples.

## Quick Reference

| Rule | Example |
|------|---------|
| Early return | `if (invalid) { return; }` then main logic |
| If continue in loops | Only when simple condition vs complex main logic |
| If/else in loops | When both branches have comparable complexity |
| Blank line before flow control | `x = 1;` then blank then `return;` / `continue;` / `break;` |
| Blank line before control structure | `x = 1;` then blank then `for (...)` |
| Blank line after control structure | `}` then blank then `y = 2;` |
| Exception: start of block | No blank line needed |
| Exception: end of block | No blank line needed |
| Optional chaining | `a?.b?.c` instead of nested `if` |
| Nullish coalescing | `value ?? 'default'` instead of ternary |
| Explicit checks | `array.length > 0` not `array.length` |
| Template literals | `` `Hello ${name}` `` not `'Hello ' + name` |
| Parameter order | Required first, optional last |
