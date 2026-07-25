---
description: Session 1 of the goal workflow — read any source (Jira US, GitHub issue, spec file, inline), lift ambiguities and fill functional gaps, build the missing Definition of Done, decompose into functional iterations, persist a validated plan on a feature branch, then echo the per-iteration /goal handoff for Session 2
argument-hint: A source — Jira key (CT-1234), GitHub issue number (42), a spec path (.claude/plans/x-spec.md), or 'inline'
---

# /goal:run-issue — Source → Plan → Branch (Session 1 of the goal workflow)

You are helping the developer prepare an **autonomous `/goal` execution** that
delivers working code. THIS session is purely interactive — lift every
ambiguity and fabricate the missing Definition of Done NOW, because once
`/goal` starts in Session 2 it cannot ask the developer anything.

The source is **not necessarily a GitHub issue**. It is frequently a **Jira
US** that has functional holes, undocumented technical consequences, and **no
Definition of Done at all** — building that DoD here is the whole point.

> Companion docs: this plugin's `README.md` (full workflow), `templates/done-criteria.template` (acceptance-criteria baseline), `templates/goal-handoff.template` (the canonical `/goal` handoff both `/goal:run-issue` and `/goal:next` emit).
>
> **Decomposition skills:** Phase 3 loads `product:vertical-slice` (how to split) and
> `product:delivery` (how each slice ships without blocking). They are the difference
> between a plan of iterations and a plan of tasks.
>
> **Permissiveness:** this command works standalone. It reads Jira via the
> Atlassian MCP, GitHub via `gh`, or a plain file — whatever the source is.
> GitHub is **never required**. Optional enhancers (`pocock` grill skills,
> `superpowers` verification/debugging, `common` spec-first-dev, `craft` TDD,
> language convention skills) sharpen the workflow but none are mandatory.

## Argument — resolve the source

Source: `$ARGUMENTS`

Resolve it to a **work item** and a stable **work-id**:

**Draft-first — check the local artifact BEFORE any external I/O.** For a Jira
key or an issue number, the work-id is derivable from the argument alone (no
network): `CT-5856` → `ct-5856`, `42` → `issue-42`. So **first** look for
`.claude/plans/<work-id>-spec.md`:
- **It exists** → `/goal:draft-issue` already ran and captured the source
  (Jira/issue content, gaps, decisions) into that draft. It is the **primary
  source** — read it, do NOT re-fetch Jira/gh to rebuild what it already holds.
  Only call the Atlassian MCP / `gh` to fill a **specific gap the draft
  explicitly flags** (e.g. an unread screenshot). This skips a pointless OAuth
  round-trip and guarantees a fresh session picks up the right element.
- **It does not exist** → fall through to the external resolution table below.

| `$ARGUMENTS` shape | How to read it | work-id |
|---|---|---|
| Jira key `^[A-Z][A-Z0-9]+-[0-9]+$` (e.g. `CT-1234`) | Atlassian MCP — see below | key lowercased → `ct-1234` |
| Bare integer `42` or `#42` | `gh issue view 42 --json number,title,body,labels,assignees,comments` (needs `gh auth`) | `issue-42` |
| A path ending in `.md` | Read the file | ≤40-char kebab slug of the title |
| `inline` or empty | Ask the developer to paste the source now | ≤40-char kebab slug of the title |
| Anything else that doesn't resolve | STOP and report | — |

**Reading a Jira source via MCP:** load the Atlassian tools first with
`ToolSearch` (`select:getAccessibleAtlassianResources,getJiraIssue`), get the
`cloudId` from `getAccessibleAtlassianResources`, then `getJiraIssue` with the
key. Extract: summary, description, acceptance criteria (if any), status, and
the comment thread (comments often hold the real requirements). If the MCP is
unreachable, STOP and tell the developer to paste the US with `inline`.

The **work-id** drives every artifact: spec at `.claude/plans/<work-id>-spec.md`,
branch `feature/<work-id>-<slug>`, log at `.claude/plans/<work-id>-execution-log.md`.

