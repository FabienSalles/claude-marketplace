---
description: Step 0 of the goal workflow — normalize any planning source (Jira US, spec file, PRD/BMAD story, brainstorm, inline note) into a clean structured spec, and OPTIONALLY mirror it as a GitHub issue. GitHub is opt-in, never forced.
argument-hint: A source — Jira key (CT-1234), a spec path (.claude/plans/x-spec.md), or 'inline'
---

# /goal:draft-issue — Source → Normalized spec (+ optional GitHub issue)

You are turning a raw planning artifact into a clean, structured spec that
`/goal:run-issue` can consume. Creating a GitHub issue from it is **optional** — you
**ask**, you never impose it.

This sits at the upstream end of the chain:

```
(idea / Jira US / PRD / BMAD story / brainstorm)
   └─ /goal:draft-issue ← YOU ARE HERE
        ├─ normalized spec written to .claude/plans/<work-id>-spec.md   (always)
        └─ GitHub issue mirror                                          (only if the developer says yes)
             └─ /goal:run-issue <source>
                  └─ /goal  (per iteration)
```

## Argument — resolve the source

Source: `$ARGUMENTS`

| `$ARGUMENTS` shape | How to read it | work-id |
|---|---|---|
| Jira key `^[A-Z][A-Z0-9]+-[0-9]+$` (e.g. `CT-1234`) | Atlassian MCP — see below | key lowercased → `ct-1234` |
| A path ending in `.md` | Read the file | ≤40-char kebab slug of the title |
| `inline` or empty | Ask the developer to paste the source now | ≤40-char kebab slug of the title |
| A path that doesn't exist | STOP and tell the developer | — |

**Reading a Jira source via MCP:** load the Atlassian tools with `ToolSearch`
(`select:getAccessibleAtlassianResources,getJiraIssue`), get the `cloudId`, then
`getJiraIssue` with the key. Pull summary, description, acceptance criteria, and
comments. If the MCP is unreachable, STOP and ask the developer to paste the US
with `inline`.

## Phase 0 — Preconditions

