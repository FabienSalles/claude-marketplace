# frontend

Frontend clean architecture (hexagonal), React component patterns, and best practices for safely editing existing UI.

## Install

```text
/plugin install frontend@fabien-claude-marketplace
```

Or `./setup.sh --pack frontend` (dev mode).

## Skills (3)

| Skill | Purpose |
|---|---|
| [`frontend-clean-architecture`](skills/frontend-clean-architecture/SKILL.md) | `features/<feature>/domain + infrastructure` layout, strict dependency direction, domain models/repositories/services/referentials, mappers, hooks as orchestrators |
| [`frontend-component-patterns`](skills/frontend-component-patterns/SKILL.md) | Container vs Presentation criteria, when to extract custom hooks (3+ related states), when to split markup (150+ lines), form section props convention |
| [`frontend-best-practices`](skills/frontend-best-practices/SKILL.md) | Editing existing UI without regressions (add-not-modify), surfacing conflicting constraints upfront, autonomous visual debugging via Chrome DevTools MCP |
