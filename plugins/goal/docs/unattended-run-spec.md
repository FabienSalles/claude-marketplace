# Making an unattended run reach the end — working spec

**Status: nothing here is decided.** This is a working document, not a locked plan and not a
description of what ships. `roadmap.md` holds what is still moving in the current design; this
file holds a proposed change of design, written from one session of reading the code against
three brakes the developer named. Every claim carries its `file:line` so a later pass can
re-check it instead of re-deriving it.

The three brakes, in the developer's words:

1. `/goal:auto` can stop for anything, so a night is never delivered whole.
2. The sequential/parallel plan split needs one launch per plan, by hand.
3. No run produces a **running application** anyone can look at, so anything the plan failed
   to say about the interface is invisible to every check.

---

## 0. What a run costs today, measured from the code

### The runner indirection

A workflow script has no shell, so every command crosses through a `goal-runner` subagent. In
steady state one iteration spends **9 agent spawns, 8 of which only run a shell command**:

| Call | `workflows/goal-auto.js` |
|---|---|
| `readControls` | :737 |
| `section:N` (a `sed`) | :761 |
| **implementer** (the only real work) | :764 |
| `touched:N` (a `git status --porcelain`) | :785 |
| `gate:N` | :799 |
| `scan` + `push` | :182, :188 |
| `plan-facts` (a `sed`) | :213 |
| `pr:edit` | :727 |

A full model round-trip to execute `sed -n` is the bulk of the per-iteration latency, and none
of it is verification.

### The gate's own replays

`commands.ts:44` replays `gate1` twice more, `bite.ts:89` a fourth time. On the real plan
`ct-5659` every gate command is a `docker compose run --rm`, so iteration 4 costs **9 container
boots**: 3 declared gates, 2 determinism replays, 3 distinct regression-wall commands, 1 bite.
Container boot dominates suite time on that stack.

**Correcting a plausible misreading:** the regression wall (`cross-iteration.ts:14`) deduplicates
by command string, so it converges on the plan's set of distinct commands. It is **not**
quadratic, and it is not where the cost is.

### Publication per iteration

`mirror()` runs on every green iteration (`:874`): scan, push, plan-facts, PR edit. Four agent
spawns and a network push to rewrite a PR body nobody reads before the end.

---

## 1. Found while reading: the lenses have never run

`goal-auto.js:916` enters the Lenses phase only when `input.lenses === true`. `auto.md:219`
launches the workflow without that field. **No run has ever executed a lens.**

The `completeness` lens asks (`goal-auto.js:297`):

> *"What does the plan's Business intent imply that no iteration of it covers?"*

That is exactly the question that would have surfaced the two interface elements missing from a
recent run: present in the design, absent from the plan, therefore invisible to every gate. The
mechanism exists and is inert. Cheapest correction in this document.

---

## 2. Halt taxonomy

"Retry more" is the wrong answer. The halts have to be classified before any of them is touched.

| Class | What halts | Verdict |
|---|---|---|
| **A. The code is wrong** | `runGates` (gate1..N), `biteCheck` | Must halt. Not negotiable. |
| **B. The plan was wrong about itself** | `scopeCheck`, `budgetCheck`, `removalCheck` | **This is where the nights die.** |
| **C. Infrastructure** | push rejected, `gh` 5xx, runner returning `-1` | Should retry |
| **D. Flakiness** | `determinismCheck`, regression wall on a stateful command | Says nothing about the code |

Class B is nobody's fault: `max_diff=260` was written by a model three days earlier, and
`impl_files` cannot foresee the translation file the slice legitimately needs. Worse,
`goal-gate.ts:66` runs `budgetCheck` **before** any command, so a slice whose tests all pass can
die on an estimate without ever having run them.

---

## 3. The core finding: `impl_files` holds four jobs at once

Removing the scope check is not available as written, and the reason is not the obvious one.

| # | Job | Where |
|---|---|---|
| 1 | **The staging list** | `scope.ts:135` stages *only* the declared paths |
| 2 | The blast radius of an unattended run | `scope.ts:64` |
| 3 | The disjointness proof that makes a split safe | `run-issue.md:340` |
| 4 | The bite check's set-aside selection | `bite.ts:60` |

Job 1 is decisive. Drop the check and leave the rest alone and you do not get permissiveness:
the file is written, never committed, and the branch ships without it. The iteration is green
and incomplete at the same time, which the gate already names in its own words about gitignored
paths (`scope.ts:30`).

