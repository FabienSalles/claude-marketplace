---
name: php-8-3
description: "ACTIVATE when writing PHP class constants in a PHP 8.3+ project. Covers: mandatory typed class constants and default visibility. DO NOT use for: general PHP syntax, PHP 8.2 features (see php-8-2)."
version: "1.2"
---

# PHP 8.3 Conventions

Two project conventions for class constants: **type them**, and keep them
**private by default**.

## Typed Constants

```php
// AVOID
private const TRANSLATION_DOMAIN = 'messages';
private const MAX_ITEMS = 100;

// CORRECT
private const string TRANSLATION_DOMAIN = 'messages';
private const int MAX_ITEMS = 100;
```

Supported types: `string`, `int`, `float`, `bool`, `array`, class/interface names, `mixed`.

## Visibility defaults

Default to `private` for class constants. Promote to `public` **only** when an
external consumer (template, sibling class, public API) actually reads it. Don't
mirror the visibility of a neighbor constant without checking — the principle of
least visibility wins over consistency.

```php
// AVOID — public by default, no external consumer
final class CheckoutController
{
    public const string ROUTE_NAME = 'checkout_index';
    public const string CART_COOKIE_NAME = 'cart_token';
    // ...
}

// CORRECT — private until proven otherwise
final class CheckoutController
{
    private const string ROUTE_NAME = 'checkout_index';
    private const string CART_COOKIE_NAME = 'cart_token';
    // ...
}

// CORRECT — public is justified, the constant is actually read elsewhere
final class OrderConfirmationController
{
    // Read by templates/order/index.html.twig via path('order_confirmation', ...)
    // and by CheckoutController to redirect after a successful checkout.
    public const string ROUTE_NAME = 'order_confirmation';
}
```

**Decision heuristic before writing `public const`**: grep for usages outside
the declaring class. No hit → `private`. Hit → `public` and add a brief
comment naming the consumer (helps future cleanup when the consumer disappears).
