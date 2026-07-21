# Choosing a planning / execution workflow

This marketplace ships several planning and delivery workflows whose scopes overlap. This guide maps **which one to reach for**, and how they relate so you don't double up.

## Deliver a feature or issue as code

| Workflow | What it is | Reach for it when |
|---|---|---|
| **`goal`** (`draft-issue` → `run-issue` → `/goal` → `next`) | Source (Jira / GitHub issue / spec file / note) → a grilled plan with a command-checkable Definition of Done and small functional iterations → autonomous `/goal` execution, one reviewable slice per fresh session, with an audit log | The requirement is fuzzy **or** you want to iterate across sessions, hand off, and audit. Git/commit/PR are opt-in. This is the full pipeline. |
| **`/spec-first-dev`** | Gated 5-phase spec-then-build, **interactive, single session**: understand the domain → explore the code → lock a validated spec → implement test-first against it | The requirement is fuzzy or the domain is unfamiliar, **but** you'll build it in one sitting and don't need a branch, per-iteration handoffs, or an execution log. The lighter path. |
| **`/feature-tdd-dev`** | TDD implementation loop (red → green → refactor) with an approval gate | The spec is **already clear** and iterations are known — no grilling needed, just drive the TDD. |

## Decide, interrogate, navigate (before you plan)

| Skill | Reach for it when |
|---|---|
| **`grill-me`** | A one-off decision (library choice, hook design, the shape of a refactor). Claude grills you one question at a time with a recommendation per branch. |
| **`grill-with-docs`** | Same, on a DDD project with a `CONTEXT.md` / `docs/adr/` to keep current. |
| **`goal:grill-adversarial`** | A **front / interactive** feature with many states — enumerates the `(state × action)` space and invariants before iterations freeze. Runs inside `goal:run-issue`, or standalone. |
| **`zoom-out`** | You don't know the area of code — get a map of the relevant modules and callers. |
| **`/research`** | Gather objective facts before deciding, kept separate from implementation. |

## Always-on discipline (fires during any workflow)

- **`systematic-debugging`** — a bug, failing test, or unexpected behavior → root-cause-first before any fix.
- **`verification-before-completion`** — evidence (a re-run command + its output) before claiming "done".

## Decision tree

```
Deliver a feature / issue as code?
├─ Fuzzy source, OR iterate across sessions / hand off / audit
│     → goal            (grills, builds the DoD, executes slice by slice)
├─ Fuzzy but built in ONE session, no branch/handoff machinery
│     → /spec-first-dev
└─ Spec already clear, iterations known
      → /feature-tdd-dev

Settle ONE decision (lib, hook, refactor shape)?   → grill-me / grill-with-docs
Don't know the area of code?                        → zoom-out
Complex NON-feature task (migration, large refactor)?
├─ carried across sessions, want a persisted phased plan → crispi-planning
└─ quick, one session                                    → native plan mode
Need facts before deciding?                         → /research
A bug?                                              → systematic-debugging (auto)
```

## How they overlap (so you don't double up)

- **`goal` subsumes `/spec-first-dev`'s grilling.** `goal:run-issue`'s Session-1 phases (understand → explore → specify) do the same spec-building work, then add autonomous execution. Use `/spec-first-dev` **only** when you want that conversation without `goal`'s branch / iteration / log machinery.
- **`/feature-tdd-dev` is the build phase without the grilling.** If the spec is clear, skip straight to it.
- **Non-feature tasks** (a migration, a large mechanical refactor, a tooling change) split by weight: `crispi-planning` when you want a **persisted, phased** plan carried across sessions; Claude Code's **native plan mode** for quick in-session planning. Neither is for feature work — that's `goal` / `/spec-first-dev`.
- **The grill family is layered:** `grill-me` for a single decision, `grill-with-docs` when domain docs exist, `goal:grill-adversarial` for a stateful feature's full interaction space.
