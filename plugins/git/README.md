# git

Transverse git & PR discipline for Claude Code. Centralizes the rules that were
scattered across the global `CLAUDE.md` and the former PR-creation skill into one skill,
built around the costliest recurring mistake: reasoning on **stale refs**.

## Install

```text
/plugin install git@fabien-claude-marketplace
```

Or `./setup.sh --pack git` (dev mode).

## Skills (1)

| Skill | Purpose |
|---|---|
| [`git`](skills/git/SKILL.md) | Fetch-before-reasoning on remote state, never ask what a command answers, branch/commit discipline, English conventional commits without AI trailer, PR conventions (French title, ultra-succinct body, draft for WIP, fork targets parent), force-push and worktree guardrails, manual index mode. Includes ❌/✅ anti-patterns and the canonical PR-body before/after example. |

> Merges the former PR-creation skill. Ships a blocking fetch-first PreToolUse
> hook (`hooks/fetch-first.sh`).