**The fault is the conflation.** Three of those jobs are *safety bounds*, which a human can
declare correctly. The fourth use in practice is a *technical prediction*, made at planning time
by a model that has not opened the files. Fusing them means **a bad prediction becomes a safety
violation**. `budgetCheck` has the identical pathology with `max_diff`.

The design already half-admits the distinction: the `Incidental:` header line exists precisely
for this, *"widen what is tolerated, never what is expected"* (`scope.ts:60`). It only requires
foresight, which is the original problem.

### Proposed: three tiers instead of a binary

| The changed file is… | Today | Proposed |
|---|---|---|
| outside the coarse bound | halt | **halt** (rare, and genuinely alarming) |
| inside the bound, outside `impl_files` | halt | **staged, committed, recorded** |
| inside `impl_files` | nothing | nothing |

The coarse bound need not be hand-written: the parent directories of the already-declared paths
give it for free. On `ct-5659` that yields `src/Infrastructure/Api/Subscription/FundSource/`,
`templates/subscription/fund_source/`, `translations/`. An unforeseen translation file lands in
tier 2; anything under `src/Domain/` stays a halt.

**The feedback loop the developer asked for already has a home.** The auditor is mandated to say
what recurs across runs (`goal-auto.js:391`). A "the planner never predicts translation files"
that shows up three times is a fix to `/goal:run-issue`, not a lost night. Cost: one more field
in the audit report.

**Implementation trap:** tier-2 files that are not tests must join the bite check's set-aside
list, or an implementation can hide in an unlisted file and weaken the check.

### `Incidental:` stays, and is not absorbed — settled

The header line (`plan.ts:126`) already exists for **generated** tooling a project cannot help
producing: a lockfile, a tsconfig. It grants a path exactly four properties:

| Behaviour | `impl_files` path | `Incidental:` path |
|---|---|---|
| Passes the scope check | yes | yes (`scope.ts:63`) |
| Counted in `max_diff` | yes | **no** (`goal-gate.ts:66` receives `paths`, not `allowed`) |
| Subject to `removalCheck` | yes | **no** (`goal-gate.ts:67`) |
| Staged and committed | yes | yes (`scope.ts:135`) |
| Set aside by the bite check | yes | no (`bite.ts:60` filters on `impl_files` only) |

Its rationale (`plan.ts:116`) — *"a lockfile moves on whichever slice happens to touch a
dependency; a per-slice list is a prediction that is wrong by the next one"* — is the same
argument this section makes about `impl_files`. It is the precedent, not a competitor.

**The two cover disjoint cases**, so neither replaces the other:

- **Tier 2** is **authored** work, unforeseen, but *near* what was declared: a translation file
  under `translations/`, which is the parent directory of a declared path.
- **`Incidental:`** is **generated** work, anywhere: a `composer.lock` at the repository root,
  whose parent directory is never a parent of a declared path. It falls **outside** the coarse
  bound, lands in tier 1, and would halt. Tier 2 does not even reach it.

They must also be treated differently. A tier-2 file is authored: it **must** count toward
`max_diff` (soft band, §4) and **must** face `removalCheck`. Those exemptions only make sense for
generated content.

| | Scope | `max_diff` | `removalCheck` | Staged | Bite set-aside |
|---|---|---|---|---|---|
| `impl_files` | declared | counted | yes | yes | yes |
| **tier 2** (new) | tolerated **+ recorded** | counted | yes | yes | yes |
| `Incidental:` | tolerated | **exempt** | **exempt** | yes | no |

`Incidental:` keeps the exemptions and stays the only row that has them.

### The conclusion on freezing

Do not freeze the prediction. Do not unfreeze everything either. **Freeze the bound, free the
prediction.** `impl_files` stays useful as a description of what the slice targets and as the
bite check's selector; it stops being a guillotine.

---

## 4. `max_diff` as a soft band

Halt beyond a factor (2×, 3× — undecided), otherwise record the overshoot in the audit. The
signal survives, the night survives. Same reasoning as tier 2 above, applied to the other
planning-time estimate.

---

## 5. Recovery budget, class C only

Two attempts, on push rejected / `gh` non-zero / runner returning `-1`. **Never** on a gate
verdict. The classes and budgets are already written in `loops.md:52` and nothing implements
them.

---

## 6. Refused on purpose

