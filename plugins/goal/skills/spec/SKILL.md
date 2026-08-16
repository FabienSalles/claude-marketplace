---
name: spec
description: Functional contract of the goal workflow — normalize any planning source (Jira US, GitHub issue, spec file, PRD/BMAD story, a ticket cut by /goal:tickets, brainstorm, inline note), grill the functional gaps closed one question at a time, build the functional Definition of Done (an observable acceptance criterion per business rule — no project command named here), run the opt-in adversarial grill, and OPTIONALLY mirror the intent as a GitHub issue. Technical grill, decomposition and the locked plan are /goal:plan's.
---

## Portability

This skill degrades gracefully outside Claude Code:

- No `AskUserQuestion` tool → ask the question in plain text and wait for the reply.
- No Atlassian MCP → ask the developer to paste the Jira source inline (see the
  `$ARGUMENTS` table below, which already routes to this fallback).
- No `pbcopy` → print the content instead of copying it to the clipboard.

# /goal:spec — Source → functional contract (+ optional GitHub issue)

You are turning a raw planning artifact into the **functional contract** that
`/goal:plan` executes against: the need, the scope, the business rules, and a
**functional Definition of Done** — one observable acceptance criterion per rule.
Creating a GitHub issue from it is **optional** — you **ask**, you never impose it.

This is the level where **what must become true** is settled. **How** it is proven
(commands), decomposed and delivered is `/goal:plan`'s level, and stays out of this
session entirely.

```
(chantier too big for one spec)
   └─ /goal:tickets ─▶ ordered backlog; each ticket lands here at its turn
(idea / Jira US / GitHub issue / PRD / BMAD story / brainstorm)
   └─ /goal:spec ← YOU ARE HERE
        ├─ functional contract written to .claude/plans/<work-id>-spec.md   (always)
        └─ GitHub issue mirror                                             (only if the developer says yes)
             └─ /goal:plan <source>
                  └─ manual: /goal + /goal:next · commit+pr: /goal:supervise
```

## Argument — resolve the source

Source: `$ARGUMENTS`

| `$ARGUMENTS` shape | How to read it | work-id |
|---|---|---|
| Jira key `^[A-Z][A-Z0-9]+-[0-9]+$` (e.g. `CT-1234`) | Atlassian MCP — see below | key lowercased → `ct-1234` |
| Bare integer `42` or `#42` | `gh issue view 42 --json number,title,body,labels,comments` (needs `gh auth`) | `issue-42` |
| A backlog written by `/goal:tickets` (file starts `# Backlog:`) | Take the ticket marked `← next` — and only it. The rest of the backlog is context, not scope | ≤40-char kebab slug of the ticket title |
| Any other path ending in `.md` | Read the file | ≤40-char kebab slug of the title |
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
- **Only if the source is a GitHub issue:** `gh auth status` succeeds
- **Do NOT check `gh` otherwise.** GitHub as an *output* is only touched in
  Phase 5, and only if the developer opts in.

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
real Definition of Done and often has functional gaps. Missing functional
sections are not carried forward as flags: Phase 3 grills them closed **here**,
while the developer is present. Only *technical* consequences you notice while
reading (a migration, a coupling, a contract change) are flagged, for
`/goal:plan`.

### Size verdict — one outcome, or a chantier?

Before grilling, rule on size. A spec covers **one outcome**: one success signal,
one delivery. When the source carries **several independent outcomes** — parts
that each have their own success signal and could ship weeks apart — or no single
success signal at all, it is a **chantier**: STOP and route to `/goal:tickets`,
which cuts it into an ordered backlog and sends each ticket back here at its
turn. Grilling a chantier as one spec freezes guesses about parts nobody has
learned anything about yet.

When the verdict is borderline or the developer disputes it, load
`product:vertical-slice` and judge with it: parts that only mean something
together are one outcome; parts that ship alone and stay valuable alone are a
chantier's tickets.

### Reproduce the problem

Before anything is graded against it, reproduce the Problem the source states — the
same commands and readings the source's own evidence points at, or the ones the
developer names when it doesn't. Record each command run and the value it produced;
that pair, verbatim, is what Phase 4 writes into `## Reproduction`. A problem that
cannot be pointed at with a command is still caught by Phase 2's blocker for
unevidenced problems — this step is for one that *can* be pointed at, and no longer
shows what the source says it shows.

## Phase 2 — Validate the need

