---
description: "Adversarial 3-agent code review — produces ~2 high-impact comments per PR"
allowed-tools: Agent, Read, Grep, Glob, Bash
---

# Deep Review — Adversarial Code Review

You will perform a 3-pass adversarial code review on the current changes (or a specified PR).

## Step 1: Identify Changes

If an argument was provided (PR number or branch), use it. Otherwise, review the current uncommitted changes or the last commit.

```bash
# For uncommitted changes:
git diff --stat
git diff

# For last commit:
git log -1 --stat
git show HEAD

# For a PR:
gh pr diff <number>
```

## Step 2: Agent 1 — Builder Perspective

Launch an agent that reads the changes as if it wrote them. It should:
- Understand the intent of each change
- Identify the design decisions made
- Note any assumptions embedded in the code
- Output: A summary of what was done and why (best guess)

## Step 3: Agent 2 — Adversarial Reviewer

Launch an agent that reviews the changes with a critical eye. It should find issues in these categories:
- **Bugs**: Logic errors, off-by-one, null handling, race conditions
- **Security**: Injection, auth bypass, data exposure (OWASP Top 10)
- **Architecture**: Coupling, SOLID violations, pattern inconsistency
- **Performance**: N+1 queries, unnecessary allocations, missing indexes
- **Tests**: Missing coverage for edge cases, brittle tests

Rules for the reviewer:
- Minimum 3 findings, maximum 10
- Each finding must include: file:line, severity (critical/major/minor), description, suggested fix
- Do NOT report: style issues, missing docstrings, naming preferences

## Step 4: Agent 3 — Meta-Reviewer (Filter)

Launch an agent that receives both the Builder summary and the Reviewer findings. It should:
- Remove false positives (issues that aren't actually issues given the context)
- Remove nitpicks (minor issues that aren't worth the review noise)
- Merge duplicates
- Rank remaining issues by impact
- Output: Final list of ~2-5 high-impact findings

## Step 5: Output

Present the final findings in this format:

```
## Deep Review — [scope description]

### Finding 1: [title]
**Severity:** critical/major
**Location:** `file:line`
**Issue:** [clear description]
**Fix:** [concrete suggestion]

### Finding 2: ...

---
Reviewed X files, Y lines changed. Z findings after filtering.
```
