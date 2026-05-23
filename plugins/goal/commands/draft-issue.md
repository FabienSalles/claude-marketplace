---
description: Step 0 of the autonomous issue→PR workflow — convert a spec, PRD output, BMAD story, brainstorm note or any planning artifact into a properly-formatted GitHub issue ready to be picked up by `/run-issue`
argument-hint: Optional path to a spec file (e.g. .claude/plans/refactor-x-spec.md) — or 'inline' to paste it now
---

# /draft-issue — Spec → GitHub Issue (Step 0 of the autonomous workflow)

You are converting a planning artifact into a GitHub issue formatted so the **autonomous loop** (`/run-issue` → `/goal` → PR) can pick it up downstream without losing information.

This command sits at the **upstream end** of the chain:

```
(idea)
  └─ BMAD bmm:create-prd → bmm:create-epics-and-stories
       │
       └─ /business-first-dev (5 phases, GATES, persists a spec)
            │
            └─ /draft-issue ← YOU ARE HERE
                 └─ gh issue created with the right sections
                      └─ /run-issue <N>
                           └─ /goal
                                └─ PR + execution log
```

Any of those upstream tools can produce the input. The point of `/draft-issue` is to **normalize** the artifact into the issue body shape `/run-issue` knows how to consume.

## Argument

Spec source: `$ARGUMENTS`

- A path to a markdown spec → read the file.
- The literal `inline` (or empty + no spec on disk) → ask the developer to paste the spec content here.
- A path that doesn't exist → STOP and tell the developer.

## Phase 0 — Preconditions

Verify in one round:
- `gh auth status` succeeds
- The current working directory is inside a git repo whose remote points to GitHub (`gh repo view` works)

If either fails, STOP and tell the developer what to fix.

## Phase 1 — Read & extract

From the source, extract these sections. They may use different headings depending on the upstream tool — normalize:

| Target section | Upstream synonyms |
|---|---|
| **Title** | `# …` first heading, or BMAD `story.title`, or business-first-dev "Feature" |
| **Business intent** | "Business intent", "Why", "Context", "Goal", BMAD `story.description` |
| **Scope IN** | "Scope IN", "In scope", "Requirements", BMAD `acceptance_criteria` (positive) |
| **Scope OUT** | "Scope OUT", "Out of scope", "Non-goals", "Will not do" |
| **Acceptance criteria** | "Acceptance criteria", "Done when", "Success criteria" |
| **Files to touch** (optional) | "Files to create/modify", "Files to touch", "Affected files" |
| **Decisions** (optional) | "Decisions made", "Q&A", "Clarifications" |

If some sections aren't in the source, that's fine — note which ones and ask the developer.

## Phase 2 — Validate completeness

Before drafting the issue, surface anything that would break `/run-issue` downstream:

| Issue | Severity | Action |
|---|---|---|
| Empty business intent | ❌ blocker | Ask developer to provide it now |
| No acceptance criteria | ❌ blocker | Ask for at least 1 command-line verifiable criterion |
| Scope IN/OUT mixed in one list | ⚠️ warn | Propose a split |
| No "Files to touch" | ℹ️ info | Fine — `/run-issue` Session 1 will discover them |
| Acceptance criteria not command-line verifiable ("code is clean", "no regression") | ⚠️ warn | Suggest concrete commands (test path, lint exit code, …) |

STOP here and resolve every blocker / discuss every warning with the developer before Phase 3.

## Phase 3 — Draft the issue body

Render the issue body using this exact structure (so `/run-issue` finds its sections):

```markdown
## Business intent

<paragraphs from the source — what + why>

## Scope

**IN**
- <items>

**OUT**
- <items>

## Acceptance criteria

- [ ] <command-line verifiable criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Files (suspected)

- `<path>` — <role>
- `<path>` (new) — <description>

## Notes / decisions captured upstream

- <Q/A pair or design decision worth preserving>

---

_Drafted by `/draft-issue` from `<spec source path or 'inline'>`. Pair with_
_`/run-issue <N>` once the issue is created to start the autonomous loop._
```

Compute an issue **title** in ≤ 80 chars: imperative form, no trailing punctuation, no ticket prefix.

Save the body to a temp file you can re-use:

```bash
TMP=$(mktemp -t draft-issue-XXXXXX.md)
# write the body to $TMP
```

Show the title and body to the developer.

## Phase 4 — Confirm + create

Ask the developer:

> "Create the issue now? (y / edit / cancel)
>  - Optional: labels (comma-separated)?
>  - Optional: milestone?
>  - Optional: assignee (use `@me` for yourself)?"

WAIT for input.

If **y** (default no labels/milestone/assignee unless given):

```bash
gh issue create \
  --title "<title>" \
  --body-file "$TMP" \
  [--label "<labels>"] \
  [--milestone "<milestone>"] \
  [--assignee "<assignee>"]
```

Capture the resulting URL/number from `gh issue create` stdout.

If **edit**: tell the developer the temp file path, ask them to edit it, then re-run Phase 4 once they're done.

If **cancel**: print the temp file path so they can use it later, exit cleanly.

## Phase 5 — Handoff

Print this exact message:

```
✓ Issue created: <URL>

Next step — start the autonomous loop:
  cd <current repo>
  claude
  > /run-issue <N>
```

Where `<N>` is the issue number returned by `gh issue create`.

## Rules

- The issue body **is the contract** handed to `/run-issue`. Anything fuzzy here costs a clarification loop in Session 1.
- **Do not auto-create labels, milestones, or assignees** — only what the developer explicitly provided.
- **Do not push code** or create branches in this command — that's `/run-issue`'s job.
- **Permissiveness** — this command does not require any other plugin. It only needs `gh` CLI and a GitHub remote.

## Chain reminders

- After `/business-first-dev`: the validated spec from Phase 3 is usually at `.claude/plans/<feature>-spec.md`. Use that path as `$ARGUMENTS`.
- After BMAD `bmm:create-epics-and-stories`: one issue per story. Run `/draft-issue` once per story file.
- For ad-hoc brainstorm: paste with `inline` argument.