## Phase 0 — Preconditions

Verify in one round:
- `git rev-parse --show-toplevel` succeeds (we're in a repo)
- The current branch is clean; if dirty, ask the developer to stash/commit first
- **Only if the source is a GitHub issue AND no local draft covers it:** `gh auth status` succeeds
- **Only if the source is Jira AND no local draft covers it:** the Atlassian MCP resolves (`getAccessibleAtlassianResources` returns a resource). When the draft-first check found `.claude/plans/<work-id>-spec.md`, skip this — no MCP/OAuth needed.

Do **not** require `gh` for a Jira/file/inline source. If a needed check fails,
STOP and tell the developer what to fix.

Optional pointer (do not block on it): if the source is **not** a GitHub issue
and the developer might want one for tracking, mention once: _"No GitHub issue
backs this source — run `/goal:draft-issue <source>` first if you want one mirrored.
Otherwise I continue local-only."_ Default: continue local-only.

## Phase 1 — Read the source

Summarize the source in 5–10 lines:
- What the developer appears to want (the business need)
- What's clearly stated vs implied vs **missing**
- Which files/modules you suspect are involved
- **Functional gaps** you already spot (unspecified rules, undefined edge cases)
- **Technical consequences** the source doesn't mention (migrations, cross-service
  couplings, contract changes)
- Whether a Definition of Done exists (for a Jira US: almost always **no** → you'll build it)

Ask: **"Is my reading correct? Anything to add before I start grilling?"** WAIT.

## Phase 2 — Grill (one question at a time)

Goal of the grill: **close every functional gap and surface every technical
consequence** so the plan is executable without further human input. Pick the
best available interview approach, in order:

1. **`pocock:grill-with-docs`** if installed AND `CONTEXT.md`/`docs/adr/` exist.
2. **`pocock:grill-me`** if installed.
3. **`common:spec-first-dev` Phase 1 questions** if `common` is installed.
4. **Inlined baseline** (below) — always works.

### Inlined baseline questions (fallback)

Ask one at a time, each with your recommended answer. Skip anything the source
already answers.

**Round 1 — the need (fill functional gaps):**
- Who triggers this? (end user / admin / batch / external system)
- Precise end-to-end happy path, step by step?
- Which **business rules** apply? (validations, computations, conditions, limits)
- Vocabulary: project-specific terms to align with? Where do they live?
- Business edge cases (not technical — real domain cases)?
- What is explicitly **out of scope** for this delivery?

**Round 2 — the system (surface technical consequences):**
- Mockups / Figma / design docs referenced?
- Cross-project couplings? (API client here, endpoint elsewhere — scan another repo?)
- Where does data come from? (new API, existing DB, hard-coded, external)
- Migrations, schema changes, or contract changes implied?
- Constraints not derivable from the code? (deadlines, legal, team decisions)
- Anything else invisible in the code I should know?

**Round 3 — verifiability + Definition of Done (always ask):**
- For **each business rule** from Round 1: what command-line check proves it holds?
  (a named test, a lint rule, a build output) — this is how the DoD gets teeth.
- What is the smallest command that proves the whole thing works end to end?
- What must **not** change as a side-effect? (files / behaviors to protect)
- What are the project's actual test and lint/QA commands? (dockerized where
  applicable — do not assume host-level runners)

### Stop condition

Stop grilling when: every functional gap is closed, every business rule maps to
a command-line check, and no "it depends" remains. Typical: 5–15 questions for a
small US, more for a feature. **One question per message** — batch questionnaires
reduce signal.

## Phase 2b — Adversarial grill (opt-in, before freezing iterations)

The baseline grill resolves what is **raised**. It does not enumerate the
interaction state space, so broken invariants and broken execution schemas
(interface / usage incoherence) slip through and become rework. Close that gap here,
**before** decomposition:

1. Read the spec's **`## Adversarial grill`** line (set by `/goal:draft-issue` Phase 3b).
   - **`requested`** → load and run the **`goal:grill-adversarial`** skill on the
     whole plan.
   - **`not requested`** → skip, unless step 2 applies.
