# craft

Cross-language **software craftsmanship principles**. Abstract rules that apply across PHP, TypeScript, and future languages.

## Pairs with language-specific example skills

Each `*-principles` skill in this plugin defines the **rules** in language-agnostic form. Companion skills in the language plugins provide the **examples**:

| Principles skill (here) | Examples skills (language plugins) |
|---|---|
| `refactoring-principles` | `php-refactoring`, `ts-refactoring` |
| `oop-principles` | `php-oop`, `ts-oop` |
| `code-style-principles` | `php-code-conventions`, `ts-code-conventions` |
| `testing-principles` | `php-test-conventions`, `vitest-test-conventions` |
| `tdd-workflow-principles` | `php-tdd-workflow`, `vitest-tdd-workflow` |
| `ddd-principles` (OOP) | `php-ddd-conventions`, `nest-ddd-conventions` |
| `ddd-fp-principles` (functional) | `ddd-ts-fp` |

(`ts-ddd-events` remains independent — event sourcing / outbox is a niche concern, not cross-language refactorable as-is.)

(More to come: `security-audit-principles`.)

## Why this split

- **No more duplication** — the abstract rules used to be repeated in every `php-*` and `ts-*` skill, with only the examples differing.
- **Anti-drift** — impossible for PHP and TS conventions to silently diverge on a shared concept.
- **Cheaper context** — when working on PHP, Claude loads `craft:*-principles` + `php:*` examples; the TS examples skill stays cold.
- **Easier to add languages** — adding Rust = a new `rust-refactoring` examples skill, zero principles to rewrite.

## What's included

| Skill | Status |
|---|---|
| `refactoring-principles` | ✓ shipped |
| `oop-principles` | ✓ shipped |
| `code-style-principles` | ✓ shipped |
| `testing-principles` | ✓ shipped |
| `tdd-workflow-principles` | ✓ shipped |
| `ddd-principles` (OOP) | ✓ shipped |
| `ddd-fp-principles` (functional) | ✓ shipped |
| `security-audit-principles` | ❌ **NOT planned** — handled by the `audit` plugin (overlay on netresearch/security-audit, no principles extraction needed since upstream is already comprehensive) |
