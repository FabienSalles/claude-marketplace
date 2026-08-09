---
description: Executable contract of the goal workflow (Session 1) — from a functional contract built by /goal:spec, or any source whose functional level is already settled, surface the technical consequences, map every business rule to a command-line check, decide delivery mode / commit policy / remote, decompose into gate-blocked iterations, persist the locked plan on a feature branch, then echo the per-iteration /goal handoff for Session 2. Never re-opens a functional question — a functional hole is a spec fault and goes back through /goal:spec.
argument-hint: A source — Jira key (CT-1234), GitHub issue number (42), a spec path (.claude/plans/x-spec.md), or 'inline'
---

# /goal:plan — Spec → locked plan → branch (Session 1 of the goal workflow)

You are helping the developer prepare an **autonomous `/goal` execution** that
delivers working code. THIS session is purely interactive — lift every
technical ambiguity and lock the executable Definition of Done NOW, because
once `/goal` starts in Session 2 it cannot ask the developer anything.

The levels are split. **What** must become true — business rules, each with an
observable acceptance criterion — is `/goal:spec`'s contract. THIS session owns
**how**: the technical consequences, the command each rule is proven by, the
delivery decisions, the iterations, the lock. A raw source (a Jira US straight
from the sprint) is welcome here — Phase 1 rules on whether its functional
level is settled, and runs `/goal:spec` first when it is not.

> Companion docs: this plugin's `README.md` (full workflow), `templates/done-criteria.template` (acceptance-criteria baseline), `templates/goal-handoff.template` (the canonical `/goal` handoff both `/goal:plan` and `/goal:next` emit).
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

**Spec-first — check the local artifact BEFORE any external I/O.** For a Jira
key or an issue number, the work-id is derivable from the argument alone (no
network): `CT-5856` → `ct-5856`, `42` → `issue-42`. So **first** look for
`.claude/plans/<work-id>-spec.md`:
- **It exists** → `/goal:spec` already ran and captured the source (Jira/issue
  content, business rules, decisions) into that contract. It is the **primary
  source** — read it, do NOT re-fetch Jira/gh to rebuild what it already holds.
  Only call the Atlassian MCP / `gh` to fill a **specific gap the contract
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
- **Only if the source is a GitHub issue AND no local spec covers it:** `gh auth status` succeeds
- **Only if the source is Jira AND no local spec covers it:** the Atlassian MCP resolves (`getAccessibleAtlassianResources` returns a resource). When the spec-first check found `.claude/plans/<work-id>-spec.md`, skip this — no MCP/OAuth needed.

Do **not** require `gh` for a Jira/file/inline source. If a needed check fails,
STOP and tell the developer what to fix.

Optional pointer (do not block on it): if the source is **not** a GitHub issue
and the developer might want one for tracking, mention once: _"No GitHub issue
backs this source — run `/goal:spec <source>` first if you want one mirrored.
Otherwise I continue local-only."_ Default: continue local-only.

## Phase 1 — Read the source, and rule on the functional level

Summarize the source in 5–10 lines:
- What the developer wants (the business need), and what is already settled
- Which files/modules you suspect are involved
- **Technical consequences** the source doesn't mention (migrations, cross-service
  couplings, contract changes)
- Whether the functional level is settled

Then rule, explicitly, before any question:

- **The artifact came through `/goal:spec`** (`Status: spec`, business rules with
  observable criteria) → the functional level is settled. Its `## Flags for
  /goal:plan` and `## Deferred decisions` sections are this session's inbox.
- **Raw source, and no functional question is needed** — the happy path, the
  business rules and the scope are all extractable without inventing anything →
  normalize them into the spec sections yourself (mechanical extraction, zero
  invention) and say you did.
- **Raw source, and at least one functional question exists** → **invoke the
  `goal:spec` skill now** and run it to its handoff in this session, then resume
  here. The functional grill lives there and only there — this command never
  improvises its own, because a functional answer that lives only in this
  conversation is lost to the next session, while one in the contract is not.

Ask: **"Is my reading correct? Anything to add before the technical grill?"** WAIT.

## Phase 2 — Technical grill (one question at a time)

Goal of the grill: **surface every technical consequence and map every business
rule to a command-line check**, so the plan is executable without further human
input. Pick the best available interview approach, in order:

