---
name: crispi-planning
description: ACTIVATE when planning a complex, multi-file task that is NOT a single feature — a migration, a cross-cutting refactor, a tooling/build change — where you want a phased plan persisted to .claude/plans/ across sessions. ACTIVATE for 'CRISPI', 'structured plan', 'plan this migration', 'plan this refactor'. Provides the 5-phase CRISPI framework (Context, Research, Implementation design, Structured Plan, Implementation). DO NOT use for a single feature or issue (use goal or /spec-first-dev), simple single-file changes, or quick in-session planning (use native plan mode).
version: 1.0.0
---

# CRISPI Planning Framework

**CRISPI** = **C**ontext · **R**esearch · **I**mplementation design · **S**tructured **P**lan · **I**mplementation.

A structured 5-phase approach for a complex task, persisted to a plan file. It prevents over-planning by time-boxing each phase.

## When to Use

Reach for CRISPI on a **complex, multi-file task that is not a single feature** and that you'll carry across sessions:

- A migration, a cross-cutting refactor touching multiple modules, a tooling/build change
- Tasks requiring changes across 3+ files where a persisted, phased plan pays off
- Any task where you catch yourself exploring for more than 5 minutes

**Not for:** a single feature or issue — use [`goal`](../../../goal/README.md) (iterated) or [`/spec-first-dev`](../../commands/spec-first-dev.md) (single session). For quick in-session planning, use Claude Code's native plan mode. See [`docs/workflows-decision-guide.md`](../../../../docs/workflows-decision-guide.md).

## The 5 Phases

### Phase 1: Context (max 5 min)

Understand what exists. Read only the files directly relevant to the task.

**Output:** Save to `.claude/plans/<task-name>-context.md`
```markdown
## Context
- What exists: [key files, current behavior]
- What's requested: [exact scope from user]
- Constraints: [tech stack, patterns to follow, deadlines]
```

### Phase 2: Research (max 10 min)

Investigate unknowns identified in Context. Search for patterns, dependencies, similar implementations.

**Output:** Append to the plan file
```markdown
## Research Findings
- Pattern to follow: [existing pattern found in codebase]
- Dependencies: [what this touches]
- Risks: [what could go wrong]
```

### Phase 3: Implementation Design (max 5 min)

Decide the approach. One approach, not three alternatives.

**Output:** Append to the plan file
```markdown
## Design Decision
- Approach: [chosen approach]
- Why: [1-2 sentences]
- Files to change: [ordered list]
```

When you accept complexity — an abstraction, a new dependency, an extra layer, a generalization beyond the current need — justify it in a Complexity Tracking table. Leave it empty when there is nothing to justify.

```markdown
## Complexity Tracking
| Complexity accepted | Why needed | Simpler alternative rejected because |
|---|---|---|
| [what] | [the concrete need] | [why the simpler option doesn't cover it] |
```

### Phase 4: Structured Plan (max 5 min)

Break into ordered, testable steps. Each step should leave the codebase in a working state.

**Output:** Append to the plan file
```markdown
## Steps
1. [ ] [Step description] → [file(s)] → [how to verify]
2. [ ] ...
```

### Phase 5: Implementation

Execute the plan. Update checkboxes as you go. If you discover something that changes the plan, update the plan file before continuing.

## Rules

- **No phase skipping.** But phases can be very short (1 min each for simpler tasks).
- **File persistence is mandatory.** If context gets long, the plan file is your lifeline.
- **One approach, not three.** Pick and commit. Revisit only if implementation proves it wrong.
- **Max 25 min total for phases 1-4.** If planning takes longer, the task needs to be split.