**Resuming the iterations after a halt**, even when their declared files are disjoint from the
halted one. `pending.slice(stopped.from)` abandons everything after, and making that conditional
would put a second execution mode inside one code path — the exact defect `why-not-parallel.md:57`
documents and that this harness has already paid for once.

---

## 7. One command for every track

The shape already exists in the notes and is unbuilt: `loops.md:88`, *queue drain*, a `for` over
**plans** rather than iterations. The `Workflow` runtime exposes `workflow(ref, args)`, which
runs a child workflow inline, one level deep.

```js
for (const plan of order) {
  const result = await workflow({scriptPath: 'goal-auto.js'}, {plan, gate})
  if (result.status !== 'done') break
}
```

This is not parallelism inside the workflow. It is sequential nesting, the Temporal
child-workflow shape `why-not-parallel.md:129` explicitly endorses.

**Be honest about what it does not buy:** no tokens. It removes the human gesture between two
plans, nothing else.

### The real blocker is not the command, it is `Trigger:`

A split with a foundation reads "run foundation → wait for its PR to merge → run the rest". The
`Trigger:` line encodes that wait. **Nobody merges at 3am**, which is what makes an unattended
multi-plan run impossible today.

### Stacked pull requests remove exactly that wait

From the [GitHub changelog](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/),
in public preview: each PR targets the layer below it; merging the topmost ready PR lands it and
every unmerged layer below in one operation; merging a lower layer leaves the ones above open and
**auto-rebases and retargets** them. CLI via `gh extension install github/gh-stack`. Branch
protections and required checks still govern what reaches the default branch.

Mapped onto this harness: the queue runs `foundation` on `feature/x-foundation`, then `astro`
branched *from* foundation with `PR base: feature/x-foundation`. **`PR base:` is already
supported** (`goal-auto.js:176`), and the cleanup plan already performs this exact assembly
(`auto.md:330`). No mid-run merge is needed.

**Trade-off to accept:** it turns independent PRs into a linear stack. If the parts are genuinely
disjoint, a stack is stricter than necessary — `astro` cannot merge before `foundation`. Right
compromise for foundation + N parts; wrong one for N parts with no foundation, where separate
runs stay better.

### Open, in this section

- **Worktree topology for a queue.** One worktree per plan, or one for all? The branch check
  (`goal-auto.js:539`) requires the checkout to stand on `feature/<work-id>` matching the plan's
  own work-id, so a single-worktree queue would have to switch branches between plans. Undecided.
- Whether the queue is a new command (`/goal:queue`) or an argument to `/goal:auto`.
- Whether the index `<work-id>-plans.md` (`run-issue.md:368`) becomes machine-read, and what
  refuses a queue whose order contradicts a plan's own `Trigger:`.

---

## 8. A really functional application

Two distinct gaps. Conflating them would produce a bad design.

### Gap A — no instance is ever running

The worktree is a dead checkout. This wants a declared contract, the same shape as `Remote:`
(declared, refused rather than guessed):

```
App: docker compose up -d --wait web
Health: http://localhost:${GOAL_PORT}/
```

With per-run port allocation, or two concurrent worktrees collide. Mechanism undecided.

### Gap B — nothing judges the interface against the intent

This is the failure that actually happened: two elements present in the design, absent from the
plan, therefore invisible. It is a **plan-completeness** failure, not an implementation one, and
the gate cannot structurally catch it — the gate only knows the plan.

Proposed shape, reusing what exists: a **visual lens**, a fourth entry in `LENSES`
(`goal-auto.js:293`), which boots the app in the worktree, drives Chrome through
`mcp__claude-in-chrome`, captures the feature's screen and asks one closed question against the
plan's `Business intent`. Advisory, never blocking, same contract as the other three and for the
same reason (`goal-auto.js:291`: a false positive at 3am costs a morning).

**Prerequisite that cannot be skipped.** A lens judges against the plan's own declarations, never
against a standard it invented (`goal-auto.js:322`). So the visual reference has to enter the
plan upstream: `/goal:run-issue` must extract Figma node ids into the plan when the source has
them. Without that, the visual lens invents its criterion and inherits every reliability caveat
in `adversarial-verification.md`.

### Open, in this section

- Port allocation mechanism, and teardown when a run halts.
- Whether a visual finding stays purely advisory. If it does, what forces anyone to act on it;
  if it does not, "a lens never blocks" leaks.
- Whether Figma is the only reference form, or a plan can declare an expected-elements list in
  prose for work with no design file.

