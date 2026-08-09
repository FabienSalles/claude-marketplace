# git

Transverse git & PR discipline for Claude Code. Centralizes the rules that were
scattered across the global `CLAUDE.md` and the former PR-creation skill into one skill,
built around the costliest recurring mistake: reasoning on **stale refs**.

## Install

```text
/plugin install git@fabien-claude-marketplace
```

## Skills (1)

| Skill | Purpose |
|---|---|
| [`git`](skills/git/SKILL.md) | Fetch-before-reasoning on remote state, never ask what a command answers, branch/commit discipline, English conventional commits without AI trailer, history shape (reshape before the first push, `--fixup` over fix-on-fix, ask before pushing a branch that repairs itself, reshape unasked under a non-manual policy), PR conventions (French title, ultra-succinct body, draft for WIP, fork targets parent), force-push and worktree guardrails, manual index mode. Includes ❌/✅ anti-patterns and the canonical PR-body before/after example. |

> Merges the former PR-creation skill. Ships a blocking fetch-first PreToolUse
> hook (`hooks/fetch-first.sh`).
