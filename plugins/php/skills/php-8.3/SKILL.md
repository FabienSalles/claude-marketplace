---
name: php-8.3
description: "ACTIVATE when writing PHP class constants in a PHP 8.3+ project. Covers: mandatory typed class constants. DO NOT use for: general PHP syntax, PHP 8.2 features (see php-8.2)."
version: "1.1"
---

# PHP 8.3 Conventions

The key project convention: always type class constants.

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
