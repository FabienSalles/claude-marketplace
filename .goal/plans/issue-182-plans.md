# Plans: The gate's commands leave no process behind, except the services a plan declares

Work-id: issue-182
Written by /goal:plan on 2026-10-10. Ordering only — each plan is authoritative about
itself, and its own `Trigger:` line is what a run reads.

## Order

0. `/Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/issue-182-spec.md` — the functional contract both plans execute. Not a plan: never launched.
1. `/Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/issue-182-reap-spec.md` — nothing a declared command started outlives it. Nothing waits on it.
2. `/Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/issue-182-services-spec.md` — declared services. Waits on plan 1's pull request being merged.

## Launch

```bash
/goal:supervise /Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/issue-182-reap-spec.md
# once its pull request is merged, from a fresh origin/main:
/goal:supervise /Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/issue-182-services-spec.md
```
