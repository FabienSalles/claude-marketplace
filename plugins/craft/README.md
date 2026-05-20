# craft

Cross-language **software craftsmanship principles**. Abstract rules that apply across PHP, TypeScript, and future languages.

## Pairs with language-specific example skills

Each `*-principles` skill in this plugin defines the **rules** in language-agnostic form. Companion skills in the language plugins provide the **examples**:

| Principles skill (here) | Examples skills (language plugins) |
|---|---|
| `refactoring-principles` | `php-refactoring`, `ts-refactoring` |

(More pairs to come as the cross-language refactor progresses: DDD, OOP, TDD, testing, code style.)

## Why this split

- **No more duplication** — the abstract rules used to be repeated in every `php-*` and `ts-*` skill, with only the examples differing.
- **Cheaper context** — when working on PHP, Claude loads `craft:*-principles` + `php:*` examples; the TS examples skill stays cold.
- **Easier to add languages** — adding Rust = a new `rust-refactoring` examples skill, zero principles to rewrite.

## What's included

| Skill | Status |
|---|---|
| `refactoring-principles` | ✓ POC (paired with `php-refactoring` + `ts-refactoring`) |
| `ddd-principles` | _planned_ |
| `oop-principles` | _planned_ |
| `tdd-workflow-principles` | _planned_ |
| `testing-principles` | _planned_ |
| `code-style-principles` | _planned_ |