1. **`pocock:grill-with-docs`** if installed AND `CONTEXT.md`/`docs/adr/` exist.
2. **`pocock:grill-me`** if installed.
3. **Inlined baseline** (below) — always works.

### Inlined baseline questions (fallback)

Ask one at a time, each with your recommended answer. Skip anything the source
already answers.

**Round 1 — the system (surface technical consequences):**
- Mockups / Figma / design docs referenced?
- Cross-project couplings? (API client here, endpoint elsewhere — scan another repo?)
- Where does data come from? (new API, existing DB, hard-coded, external)
- Migrations, schema changes, or contract changes implied?
- Constraints not derivable from the code? (deadlines, legal, team decisions)
- Anything else invisible in the code I should know?

**Round 2 — verifiability + Definition of Done (always ask):**
- For **each business rule** in the functional contract: what command-line check proves it holds?
  (a test command, a lint rule, a build output) — this is how the DoD gets teeth. Take
  the command they can run, not the name of a test: a name is proof of nothing once it
  is renamed, and only the command is replayed later.
- For **each business rule**: which test **owns** it? Pick the level where the intent reads
  best (`craft:testing-principles` §14) — an E2E command is right when the full-chain test
  states the rule plainly, wrong when its assertion would scrape the DOM for a consequence
  a lower level owns. "Every rule → the controller test" is a plan smell; the gate's
  `test_files` must name the owning test.
- Any **mechanism claim** ("X produces the violation", "the framework returns Y") enters
  the plan verified by a probe (scratch script, grep into vendor), or carries the word
  **hypothesis**. An unverified mechanism claim costs a full RED cycle downstream.
- What is the smallest command that proves the whole thing works end to end?
- What must **not** change as a side-effect? (files / behaviors to protect)
- What are the project's actual test and lint/QA commands? (dockerized where
  applicable — do not assume host-level runners)
- For every enumerated command set (a gate's `gate1..N`, a DoD's `dod1..N`): are the
  commands independent — no shared database, fixtures, or written cache? When yes, combine
  them into **one** gate command with a grouped-output failure-propagating runner: `make -j
  --output-sync=target`, `npm-run-all -p`, and `concurrently -n` are the approved forms.
  `cmd1 & cmd2 & wait` is refused — it interleaves output and can swallow a non-zero exit
  code, so a real failure reads as green.

### Stop condition

Stop grilling when: every technical consequence is on the table, every business
rule maps to a command-line check, and no "it depends" remains. Typical: 5–15
questions for a small US, more for a feature. **One question per message** — batch questionnaires
reduce signal.

## Phase 2b — Functional holes found here go back, not forward

The adversarial grill (states, invariants, transition matrix) is `/goal:spec`'s,
and by now it already ran or was explicitly skipped — the contract's
`Adversarial grill:` line says which. Do not re-open it here.

When this session surfaces a functional hole anyway — a business rule nobody
wrote, a transition nobody resolved — that is a **spec fault**: stop, fix the
functional contract first (through `goal:spec`, or by hand for a one-line
amendment the developer dictates), then resume planning. Deciding it inline "to
keep moving" is how a plan diverges from the contract it claims to execute.

