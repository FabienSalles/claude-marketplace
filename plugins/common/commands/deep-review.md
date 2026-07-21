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

## Step 1b: Plan-Alignment Pre-Pass (when a plan is available)

If a plan, spec, or acceptance criteria are available — passed as an argument, referenced in the commit message / PR body, or found at a known path — ingest them. If none are available, mark this pass **"Not run"** and continue; **never invent criteria**.

When criteria exist:
- For **each** acceptance criterion, check `[x]` only when the diff shows evidence, citing the `file:line`; leave `[ ]` when unmet, naming the gap.
- Flag every change in the diff that traces to **no** criterion as **scope-creep** — behavior delivered that nobody asked for (the over-engineering axis).
- **Verdict gate:** an unmet criterion that matters (tagged `fix`) blocks an `approve` — report it as a finding, not a pass.

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
- **Tests**: Missing coverage for edge cases, brittle tests. Ask: *if the behavior this change produces broke where it's actually used, would any test fail?* Trace the changed behavior to its nearest observable boundary. **Read the actual test before claiming what it covers** (or prove its absence by symbol search) — never assert "covered" or "missing" from the diff alone.

Rules for the reviewer:
- Minimum 3 findings, maximum 10
- Each finding must include: file:line, severity (critical/major/minor), description, suggested fix
- **Rate from the real call site, not the diff hunk.** Before assigning severity, read the surrounding code — call sites, guards, existing validation — outside the changed lines. Severity reflects the real consequence at a real call site, not the worst theoretical reading.
- Put **pre-existing** issues not caused by these changes in a separate `defer` bucket — note them, don't rate them as findings of this change.
- Do NOT report: style issues, missing docstrings, naming preferences

## Step 4: Agent 3 — Meta-Reviewer (Filter)

Launch an agent that receives both the Builder summary and the Reviewer findings. It should:
- Remove false positives (issues that aren't actually issues given the context)
- Remove nitpicks (minor issues that aren't worth the review noise)
- Merge duplicates
- Rank remaining issues by impact
- Carry the plan-alignment verdict (or "Not run") through: an unmet `fix` criterion prevents an overall approve
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
**Plan-alignment:** N/M criteria met (or "Not run") · Unmet: [list or none] · Scope-creep: [list or none]
Reviewed X files, Y lines changed. Z findings after filtering.
```
