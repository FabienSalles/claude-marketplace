---
name: context-window-management
description: ACTIVATE when context is getting long, when quality of responses degrades, when working on large codebases, or when a session has been running for 30+ minutes. ACTIVATE for 'context too long', 'losing track', 'fresh session', 'context window'. Provides rules for managing context utilization to maintain response quality. DO NOT use at the start of short sessions.
version: 1.0.0
---

# Context Window Management

Rules for maintaining response quality as conversations grow.

## Warning Signs

- You're re-reading files you already read earlier in the session
- Responses start missing details or contradicting earlier decisions
- The user has to repeat instructions
- You lose track of what was already done vs what remains

## Rules

### 1. Offload to Files

Never keep large outputs only in context. Write them to files:
- Plans → `.claude/plans/<name>.md`
- Research findings → `.claude/research/<name>.md`
- Progress tracking → update plan checkboxes or task lists

### 2. Suggest Fresh Sessions

When you notice degradation, proactively suggest:
> "The context has grown long. I recommend saving the current progress and continuing in a fresh session."

Before suggesting, ensure you've saved:
- Current progress (what's done, what remains)
- Key decisions made
- Any blockers or open questions

### 3. Read Selectively

- Don't read entire files when you need a specific function
- Use `offset` and `limit` parameters on Read
- Use Grep to find specific sections instead of reading whole files
- Prefer Glob over recursive directory reads

### 4. Minimize Tool Output Bloat

- Use `head_limit` on Grep results
- Avoid running commands that produce large output (e.g., `npm install` verbose)
- When a command produces unexpected large output, summarize and move on

### 5. Session Handoff Template

When suggesting a fresh session, save this to `.claude/plans/<task>-handoff.md`:

```markdown
## Session Handoff — <task>

### Completed
- [what was done]

### In Progress
- [current step, what's partially done]

### Remaining
- [what still needs to be done]

### Key Decisions
- [decisions made and why]

### Resume Instructions
Start by reading this file, then continue from "In Progress".
```
