# jquery

jQuery code conventions: module structure, `js-*` selector hooks, per-block scoping, symmetric state toggles. Framework-agnostic (any backend / build system).

## Install

```text
/plugin install jquery@fabien-claude-marketplace
```

Or `./setup.sh --pack jquery` (dev mode).

## Skills (1)

| Skill | Purpose |
|---|---|
| [`jquery`](skills/jquery/SKILL.md) | One ES module per feature with an exported `init`, `js-*` selector classes (never form IDs, never `data-*` for hooks), per-block scoping via `.each()` + `find()`, original state captured in the closure, symmetric `toggleClass` over imperative show/hide helpers |

Ships two references: [`module-template.md`](skills/jquery/references/module-template.md) and [`anti-patterns.md`](skills/jquery/references/anti-patterns.md).

## When to use

Writing or modifying jQuery (`$(...)`, `$el.find(...)`, `$(document).ready(...)`), or a new feature whose page interaction is handled by jQuery. Not for vanilla JS, React/Vue/Astro, or template-engine / build-tool wiring: those belong with the backend framework's frontend skill.
