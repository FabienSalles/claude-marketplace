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

## Quick Reference

| Rule | Principle |
|------|-----------|
| Control-structure spacing | Blank line before AND after `if`/`for`/`while`/`switch` (except start/end of block) |
| Early return | Edge cases first, main logic at base indentation |
| Continue vs if/else | `continue` only when exit is simple and main is complex |
| Flatten null checks | Use null-propagation operator instead of nested `if` |
| Explicit checks | No implicit truthy/falsy — compare to empty / null explicitly |
| Parameter ordering | Mandatory before optional |
