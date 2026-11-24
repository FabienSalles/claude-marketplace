---
name: conventional-review
description: "ACTIVATE when asked to review a change on any VCS and in any language: a PR, an MR, a branch, a commit range, a patch or a pasted diff. ACTIVATE for 'review', 'code review', 'revue de code', 'relis ma PR', 'review this MR', 'conventional comments'. Diff-only findings, each written as a conventional comment whose decoration says whether it blocks, with a concrete fix. Takes a level, low to xhigh, and an own or external scope. Reuses /code-review and installed convention skills when present, runs standalone on Codex and Copilot. Never posts without consent."
---

# Conventional review: diff-only findings, ranked, written as conventional comments

A review is worth what its reader can act on. This skill produces few findings, each anchored
on a changed line, rated from its real consequence, and written in the
[Conventional Comments](https://conventionalcomments.org/) format so the author knows at a
glance what blocks and what does not.

It works on any version control system, any forge and any language. Optional amplifiers
(Claude Code's `/code-review`, convention skills) add depth when the agent has them; without
them the review is complete on its own.

## Rules

1. **Diff only.** Every finding anchors on an added or modified line. Read the code around it
   for context, but pre-existing debt is not a finding, unless the diff makes it worse: then
   anchor on the line that worsens it. One exception: an acceptance criterion the diff does not
   meet has no line to anchor on; it becomes a general comment on the change.
2. **Rate from the real call site, not the hunk.** Before marking a finding `blocking`, read the
   callers, guards and validation outside the diff. The decoration reflects the consequence at
   a real call site, not the worst theoretical reading.
3. **One finding, one problem, one fix.** Each cites file and location and gives a concrete
   correction. A doubt without a fix is a `question`, not an `issue`.
4. **No noise.** Nothing a formatter or linter enforces in CI, no naming taste, no missing
   docstrings. A broken convention is a finding only when its written rule is cited
   (`references/axes.md`, axis 5).
5. **Say what was not verified**: tests not run, no coverage report, ticket unreachable,
   a call site outside the diff not read.
6. **Read-only.** Never post a comment, approve, request changes, commit, push or edit the
   change without an explicit request from the user, for this change. Comments go out only
   through step 7, after the user approved the list.
7. **Language.** Write the report in the user's language. Conventional comment labels and
   decorations stay in English: they are a parseable standard.

## Step 0: level and scope

Two settings, read from the user's words, both stated in the report header.

**Level**: how deep the review goes. Default `medium`.

| Level | Own pass | `/code-review` | Subagents | Reported |
|---|---|---|---|---|
| `low` | business fit, errors, security, tests of the changed behaviour | `low` | no | `blocking` only |
| `medium` | all eleven axes | `medium` | no | all |
| `high` | all eleven axes; callers outside the diff read for every `blocking` and `non-blocking` finding | `high` | adversarial reviewer, then a separate filter | all |
| `xhigh` | as `high`, plus the project's tests and linters on the touched files when they run locally without an external service | `xhigh` | same | all, no cap |

`max` and `ultra` only when the user names them: they go to `/code-review` as is, the own pass
runs as `xhigh`. Always pass the level to `/code-review` explicitly: without one it reuses the
last level typed.

**Scope**: whose conventions apply.

| Scope | Conventions axis uses |
|---|---|
| `own` | the project's written rules and the user's convention skills (`craft:*`, language packs) |
| `external` | the project's written rules only; the user's skills are not loaded |

Every other axis runs the same in both. The user's words decide ("external", "MR externe",
"own", "mon projet"). Otherwise the scope is `own` when the project references those skills
(its `CLAUDE.md` or `AGENTS.md`, or the plugins enabled in `.claude/settings.json`), and
`external` when it does not.

## Step 1: get the change

Use read-only commands. Collect the diff, the description, the commits and the ticket key
(title, branch name or commit messages).

| Source | Diff | Context |
|---|---|---|
| git, branch | `git diff <base>...HEAD` | `git log --oneline <base>..HEAD` |
| git, uncommitted | `git diff HEAD` | `git status --short` |
| Mercurial | `hg diff -r <base>` | `hg log -r <base>::.` |
| Subversion | `svn diff -r <rev>:HEAD` | `svn log -r <rev>:HEAD` |
| GitHub PR | `gh pr diff <n>` | `gh pr view <n>` |
| GitLab MR | `glab mr diff <n>` | `glab mr view <n>` |
| Other forge | its CLI or API, read-only | same |
| Pasted diff | as is | ask for the description only if the intent is unclear |

`<base>` is the target branch of the change; when nothing names it, use the default
branch's merge base and say so. When no command can reach the change, ask for the patch.

## Step 2: gather the review criteria

- **Intent.** Before judging anything, state in one sentence what the change is meant to do,
  from its description, commits and code. A finding is judged against that intent.
- **Acceptance criteria.** Take them from the ticket (tracker reachable by CLI or MCP), the
  description, or a plan or spec the user names. Never invent criteria: with none, write
  *plan alignment: not run* and go on. With criteria:
  - check each one only when the diff shows the evidence, citing `file:line`; an unmet
    criterion is a `blocking` finding;
  - flag every change that traces to no criterion as **scope creep**, a `question`.
- **Project conventions.** Read the repository's `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING`
  and linter configuration.
- **Convention skills, scope `own` only, when installed.** Load those matching the diff: the cross-language
  `craft:*` principles (code style, testing, OOP, DDD, refactoring) and the language packs
  (`php:*`, `typescript:*`, `symfony:*`, test packs). Their rules become review criteria; a
  finding on one of them cites the skill and the rule.
- **Fallback.** Without any of them, `references/axes.md` alone is the checklist.

## Step 3: run the passes

**A. Own pass, always.** Walk the diff along the eleven axes of `references/axes.md`:
quality, duplication, design and architecture, over-engineering, conventions, error handling,
performance and load, security, observability, tests, change hygiene.

**B. Amplifiers, only when the agent has them.**

| If available | Use it for | Never |
|---|---|---|
| Claude Code `/code-review` | a correctness pass on the same target, at the level of step 0 | `--comment`, `--fix`, the `max` or `ultra` levels unless the user asked |
| subagents (level `high` and above) | one subagent reviews adversarially, a second one filters its findings without having written them | letting the filter see your own conclusions first |
| a security skill (`security-audit`, `audit:ts-security`) | a diff touching authentication, input parsing, crypto, dependencies | rating its generic findings without the call site |

`/code-review` reviews the repository of the session, not a PR or MR URL from another one. Run
it only when the session's working directory is a clone of the change's repository, with the
change's source branch as target after a fetch. Otherwise skip it and say so under *Not
verified*; from `high` up, the adversarial subagent covers for it.

On Codex, Copilot or any agent without them, skip B and write "correctness pass: own only"
under *Not verified*.

**C. Filter, always.** Run every candidate, yours and the amplifiers', through the rules:
drop what the context already handles, drop the nitpicks not worth the author's time, merge
duplicates, keep the findings with the highest impact. A short list the author acts on beats
a long one they skim; never pad it to reach a count.

## Step 4: rate and label

| Decoration | What it is | Labels |
|---|---|---|
| `blocking` | bug, unmet acceptance criterion, lost error or trace, security hole, committed secret, unprotected external call, sensitive data leak, data corrupted under concurrency, broken contract, probable regression | `issue`, `todo` |
| `non-blocking` | robustness, measurable performance or load, important missing test, unvalidated input, notable duplication, boundary or responsibility violation, over-engineering, convention broken, readability, magic value, minor refactor, local inconsistency | `issue`, `suggestion`, `nitpick` |

The decoration carries the criticality: there is no separate priority. The subject line is
`<label> (<decoration>[, <axis>]): <subject>`, for example
`issue (blocking, security): token compared with == leaks timing`.
Labels, decorations and full examples: `references/conventional-comments.md`.

**Verdict:** any `blocking` finding means *changes required*; `non-blocking` findings only
mean *approve with reservations*; otherwise *approve*.

## Step 5: report

```
**<change id>**: <title> · <n> files, +<added> / -<removed>
**Level:** <level> · **Scope:** own | external
**Intent:** <one sentence>
**Plan alignment:** <met>/<total> criteria met, scope creep: <list or none> | not run
**Verdict:** changes required | approve with reservations | approve

| # | Label (decoration) | File | Problem | Proposed fix |
|---|--------------------|------|---------|--------------|
```

Sort `blocking` first. Then, in this order:

- **Strengths**: two or three, specific (they become `praise` comments).
- **Not verified**: what could not be checked, and why.
- **Keep or drop?**: ask the user to keep or drop each point before any comment is written.

## Step 6: comments, on request only

Write each kept point as one conventional comment, delivered as raw Markdown inside a
four-backtick block so the user can paste it into any forge editor:

- the subject line from step 4;
- **problem**: one or two sentences with the concrete impact, a short before / after if it
  helps;
- **proposed fix**: short bullets; any code goes in a fenced block tagged with its language;
- **test**: the test that pins the fix, when relevant, also fenced;
- the location: file and line, plus a search term the reviewer can find in the forge's diff
  view.

A `blocking` finding whose answer is out of the reviewer's reach (production data, an
environment's configuration) carries the check that settles it, through the project's own
tools: a script, a make target, a test to run, a query. Never an ad hoc shell command (`grep`
pipelines and the like). A `non-blocking` finding, or one the reviewer already verified, states
the fact in one sentence, with no command. One comment, one point.

## Step 7: publish, only after the list is approved

Never post straight from step 6. When the user asks to publish:

1. **List what will go out**, without posting anything:

   ```
   | # | Target                 | Subject line                                      |
   |---|------------------------|---------------------------------------------------|
   | 1 | src/pay.ts:42 (inline) | issue (blocking, errors): ...                     |
   | 2 | general comment        | todo (blocking): criterion 3 not met ...          |
   ```

   followed by the full body of each comment. Name the forge and the change they go to.
2. **Wait for an explicit approval of that list.** The user may drop, reword or reorder
   points; show the list again after any change. The approval covers this list only.
3. **Check the change has not moved**: compare its head commit with the one reviewed. If it
   moved, re-anchor every inline comment on the new diff and go back to 1.
4. **Create exactly the approved comments as a pending review** when the forge has one
   (GitHub pending review, GitLab draft notes): only the user sees them, in the forge's own
   diff view. Inline when the target is a line. Stop at the first failure and report what was
   created and what was not.
5. **Publish only on a second explicit go**, or let the user submit the review from the forge.
   A forge with no pending review: post directly, still one comment at a time, after step 2.

Never approve, request changes or resolve threads on the user's behalf. Forge commands:
`references/posting.md`. With no CLI or API at hand, hand over the approved list for the user
to paste.
