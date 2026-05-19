# php

PHP 8.2/8.3 conventions and workflows: code style, DDD, TDD, Symfony, Twig, Composer, OOP, refactoring, SQL.

## Install

```text
/plugin install php@fabien-claude-marketplace
```

Or `./setup.sh --pack php` (dev mode — registers this directory as a local marketplace).

## Skills (13)

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
| [`php-symfony-form`](skills/php-symfony-form/SKILL.md) | `data_class` as single source of truth, `DataTransformer` placement, `property_path` for collections |
| [`php-prg-pattern`](skills/php-prg-pattern/SKILL.md) | POST success → redirect; POST error → re-render; flash messages after redirect |
| [`php-twig-conventions`](skills/php-twig-conventions/SKILL.md) | When (not) to create a `<twig:*>` component, `trans_default_domain` isolation pitfall, `ClockInterface` for dates in templates |

### Testing

| Skill | Purpose |
|---|---|
| [`php-test-conventions`](skills/php-test-conventions/SKILL.md) | DAMP over DRY, spy over mock (AAA), test naming, factory methods, assertion patterns |
| [`php-tdd-workflow`](skills/php-tdd-workflow/SKILL.md) | Cross-layer TDD iterations, red-green-refactor cycle, keeping the app working at every GREEN, bug-fix-first-test |

### Data & tooling

| Skill | Purpose |
|---|---|
| [`php-sql-conventions`](skills/php-sql-conventions/SKILL.md) | Query direction convention (start from known entity), nowdoc formatting, JOIN ordering |
| [`php-composer-conventions`](skills/php-composer-conventions/SKILL.md) | Caret versioning policy, forbidden patterns (`*`, `dev-master`, exact versions), internal package exception |