2. If the line is **absent** (spec didn't come through `/goal:draft-issue`) OR the feature
   is **front / interactive** and Phase 2 flagged functional gaps → **ask now**
   (`AskUserQuestion`, recommending **yes** for front/interactive): run the
   adversarial grill? If yes → load `goal:grill-adversarial`.

`grill-adversarial` composes the Pocock grills and adds the coverage discipline:
enumerate states, extract invariants (front-only ⇒ the front owns them), build the
`(state × action)` transition matrix, hunt execution-schema breaks, and turn every
hole into an **owned + sequence-tested** rule. Fold its output into the **Business
rules** and iterations below — each new invariant becomes a business rule with a
**sequence test** (drive the action series, assert the invariant holds throughout),
assigned to an iteration or marked **transverse** (re-verified at each iteration's
DoD). Do not freeze iterations until every `(state, action)` cell is resolved.

## Phase 2c — The two decisions that shape the plan

Both are asked **before** decomposing, because both change the plan itself and not just
what happens to it afterwards. `product:vertical-slice` sizes and orders slices from the
execution mode, and `product:delivery` picks a strategy from what the change may break.
Decomposing first and asking after produces a plan built for the wrong mode.

### A — Delivery mode: name what can break, then let the developer choose

The default is **no BC break, feature flag where behaviour changes**. That default is not
negotiable by omission: to leave it, the developer has to see what they are giving up.

So do not ask an abstract question. **First establish this change's blast radius**, then
ask with that list in front of them. A developer who reads "do you accept breaking
changes?" says yes; one who reads "the `price_ht` column is read by the invoicing export
and two reports" says no, or says yes for a reason.

### 1. Establish the blast radius

Load `product:delivery`. Go through the change and, for each item it touches, find who
depends on it. Grep, do not guess. Look for:

| What the change touches | Who breaks | How to check |
|---|---|---|
| a DB column / table | other queries, exports, reports, another service reading the same base | grep the column name across the repo, ask about external readers |
| an HTTP endpoint or a response field | front-ends, mobile apps, partners, webhooks | grep the route, check the API clients |
| an event / message payload | every consumer, including ones in other repos | grep the event name |
| a config or env key | deploy manifests, other environments, teammates' local setups | grep + check the deploy config |
| an exported function, class or interface | callers in this repo and in packages that depend on it | grep the symbol |
| a template block, slot or CSS hook | templates that extend or override it | grep the block name |
| a CLI flag or a file format | scripts, cron jobs, anything automated | grep, ask |

Anything with **zero** dependents is additive by nature and is not part of the question.
Only list what genuinely has a consumer.

### 2. Ask, with the list in view

If the blast radius is **empty**, say so and record `no-bc-break` without asking: there is
nothing to break, and a question with no stake is noise.

Otherwise ask (`AskUserQuestion`), showing the concrete list:

> This change touches things other code depends on:
> - `<item>` → read by `<consumer>`, breaks if `<what>`
> - `<item>` → …
>
> **no-bc-break** (default) — nothing above breaks. Behaviour changes go behind a flag
> defaulting to off, schema changes are expand/contract, and removals become a separate
> cleanup plan. Costs extra slices and a flag to remove later.
> **allow-bc-break** — I change these directly. Fewer slices, and the consumers above
> break the moment it deploys. Choose this when you own every consumer listed and can
> deploy them together, or when the list is wrong.

WAIT for the answer. Record it on the spec's `Delivery mode:` line, and **write the blast
radius into the spec** under `## Blast radius`, whichever answer they gave. The list is
what makes the decision reviewable later, and under `allow-bc-break` it is also the list
of what to deploy together.

### 3. What each mode does to the decomposition

- **`no-bc-break`** — every slice is additive. A behaviour change ships flagged off, a
  schema change ships expand-first, a removal never shares a slice with what replaces it.
  Each iteration carries its **Delivery strategy** from `product:delivery`. This mode is
  what *creates* a cleanup: the flag and the old path it keeps alive have to be deleted
  later. Go to section C.
- **`allow-bc-break`** — the breaking slices may change things in place. No flag, no
  compat shim, no old path left standing, and therefore **no cleanup at all**: the PR
  carries the whole change and lands already clean. Each breaking slice still carries a
  **Breaks:** line naming the consumers from the blast radius, so the reviewer sees the
  contract change without reconstructing it. Skip section C.

### C — When does the cleanup happen? (only under `no-bc-break`)

Ask only if the plan will actually introduce a flag or a compat path. No flag, no cleanup,
no question.

> The flag and the old path have to go eventually. When should the cleanup be **written**?
> Either way you decide when it **merges** — the rollback window is never given up.
>
> **later** (default) — nothing is written now. The cleanup lives as its own plan and you
> run the workflow on it once the trigger holds. Least to carry, but the work restarts
> cold: a future session rebuilds the context, and a cleanup nobody schedules is how flag
> debt accumulates.
> **now** — the cleanup is written in this session, in **its own PR stacked on the feature
> PR, left as a draft**. The feature PR merges and soaks with the flag on, you verify with
> real users in real conditions, then you mark the cleanup PR ready and merge it yourself.
> Written while the context is fresh, merged only when you say so. The cost is an open PR
> that can drift if the feature changes during review, or if the soak makes you revise the
> new path.

WAIT, then write the answer on the spec's `Cleanup:` header line.

Under **now**, be clear about what it does and does not change: _"The cleanup PR is opened
as a draft on top of the feature PR. Merging the feature does not merge it. You keep the
full rollback window and merge the cleanup when production has convinced you."_ The point
of the second PR is exactly that separation, so do not describe it as skipping the soak.

### B — Commit / PR policy

Ask (this controls what an execution session is allowed to do, and how big a slice should be):

> **How should the execution sessions handle commits and the PR?**
> - **manual** (default) — I never commit, push, or open a PR. After each
>   iteration I stop with a synthesis; you review and commit yourself.
> - **commit** — I commit each iteration myself (conventional message, no
>   `Co-Authored-By` trailer), but never push or open a PR.
> - **commit+pr** — like commit, plus after the LAST iteration I push and open
>   the PR (requires a GitHub remote). This is what `/goal:auto` needs.

WAIT for the answer. Then **write it into the spec's `Policy:` header line**, and use the
same value as `<policy>` in the handoff verbatim.

The spec is what makes it durable. `/goal:next` reads the policy from the plan and falls
back to `manual` when it cannot find it, so a policy that lives only in the pasted handoff
is lost to a fresh session or a compaction, and the run silently degrades to manual.
`/goal:auto` has the same need, and reads it before it will start at all.

## Phase 3 — Decompose into functional iterations, then write the plan

**Load `product:vertical-slice` and `product:delivery` before decomposing.** This is the
step where the plan's quality is decided, and improvising the split is what produces
horizontal slices dressed as iterations. `vertical-slice` gives the procedure — name the
core complexity, pick and combine the techniques that isolate it, apply the technical
constraints, size to the execution mode, then verify against INVEST. `delivery` gives each
iteration a way to reach production while the rest is unfinished. Neither is installed?
Say so once and continue with the guidance below — but the split will be weaker.

Run the skill's five steps against this spec, with the two decisions from Phase 2c in
hand: `Delivery mode:` constrains what a slice may change, and `Policy:` sets the
granularity (the skill's step 4 sizes differently for a diff you review yourself and for
one an unattended agent must gate on a command). Do not restate its rules here — apply
them, and let the plan show the result.

What this command owns, and the skill does not, is everything below: the plan's file
format, the parallel-track mechanics, the cleanup carve-out, and persistence.

**Ask whether the iterations split into independent tracks.** A track is a group
of iterations that shares no file with any other track and needs nothing another track
produces. Tracks matter because `/goal:auto` runs them **in parallel**, each in its own
git worktree, each ending in its **own PR**. Three focused PRs a reviewer can merge
separately beat one PR touching everything.

The test for a real track is mechanical, not editorial: **the union of its "Files to
touch" must be disjoint from every other track's.** One shared file and the tracks are
not independent, whatever the story says. Check it before you propose the split.

Good candidates: work organized per module, per plugin, per bounded context, per package
in a monorepo. Bad candidates: a shared refactor everything else builds on, anything
touching a common config, migrations that must run in order.

**When the candidates share a foundation, extract it — do not fall back to sequential.**
Tracks are rarely disjoint on the first pass. They usually share one artefact the others
depend on: a validation script, a schema, a config, a rename that renumbers every call
site. That overlap is not proof the work is sequential — it is a **foundation**, and the
resolution is to pull it out rather than abandon the split:

- The shared artefact, plus every change whose halves are incoherent apart (a reciprocal
  cross-module pointer, a rename and its callers), goes into a **foundation plan** — one
  sequential list, one PR.
- The remainder forks into tracks in a **follow-up plan**, written at lock time as
  `.claude/plans/<work-id>-tracks-spec.md`, carrying a **Trigger** line: the foundation PR
  is merged. Tracks branched before that sit on a tree without the artefact their DoD
  calls, so their acceptance commands cannot run.

Only conclude "sequential" when the remainder, foundation removed, still shares files.

If a split exists, ask the developer (`AskUserQuestion`) whether to use it, showing the
tracks and the file sets that make them disjoint. If it does not, say so and keep a single
sequential list. Do not invent tracks to look parallel: a false track means two PRs that
conflict at merge.

**Under `commit` or `commit+pr`, every iteration carries a `gate` block, and that block is
what runs.** The acceptance criteria used to be prose, and `/goal:auto` translated them into
gate commands at run time: a model reading "the project test command exits 0" and deciding,
alone and unattended, which command that is. The block removes the translation. It is written
here, while the developer is present to read it, in the exact `key=value` form the state file
and `goal-auto-gate.sh` already consume, so it is copied verbatim rather than interpreted.

Write only commands that can fail. `git diff --stat` and `git status` do not belong in it:
the gate script checks scope leak and parasitic artifacts structurally, so such a line is a
gate that always exits 0. A criterion no command can express does not go in the block either
— put it under **Not machine-verifiable**, where it stays visible instead of vanishing from
the gate. **A slice whose core deliverable lands there cannot be verified unattended**: say
so now, because `/goal:auto` halts on an iteration with no `gate1`.

Use the project's real commands, dockerized where the project is, and check each one runs
today. A command that does not exist yet is a halt at iteration 1, not at review time.

**Cleanup never belongs to this plan.** Removing a flag, dropping the old column, deleting
the compat shim: all of it waits on a condition this plan cannot satisfy, because the
condition is that the change is *live* and the new path has proven itself. A cleanup slice
in the same plan is a slice whose trigger fires after its own PR is merged, which is a
contradiction, and in an autonomous run it is worse: the agent would delete the fallback in
the same PR that introduces the thing it falls back to.

So collect every cleanup slice into a separate **follow-up plan**, written at lock time as
`.claude/plans/<work-id>-cleanup-spec.md`. Each keeps its **Trigger** line (the production
evidence that must hold first) and its proof. It becomes its own PR later, when the
developer runs the workflow on that plan. Do not put it in a track either: tracks run in
parallel, and cleanup is strictly after.

Persist at `.claude/plans/<work-id>-spec.md`:

````markdown
# Spec: <title>

Source: <Jira CT-1234 | gh issue #42 URL | spec file path | inline>
Work-id: <work-id>
Policy: <manual | commit | commit+pr — filled in Phase 2c>
Delivery mode: <no-bc-break | allow-bc-break — filled in Phase 2c>
Cleanup: <later | now | none — none when allow-bc-break or no flag was introduced>

## Business intent
<1–3 paragraphs: what + why, in the developer's domain vocabulary>

## Scope IN
- <what's in>

## Scope OUT
- <what's explicitly NOT in this delivery>

## Business rules (each must map to a test in the DoD)
- <rule> → verified by <named test / command>
- <rule> → verified by <named test / command>

## States, invariants & transitions (only if the adversarial grill ran)
- **States:** <S1…Sk>
- **Invariants:** <I1…In — each with its owner; front-only ⇒ the front owns it>
- **Transition matrix:** <(state × action) → resulting state / blocked / invariant preserved>
- Each invariant → a **sequence test**, assigned to an iteration or marked **transverse** (re-verified at each iteration's DoD).

## Delivery strategy
<From `product:delivery`. What already exists that this must not break, the flag (name +
mechanism + default) if one is needed, the expand/contract sequence if a shared schema or
contract moves, and what the cleanup iteration will delete once it is live. "Purely
additive, nothing existing reads it" is a complete answer — write it rather than omit the
section.>

## Files NOT to touch
- <tempting-but-out-of-scope files>

## Definition of Done (global, command-line verifiable)
Built here because the source had none. Use the project's real commands
(dockerized where applicable — e.g. `make …` / `docker compose run --rm …`,
not host `php`/`composer`/`npm`).

```gate
dod1=<whole-scope test command>
dod2=<project lint/QA command>
```

Also true, and not expressible as a command of its own:
- Every business rule above has a passing covering test (proven by `dod1`)
- Project convention skills were loaded before coding (see handoff)

## Functional iterations

<Sequential by default: one flat list of iterations, no `## Track` heading. Add tracks
ONLY when the split is real and the file sets are provably disjoint. Iterations are
numbered once across the whole plan, whether or not tracks are used.>

### Iteration 1 — <name>
- [ ] Not done yet
- **Goal:** <the slice's user-visible/behavioral outcome>
- **Shippable after it:** <what is really usable/observable in prod once this lands>
- **Files to touch:** `<path>` (+ `<path>` (test))
- **Business rules covered:** <subset of the rules above>
- **Delivery:** <additive | flag `<name>` off by default | expand step of expand/contract | …>
- **Not machine-verifiable:** <criteria no command can express, or "none">

```gate
iteration_files=<bare space-separated repo-relative paths, a subtree as a trailing slash>
commit_msg=<conventional message, no Co-Authored-By trailer>
gate1=<test command scoped to this slice>
gate2=<project lint/QA>
```

### Iteration 2 — <name>
- [ ] Not done yet
- ...

<No Cleanup iteration here. Anything that removes a flag, a compat path or an old
column goes to `.claude/plans/<work-id>-cleanup-spec.md`, in this shape:>

### Iteration 1 — Cleanup: <what is removed>
- [ ] Not done yet
- **Trigger:** <what must be true in production before this can start>
- **Delete:** <flag + config entry, losing implementation + its tests, compat shim, old column>

```gate
iteration_files=<bare space-separated repo-relative paths>
commit_msg=<conventional message>
gate1=! grep -rq <flag name> <src dirs>
gate2=<test command>
gate3=<project lint/QA>
```

<With tracks, wrap the iterations in `## Track` headings instead. Everything inside a
track stays sequential; tracks are independent of each other and each becomes its own
branch and its own PR:>

## Track astro — <what this track delivers>
- **Branch suffix:** `astro`
- **Files owned:** `plugins/astro/**`

### Iteration 1 — <name>
- [ ] Not done yet
- ...

## Track php — <what this track delivers>
- **Branch suffix:** `php`
- **Files owned:** `plugins/php/**`

### Iteration 3 — <name>
- [ ] Not done yet
- ...

## Out-of-band decisions captured during grill
- Q: <question>
  A: <answer>
````

Show the plan. Ask: **"Does this plan match our conversation? The iterations
are the review checkpoints — edit the split or any criterion before I lock it?"**
WAIT for explicit confirmation.

## Phase 4 — Lock: branch + persist the plan

```bash
slug="<≤40-char kebab slug of the title>"
git checkout -b "feature/<work-id>-$slug"
mkdir -p .claude/plans
# the plan file is already written at .claude/plans/<work-id>-spec.md
```

**Write the cleanup follow-up plan**, if Phase 3 produced any cleanup slice. Same shape as
the main spec (header, DoD, iterations), at `.claude/plans/<work-id>-cleanup-spec.md`.
Never fold it back into the main plan. Its header depends on the `Cleanup:` answer:

- **`later`** → `Policy: manual`, so nobody runs it unattended by accident, and a first
  line stating the trigger that must hold before it may start. Tell the developer it
  exists and that it will produce its own PR when they run the workflow on it.
- **`now`** → same `Policy:` as the main plan, and the trigger line is **kept as the merge
  condition**: it no longer gates when the cleanup is written, it gates when its PR is
  marked ready. Its iterations run in this session after the feature plan, on a branch cut
  from the feature branch, and its PR targets that branch and stays a **draft** so merging
  the feature never drags the cleanup in with it.

**Never commit the plan, whatever the policy.** `.claude/` is gitignored in most
projects, so `git add .claude/plans/<work-id>-spec.md` exits 1 and the commit that
follows exits 1 too: an instruction to "lock the contract" as a commit silently
achieves nothing. The plan does not need to be tracked anyway. It is durable on disk
and every session reads it from there.

**Publish the plan to the GitHub issue, when one exists.** The issue is the right home
for it: one plan can produce several PRs (parallel tracks, and always a separate cleanup
plan), so a plan pasted into a PR body would repeat the whole contract on every PR while
each realises only a slice of it. In the issue it is stated once, and every PR points back
to it.

- The issue exists and `/goal:draft-issue` created it → update its body with the locked plan.
- The issue exists but you do not own it → post the plan as a comment.
- **No issue** → publish nothing. The plan stays on disk only, and PR bodies stand alone.
  Do not create an issue for this: `gh` stays untouched unless the developer asked for one.

Tell the developer where the plan now lives, and read the branch name back.

## Phase 5 — Hand off to Session 2 (one /goal per iteration)

Emit the canonical `/goal` handoff from `templates/goal-handoff.template`, filled
per that file's **"How to fill it"** section: `<plan path>` =
`.claude/plans/<work-id>-spec.md`, the spec's real test/lint commands, `<policy>` =
the chosen policy verbatim, `<delivery-mode>` = the spec's `Delivery mode:` line verbatim.
Fold the policy and delivery-mode blocks to the single active branch of each — an executor
reads its own mode, never the one it is not in. Respect the **≤ 4000-character hard limit**. The
developer pastes it once per iteration — it always picks the **next unchecked**
iteration, so the same text works every round.

Then tell the developer:

> Run `/goal` above. When it stops, read the synthesis, review the diff, and
> (in **manual** mode) commit the iteration yourself. Then run **`/goal:next`**
> before anything else: `/goal` verified itself, and `/goal:next` is the only step
> that replays the acceptance commands independently. Skipping it means a passing
> iteration is only ever self-certified. It also reconciles the plan with the code
> and re-emits the handoff. Then `/clear` and paste that handoff into a fresh
> session. Repeat until the spec has no unchecked iterations left.
>
> For a hands-off run you can use `tmux new -s <work-id>` + `claude`, but for the
> per-iteration review loop staying in one interactive terminal is simpler.

## Rules for THIS session

- **Do not write production code.** Every phase is clarification + contract only.
- **GitHub is optional.** Never call `gh` unless the source is a GitHub issue or
  the developer opted into a PR (commit+pr policy).
- **Lift, don't assume.** If tempted to "infer" an answer the executor will need,
  ASK instead. A Jira US's silence is a question, not a default.
- **Build the DoD.** The source rarely ships one — every business rule must land
  as a command-line check.
- **Every iteration is a vertical slice with a delivery strategy.** If you cannot
  say what is shippable after it, and how it reaches production while the rest is
  unfinished, it is a task — go back to `product:vertical-slice` step 2.
- **Slice sizing is the skill's call, not this command's.** "Smaller is better" is
  wrong as a blanket rule: the right size comes from the execution mode, and
  `product:vertical-slice` step 4 is where that is decided.
- **One question at a time.**
- **The spec is the contract.** Any Session-2 deviation updates the spec first.
