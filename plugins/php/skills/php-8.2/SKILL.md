---
name: php-8.2
description: "ACTIVATE when writing PHP classes, DTOs, or value objects in a PHP 8.2+ project. Covers: mandatory readonly class usage (class-level, not per-property). DO NOT use for: general PHP syntax, PHP 8.3 features (see php-8.3)."
version: "1.1"
---

# PHP 8.2 Conventions

The key project convention: always use `readonly class` instead of per-property `readonly`.

## Readonly Classes

```php
// AVOID: readonly on each property
final class OrderSummary
{
    public function __construct(
        private readonly string $orderUuid,
        private readonly string $buyerUuid,
    ) {}
}

// CORRECT: readonly on the class
final readonly class OrderSummary
{
    public function __construct(
        private string $orderUuid,
        private string $buyerUuid,
    ) {}
}
```

Use `readonly class` when all properties should be readonly (most DTOs, value objects, services). Keep per-property `readonly` only when some properties need to be mutable.