---

## 9. Does `/goal:auto` earn its orchestration? — open

Raised as a challenge: if a script is going to launch `/goal:auto` sequentially over several
plans, why not have that script launch **native `/goal`** per iteration instead, and drop the
workflow entirely?

### What a scripted `/goal` would lose

`README.md:16` answers it: *"Native `/goal` alone is brittle: drop `/goal 'deliver X'` and walk
away and it drifts."* In the manual loop the developer **is** the anti-drift mechanism. Scripting
`/goal` removes the human and puts nothing in their place.

| | Agent | Judge | Drift corrector |
|---|---|---|---|
| `/goal` manual | native, drifts | developer + gate | **the developer** |
| `/goal` scripted | native, drifts | gate | **nobody** |
| `/goal:auto` | constrained (`goal-implementer`) | gate | the constraint |

`goal-implementer` cannot commit, push, stage or tick, and its paths are bounded. Native `/goal`
is a full session that can do all of it.

### What the challenge does land on

If the value is **the constrained implementer plus the mechanical gate**, then nothing requires
the orchestration to be a `Workflow`. And as a workflow it currently costs: 8 shell-only agent
spawns per iteration (§0), a nested `workflow()` where a nested `for` would do (§7), and no way
to sleep through a quota exhaustion.

### A third design, not previously stated

Verified in `claude --help`: the flags `--agent <agent>` and `--allowedTools` both exist. So an
iteration can be an invocation that is *already* constrained, rather than one governed by a
prompt that forbids:

```bash
for n in $(unchecked "$plan"); do
  claude -p --agent goal-implementer --permission-mode auto "$(section "$plan" "$n")"
  node goal-gate.ts commit "$plan" "$n" "$hash" || break
done
```

The "the implementer does not commit" separation stays structural. It moves from *the workflow
has no shell* to *the session is pinned to the agent and its tools*.

**What it gives up, and this has to be accepted rather than discovered:** `budget.spent()`, and
therefore the per-iteration token cost in the audit report; the `/workflows` progress tree; and
Remote Control visibility. The first is the one that matters — it is the only measurement
currently held on what a run costs.

**Undecided.** This is a genuine fork in the design, not a refinement of §0–§8. Settling it
changes what items 4, 5 and 6 of the sequencing below even mean, so it should be settled first.

**§10 narrows it.** Once an external tool holds layer 3, the loop's remaining job is small
enough that the observability argument decides it.

---

## 10. Three layers, and where the external tools actually sit

Read against the 2026-07-31 audit artifact *"goal:auto — audit & comparatif"*. Naming the layers
is what makes the tool question answerable, because the tools and the dissatisfaction are not on
the same one.

| Layer | Job | Who can hold it |
|---|---|---|
| **3 · Scheduling** | which plans, in what order, when | `goal-launch.sh`, **Orca (DAG)**, **Hermes (cron)** |
| **2 · The loop** | which iteration, halt or continue | `goal-auto.js`, **or bash** (§9) |
| **1 · Judged execution** | constrained implementer + gate | `goal-implementer` + `goal-gate.ts` |

**The dissatisfaction is at layer 2. Orca and Hermes are both at layer 3.** Neither answers it.
The audit says as much without framing it this way: on the latency need, Orca is *"DAG
multi-plans ; rien sur l'orchestration interne"*.

### Orca — takes layer 3, and deletes §7

Runs the real local CLI, so `~/.claude` and the hooks still apply. Adopts an externally created
worktree three documented ways, which is the filter Conductor fails. Its **DAG with dependencies
plus scheduled automations is exactly §7**: the multi-plan queue no longer needs a nested
`workflow()`, and the foundation → parts ordering stops requiring a human to merge at 3am.

Reservations carried over from the audit, not to be lost:

- default launch flag is `skip-permissions`; replace with `--permission-mode auto`, memorised per
  agent, or preflight 11's whole reason for existing is bypassed.
- mobile is a direct LAN / Tailscale connection with no cloud relay, so **the Mac stays awake**.
- four and a half months old, ~2 800 open issues.

### Hermes — not a night mode

1. **It does not solve the stated problem.** It delegates to Claude Code with
   `claude -p … --permission-mode auto`, so it runs on the same machine Orca does. "Work at
   night" in the sense of *machine off* is not something it provides.
