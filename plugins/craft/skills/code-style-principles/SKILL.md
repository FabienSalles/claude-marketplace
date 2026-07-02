---
name: code-style-principles
description: "ACTIVATE whenever writing or modifying production code in src/. ACTIVATE for code review, formatting questions, or 'coding standards'. Covers cross-language code style: control-structure spacing, early-return pattern, continue-vs-if/else in loops, explicit (non-truthy/falsy) checks, flattening nested null checks, parameter ordering. These rules go BEYOND standard linters. Language-specific syntax (no-empty in PHP, template literals in TS, nowdoc, optional chaining vs nullsafe) lives in php-code-conventions / ts-code-conventions."
version: "1.0"
---

# Code Style — Cross-Language Principles

> The **rules** below are language-agnostic. Syntax-specific examples (nullsafe `?->`, optional chaining `?.`, no-`empty()`, nowdoc, template literals) live in:
> - `php-code-conventions`
> - `ts-code-conventions`

These conventions go **beyond** standard linters (PSR-12/PER, eslint/prettier). They encode the project's house style.

## 1. Control-Structure Spacing

Always add a blank line **before AND after** control structures (`if`, `for`, `foreach`/`for...of`, `while`, `switch`) when they are not at the start or end of the enclosing block.

**Exception:** no blank line at start or end of a method/function/block.

**Why:** visual separation between sequential statements and branching/looping logic.

## 2. Early-Return Pattern

Always use early return to handle edge cases and invalid conditions **first**. Main logic stays at base indentation.

- Reduces nesting.
- Clarifies intent (edge cases handled upfront).
- Add a blank line **before** the `return` when preceded by other statements.

## 3. If-Continue Pattern in Loops

`continue` in a loop is the equivalent of early-return in a function.

- Use `continue` **only** when the exit condition is simple and the main processing is more complex.
- When both branches have comparable complexity, prefer a classic `if/else` for readability.
- Add a blank line **before** `continue` / `return` / `break` / `throw` when preceded by other statements.

## 4. Flatten Nested Null Checks

Replace nested null-guards with the language's null-propagation operator (PHP: `?->`, TS: `?.`, Kotlin: `?.`, Swift: `?.`).

For absent values with a default, use the null-coalescing operator (PHP: `??`, TS: `??`, …).

**Criterion:** if you nest more than one `if (x !== null)`, use null-propagation.

## 5. Explicit Checks Over Implicit Truthy/Falsy

Use **explicit** comparisons instead of relying on language coercion.

- Arrays / collections: compare to empty (`=== []`, `.length > 0`) — not truthy.
- Strings: compare to `''` (or use length).
- Null/undefined: compare to `null` / `undefined` explicitly.

**Exception:** booleans can be checked directly (`if (isValid)`).

**Why:** implicit truthy/falsy hides type bugs and gives unstable results across languages (and even across the same language: PHP `empty()`, JS coercion).

## 6. Parameter Ordering

Constructors / function signatures: **mandatory parameters before optional / nullable**.

Within each group, the language's natural ordering applies (e.g. promoted properties in PHP, default values in TS).

## 7. Comments — Justify or Delete

Write a comment **only** when the code cannot speak for itself. A comment earns its place if it surfaces something the code does **not**:

- **Hidden complexity** — a non-obvious algorithm, a workaround, a `!important` / specificity hack, an ordering constraint.
- **Business / domain rule** — the *why* behind a magic value or branch (e.g. "French IBAN length = 27").
- **A decision that would otherwise look wrong** — why a line is disabled, why a framework default is overridden.

Delete any comment that **restates the code** without adding value:

```php
// AVOID — reproduces the code
// Uppercase the IBAN and strip whitespace
return strtoupper(preg_replace('/\s+/', '', $iban));

// AVOID — restates the name
/** Extra HTML attributes applied to the wrapper. */
public array $wrapperAttributes = [];
```

```php
// CORRECT — surfaces a non-obvious rule
// !important: beat Bootstrap's :valid border (empty boxes are HTML5-valid)
border-color: $danger !important;
```

**Type annotations are not prose comments**: keep `@var` / `@return` / `@param` when they add type information a tool or reader needs — they are not subject to this rule.

**Heuristic**: if deleting the comment loses no information a competent reader couldn't get from the code in seconds, delete it.

## Quick Reference

| Rule | Principle |
|------|-----------|
| Control-structure spacing | Blank line before AND after `if`/`for`/`while`/`switch` (except start/end of block) |
| Early return | Edge cases first, main logic at base indentation |
| Continue vs if/else | `continue` only when exit is simple and main is complex |
| Flatten null checks | Use null-propagation operator instead of nested `if` |
| Explicit checks | No implicit truthy/falsy — compare to empty / null explicitly |
| Parameter ordering | Mandatory before optional |
| Comments | Only for hidden complexity / business rule; delete anything that restates the code |
