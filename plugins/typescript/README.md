# typescript

TypeScript conventions and workflows: typing, code style, functional programming, OOP, DDD events, refactoring. (Security audit patterns moved to the `audit` plugin as `audit:ts-security`.)

## Install

```text
/plugin install typescript@fabien-claude-marketplace
```

Or `./setup.sh --pack typescript` (or alias `--pack ts`).

## Skills (7)

### Code & typing

| Skill | Purpose |
|---|---|
| [`ts-conventions`](skills/ts-conventions/SKILL.md) | Strict mode policy, no-any/no-enum, type over interface, discriminated unions, `satisfies`, branded types |
| [`ts-code-conventions`](skills/ts-code-conventions/SKILL.md) | Project-specific spacing around control structures, early return, continue vs if/else, explicit checks (no truthy/falsy) |

### Paradigms

| Skill | Purpose |
|---|---|
| [`ts-functional`](skills/ts-functional/SKILL.md) | Type-safe `pipe`, currying, `Result<T,E>`, railway-oriented error handling, `AsyncResult` |
| [`ts-oop`](skills/ts-oop/SKILL.md) | Tell Don't Ask in TS, collections over named properties, iterable collections via `Symbol.iterator`, self-descriptive value objects |
| [`ddd-ts-fp`](skills/ddd-ts-fp/SKILL.md) | Immutable aggregates as readonly types, curried domain operations, smart constructors (`make*`), validation/enrichment pipelines |
| [`ts-ddd-events`](skills/ts-ddd-events/SKILL.md) | Domain event structure, event store (append-only), outbox pattern for reliable publishing, consumer pattern |

### Refactoring

| Skill | Purpose |
|---|---|
| [`ts-refactoring`](skills/ts-refactoring/SKILL.md) | End-to-end flow analysis before refactoring, consumer-driven value-object design, value-object completeness checklist |

> Security audit for TS/NestJS was moved to [`audit:ts-security`](../audit/skills/ts-security/SKILL.md) so all audit concerns live in the same plugin.