2. **It costs an invariant already paid for.** `steering-and-injection.md` exists because an
   agent that reads third-party-controlled text while holding write credentials is one injection
   from using them, which is why `CONTROLS` (`goal-auto.js:406`) holds only subtractive verbs.
   Hermes puts 20+ messaging channels in front of an agent that writes. The audit flags it:
   *"une surface d'attaque messagerie contraire à l'esprit de ta quarantaine"*.
3. **It observes at session level, not diff level.** The need is "is it advancing", not "how many
   tokens did the session burn".

What it genuinely offers is a phone gateway: launch and follow from Telegram. That is a channel,
not a night mode.

**Corrected, after pushback.** The above under-weighted a real distinction: Orca *fires what was
configured*, Hermes has an agent that can *decide*. That is true, and the first version of this
section flattened it.

Applied to this pipeline, though, it does not pay where it looks like it should. **Launching a
plan requires no judgement**: which plan runs next is either the index's order or a `Trigger:`
dependency. Putting a deciding agent there adds judgement to the one layer deliberately made
mechanical, and an Orca cron does the same work with nothing to get wrong.

Where the autonomy would genuinely earn its place is **after** a run, on the events that do
require a decision:

- CI went red on the pull request the run just opened — `loops.md:120` calls this the largest
  open gap: nobody currently learns it;
- a run halted and the diagnosis says the cause is infrastructure, not the code (§5);
- the base moved and a halted branch is now stale.

So: **Hermes as reaction, not as trigger.** The injection objection above still stands; it just
applies to a narrower surface.

### What would actually answer "work at night"

Neither tool. The gates are this project's own `docker compose run` commands, so running without
the developer's Mac requires an environment where those commands execute. `loops.md:148` already
names it and calls it the blocker: *settle the environment question before the scheduling one.*
Layer 3 tooling does not touch it.

### Consequence

With Orca at layer 3, layer 2 has to order iterations, call the gate, and stop at the first
refusal. That is roughly fifteen lines of bash. The workflow's own justification (`auto.md:16`:
*"in a script the ordering is instructions and `break` executes"*) applies identically to a shell
loop, and the observability argument then decides: one process, one log, one notification.

**Leaning, not decided: Orca at layer 3, bash at layer 2, layer 1 untouched.** The workflow
disappears. This is an afternoon's experiment, not a paper proof, and it should be run before it
is written down as a decision.

---

## 11. Salvage list, if the workflow goes

Written for the second step (§9 is deferred, not cancelled). What matters here is bucket B: it is
**invisible**. A rewrite from the README loses every line of it and rediscovers each one through
the same bug that produced it.

### A — survives untouched

`scripts/goal-gate.ts` and all of `scripts/gate/` (plain Node, invoked as a command — this is
layer 1, the actual value); `agents/goal-implementer.md`, `goal-lens.md`, `goal-auditor.md`
(usable through `claude -p --agent <name>`); `commands/run-issue.md`, `next.md`,
`draft-issue.md`; `hooks/`, `templates/`, and the gate's own test suite.

### B — must be ported, or it is lost silently

Each line came from a real incident.

| # | What it holds | Where |
|---|---|---|
| 1 | **The section travels as text, its path never does.** The plan lives outside the worktree (`.claude/` is gitignored); handing its absolute path to the implementer made it write into the wrong checkout, with a correct `cwd` throughout | `:83-87` |
| 2 | **The plan hash, computed once and carried for the whole run.** Recomputing per iteration would bless a plan rewritten at iteration 1 | `:588` |
| 3 | **Every iteration proved runnable before any is implemented.** A missing gate block is worth knowing at minute 3, not at iteration 9 | `:574` |
| 4 | **"the implementer wrote nothing" ≠ "the gate refused".** Unchanged tree + non-empty `impl_files` is a different diagnosis; reporting it as a refusal says "your work was judged and rejected" about work that was never judged | `:784` |
| 5 | **`gh pr create` targets a fork's *parent*.** The remote and the repo are named explicitly, never inferred. The `sed` is reusable as-is | `:169` |
| 6 | **No `fixup!` / `squash!` commit before the first push.** After it, folding one would need a force | `:197` |
| 7 | **Draft PR at the first commit, body rewritten after.** A halt at 3/15 leaves something readable instead of an invisible branch | `:688` |
| 8 | **A title containing a quote is refused, not stripped** | `:209` |
| 9 | **The halt report's shape**: landed / notAttempted / the gate's verbatim output / push state | `:269` |
| 10 | **The `SURVEY` awk**: an iteration heading, then the first checkbox in its section — the same reading the gate uses | `:475` |
| 11 | **The branch check.** A run publishes the branch its checkout is on, so standing on the wrong one publishes the wrong one | `:539` |
| 12 | **The "base already green" sweep**: run the DoD's and every `gate2..N`'s commands on the untouched tree before a line is written | `auto.md:153` |

