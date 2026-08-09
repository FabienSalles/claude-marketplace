# pocock

Cherry-picked subset of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).

## Why a subset

Upstream now ships ~41 skills (≈22 "blessed" under `engineering/` + `productivity/`). Three are vendored here as **pinned snapshots**; the overlapping ones we evaluated are deliberately excluded:

| Skill | Status | Why |
|---|---|---|
| `grill-me` | ✅ kept | Inverts the usual "Claude proposes / user pushes back" loop: Claude grills until the design tree is resolved before any code |
| `grill-with-docs` | ✅ kept | `grill-me` + maintains `CONTEXT.md` glossary and ADRs inline as decisions crystallise |
| `zoom-out` | ✅ kept | One-shot user trigger to request a higher-level map of an unfamiliar area. Note: removed from upstream since; the vendored copy is a deliberately-kept orphan snapshot |
| `tdd` | ❌ skipped | Would be a 4th TDD framework alongside `php-tdd-workflow`, `vitest-tdd-workflow`, `common:feature-tdd-dev` → Claude hesitates |
| `diagnosing-bugs` (ex-`diagnose`) | ❌ skipped | Overlaps with `qa:phpstan-resolver` (PHP) and `superpowers:systematic-debugging` (language-agnostic) |
| `triage` / `improve-codebase-architecture` / `to-tickets` (ex-`to-issues`) / `to-spec` (ex-`to-prd`) / `prototype` / `handoff` / `writing-great-skills` (ex-`write-a-skill`) / `setup-matt-pocock-skills` | ❌ skipped | Out of scope (orthogonal workflows or covered elsewhere, e.g. `plugin-dev:skill-development` for skill authoring, `atlassian:capture-tasks-from-meeting-notes` for to-tickets) |

## When to use which

| Situation | Reach for |
|---|---|
| A one-off decision outside feature work (lib choice, hook design, isolated refactor) | `grill-me` |
| Same, on a DDD project with a `CONTEXT.md` / `docs/adr/` to keep current | `grill-with-docs` |
| Entering an unfamiliar area of the codebase | `zoom-out` (invoke explicitly) |
| A full feature | `/spec-first-dev` (house workflow, more structured than a grill) |

## Upstream

- Repo: https://github.com/mattpocock/skills
- Author: Matt Pocock
- License: MIT (preserved as `LICENSE`)

## How to refresh from upstream

```bash
cd /tmp
rm -rf mattpocock-skills-temp
git clone --depth 1 https://github.com/mattpocock/skills.git mattpocock-skills-temp
# Upstream has since restructured: grill-me / grill-with-docs are now thin wrappers
# over `grilling` + `domain-modeling`, and `zoom-out` was removed entirely.
# Diff the vendored grill-me / grill-with-docs against the upstream `grilling`/`domain-modeling`
# skills, port forward any meaningful changes, and bump version in .claude-plugin/plugin.json.
# `zoom-out` has no upstream counterpart anymore — keep it as a frozen snapshot.
```

## Notes on skill internals

- `grill-with-docs` ships sibling files `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` (included).
- `zoom-out` has `disable-model-invocation: true` frontmatter → never auto-triggers, only fires when the user explicitly invokes it.
- `grill-me` and `grill-with-docs` are similar; pick `grill-with-docs` when there's an existing `CONTEXT.md` / `docs/adr/` to maintain, otherwise `grill-me`.
