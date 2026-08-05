# Why a run is not parallel

The harness ran parallel tracks — one git worktree per track, one pull request each, all at
once — from 2026-07-26 to 2026-07-28. It was removed on purpose. This is the argument, kept so
nobody rebuilds it from the same intuition.

**The short version.** Parallelism inside the orchestrator costs tokens rather than saving them,
buys only wall-clock — the cheapest resource an unattended overnight run has — and does not even
keep that to itself, since several separate runs buy exactly the same wall-clock. It cost a second
execution mode inside one code path, and that mode is what produced every failure below.

The replacement is not "no parallelism". It is **parallelism at the launch site**: a plan that
splits becomes several plan files, and the developer launches one run per file.

**What a run is, as of today.** A run is one `node goal-run.ts <plan>` process
(`scripts/goal-run.ts` plus `scripts/run/*.ts`), which is what `/goal:supervise` launches
(`commands/supervise.md:31`). It surveys the plan's unchecked boxes, then implements them one at a
time in a single `for` loop (`goal-run.ts:92-98`). The harness that carried tracks is the
abandoned Workflow runtime this loop used to run on — still checked in, orchestrating nothing
that ships — and the sections below describe it in the past tense on purpose.

---

## 1. What it cost, measured

Two real runs of the workflow harness, back to back, on the same repository and comparable work —
markdown edits across plugin files.

| | Sequential (plan A, 2026-07-26) | Parallel (plan B, 2026-07-27) |
|---|---|---|
| Iterations landed | **4 / 4** | **1 / 6** |
| Tokens | **82,438** | **942,390** |
| Cost per iteration | ~20 k | 39 k – 118 k |

Summing the per-iteration costs the audits recorded (118 k + 39 k + 99 k + 55 k + 73 k)
accounts for roughly **383 k** of the 942 k. The remaining **~560 k is orchestration
overhead**: four surveys, four audits, four sets of lenses, four reporters, four PR bodies.

Part of that overhead is attributable to the bugs — a gate that refuses after a full
implementation makes the work happen twice — and that part cannot be isolated from the
record. But the structural half is not in dispute: **N tracks means N orchestrations of the
same shape**, and the per-iteration cost was 2–6× the sequential run's for the same kind of
work.

### Tokens are never the thing parallelism buys

It is the same work plus coordination. The only thing it can buy is **wall-clock**, and an
unattended run exists precisely to advance while nobody is watching. Wall-clock is what you have
most of at 3am.

### And moving it up loses none of it

This used to be an argument about the `Workflow` runtime's per-workflow concurrency cap: five
invocations got five caps, so nothing was surrendered by moving the parallelism up. There is no
runtime to appeal to now. A run is an ordinary Node process that spawns one `claude -p` per
iteration (`run/iteration.ts:111`), and nothing inside it bounds concurrency, tokens or
wall-clock — the 80k floor the Workflow used to declare was the only cost ceiling any generation
ever had, it was inert unless a directive armed a budget, and neither runner since has carried
anything in its place.

Which makes the conclusion cheaper rather than weaker. What actually limits five concurrent runs
is the subscription and the machine, and that limit is the same whether the parallelism lives
inside one script or across five sessions. The harness was never the thing providing it, so moving
the parallelism to the launch site surrenders nothing.

---

## 2. The design defect, and its three symptoms

The abandoned Workflow served two execution modes in one code path, and **the mode was inferred
from an absence**: `DIR === undefined` meant sequential. Nine sites branched on it, by the count
taken when they were removed.

That inference is the whole problem. A site that never asks the question gets sequential
behaviour **by default** — which is exactly wrong in track mode. So forgetting a branch does
not break loudly; it silently does the other thing. Both failures of the 2026-07-27 run were
precisely the two sites where the branch had been forgotten.

