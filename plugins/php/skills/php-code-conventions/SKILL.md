---
name: php-code-conventions
description: "ACTIVATE whenever writing or modifying PHP code in src/, creating controllers, services, repositories, specifications, or any production PHP class. ACTIVATE for code review, formatting questions, or 'coding standards'. Provides PHP-specific code style examples for the cross-language rules defined in craft:code-style-principles, plus PHP-specific rules (no empty(), nullsafe `?->`, nowdoc, constructor parameter ordering with promoted properties). DO NOT use for: test code conventions (see phpunit:php-test-conventions), SQL formatting (see php-sql-conventions)."
version: "2.0"
---

# Code Conventions — PHP

> The **cross-language rules** (control-structure spacing, early return, continue vs if/else, parameter ordering, explicit checks, flatten null checks) are defined in `craft:code-style-principles`. This skill keeps PHP-specific syntax, PSR-12/PER extensions, and pointers to the project's `references/code-examples.md`.

All code complies with PSR-12 and PER Coding Style. The rules below are project-specific PHP conventions that go **beyond** these standards.

> **For complete worked examples** (control-structure spacing, early return, continue patterns, parameter ordering, heredoc/nowdoc), read `references/code-examples.md`.

## PHP-specific: Nullsafe Operator `?->`

Use `?->` to avoid nested null checks.

When using `match` with nullable input, add `null` as a case.

## PHP-specific: NEVER Use `empty()`

The `empty()` function has unpredictable behavior with different types and hides potential bugs.

| Type | Correct | Avoid |
|------|---------|-------|
| Arrays | `$array === []` | `empty($array)` |
| Strings | `$string === ''` | `empty($string)` |
| Null | `$value === null` | `empty($value)` |

## PHP-specific: Constructor Parameter Ordering

Mandatory parameters before optional; within each group, **promoted properties before simple parameters**:

1. Promoted mandatory (`public`/`private`/`protected`, required)
2. Simple mandatory (non-promoted, required)
3. Promoted optional (nullable promoted property)
4. Simple optional (nullable simple parameter)

> See `references/code-examples.md` for correct and incorrect examples.

## PHP-specific: Heredoc / Nowdoc (PER Section 10)

Reference: [PER Coding Style — Section 10](https://www.php-fig.org/per/coding-style/#10-heredoc-and-nowdoc)

**A nowdoc SHOULD be used wherever possible.** Heredoc MAY be used only when nowdoc does not satisfy requirements.

Indentation:
1. Declaration begins on the **same line** as its context.
2. Content is indented **once past the scope indentation**.
3. Closing identifier is at the **same indentation level as the content**.

> See `references/code-examples.md` for PER-compliant and non-compliant examples.

## Quick Reference (PHP-specific only)

> For the cross-language quick reference (early return, continue, blank lines, parameter ordering), see `craft:code-style-principles`.

| Rule | Example |
|------|---------|
| Nullsafe for nested null checks | `$a?->b?->c` instead of nested `if` |
| No `empty()` function | `$array === []` instead of `empty($array)` |
| Prefer nowdoc | `<<<'SQL'` instead of `<<<SQL` |
| Heredoc/nowdoc indentation | Content +1 level, closing same as content |
| Constructor params | Promoted-mandatory → simple-mandatory → promoted-optional → simple-optional |