| Issue | Severity | Action |
|---|---|---|
| Empty business intent | ❌ blocker | Ask the developer to provide it now |
| **Problem asserted with no evidence** ("it would be better if…") | ❌ blocker | A problem nobody can point at has no way to be closed. Ask for the incident, the measurement, the file and line. |
| **Problem does not reproduce** (the commands run in Phase 1 now show something the source didn't claim, or already fixed) | ❌ blocker | STOP. Say what changed since the source was written, and do not write a contract against a premise that no longer holds. |
| **Objective written as a solution** ("rewrite X in Y") | ⚠️ warn | Ask what must become *true*. A solution stated as an objective freezes a design before the grill has looked at it. |
| No success signal | ⚠️ warn | Note it. Acceptance criteria prove behavior is in place; they never prove the problem is gone. |
| No acceptance criteria at all | ⚠️ warn | Fine — Phase 3 builds the functional DoD; that is this session's deliverable |
| Scope IN/OUT mixed | ⚠️ warn | Propose a split |
| Criteria not observable ("code is clean") | ℹ️ info | Rewrite as observable behavior in Phase 3; `/goal:plan` maps it to a command later |

Resolve blockers with the developer before Phase 3.

## Phase 3 — Functional grill (one question at a time)

Goal: **close every functional gap**, so that `/goal:plan` never has to ask a
functional question — once decomposition starts, a functional hole is rework.
Technical consequences are NOT grilled here: when one surfaces, write it under
`## Flags for /goal:plan` and move on.

Pick the best available interview approach, in order:

1. **`pocock:grill-with-docs`** if installed AND `CONTEXT.md`/`docs/adr/` exist.
2. **`pocock:grill-me`** if installed.
3. **`common:spec-first-dev` Phase 1 questions** if `common` is installed.
4. **Inlined baseline** (below) — always works.

### Inlined baseline questions (fallback)

Ask one at a time, each with your recommended answer. Skip anything the source
already answers.

- Who triggers this? (end user / admin / batch / external system)
- Precise end-to-end happy path, step by step?
- Which **business rules** apply? (validations, computations, conditions, limits)
- Vocabulary: project-specific terms to align with? Where do they live?
- Business edge cases (not technical — real domain cases)?
- What is explicitly **out of scope** for this delivery?
- For each business rule: **what would you observe** to know it holds?
  Behavior, not a command — naming the command is `/goal:plan`'s job.

### Stop condition

Stop grilling when: every functional gap is closed, every business rule carries
an observable acceptance criterion, and no "it depends" remains. Typical: 5–15
questions for a small US, more for a feature. **One question per message** —
batch questionnaires reduce signal. A question the developer explicitly defers
is recorded under `## Deferred decisions` with what was assumed instead — never
silently dropped.

## Phase 3b — Adversarial grill (opt-in, runs HERE)

The baseline grill resolves the branches that get **raised**. It does not
enumerate the interaction state space — so broken invariants and broken
execution schemas (interface/usage incoherence) slip through and surface later
as rework. The `goal:grill-adversarial` skill closes that gap, and this is the
one place it runs: before anything downstream freezes. It is heavy — so it is
**opt-in**.

Ask the developer with `AskUserQuestion`:

> **Run the adversarial grill on this spec now?**
> - **yes (recommended for front / interactive work, or when unsure)** —
>   enumerate states, extract invariants, build the `(state × action)`
>   transition matrix, and turn every hole into an owned rule with an
>   observable criterion. Take altitude and question everything, including
>   what was never defined.
> - **no** — small US whose scenarios you fully enumerate and are confident
>   about; or pure back / transactional work where actions are coarse and
>   server-owned.

Recommend **yes** whenever the feature is **front / interactive**, state lives
client-side, or Phase 1 flagged functional gaps. If yes → load
**`goal:grill-adversarial`** and run it to termination; its states, invariants
and transition matrix land in the contract below. Either way, record the
outcome on the contract's `Adversarial grill:` line (`ran` / `skipped — <why>`),
so `/goal:plan` and any later reader know whether the state space was
enumerated or waved through.

## Phase 4 — Write the functional contract

Always write `.claude/plans/<work-id>-spec.md`:

````markdown
# Spec: <title>

Source: <Jira CT-1234 | gh issue #42 | spec file path | ticket <rank> of <chantier-id> | inline>
Work-id: <work-id>
Status: spec — functional contract settled; /goal:plan builds the executable plan.
Adversarial grill: <ran | skipped — why>

## Business intent

**Problem.** <what fails today, with the evidence you can point at — an incident, a
measurement, a file and a line. Never "it would be better if".>

**Objective.** <what must become *true*. An outcome, not a solution: "a locked plan runs
overnight and I wake up to PRs or a diagnosis", not "replace the loop with a script".>

**Success signal.** <how you would know it worked out in the real world. Distinct from the
acceptance criteria, which only ever prove that behavior is in place.>

**Affected.** <who lives with the problem today, and what changes for them.>

<Then 1–3 paragraphs connecting the problem to the objective, in the developer's own domain
vocabulary.>

## Reproduction
<the exact commands run in Phase 1, each followed by the value it produced — the same evidence
the Problem line points at, kept alongside it so /goal:plan and any later reader can re-run it>

## Scope IN
- <items>

## Scope OUT
- <items>

## Business rules (functional DoD — one observable criterion per rule)
- <rule> → observed when: <the behavior a human or a test can watch. No command named here — /goal:plan maps each criterion to one>

## States, invariants & transitions (only if the adversarial grill ran)
- **States:** <S1…Sk>
- **Invariants:** <I1…In — each with its owner; front-only ⇒ the front owns it>
- **Transition matrix:** <(state × action) → resulting state / blocked / invariant preserved>

## Deferred decisions
- <question the developer chose not to settle now, and what was assumed instead — or "none">

## Files (as found in source)
- `<path>` — <role — only when the source named them; suspecting files is /goal:plan's job>

## Flags for /goal:plan
- <technical consequence noticed while reading — a migration, a cross-repo coupling, a contract change>

## Notes / decisions from source
- <Q/A or comment-thread decision worth preserving>
````

Show the title and the contract to the developer, and read the **Business
intent** block back to them explicitly. It is the one section nothing downstream
can reconstruct: `/goal:plan` can map rules to commands, but it cannot invent
why the work matters or how anyone would know it worked. WAIT for their
confirmation before Phase 5.

## Phase 5 — Ask: create a GitHub issue? (opt-in)

Ask explicitly:

> **Do you also want a GitHub issue mirroring this contract?**
> - **no** (default) — keep it local; go straight to `/goal:plan`.
> - **yes** — I'll `gh issue create` from it. (Optional: labels, milestone,
>   assignee — I create nothing you didn't name.)

WAIT for the answer.

If **no** → skip to Phase 6 with no GitHub involvement.

If **yes**:
1. Now verify `gh auth status` and that `gh repo view` works. If either fails,
   STOP, report, and fall back to the local-only handoff.
2. Render the **intent projection** — and only it — into a temp file. The projection is
   `## Business intent`, `## Scope IN`, `## Scope OUT` and the flags: the sections that will
   still be true in three weeks. Add one closing line saying the executable plan lives locally
   (gitignored) and that the pull request body is where the delivered work is read.

   Everything `/goal:plan` will later produce — the command-mapped Definition of Done, the
   iterations, the `gate` blocks — stays **out**. Those change at every slice, and an issue
   holding a copy of them is wrong by the second commit while looking authoritative. The issue
   is the log; the PR is the deliverable.

   ```bash
   TMP=$(mktemp -t goal-spec-XXXXXX.md)
   ```
3. Create it:
   ```bash
   gh issue create --title "<title>" --body-file "$TMP" \
     [--label "<labels>"] [--milestone "<milestone>"] [--assignee "<assignee>"]
   ```
4. Capture the issue number `<N>`. From now on the work-id is `issue-<N>`; rename
   the spec to `.claude/plans/issue-<N>-spec.md` so `/goal:plan <N>` finds it.

Do **not** auto-create labels/milestones/assignees — only what the developer named.

## Phase 6 — Handoff

The developer has to be able to tell, from this output alone, **what now exists, what
deliberately does not yet, and the single next command.** Print exactly that shape, and make
the command the last thing on screen — nothing after it, no commentary, no summary.

```
✓ Functional contract written — .claude/plans/<work-id>-spec.md
✓ GitHub issue created — <URL>            (omit this line when local-only)

This contract has
  · the need — problem, objective, success signal, who is affected
  · scope IN and scope OUT
  · <R> business rules, each with an observable acceptance criterion
  · states, invariants & transitions        (omit when the adversarial grill was skipped)
  · <D> deferred decisions and <F> flags for /goal:plan

It deliberately does NOT have yet
  · no command-mapped Definition of Done — /goal:plan gives every criterion its command
  · no iterations, no branch, no code
  · nothing is committed and nothing was pushed

Next
    /goal:plan <N or work-id>
```

Fill `<R>`, `<D>` and `<F>` with the real counts, and name the two or three flags that will
cost the most to resolve — a developer who reads "4 flags" learns nothing, one who reads
"the export coupling is unconfirmed, and the flag mechanism is undecided" knows what the next
session will ask them.

If the source was local-only, drop the issue line and use the work-id in the command.

## Rules

- **GitHub as output is opt-in.** Never call `gh` to create anything unless the developer
  said yes in Phase 5.
- **Do not write production code, do not create branches** — everything here is contract.
- **The functional DoD is built HERE.** Every business rule leaves this session with an
  observable acceptance criterion. What is NOT built here: the command that proves it —
  naming project commands is `/goal:plan`'s verifiability round.
- **No technical grilling.** A coupling, a migration, a data source you notice goes to
  `## Flags for /goal:plan`, never into a question round.
- **One spec = one outcome.** Several independent outcomes are a chantier — route to
  `/goal:tickets` instead of writing a contract no single plan can execute.
- **The adversarial grill runs here or not at all.** Downstream never re-opens the state
  space; an unenumerated interaction discovered later is a spec fault that comes back to
  this file.
- **Standalone** — needs only a git repo, plus the Atlassian MCP for a Jira source and
  `gh` only for a GitHub-issue source or the opt-in mirror.
- **Never assert a problem the source did not evidence.** If it says "improve X", the problem
  is missing and Phase 2 blocks. Inventing a plausible one puts a fabricated premise at the
  head of a chain that will never re-examine it.
- **One question at a time.**
- **The handoff command is the last line you print.** Anything printed after it buries the
  one thing the developer came for.
