# pocock

Cherry-picked subset of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).

## Why a subset

The upstream plugin ships 14 skills. Three are pulled here; the others are deliberately excluded:

| Skill | Status | Why |
|---|---|---|
| `grill-me` | ✅ kept | Inverts the usual "Claude proposes / user pushes back" loop — Claude grills until the design tree is resolved before any code |
| `grill-with-docs` | ✅ kept | `grill-me` + maintains `CONTEXT.md` glossary and ADRs inline as decisions crystallise |
| `zoom-out` | ✅ kept | One-shot user trigger to request a higher-level map of an unfamiliar area |
| `tdd` | ❌ skipped | Would be a 4th TDD framework alongside `php-tdd-workflow`, `vitest-tdd-workflow`, `common:feature-tdd-dev` → Claude hesitates |
| `diagnose` | ❌ skipped | Overlaps with `qa:phpstan-resolver` (PHP) and `superpowers:systematic-debugging` (language-agnostic) |
| `triage` / `improve-codebase-architecture` / `to-issues` / `to-prd` / `prototype` / `caveman` / `handoff` / `write-a-skill` / `setup-matt-pocock-skills` | ❌ skipped | Out of scope (orthogonal workflows or covered elsewhere — e.g. `plugin-dev:skill-development` for skill authoring, `atlassian:capture-tasks-from-meeting-notes` for to-issues) |

## Upstream

- Repo: https://github.com/mattpocock/skills
- Author: Matt Pocock
- License: MIT (preserved as `LICENSE`)

## How to refresh from upstream

```bash
cd /tmp
rm -rf mattpocock-skills-temp
git clone --depth 1 https://github.com/mattpocock/skills.git mattpocock-skills-temp
# Manually diff /tmp/mattpocock-skills-temp/skills/{productivity/grill-me,engineering/grill-with-docs,engineering/zoom-out}
# against this plugin's skills/, port forward any meaningful changes,
# and bump version in .claude-plugin/plugin.json.
```

## Notes on skill internals

- `grill-with-docs` ships sibling files `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` — included.
- `zoom-out` has `disable-model-invocation: true` frontmatter → never auto-triggers, only fires when the user explicitly invokes it.
- `grill-me` and `grill-with-docs` are similar; pick `grill-with-docs` when there's an existing `CONTEXT.md` / `docs/adr/` to maintain, otherwise `grill-me`.
