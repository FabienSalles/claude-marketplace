# TypeScript Code Convention Examples

## Table of Contents
- [Control Structure Spacing Examples](#control-structure-spacing-examples)
- [Early Return Examples](#early-return-examples)
- [If Continue Pattern Examples](#if-continue-pattern-examples)
- [Optional Chaining and Nullish Coalescing](#optional-chaining-and-nullish-coalescing)
- [Explicit Checks Examples](#explicit-checks-examples)
- [Parameter Ordering Examples](#parameter-ordering-examples)

## Control Structure Spacing Examples

### For...of

```typescript
// Avoid - No blank lines around for...of
const codes: Record<string, boolean> = {};
for (const offer of offers) {
  codes[offer.code] = true;
}
this.offerCodes = codes;

// Correct - Blank lines before and after for...of
const codes: Record<string, boolean> = {};

for (const offer of offers) {
  codes[offer.code] = true;
}

this.offerCodes = codes;
```

### If statements

```typescript
// Avoid
let result: string | null = null;
if (condition) {
  result = 'value';
}
return result;

// Correct
let result: string | null = null;

if (condition) {
  result = 'value';
}

return result;
```

### Exception: Start/End of block

```typescript
// Correct - for...of at start of function
function process(items: Item[]): void {
  for (const item of items) {
    // ...
  }

  this.finalize();
}

// Correct - if at end of function
function validate(): boolean {
  const isValid = this.check();

  if (!isValid) {
    return false;
  }
}
```

## Early Return Examples

```typescript
// AVOID - Main logic nested inside condition
function processOrder(order: Order): void {
  if (order.items.length > 0) {
    if (order.status === 'pending') {
      // deep nesting...
    }
  }
}

// CORRECT - Early returns for invalid cases
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

```typescript
// Correct
if (condition) {
  doSomething();

  return;
}

// Correct - No blank line when return is alone
if (total === 100) {
  return;
}
```

## If Continue Pattern Examples

```typescript
// CORRECT - continue to clear the simple case, main logic below
for (const item of items) {
  if (!item.isActive) {
    logger.debug(`Skipping inactive item ${item.id}`);

    continue;
  }

  const price = calculatePrice(item);
  const discount = applyDiscount(price, item.category);
  results.push({ item, finalPrice: price - discount });
}

// CORRECT - if/else when both branches have comparable complexity
for (const [index, fieldName] of fieldNames.entries()) {
  if (index === lastIndex) {
    addError(fieldName, errorMessage);
  } else {
    addError(fieldName, '');
  }
}

// AVOID - continue when both branches are equally simple
for (const [index, fieldName] of fieldNames.entries()) {
  if (index !== lastIndex) {
    addError(fieldName, '');

    continue;
  }

  addError(fieldName, errorMessage);
}
```

## Optional Chaining and Nullish Coalescing

```typescript
// AVOID - Deeply nested conditions
if (customer.personalInfo !== null && customer.personalInfo !== undefined) {
  if (customer.personalInfo.usPerson === true) {
    types.push('us_person');
  }
}

// CORRECT - Flat with optional chaining
if (customer.personalInfo?.usPerson === true) {
  types.push('us_person');
}

// AVOID - Ternary for defaults
const name = user.displayName !== null && user.displayName !== undefined
  ? user.displayName
  : 'Anonymous';

// CORRECT - Nullish coalescing
const name = user.displayName ?? 'Anonymous';
```

## Explicit Checks Examples

```typescript
// AVOID - Implicit truthy/falsy
if (array.length) { ... }
if (!string) { ... }
if (value) { ... }

// CORRECT - Explicit checks
if (array.length > 0) { ... }
if (string === '') { ... }
if (value !== null && value !== undefined) { ... }
// or with nullish check:
if (value != null) { ... }
```

> **Exception**: Booleans can be checked directly: `if (isValid)` is fine.

### Template Literals over Concatenation

```typescript
// AVOID
const message = 'Hello ' + user.name + ', you have ' + count + ' items';

// CORRECT
const message = `Hello ${user.name}, you have ${count} items`;
```

## Parameter Ordering Examples

```typescript
// Correct - required first, then optional
function createTenant(
  email: string,
  firstName: string,
  lastName: string,
  phone?: string,
  birthDate?: Date,
): Tenant { ... }

// Avoid - optional mixed with required
function createTenant(
  email: string,
  phone?: string,
  firstName: string,
): Tenant { ... }
```

For constructors, same rule applies:

```typescript
// Correct
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
