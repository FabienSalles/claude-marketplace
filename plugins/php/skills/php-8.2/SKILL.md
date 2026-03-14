---
name: php-8.2
description: This skill should be used when writing PHP code. Provides PHP 8.2 specific features and conventions.
version: "1.0"
---

# PHP 8.2 Conventions

This skill documents PHP 8.2 specific features to use in all PHP projects.

## Readonly Classes

**Always prefer `readonly class` over individual `readonly` properties.** PHP 8.2 introduced readonly classes, which make all promoted properties readonly implicitly.

```php
// ❌ AVOID - readonly on each property
final class OrderSummary
{
    public function __construct(
        private readonly string $orderUuid,
        private readonly string $buyerUuid,
        private readonly int $buyerAge,
    ) {
    }
}

// ✅ CORRECT - readonly on the class
final readonly class OrderSummary
{
    public function __construct(
        private string $orderUuid,
        private string $buyerUuid,
        private int $buyerAge,
    ) {
    }
}
```

### When to Use

- Use `readonly class` when **all** properties should be readonly (most DTOs, value objects, services)
- Keep per-property `readonly` only when some properties need to be mutable

### Benefits

- **Less noise**: No need to repeat `readonly` on each property
- **Stronger guarantee**: Prevents accidentally adding a mutable property
- **Cleaner constructors**: Promoted properties are shorter

## Disjunctive Normal Form (DNF) Types

PHP 8.2 allows combining union and intersection types:

```php
// ✅ PHP 8.2 - DNF types
function process((Countable&Iterator)|null $input): void
```

## `true`, `false`, `null` as Standalone Types

```php
// ✅ PHP 8.2 - Standalone false/true/null types
function alwaysFails(): false
{
    return false;
}
```

## Enum Constants in `const` Expressions

```php
// ✅ PHP 8.2
enum Status: string
{
    case Active = 'active';
    case Inactive = 'inactive';

    const DEFAULTS = [self::Active, self::Inactive];
}
```

## Quick Reference

| Rule | Example |
|------|---------|
| Readonly class | `final readonly class Dto` |
| Readonly class constructor | No `readonly` on promoted properties |
| Mutable exception | Use per-property `readonly` only when needed |
| DNF types | `(A&B)|null` |
| Standalone types | `true`, `false`, `null` |
