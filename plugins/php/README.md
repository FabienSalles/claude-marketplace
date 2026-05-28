# php

PHP 8.2/8.3 **language** conventions — framework-agnostic. Code style, OOP, DDD, refactoring, SQL, Composer.

Pair with [`phpunit`](../phpunit/) for testing discipline and [`symfony`](../symfony/) for Symfony-specific overlays (FormType, Twig component, PRG pattern). All three are independent — a Laravel project takes `php` alone or `php` + `phpunit`, a Symfony project takes the three together.

## Install

```text
/plugin install php@fabien-claude-marketplace
```

Or `./setup.sh --pack php` (dev mode — registers this directory as a local marketplace).

## Skills (8)

### Language

| Skill | Purpose |
|---|---|
| [`php-8.2`](skills/php-8.2/SKILL.md) | Mandatory `readonly` class usage (class-level, not per-property) |
| [`php-8.3`](skills/php-8.3/SKILL.md) | Mandatory typed class constants |

### Code style & OOP

| Skill | Purpose |
|---|---|
| [`php-code-conventions`](skills/php-code-conventions/SKILL.md) | Project-specific spacing, early return, no `empty()`, parameter ordering, nowdoc — goes beyond PSR-12/PER |
| [`php-oop`](skills/php-oop/SKILL.md) | Tell Don't Ask, collections over named properties, Whole Object pattern, self-describing value objects |
| [`php-refactoring`](skills/php-refactoring/SKILL.md) | End-to-end flow analysis before refactoring, consumer-driven value-object design, imports as coupling signals |

### Domain & architecture

| Skill | Purpose |
|---|---|
| [`php-ddd-conventions`](skills/php-ddd-conventions/SKILL.md) | Strict domain layer purity rules, SPI interface pattern |

### Data & tooling

| Skill | Purpose |
|---|---|
| [`php-sql-conventions`](skills/php-sql-conventions/SKILL.md) | Query direction convention (start from known entity), nowdoc formatting, JOIN ordering |
| [`php-composer-conventions`](skills/php-composer-conventions/SKILL.md) | Caret versioning policy, forbidden patterns (`*`, `dev-master`, exact versions), internal package exception |

## What moved out (v1 → v2)

In v2.0 the plugin was tightened to **PHP language only** to make it reusable across frameworks. The framework-specific and testing skills moved to dedicated plugins:

| Skill | New home |
|---|---|
| `php-tdd-workflow` | [`phpunit`](../phpunit/) |
| `php-test-conventions` | [`phpunit`](../phpunit/) |
| `symfony-form` | [`symfony`](../symfony/) |
| `twig-conventions` | [`symfony`](../symfony/) |
| `prg-pattern` | [`symfony`](../symfony/) |

If you used the monolithic `php` plugin before, install [`phpunit`](../phpunit/) and [`symfony`](../symfony/) alongside it to keep the same coverage.