- `git rev-parse --show-toplevel` succeeds (we're in a repo)
- **Only if the source is Jira:** the Atlassian MCP resolves
- **Do NOT check `gh` here.** GitHub is only touched in Phase 4, and only if the
  developer opts in.

If a needed check fails, STOP and say what to fix.

## Phase 1 — Read & extract

Normalize the source into these sections (headings vary by upstream tool):

| Target section | Upstream synonyms |
|---|---|
| **Title** | first `# …`, BMAD `story.title`, spec-first "Feature", Jira summary |
| **Problem** | "Why", "Context", "Background", "Pain", the incident that triggered the ticket |
| **Objective** | "Goal", "Outcome", "Definition of success", BMAD `story.description` |
| **Success signal** | "How we'll know", "Metric", "KPI" — rarely present, usually to be built |
| **Affected** | "Users", "Personas", "Impacted teams", the caller named in a bug report |
| **Business intent** | the prose that connects the four above, Jira description |
| **Scope IN** | "In scope", "Requirements", BMAD `acceptance_criteria` (positive), Jira AC |
| **Scope OUT** | "Out of scope", "Non-goals", "Will not do" |
| **Acceptance criteria** | "Done when", "Success criteria", Jira AC |
| **Files to touch** (optional) | "Files to create/modify", "Affected files" |
| **Decisions** (optional) | "Q&A", "Clarifications", Jira comment thread |

Note which target sections the source is **missing** — a Jira US usually lacks a
real Definition of Done and often has functional gaps. Don't fill them here;
flag them so `/goal:run-issue` grills them.

## Phase 2 — Validate completeness

| Issue | Severity | Action |
|---|---|---|
| Empty business intent | ❌ blocker | Ask the developer to provide it now |
| **Problem asserted with no evidence** ("it would be better if…") | ❌ blocker | A problem nobody can point at has no way to be closed. Ask for the incident, the measurement, the file and line. |
| **Objective written as a solution** ("rewrite X in Y") | ⚠️ warn | Ask what must become *true*. A solution stated as an objective freezes a design before the grill has looked at it. |
| No success signal | ⚠️ warn | Note it. Acceptance criteria prove code runs; they never prove the problem is gone. |
| No acceptance criteria at all | ⚠️ warn | Fine to defer — `/goal:run-issue` builds the DoD; note it |
| Scope IN/OUT mixed | ⚠️ warn | Propose a split |
| Criteria not command-line verifiable ("code is clean") | ℹ️ info | Note for `/goal:run-issue` to make concrete |

Resolve blockers with the developer before Phase 3. Warnings/infos are fine to
carry forward — `/goal:run-issue` is where the DoD gets built.

## Phase 3 — Write the normalized spec

Always write `.claude/plans/<work-id>-spec.md`:

```markdown
# Spec (draft): <title>

Source: <Jira CT-1234 | spec file path | inline>
Work-id: <work-id>
Status: draft — pass through /goal:run-issue to build the Definition of Done and iterations.

## Business intent

**Problem.** <what fails today, with the evidence you can point at — an incident, a
measurement, a file and a line. Never "it would be better if".>

**Objective.** <what must become *true*. An outcome, not a solution: "a locked plan runs
overnight and I wake up to PRs or a diagnosis", not "replace the loop with a script".>

**Success signal.** <how you would know it worked out in the real world. Distinct from the
acceptance criteria, which only ever prove that code runs.>

**Affected.** <who lives with the problem today, and what changes for them.>

<Then 1–3 paragraphs connecting the problem to the objective, in the developer's own domain
vocabulary.>

## Scope IN
- <items>

## Scope OUT
- <items>

## Acceptance criteria (as found — may be incomplete)
- <items, or "none in source — /goal:run-issue will build the DoD">

## Files (suspected)
- `<path>` — <role>

## Gaps flagged for /goal:run-issue
- <functional gap / missing DoD / technical consequence to grill>

## Adversarial grill
- <requested | not requested>   (decided in Phase 3b; /goal:run-issue reads this line)

## Notes / decisions from source
- <Q/A or comment-thread decision worth preserving>
```

Show the title and the spec to the developer, and read the **Business intent** block back to
them explicitly. It is the one section nothing downstream can reconstruct: `/goal:run-issue`
can build a Definition of Done from scope and criteria, but it cannot invent why the work
matters or how anyone would know it worked.

## Phase 3b — Ask: run the adversarial grill in /goal:run-issue? (opt-in)

The default grill resolves the branches that get **raised**. It does **not**
enumerate the interaction state space — so broken invariants and broken execution
schemas (interface/usage incoherence) slip through and surface later as rework.
The `grill-adversarial` skill closes that gap, but it is heavy — so it is **opt-in**.

Ask the developer with `AskUserQuestion`:

> **Run the adversarial grill on this spec in `/goal:run-issue`?**
> - **yes (recommended for front / interactive work, or when unsure)** — `/goal:run-issue`
>   will load `grill-adversarial`: enumerate states, extract invariants, build the
>   `(state × action)` transition matrix, and turn every hole into an owned + tested
>   rule. Take altitude and question everything, including what was never defined.
> - **no** — small US whose scenarios you fully enumerate and are confident about;
>   or pure back / transactional work where actions are coarse and server-owned.

Recommend **yes** whenever the feature is **front / interactive**, state lives
client-side, or Phase 2 flagged functional gaps. Write the answer verbatim into the
spec's **`## Adversarial grill`** line (`requested` / `not requested`) so `/goal:run-issue`
picks it up without asking again.

## Phase 4 — Ask: create a GitHub issue? (opt-in)

Ask explicitly:

> **Do you also want a GitHub issue mirroring this spec?**
> - **no** (default) — keep it local; go straight to `/goal:run-issue`.
> - **yes** — I'll `gh issue create` from the spec. (Optional: labels, milestone,
>   assignee — I create nothing you didn't name.)

WAIT for the answer.

If **no** → skip to Phase 5 with no GitHub involvement.

If **yes**:
1. Now verify `gh auth status` and that `gh repo view` works. If either fails,
   STOP, report, and fall back to the local-only handoff.
2. Render the issue body from the spec (same sections), write it to a temp file:
   ```bash
   TMP=$(mktemp -t draft-issue-XXXXXX.md)
   ```
3. Create it:
   ```bash
   gh issue create --title "<title>" --body-file "$TMP" \
     [--label "<labels>"] [--milestone "<milestone>"] [--assignee "<assignee>"]
   ```
4. Capture the issue number `<N>`. From now on the work-id is `issue-<N>`; rename
   the spec to `.claude/plans/issue-<N>-spec.md` so `/goal:run-issue <N>` finds it.

Do **not** auto-create labels/milestones/assignees — only what the developer named.

## Phase 5 — Handoff

The developer has to be able to tell, from this output alone, **what now exists, what
deliberately does not yet, and the single next command.** Print exactly that shape, and make
the command the last thing on screen — nothing after it, no commentary, no summary.

```
✓ Draft spec written — .claude/plans/<work-id>-spec.md
✓ GitHub issue created — <URL>            (omit this line when local-only)

This spec has
  · the need — problem, objective, success signal, who is affected
  · scope IN and scope OUT
  · the acceptance criteria found in the source (<K> of them, or "none")
  · <G> gaps flagged for the grill
  · adversarial grill: <requested | not requested>

It deliberately does NOT have yet
  · no Definition of Done — /goal:run-issue builds it
  · no iterations, no branch, no code
  · nothing is committed and nothing was pushed

Next
    /goal:run-issue <N or work-id>
```

Fill `<K>` and `<G>` with the real counts, and name the two or three gaps that will cost the
most to resolve — a developer who reads "7 gaps" learns nothing, one who reads "no DoD in the
source, and the flag mechanism is undecided" knows what the next session will ask them.

If the source was local-only, drop the issue line and use the work-id in the command.

## Rules

- **GitHub is opt-in.** Never call `gh` unless the developer said yes in Phase 4.
- **Do not push code or create branches** — that's `/goal:run-issue`'s job.
- **Do not fabricate the DoD here** — flag gaps; `/goal:run-issue` builds it during the grill.
- **The adversarial grill is opt-in** — you only *ask* (Phase 3b) and record the
  answer; `/goal:run-issue` runs it. Recommend it for front / interactive features, where
  unmodelled invariants and transitions cause the most rework.
- **Standalone** — needs only a git repo, plus the Atlassian MCP for a Jira source
  and `gh` only for the opt-in issue.
- **Never assert a problem the source did not evidence.** If it says "improve X", the problem
  is missing and Phase 2 blocks. Inventing a plausible one puts a fabricated premise at the
  head of a chain that will never re-examine it.
- **The handoff command is the last line you print.** Anything printed after it buries the
  one thing the developer came for.
