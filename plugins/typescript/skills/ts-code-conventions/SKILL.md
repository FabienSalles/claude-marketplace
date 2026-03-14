---
name: ts-code-conventions
description: This skill should be used when writing new TypeScript code in "src/", creating modules, services, controllers, or utilities. Provides the project's coding conventions and standards.
version: "1.0"
---

# Code Conventions (TypeScript)

This skill documents TypeScript coding conventions for Quittance.me.

> **See also**: `ts-conventions` for TypeScript-specific typing rules (strict mode, branded types, etc.).

## Control Structure Spacing

**IMPORTANT**: Always add blank lines before and after control structures (`for`, `for...of`, `while`, `if`, `switch`) when they are not at the start or end of a block.

### For...of

```typescript
// ❌ Avoid - No blank lines around for...of
const codes: Record<string, boolean> = {};
for (const offer of offers) {
  codes[offer.code] = true;
}
this.offerCodes = codes;

// ✅ Correct - Blank lines before and after for...of
const codes: Record<string, boolean> = {};

for (const offer of offers) {
  codes[offer.code] = true;
}

this.offerCodes = codes;
```

### If statements

```typescript
// ❌ Avoid
let result: string | null = null;
if (condition) {
  result = 'value';
}
return result;

// ✅ Correct
let result: string | null = null;

if (condition) {
  result = 'value';
}

return result;
```

### Exception: Start/End of block

No blank line needed when the control structure is at the start or end of a function:

```typescript
// ✅ Correct - for...of at start of function
function process(items: Item[]): void {
  for (const item of items) {
    // ...
  }

  this.finalize();
}

// ✅ Correct - if at end of function
function validate(): boolean {
  const isValid = this.check();

  if (!isValid) {
    return false;
  }
}
```

## Early Return Pattern

**Always use early return** to handle edge cases and invalid conditions first.

```typescript
// ❌ AVOID - Main logic nested inside condition
function processOrder(order: Order): void {
  if (order.items.length > 0) {
    if (order.status === 'pending') {
      // deep nesting...
    }
  }
}

// ✅ CORRECT - Early returns for invalid cases
function processOrder(order: Order): void {
  if (order.items.length === 0) {
    return;
  }

  if (order.status !== 'pending') {
    return;
  }

  // main logic at base level
}
```

### Blank line before return

When `return` is preceded by other statements in a block, add a blank line:

```typescript
// ✅ Correct
if (condition) {
  doSomething();

  return;
}

// ✅ Correct - No blank line when return is alone
if (total === 100) {
  return;
}
```

## If Continue Pattern in Loops

`continue` in a loop is the equivalent of early return in a function. **Use `continue` only when the exit condition is simple and the main logic is more complex** — i.e. when `continue` serves to "clear the simple case" to keep the main logic at the first indentation level.

When both branches have comparable complexity, prefer a classic `if/else` for readability.

```typescript
// ✅ CORRECT - continue to clear the simple case, main logic below
for (const item of items) {
  if (!item.isActive) {
    logger.debug(`Skipping inactive item ${item.id}`);

    continue;
  }

  const price = calculatePrice(item);
  const discount = applyDiscount(price, item.category);
  results.push({ item, finalPrice: price - discount });
}

// ✅ CORRECT - if/else when both branches have comparable complexity
for (const [index, fieldName] of fieldNames.entries()) {
  if (index === lastIndex) {
    addError(fieldName, errorMessage);
  } else {
    addError(fieldName, '');
  }
}

// ❌ AVOID - continue when both branches are equally simple
for (const [index, fieldName] of fieldNames.entries()) {
  if (index !== lastIndex) {
    addError(fieldName, '');

    continue;
  }

  addError(fieldName, errorMessage);
}
```

## Optional Chaining and Nullish Coalescing

**Use optional chaining (`?.`) and nullish coalescing (`??`)** to flatten nested null checks.

```typescript
// ❌ AVOID - Deeply nested conditions
if (customer.personalInfo !== null && customer.personalInfo !== undefined) {
  if (customer.personalInfo.usPerson === true) {
    types.push('us_person');
  }
}

// ✅ CORRECT - Flat with optional chaining
if (customer.personalInfo?.usPerson === true) {
  types.push('us_person');
}

// ❌ AVOID - Ternary for defaults
const name = user.displayName !== null && user.displayName !== undefined
  ? user.displayName
  : 'Anonymous';

// ✅ CORRECT - Nullish coalescing
const name = user.displayName ?? 'Anonymous';
```

## No Implicit Truthy/Falsy Checks

**Use explicit comparisons** instead of relying on JavaScript's truthy/falsy coercion.

```typescript
// ❌ AVOID - Implicit truthy/falsy
if (array.length) { ... }
if (!string) { ... }
if (value) { ... }

// ✅ CORRECT - Explicit checks
if (array.length > 0) { ... }
if (string === '') { ... }
if (value !== null && value !== undefined) { ... }
// or with nullish check:
if (value != null) { ... }
```

> **Exception**: Booleans can be checked directly: `if (isValid)` is fine.

## Template Literals over Concatenation

```typescript
// ❌ AVOID
const message = 'Hello ' + user.name + ', you have ' + count + ' items';

// ✅ CORRECT
const message = `Hello ${user.name}, you have ${count} items`;
```

## Parameter Ordering

**Mandatory parameters before optional ones:**

```typescript
// ✅ Correct - required first, then optional
function createTenant(
  email: string,
  firstName: string,
  lastName: string,
  phone?: string,
  birthDate?: Date,
): Tenant { ... }

// ❌ Avoid - optional mixed with required
function createTenant(
  email: string,
  phone?: string,
  firstName: string,
): Tenant { ... }
```

For constructors, same rule applies:

```typescript
// ✅ Correct
class Receipt {
  constructor(
    readonly tenantId: string,
    readonly landlordId: string,
    readonly amount: number,
    readonly period: Period,
    readonly paidAt?: Date,
    readonly notes?: string,
  ) {}
}
```

## Quick Reference

| Rule | Example |
|------|---------|
| Early return | `if (invalid) { return; }` then main logic |
| If continue in loops | Only when simple condition vs complex main logic |
| If/else in loops | When both branches have comparable complexity |
| Blank line before flow control | `x = 1;` ⏎ ⏎ `return;` / `continue;` / `break;` |
| Blank line before control structure | `x = 1;` ⏎ ⏎ `for (...)` |
| Blank line after control structure | `}` ⏎ ⏎ `y = 2;` |
| Exception: start of block | No blank line needed |
| Exception: end of block | No blank line needed |
| Optional chaining | `a?.b?.c` instead of nested `if` |
| Nullish coalescing | `value ?? 'default'` instead of ternary |
| Explicit checks | `array.length > 0` not `array.length` |
| Template literals | `` `Hello ${name}` `` not `'Hello ' + name` |
| Parameter order | Required first, optional last |