This is the [flag argument](https://luzkan.github.io/smells/flag-argument/) as Fowler defines
it: a parameter that tells a function to carry out a different operation depending on its
value. The canonical remedy is
[replacing the conditional with distinct implementations](https://sammancoaching.org/refactorings/replace_conditional_polymorphism.html),
not adding a tenth branch.

### Symptom 1 — isolation was verbal, never structural

Every *command* was confined to the track's worktree by a `cd` prefix. The **implementer**,
which is the only thing that writes, was told nothing at all: its brief never mentioned the
worktree, and neither did its agent definition. It wrote the repo-relative paths it was
given, against the checkout it stood in.

The result was non-deterministic: **two tracks of four wrote into the main checkout** while
their gates judged an untouched worktree and correctly refused. The gate was right; the work
was in the wrong tree.

**This survived the removal of tracks, and it took a real launch to show it.** The remediation
plan that followed added the tree's path and branch to the brief, which was necessary
and not sufficient: the brief still opened on the plan's absolute path, and the plan lives
outside the run's tree because its directory is gitignored. On 2026-07-29 the first end-to-end
run read the plan there, took its parent as the repository root, and wrote its whole iteration
into the main checkout — with a correct `cwd` throughout. Naming the right tree does not beat
handing over a path to the wrong one.

The rule that came out of it is now the first thing the current runner's iteration module states,
and the shape of the brief enforces it: the section travels as text and the plan's path does not
travel at all (`run/iteration.ts:1-5`, `:56-74`). A run whose tree is unchanged says so
(`iteration.ts:164-169`) instead of letting the gate report a refusal it never earned.

### Symptom 2 — the regression wall assumes one continuous branch

The wall replays the gate commands of every **ticked** iteration, so that a slice which breaks
an earlier one halts where the cause is. It reads the whole plan, with no notion of tracks.

Tracks are four disjoint branches **by design** — that disjointness is what makes their pull
requests independently mergeable. So the wall replayed a sibling track's command against a
branch that, by the plan's own invariant, must never carry its fix. **No implementation could
satisfy it.**

### Symptom 3 — the plan was mutable shared state

One plan file, in the main checkout's gitignored `.claude/plans/`, addressed by absolute path
from four worktrees. The gate ticks `[x]` in it after every green verdict.

So one track ticking iteration 5 changed what another track's wall replayed. Two `mkdir`-based
locks existed and worked — they protect the *write*. They cannot protect the *meaning*: the
file is one object and four runs disagreed about what it described.

The audit reports collided the same way. All four wrote `.claude/goal-runs/<base-sha>.md`, and
the base sha is identical for every track by construction, so they overwrote each other. One
auditor noticed the file changing under it mid-analysis and said so in what survived. That half
was never replayed against the current runner: `run/close.ts:112-115` briefs the auditor with a
relative `.claude/goal-runs/<sha>.md`, so a run launched inside a worktree writes its report into
that worktree's own gitignored `.claude/`, which disappears with it. One run per plan makes the
collision impossible; it does not make the path right.

---

## 3. What the industry already learned

**Airflow deprecated `SubDagOperator`** in 2.0 and removed it in 3.0. The reason is ours,
almost word for word: a SubDAG nested a **different execution model** inside the parent — it
started a `BackfillJob`, ignored the configured parallelism, and diverged from its parent's
attributes. Deadlocks and oversubscribed workers followed. The replacement,
[`TaskGroup`](https://cwiki.apache.org/confluence/display/AIRFLOW/AIP-34+TaskGroup:+A+UI+task+grouping+concept+as+an+alternative+to+SubDagOperator),
is a pure grouping concept: **one execution model for everything**.

The lesson is not "do not separate". It is **do not build two engines**.

**Temporal** points the other way, and it is the direction taken here: fan-out is done with
**child workflows** — genuinely separate units, independently versioned, monitored and scaled,
with the parent aggregating results. That is exactly "several runs", and exactly not "a second
mode inside one script".

---

## 4. What the replacement buys, beyond removing the defect

**The disjointness proof moves to planning time.** It used to run at launch, where discovering
a bad split cost the whole run. `/goal:plan` now proves it once, while a human is reading
the file lists, and a mistake costs an edit.

**Every plan resumes correctly, alone.** With one shared file, each run must be told its scope
at launch — so the scope lives in the invocation arguments, not in the plan. A relaunch that
forgets them does not fail: **it does something else, silently.** With one file per part, the
plan's own boxes are the whole state and a relaunch reads them: `goal-run.ts:56` surveys the
unchecked iterations and starts at the first, which is the property the whole "the plan is the
state" design rests on.

**A run stops confiscating the checkout.** It works in the directory it was launched from, so
`cd` into a worktree and it is isolated while your main tree stays free.

**A run gets a session it does not share.** The reason is narrower than it was once written here.
Backgrounding does not kill a run: the case observed was a **permission prompt nobody answered**,
which leaves a session looking alive in `Needs input` while no iteration advances, and what fixes
it is `--permission-mode auto`, not a session of its own. What a dedicated session does buy is
outliving the terminal that opened it and a stable name to reattach to; once it is born inside a
worktree, isolation is free and the harness needs no worktree code at all. The earlier launcher
that set that up opened the abandoned Workflow rather than `goal-run.ts`, and nothing on the
current path replaced it.

---

## 5. When you would still want several runs

Nothing above argues against doing several things at once. It argues about **where** the
parallelism lives. Reach for several runs when the work genuinely splits:

- per module, per plugin, per bounded context, per package in a monorepo;
- and only when the union of one part's `test_files` + `impl_files` shares **no path** with
  another's. One shared file and the two runs conflict at merge, whatever the story says.

`/goal:plan` writes that as N self-sufficient plans plus an ordering index
(`<work-id>-plans.md`), each plan carrying its full header — nothing inherits, because each
file is read alone by its own run. Launch one per file, in its own session.

A false split is worse than a sequential plan: two pull requests that conflict at merge,
discovered after both runs have already paid for themselves.

---

## What this argument does not cover

**The numbers are the old harness's.** Both runs in §1 were runs of the abandoned Workflow, in July. The
runner that replaced it has since driven a plan end to end — seven iterations landed, global
Definition of Done green, pull request marked ready, lens and audit recorded, all of it in
`.claude/plans/goal-run-improvements-spec.md.run.log`. Nobody has remeasured the cost of an
iteration on it. The ratios above argue about a shape, not about today's price.

**A halt is a second axis of "how many runs".** `/goal:supervise` classifies a non-zero exit and
relaunches the same plan once. That is sequential re-execution of one plan, not parallelism, but it
is a multiplier on cost that this argument never counted — and its own frontmatter calls the
classifier unproven, written from two cases.
