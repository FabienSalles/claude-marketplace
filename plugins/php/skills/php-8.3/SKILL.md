---
name: php-8.3
description: This skill should be used when writing PHP code. Provides PHP 8.3 specific features and conventions.
version: "1.0"
---

# PHP 8.3 Conventions

This skill documents PHP 8.3 specific features to use in all PHP projects.

## Typed Constants

**Always type class constants.** PHP 8.3 introduced typed class constants for better type safety.

```php
// ❌ AVOID - Untyped constants
private const TRANSLATION_DOMAIN = 'messages';
private const MAX_ITEMS = 100;
private const ENABLED = true;

// ✅ CORRECT - Typed constants
private const string TRANSLATION_DOMAIN = 'messages';
private const int MAX_ITEMS = 100;
private const bool ENABLED = true;
```

### Syntax

```php
[visibility] const [type] NAME = value;
```

### Supported Types

All scalar types and class/interface types are supported:
- `string`, `int`, `float`, `bool`
- `array`
- Class names, interface names
- `mixed`

## Quick Reference

| Rule | Example |
|------|---------|
| Typed constants | `private const string NAME = 'value';` |
