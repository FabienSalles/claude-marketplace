---
description: Session 1 of the autonomous issue→PR workflow — read a GitHub issue, lift all ambiguities interactively, persist a validated spec, create a feature branch, and echo the /goal command for Session 2
argument-hint: Issue number (e.g. 42)
---

# /run-issue — Issue → Spec → Branch (Session 1 of 3)

You are helping the developer prepare for an **autonomous `/goal` session** that will deliver a working PR. THIS session is purely interactive — lift every ambiguity now, because once `/goal` starts in Session 2 it cannot ask the user anything.

> Companion docs: this plugin's `README.md` (full 3-session workflow), `templates/done-criteria.template` (standard acceptance criteria pattern).
>
> **Permissiveness:** this command works standalone — it falls back to inlined questions in Phase 2 when no upstream interview skill is available. Other plugins (`pocock` for `grill-me`/`grill-with-docs`, `superpowers` for `verification-before-completion`/`systematic-debugging`, `common` for `business-first-dev`, `craft` for TDD principles) enhance the workflow but are not required.

## Argument

Issue number: `$ARGUMENTS`

If `$ARGUMENTS` is empty, stop and ask the developer for the issue number.

## Phase 0 — Preconditions

Verify in one round:
- `gh auth status` succeeds
- `git rev-parse --show-toplevel` succeeds (we're in a repo)
- The current branch is clean (no uncommitted changes); if dirty, ask the developer to stash/commit first

If any check fails, STOP and tell the developer what to fix.

## Phase 1 — Read the issue

```bash
gh issue view $ARGUMENTS --json number,title,body,labels,assignees,comments
```

Then summarize in 5–10 lines:
- What the user appears to want
- What's clearly stated vs implied
- Which files/modules you suspect are involved
- Labels detected (size, priority, type)

Ask the developer: **"Is my reading correct? Anything to add before I start grilling?"** WAIT for confirmation.

## Phase 2 — Grill (one question at a time)

Pick the **best available** interview approach, in order of preference:

1. **`pocock:grill-with-docs`** if the skill is installed AND a `CONTEXT.md` or `docs/adr/` exists in the repo. This adds inline glossary maintenance.
2. **`pocock:grill-me`** if the skill is installed. Pure Socratic interview.
3. **`common:business-first-dev` Phase 1 questions** if the `common` plugin is installed. Structured business + system rounds.
4. **Inlined baseline** (below) — works with NO other plugin installed.

### Inlined baseline questions (fallback — use only if 1–3 unavailable)

Ask these one at a time. Provide your recommended answer for each. Skip questions already answered by the issue body.

**Round 1 — the need:**
- Who triggers this? (end user / admin / batch / external system)
- What is the precise end-to-end flow? Describe the happy path step by step.
- Which business rules apply? (validations, computations, conditions, limits)
- Vocabulary: are there project-specific terms I should align with? Where do they live? (CONTEXT.md, glossary, wiki)
- Known edge cases? Not technical — actual business cases.
- What is explicitly **out of scope** for this issue?

**Round 2 — the system:**
- Are there mockups / Figma / design docs referenced?
- Cross-project couplings? (API client here, endpoint elsewhere — should I scan another repo?)
- Where does data come from? (new API to create, existing DB, hard-coded, external)
- Constraints not derivable from the code? (deadlines, legal, team decisions)
- Anything else I cannot find in the code that I should know?

**Round 3 — verifiability (always ask):**
- What is the **smallest command-line check** that would prove this works? (test path, lint command, build output)
- What should **not** change as a side-effect? (files / behaviors to protect)

### Stop condition

Stop grilling when:
- All branches resolved
- Acceptance criteria can be stated as **command-line checks** (a test name, a lint exit code, a file count, …)
- No remaining "it depends"

Typical question count: 5–15 for a small issue, more for a feature.

### One question at a time

Walk down the decision tree, **one question per message**. For each: provide your recommended answer, then wait for the developer's response before continuing. Batch-style questionnaires reduce signal.

## Phase 3 — Write the spec

Persist at `.claude/plans/issue-$ARGUMENTS-spec.md`:

```markdown
# Spec: <Issue title>

Source: gh issue #$ARGUMENTS — <issue URL>

## Business intent
<1–3 paragraphs: what + why, in the developer's domain vocabulary>

## Scope IN
- <bullet list of what's in>

## Scope OUT
- <bullet list of what's explicitly NOT in this PR>

## Files to touch
- `<path>`: <what + why>
- `<path>` (new): <description>
- `<path>` (test): <coverage>

## Files NOT to touch
- <list any tempting-but-out-of-scope files>

## Acceptance criteria (command-line verifiable)

Use the project's actual test/lint commands. Examples by stack:
- TS/Vitest: `pnpm test path/` exits 0, `pnpm lint` exits 0
- PHP/Symfony: `make php/tests` exits 0, `make php/qa` exits 0
- Astro: `pnpm build` exits 0, `pnpm check` exits 0

Always include these guard criteria (the Karpathy / done-criteria.template baseline):
1. <project test command for this scope> exits 0
2. <project lint command> exits 0
3. `git diff --stat HEAD` shows ONLY files listed in "Files to touch"
4. `git status` is clean (no untracked artifacts)
5. No commit pushed to remote yet (push is manual in Session 3)

## Out-of-band decisions captured during grill
- Q: <question>
  A: <answer>
- Q: <question>
  A: <answer>
```

Show the spec to the developer. Ask: **"Does the spec match our conversation? Edit anything before locking?"** WAIT for explicit confirmation.

## Phase 4 — Lock: branch + commit the spec

```bash
slug=$(gh issue view $ARGUMENTS --json title -q '.title' \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//' \
  | cut -c1-40)
git checkout -b "feature/issue-$ARGUMENTS-$slug"
mkdir -p .claude/plans
git add .claude/plans/issue-$ARGUMENTS-spec.md
git commit -m "spec: lock issue #$ARGUMENTS contract for autonomous /goal"
```

Read back the branch name to the developer so they can copy it.

## Phase 5 — Hand off to Session 2

Echo this **exact text** (filled with the issue number, branch name, and the spec's actual test/lint commands) for the developer to paste:

```text
/goal Implement .claude/plans/issue-<N>-spec.md.

Load these skills before starting (project conventions): the language-specific
TDD workflow (php-tdd-workflow / vitest-tdd-workflow / feature-tdd-dev),
verification-before-completion, systematic-debugging, and the relevant
language conventions skills.

Done when ALL of these hold (run the commands and show the output, do not
assert based on memory):
1. <test command from spec> exits 0
2. <lint command from spec> exits 0
3. git diff --stat HEAD shows ONLY files listed in the spec under "Files to touch"
4. git status is clean
5. No commit pushed to origin yet (we'll review locally first)

Stop after 30 turns regardless. Branch: feature/issue-<N>-<slug>.
Spec is the contract — if a deviation is needed, update the spec first.
```

Then tell the developer:

> Open a fresh terminal in this repo and run:
> ```
> tmux new -s issue-<N>
> claude
> ```
> Paste the `/goal` text above. Detach with `Ctrl-B then D` and walk away.
> Re-attach with `tmux attach -t issue-<N>` to check progress.
> When `◎ /goal active` clears, return to your usual terminal for Session 3
> (review + push + `gh pr create`).

## Rules for THIS session

- **Do not write production code.** Phase 1–5 are clarification + contract only.
- **Do not push to remote.** The local spec commit is enough.
- **Lift, don't assume.** If you're tempted to "infer" an answer Claude could later need, ASK instead.
- **One question at a time.** Batch-style questionnaires reduce signal — the developer can't reason about a 10-question wall.
- **The spec is the contract.** If a deviation appears in Session 2, update the spec first.
