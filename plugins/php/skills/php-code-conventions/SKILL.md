---
name: php-code-conventions
description: "ACTIVATE whenever writing or modifying PHP code in src/, creating controllers, services, repositories, specifications, or any production PHP class. ACTIVATE for code review, formatting questions, or 'coding standards'. Covers: project-specific spacing rules around control structures, early return patterns, no empty() policy, constructor parameter ordering, nowdoc conventions. These rules go BEYOND PSR-12/PER. DO NOT use for: test code conventions (see php-test-conventions), SQL formatting (see php-sql-conventions)."
version: "1.1"
---

# Code Conventions

All code complies with PSR-12 and PER Coding Style. The rules below are **project-specific conventions that go beyond these standards** -- this is what matters here.

## Control Structure Spacing

**IMPORTANT**: Always add blank lines before and after control structures (`foreach`, `for`, `while`, `if`, `switch`) when they are not at the start or end of a block.

> This rule is not in PSR-12/PER (which only states blank lines "MAY be added"). In this project, they are **required**.

**Exception**: No blank line needed when the control structure is at the start or end of a method/block.

> **When applying spacing rules around control structures**, read `references/code-examples.md` for complete foreach, if, and exception examples.

## Early Return Pattern

**Always use early return** to handle edge cases and invalid conditions first. This reduces nesting and improves readability.

- **Reduces indentation**: Main logic stays at base level
- **Clarifies intent**: Edge cases are handled first
- **Blank line before return**: When `return` is preceded by other statements in a block, add a blank line

> **When refactoring nested conditions to early returns**, read `references/code-examples.md` for before/after examples and blank line rules.

## If Continue Pattern in Loops

`continue` in a loop is the equivalent of early return in a function. **Use `continue` only when the exit condition is simple and the main processing is more complex**.

When both branches have comparable complexity, prefer a classic `if/else` for readability.

> **Note**: Add a blank line before `continue` (and `return`, `break`, `throw`) when preceded by other statements in the block.

> **When deciding between continue and if/else in loops**, read `references/code-examples.md` for side-by-side comparisons.

## Nullsafe Operator to Flatten Nested Ifs

**Use the nullsafe operator `?->`** to avoid nested null checks.

When using `match` with nullable input, add `null` as a case.

> **When flattening nested null checks**, read `references/code-examples.md` for nullsafe operator and match patterns.

## Avoid empty() Function

**NEVER use the `empty()` function.** Use explicit comparisons instead.

> The `empty()` function has unpredictable behavior with different types and hides potential bugs.

| Type | Correct | Avoid |
|------|---------|-------|
| Arrays | `$array === []` | `empty($array)` |
| Strings | `$string === ''` | `empty($string)` |
| Null | `$value === null` | `empty($value)` |

## Parameter Ordering

In constructors, mandatory parameters come first, then optional ones. Within each group, promoted properties come before simple parameters:

1. **Promoted mandatory** (`public`/`private`/`protected`, required)
2. **Simple mandatory** (non-promoted, required)
3. **Promoted optional** (`public`/`private`/`protected`, nullable)
4. **Simple optional** (non-promoted, nullable)

> **When ordering constructor parameters**, read `references/code-examples.md` for correct and incorrect examples.

## Heredoc and Nowdoc (PER Coding Style Section 10)

**Reference**: [PER Coding Style - Section 10](https://www.php-fig.org/per/coding-style/#10-heredoc-and-nowdoc)

**A nowdoc SHOULD be used wherever possible.** Heredoc MAY be used only when a nowdoc does not satisfy requirements.

Indentation rules:
1. Declaration begins on the **same line** as its context
2. Content is indented **once past the scope indentation**
3. Closing identifier is at the **same indentation level as the content**

> **When writing heredoc/nowdoc blocks**, read `references/code-examples.md` for PER-compliant and non-compliant examples.

## Quick Reference

| Rule | Example |
|------|---------|
| Early return | `if (invalid) { return; }` then main logic |
| If continue in loops | Only when simple condition vs complex main logic |
| If/else in loops | When both branches have comparable complexity |
| Blank line before flow control | `$x = 1;` then blank then `return;` / `continue;` / `break;` |
| Blank line before control structure | `$x = 1;` then blank then `foreach (...)` |
| Blank line after control structure | `}` then blank then `$y = 2;` |
| Exception: start of block | No blank line needed |
| Exception: end of block | No blank line needed |
| Nullsafe for nested null checks | `$a?->b?->c` instead of nested `if` |
| No `empty()` function | `$array === []` instead of `empty($array)` |
| Prefer nowdoc | `<<<'SQL'` instead of `<<<SQL` |
| Heredoc/nowdoc indentation | Content +1 level, closing same as content |
