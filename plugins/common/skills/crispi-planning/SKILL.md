---
name: crispi-planning
description: ACTIVATE when starting complex multi-step tasks, features, or refactoring that need structured planning. ACTIVATE for 'plan', 'complex task', 'big feature', 'multi-step', 'CRISPI'. Provides a 5-phase planning framework (Context, Research, Implementation design, Structured plan, Implementation) with file persistence to avoid over-planning. DO NOT use for simple, single-file changes or quick fixes.
version: 1.0.0
---

# CRISPI Planning Framework

Structured 5-phase approach for complex tasks. Prevents over-planning by enforcing phase transitions with file persistence.

## When to Use

- Tasks requiring changes across 3+ files
- Features with unclear requirements or multiple valid approaches
- Refactoring that touches multiple modules
- Any task where you catch yourself exploring for more than 5 minutes

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