1 and 12 are the most expensive to relearn. 12 is also the highest-return check in the whole
preflight, and it is already pure shell.

### C — dies with the workflow, and should

- `agents/goal-runner.md`, `goal-reader.md`, `goal-reporter.md`. They exist **only** because a
  workflow has no shell. In bash they are three indirections for no gain, and they are §0's
  entire latency and notification problem.
- `docs/workflow-parity.md` — it documents parity between `auto.md`'s prose and the workflow.
- `scripts/goal-launch.sh`, once Orca holds layer 3 (§10). Its worktree + branch creation moves
  into Orca, which adopts an externally created worktree three documented ways. The audit's
  "immortal tmux session" finding dies with it, and so does the tmux question in
  `open-questions.md` §1.
- **Notification hooks are not the answer here either.** A hook fires on a Claude Code *session*
  event, so in a script design a `Stop` hook fires once per `claude -p`, i.e. once per iteration —
  rebuilding §0's notification flood from the other end. Orca already reports that a run ended;
  what nothing reports is *with what outcome*. In a shell loop that is one line at the end of the
  script, which already knows the answer.
- `budget.spent()`, `ITERATION_FLOOR` (`:53`, `:751`), the per-iteration cost in the audit report.
  **Only the proactive floor dies**, and it was already largely theoretical: `:664` logs that with
  no budget armed, `budget.total` is `null` and the floor is inert. Waiting for a quota to come
  back is a different mechanism and it survives — see below.
- `tests/goal-auto.test.ts` and `tests/support/workflow-runtime.ts`.

### What gets better, not merely cheaper

**Steering becomes safer.** The design (`:406-455`) reduces untrusted text to a bit vector with
`grep` *before* any model sees it. In bash there is no model at all: the `grep` is the final
executor. The invariant strengthens.

**Preflight 11 disappears.** It inspects `permissions.defaultMode`, cannot see a CLI
`--permission-mode`, and ends up asking the developer. `claude -p --permission-mode auto` states
it explicitly at every invocation. That removes the check **and** `open-questions.md` question 4,
the one that "reads as mistrust".

**Waiting for a quota comes home.** `loops.md:98` states the constraint: *"This is where waiting
lives, because a workflow script cannot sleep and, when the quota is gone, its agents cannot run
anyway."* A workflow cannot sleep, which is why the wait had to be lifted to the session with
`ScheduleWakeup`, above the workflow. In bash `sleep 1800` is free, so the wait moves back down to
where the iteration boundary already is.

It also becomes **detectable**: `claude -p` exits non-zero with a rate-limit message,
distinguishable from a gate refusal. That is §5's class C applied to the agent invocation rather
than to git and `gh`. Safe for the reason already written at `auto.md:23` — the durable state is
the plan's checkboxes, so relaunching resumes at the first unticked box and a quota wait needs no
state at all.

**One trap.** A loop sleeping thirty minutes reads, from layer 3, as a run that is "running" and
doing nothing. That is `loops.md:135` exactly: silence is indistinguishable from still working,
which is the original complaint. The log has to say *"quota exhausted, resuming at 14:20"*, or one
invisible wait has been swapped for another.

---

## Proposed sequencing

1. **Turn the lenses on.** One field in `auto.md:219`. Would likely have caught the recent miss,
   in text, at no design cost.
2. **Class B halts**: the three scope tiers, the `max_diff` soft band, and the gate tests that go
   with them.
3. **Move the determinism replays out of the per-iteration loop** — a suite that depends on its
   own leftovers is a property of the suite, not of the slice. Where they move to (`dod`,
   preflight) is undecided.
4. **Collapse the runner indirection** and stop mirroring every iteration. Mechanical, no design
   change.
5. **Queue + stack via `PR base:`.** Mostly configuration; blocked on the worktree topology
   question.
6. **`App:` contract + visual lens.** Largest, and it depends on 1 and 5.

Items 1 and 4 are the two with no design cost. Everything else in this file is a proposal that
still has to survive a pass the developer has said they want to take further.