When the contract carries `## States, invariants & transitions`, every invariant
becomes a **sequence test** in the decomposition below (drive the action series,
assert the invariant holds throughout) — assigned to an owning iteration or
marked **transverse** (re-verified at each iteration's DoD). Do not freeze
iterations while an invariant has no owner.

## Phase 2c — The decisions that shape the plan

All are asked **before** decomposing, because they change the plan itself and not just
what happens to it afterwards. `product:vertical-slice` sizes and orders slices from the
execution mode, and `product:delivery` picks a strategy from what the change may break.
Decomposing first and asking after produces a plan built for the wrong mode.

**B is asked first, because `manual` switches the git questions off.** A developer who
keeps the default reviews, stages and commits everything themselves, so nothing in this
session may then ask them about pushes, pull requests or remotes: C resolves to `later`
unasked, and D is skipped entirely.

### B — Commit / PR policy

Ask (this controls what an execution session is allowed to do, and how big a slice should be):

> **How should the execution sessions handle commits and the PR?**
> - **manual** (default) — I never commit, push, or open a PR. After each
>   iteration I stop with a synthesis; you review and commit yourself.
> - **commit+pr** — I commit each iteration myself (conventional message, no
>   `Co-Authored-By` trailer), push, and keep a PR (requires a GitHub remote).
>   It is opened as a **draft at the first commit** and every later iteration
>   updates that same PR, so you can watch the work land instead of waiting
>   for the end. It goes ready for review at the last iteration. This is what
>   `/goal:supervise` needs.

WAIT for the answer. Then **write it into the spec's `Policy:` header line**, and use the
same value as `<policy>` in the handoff verbatim.

The spec is what makes it durable. `/goal:next` reads the policy from the plan and falls
back to `manual` when it cannot find it, so a policy that lives only in the pasted handoff
is lost to a fresh session or a compaction, and the run silently degrades to manual.
`/goal:supervise` has the same need, and reads it before it will start at all.

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

### C — When does the cleanup happen? (only under `no-bc-break` + `commit+pr`)

Ask only if the plan will actually introduce a flag or a compat path. No flag, no cleanup,
no question. Under `manual`, do not ask either: record `later` — the follow-up plan is
written at lock time all the same, and the developer runs it when its trigger holds. The
`now` branch below is PR machinery, and manual has none.

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

### D — The remote it pushes to (only under `commit+pr`)

Ask this **here**, while the developer is in front of you, because an execution session runs
without them: a command that stops at 3am to ask which remote to push to does not ask, it
blocks — or worse, it guesses.

Under `manual` nothing pushes and nothing opens a pull request: skip this question and
write **no `Remote:` line at all**. A later switch to `commit+pr` hits `/goal:supervise`'s
refusal of a plan without one, which is exactly the moment to add it.

Run `git remote -v` first and show what exists, then ask:

> **Which remote should a run push to?** It is also the repository its pull request opens on.
> - **origin** (usual) — the repository you cloned.
> - **another name** — on a fork, this is what keeps the work on *your* fork. `gh pr create`
>   targets a fork's **parent** by default, so without this a run would push to your fork and
>   open its pull request on somebody else's repository. You then open the real pull request
>   upstream yourself, once the work convinces you.

WAIT for the answer, then **write it into the spec's `Remote:` header line**. There is no
default and none is inferred: `/goal:supervise` refuses a plan whose header does not carry it,
which is the point — the cost of a wrong guess is borne by whoever owns the repository the
guess lands on.

One line, not two. Pushing to one repository and opening the pull request on another is a
real thing to want, and deliberately not automated here: that second step is the manual
validation gesture.

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
granularity — step 4's direction: under `manual`, fine slices, one reviewable diff per
sitting; under `commit+pr`, fatter slices are allowed, because the gate and the
close review carry the verification and every iteration costs a fresh session — provided
the gate commands widen with the diff. Do not restate its rules here — apply
them, and let the plan show the result.

What this command owns, and the skill does not, is everything below: the plan's file
format, the cleanup carve-out, and persistence.

**A plan is one sequence, and `/goal:supervise` runs one plan.** The workflow has no parallel
mode: it works in the directory it was launched from and knows nothing of worktrees. So a
plan is a flat list of iterations, with no parallel section inside it.

**When the work genuinely splits, that is several plans, not one plan with branches.** Write
each part as its own self-sufficient plan file, and the developer launches one run per file —
the concurrency cap is per workflow, so nothing is lost. Two things make that split real
rather than decorative, and both are your job here, while a human can read the result:

- **The file sets must be provably disjoint.** The union of one plan's `test_files` +
  `impl_files` shares no path with another's. One shared file and the two runs conflict at
  merge, whatever the story says. Check it before proposing the split.
- **A shared foundation is extracted, not ignored.** Candidate parts usually share one
  artefact the others depend on — a validation script, a schema, a rename that renumbers
  every call site. That overlap is not proof the work is sequential: it is a foundation. It
  becomes its own plan, first, and the remainder splits behind it with a **Trigger** line
  naming the merge it waits on. Only conclude "sequential" when the remainder, foundation
  removed, still shares files.

Good candidates: work organized per module, per plugin, per bounded context, per package in
a monorepo. Bad candidates: a shared refactor everything else builds on, anything touching a
common config, migrations that must run in order.

Do not invent a split to look parallel: a false split is two pull requests that conflict at
merge, discovered after both runs have paid for themselves.

### What a split actually writes

One file per part, named `.claude/plans/<work-id>-<suffix>-spec.md`, where the suffix says
what the part delivers — `astro`, `marketing`, `foundation`. Each is an ordinary plan and is
run the ordinary way: `/goal:supervise .claude/plans/<work-id>-<suffix>-spec.md`.

**Every one carries the full header**, copied rather than inherited: `Policy:`,
`Delivery mode:`, `Cleanup:` and `Remote:`. Nothing inherits anything, because each file is
read alone by its own run — and a plan whose header lacks `Remote:` is refused at preflight
rather than defaulted. "Self-sufficient" is literal here, not a figure of speech.

Then one index, `.claude/plans/<work-id>-plans.md`. **Not `-spec.md`**: `/goal:supervise` with no
argument resolves the most recently modified `*-spec.md`, and the index is written last, so
naming it `-spec.md` would make it the file a bare launch picks up and tries to run.

The index carries three things and nothing else — the set, the order, and the command:

````markdown
# Plans: <title>

Work-id: <work-id>
Written by /goal:plan on <date>. Ordering only — each plan is authoritative about
itself, and its own `Trigger:` line is what a run reads.

## Order

1. `.claude/plans/<work-id>-foundation-spec.md` — <one line>. Nothing waits on it.
2. Then, in parallel, one run each:
   - `.claude/plans/<work-id>-astro-spec.md` — <one line>
   - `.claude/plans/<work-id>-marketing-spec.md` — <one line>

## Launch

```bash
/goal:supervise .claude/plans/<work-id>-foundation-spec.md
# once its pull request is merged, then in separate sessions:
/goal:supervise .claude/plans/<work-id>-astro-spec.md
/goal:supervise .claude/plans/<work-id>-marketing-spec.md
```
````

**It never copies a plan's content.** Not the iterations, not the Definition of Done, not the
gate blocks: those change at every slice, and a copy of them is stale by the second commit.
This plugin's own issue once advertised a script its pull request had deleted — duplication
is the fault, and refreshing a copy more often does not fix it.

**The dependency lives in each plan's `Trigger:` line, not in the index.** The index displays
the order; the plan enforces its own precondition. When the two disagree it is the plan that a
run obeys, which is also why an index nobody updated cannot silently reorder anything.

### The index is checked, not trusted

A list written once and never verified is a list whose holes are found the day a pull request
is missing. So **every split plan's global DoD carries this line**, which fails if any sibling
plan is absent from the index or any listed file has disappeared:

```
dodN=for f in .claude/plans/<work-id>*-spec.md; do grep -q "$(basename "$f")" .claude/plans/<work-id>-plans.md || exit 1; done; for f in $(grep -oE '<work-id>[a-z-]*-spec\.md' .claude/plans/<work-id>-plans.md); do test -f ".claude/plans/$f" || exit 1; done
```

Both directions matter and neither implies the other: the first catches a plan added later and
never listed, the second an entry pointing at a file that was renamed or deleted.

**Two `for` loops, and deliberately not a pipeline.** `grep … | while read -r f; do … exit 1;
done` reads better and is wrong here: the `exit` fires inside the pipeline's subshell, and
whether that ends the loop, the gate command, or the calling shell depends on which shell runs
it. Measured on this repository, the pipeline form killed the parent shell outright. Command
substitution in a `for` keeps `exit` in the one shell the gate spawned, which is the only shell
whose exit code anything reads. Adding a
sibling to the split therefore breaks every sibling's DoD until the index names it, which is
the cheapest possible reminder and the whole point of the line.

A single-plan spec writes no index and carries no such line — there is nothing to lose track
of, and a checklist with one entry is ceremony.

**Under `commit+pr`, every iteration carries a `gate` block, and that block is
what runs.** The acceptance criteria used to be prose, translated into gate commands at run
time: a model reading "the project test command exits 0" and deciding,
alone and unattended, which command that is. The block removes the translation. It is written
here, while the developer is present to read it, in the exact `key=value` form `goal-gate.ts`
already consumes, so it is copied verbatim rather than interpreted.

Four things the block's shape asks of you, all mechanical downstream. `test_files` and
`impl_files` are separate because the gate sets the second aside and requires `gate1` to fail
without it: a slice whose test passes either way is refused. `gate1` is therefore the one
acceptance criterion — it is bitten, and it must pass three times in a row — where `gate2..N`
are supporting lints. `max_diff` is the line ceiling you set while awake, enforced while you
are not — and where the granularity from `Policy:` lands as a number: fine under `manual`,
fatter under `commit+pr`, never past one functional outcome. And a slice with
nothing to test declares `test_files=` empty, which skips the bite rather than faking it.

**A slice proving the absence of more than one obsolete form writes one `gate1`, not several.**
The bite check only ever sets aside the implementation and re-runs `gate1`; `gate2..N` are never
replayed against the pre-implementation tree, by the bite check or by `/goal:supervise`'s own
preflight, which excludes `gate1` alone from its base-must-already-be-green sweep. A second
absence assertion placed in `gate2` is invisible to both: nothing proves it ever failed before
the fix, and a preflight run right after the plan is written halts on a base the sweep reads as
red, for a check nobody meant to gate the base. Chain every "must no longer appear" assertion
into `gate1` with `&&` instead — `gate1=! grep -rq <first> <dirs> && ! grep -rn <second> <dirs>
| grep -vqi legacy` — so the one command that gets bitten, replayed three times, and exempted
from the base sweep is the one actually carrying every removal this slice makes.

Write only commands that can fail. `git diff --stat` and `git status` do not belong in it:
the gate script checks scope leak and parasitic artifacts structurally, so such a line is a
gate that always exits 0. A criterion no command can express does not go in the block either
— put it under **Not machine-verifiable**, where it stays visible instead of vanishing from
the gate. **A slice whose core deliverable lands there cannot be verified unattended**: say
so now, because `/goal:supervise` halts on an iteration with no `gate1`.

Use the project's real commands, dockerized where the project is, and check each one runs
today. A command that does not exist yet is a halt at iteration 1, not at review time.

**Name the generated tooling once, on the header's `Incidental:` line.** A lockfile, a
`tsconfig.json`, a CLI's own config file: the slice does not author them, it provokes them by
installing a dependency or initialising a tool. Left undeclared they read as a scope leak, and
the gate refuses an implementation that is otherwise exactly what the plan asked for — which is
a complete slice discarded over a file nobody wrote. Declaring them per iteration does not work
either: a lockfile moves on whichever slice touches a dependency, so the list is wrong by the
next one. Ask what the first `install` or `init` of this stack drops in the tree, and write that.

Incidental paths are tolerated by the scope check and **staged with the commit**, so the tooling
lands in the repository; they are deliberately excluded from `max_diff`, since generated lines
are not the slice's work. Never put a secret-bearing or vendored path there: `.env`,
`node_modules/`, private keys and keystores are refused whatever any declaration says.

**When the plan builds the project itself, say which iteration does it, on the `Bootstrap:`
line.** `/goal:supervise` refuses to start against a base whose own commands are already failing, and
on an empty repository they all are: there is no manifest yet, so the test runner exits before it
looks for a test. That is not a defect the run would inherit, it is the absence the plan exists to
fill — but the check cannot tell the two apart, and left to itself it makes a bootstrap plan
unrunnable. Name the iteration that creates the toolchain and the check stands down until it is
ticked, then resumes for every launch after it.

Write it only when it is true. A plan that builds and tests today has a base worth checking from
the first launch, and a `Bootstrap:` line there buys nothing while switching off the check that
catches a red base before it costs a full implementation.

**Cleanup never belongs to this plan.** Removing a flag, dropping the old column, deleting
the compat shim: all of it waits on a condition this plan cannot satisfy, because the
condition is that the change is *live* and the new path has proven itself. A cleanup slice
in the same plan is a slice whose trigger fires after its own PR is merged, which is a
contradiction, and in an autonomous run it is worse: the agent would delete the fallback in
the same PR that introduces the thing it falls back to.

So collect every cleanup slice into a separate **follow-up plan**, written at lock time as
`.claude/plans/<work-id>-cleanup-spec.md`. Each keeps its **Trigger** line (the production
evidence that must hold first) and its proof. It becomes its own PR later, when the
developer runs the workflow on that plan. Nor does it become one of the sibling plans a
split produced: those are launched alongside each other, and cleanup is strictly after.

**Write only what stays true as long as the iteration has not changed.** A plan statement
that an event outside the slice's scope can falsify is a lie waiting to happen, and the next
cold session acts on it. Durable, so it belongs in the plan: the branch, a commit's
**subject** (its conventional message), the business rules covered, which gates are green and
which are red, the files touched, the decisions and trade-offs, the implementation traps.
Volatile, so it never becomes a plan claim: the hash of a commit on the working branch (an
upstream hash already pushed stays citable — it is not rewritten), test counts, assertion
counts, coverage percentages, and test method names cited as proof that a rule is covered. A
rebase rewrites a hash, and a commit from another feature adding a test to the same file moves
the counts. Business rules map to **commands** in the `gate` and `dod` blocks, which are run;
that is what replaces a number nobody re-measures.

Persist at `.claude/plans/<work-id>-spec.md`:

````markdown
# Spec: <title>

Source: <Jira CT-1234 | gh issue #42 URL | spec file path | inline>
Work-id: <work-id>
Policy: <manual | commit+pr — filled in Phase 2c>
Delivery mode: <no-bc-break | allow-bc-break — filled in Phase 2c>
Cleanup: <later | now | none — none when allow-bc-break or no flag was introduced>
Remote: <the git remote a run pushes to, and the repo its PR opens on — filled in Phase 2c D. Omit the line entirely under manual>
PR base: <branch the pull request targets — omit entirely when it is the repository's default, and always under manual>
Incidental: <generated tooling every slice may touch — a lockfile, a tsconfig, a CLI's own config. Omit when the project generates none>
Bootstrap: <the iteration that creates the toolchain the acceptance commands need. Omit when the project already builds and tests today>

## Business intent

<Carry the four need fields forward **verbatim** when `/goal:spec` produced them —
Problem, Objective, Success signal, Affected. When the source came straight here without
passing `/goal:spec`, build them now: they are what the whole plan is measured against, and
no later phase can reconstruct them.>

**Problem.** <what fails today, with the evidence — an incident, a measurement, a file and line>

**Objective.** <what must become true, as an outcome, not as a solution>

**Success signal.** <how you would know it worked in the real world, distinct from the DoD>

**Affected.** <who lives with the problem, and what changes for them>

<Then 1–3 paragraphs connecting them, in the developer's domain vocabulary.>

## Scope IN
- <what's in>

## Scope OUT
- <what's explicitly NOT in this delivery>

## Business rules (each must map to a command in the DoD)
- <rule> → verified by <the command that proves it>
- <rule> → verified by <the command that proves it>

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

<One flat list of iterations, numbered once across the plan. A plan that splits becomes
several plan files, each with its own flat list, never one file with parallel sections.>

### Iteration 1 — <name>
- [ ] Not done yet
- **Goal:** <the slice's user-visible/behavioral outcome>
- **Shippable after it:** <what is really usable/observable in prod once this lands>
- **Files to touch:** `<path>` (+ `<path>` (test))
- **Business rules covered:** <subset of the rules above>
- **Delivery:** <additive | flag `<name>` off by default | expand step of expand/contract | …>
- **Not machine-verifiable:** <criteria no command can express, or "none">

```gate
test_files=<the slice's test paths, or empty when it has nothing to test>
impl_files=<bare space-separated repo-relative paths, a subtree as a trailing slash>
max_diff=<added+removed line ceiling for this slice>
commit_msg=<conventional message, no Co-Authored-By trailer>
gate1=<test command scoped to this slice — the one criterion, bitten without the implementation>
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
test_files=
impl_files=<bare space-separated repo-relative paths>
max_diff=<added+removed line ceiling for this slice>
commit_msg=<conventional message>
gate1=! grep -rq <flag name> <src dirs>
gate2=<test command>
gate3=<project lint/QA>
```

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

**Write the split plans and their index**, if Phase 3 produced a split. One
`.claude/plans/<work-id>-<suffix>-spec.md` per part, each with the full header copied, then
`.claude/plans/<work-id>-plans.md` listing them in order — and the index-check line in every
split plan's global DoD. Write the index **last**, once every plan it names exists, or its
own check fails on the first plan the developer runs.

Read the launch commands back to them, one per plan, and say plainly which may run at the
same time and which waits on a merge. A split whose order lives only in this conversation is
a split the developer reconstructs from file names at midnight.

**Never commit the plan, whatever the policy.** `.claude/plans/` is gitignored in most
projects, so `git add .claude/plans/<work-id>-spec.md` exits 1 and the commit that
follows exits 1 too: an instruction to "lock the contract" as a commit silently
achieves nothing. The plan does not need to be tracked anyway. It is durable on disk
and every session reads it from there.

**Refresh the issue's intent projection, when an issue exists — and never publish the plan
there.** The **intent projection** is the part of the spec that does not move: `## Business
intent`, `## Scope IN`, `## Scope OUT`, and the gaps. That is what an issue is for.

The iterations, the Definition of Done and the `gate` blocks stay **out** of it. They are the
part that lives: every slice adds an "As built" note, decisions get refined, iterations are
appended when a real run finds something. An issue holding a copy of that is stale by the
second commit and actively misleads a reader — this happened on this plugin's own issue, which
advertised a script the PR had deleted. Duplication is the fault; refreshing a copy more often
does not fix it, it only pays for it more often.

Where each thing lives, and why: the **plan** is local and gitignored, so it can move freely.
The **PR body** is rewritten at every slice, so it is the live view of what actually landed.
The **issue** is the log — the why, the boundaries, and the pointers.

- The issue exists and you can edit it → rewrite its body with the intent projection, and add
  one line saying the executable plan lives locally and that the PR body is what shows the work.
- The issue exists but you do not own it → post the projection as a comment instead.
- **No issue** → publish nothing. The plan stays on disk only, and PR bodies stand alone.
  Do not create an issue for this: `gh` stays untouched unless the developer asked for one.

**Refresh it whenever the intent changes, and only then.** The grill routinely sharpens the
problem statement or moves a line of scope; when it does, the projection is republished before
you hand off. An autonomous run never touches those sections — the plan hash forbids it — so it
has nothing to resynchronise, which is why this is a Session 1 responsibility and not a loop's.

Tell the developer where the plan now lives, and read the branch name back.

## Phase 5 — Hand off to Session 2 (one /goal per iteration)

Emit the canonical `/goal` handoff from `templates/goal-handoff.template`, filled
per that file's **"How to fill it"** section: `<plan path>` =
`.claude/plans/<work-id>-spec.md`, the spec's real test/lint commands, `<policy>` =
the chosen policy verbatim, `<delivery-mode>` = the spec's `Delivery mode:` line verbatim.
Fold the policy and delivery-mode blocks to the single active branch of each — an executor
reads its own mode, never the one it is not in. Respect the **≤ 4000-character hard limit**:
write the filled block to a file, run `wc -m < <file>`, compress and re-count while it exceeds
4000, and print the count with the block. **That file is only a counter** — `cat`-ing it in a
tool call does not count as having shown the block, since tool output goes to the model and not
reliably to the developer. The filled block goes **in full into your final message**, as one
copy-paste block. The
developer pastes it once per iteration — it always picks the **next unchecked**
iteration, so the same text works every round.

**Under `manual`, offer the clipboard before printing.** The counter file already holds
the exact block, so ask with `AskUserQuestion`: _"Copy the `/goal` handoff to the
clipboard?"_

- **yes** (recommended) → `pbcopy < <file>` (macOS; `xclip -selection clipboard` or
  `wl-copy` where `pbcopy` does not exist). The block is in the clipboard, so do **not**
  print it again — the one exception to the in-full rule above. Close with one line:
  the handoff is in the clipboard, to paste after `/clear`, and the counter file is the
  recovery copy if the clipboard is overwritten first.
- **no** → print the block in full in the final message, as one copy-paste block.

Then tell the developer:

> Run the `/goal` handoff — printed above, or from your clipboard when you chose the
> copy. When it stops, read the synthesis, review the diff, and
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
- **No git question under `manual`.** B is asked first; on `manual`, C resolves to
  `later` unasked, D never fires, and no `Remote:` line is written.
- **Lift, don't assume.** If tempted to "infer" an answer the executor will need,
  ASK instead. A Jira US's silence is a question, not a default.
- **Map the DoD.** The functional contract says what must be observable; every
  business rule leaves here with the command that proves it. A rule without a
  command is not planned.
- **Never re-open a functional question.** A functional hole surfacing here is a
  spec fault: amend the functional contract first (Phase 2b), then keep
  planning. The grill here is technical only.
- **Every iteration is a vertical slice with a delivery strategy.** If you cannot
  say what is shippable after it, and how it reaches production while the rest is
  unfinished, it is a task — go back to `product:vertical-slice` step 2.
- **Slice sizing is the skill's call, not this command's.** "Smaller is better" is
  wrong as a blanket rule: the right size comes from the execution mode, and
  `product:vertical-slice` step 4 is where that is decided.
- **One question at a time.**
- **The spec is the contract.** Any Session-2 deviation updates the spec first.
