# Why a run is not parallel

The harness ran parallel tracks — one git worktree per track, one pull request each, all at
once — from 2026-07-26 to 2026-07-28. It was removed on purpose, under
`.claude/plans/goal-single-run-spec.md`. This is the argument, kept so nobody rebuilds it
from the same intuition.

**The short version.** Parallelism inside the workflow costs tokens rather than saving them,
buys only wall-clock — the cheapest resource an unattended overnight run has — and does not
even keep that, since the concurrency cap is per workflow and several runs each get their own.
It cost a second execution mode inside one code path, and that mode is what produced every
failure below.

The replacement is not "no parallelism". It is **parallelism at the launch site**: a plan that
splits becomes several plan files, and the developer launches one run per file.

---

## 1. What it cost, measured

Two real runs, back to back, on the same repository and comparable work — markdown edits
across plugin files.

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

It is the same work plus coordination. The only thing it can buy is **wall-clock**, and
`/goal:auto` exists precisely to run while nobody is watching. Wall-clock is what you have
most of at 3am.

### And moving it up loses none of it

The `Workflow` runtime caps concurrent agents at `min(16, cores − 2)` **per workflow**. Five
separate `/goal:auto` invocations therefore get five caps, not one shared between them. The
parallelism is not given up; it moves from inside the script to the session level, where the
developer decides it.

---

## 2. The design defect, and its three symptoms

`goal-auto.js` served two execution modes in one code path, and **the mode was inferred from
an absence**: `DIR === undefined` meant sequential. Nine sites branched on it across 919
lines.

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
auditor noticed the file changing under it mid-analysis and said so in what survived.

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
a bad split cost the whole run. `/goal:run-issue` now proves it once, while a human is reading
the file lists, and a mistake costs an edit.

**Every plan resumes correctly, alone.** With one shared file, each run must be told its scope
at launch — so the scope lives in the invocation arguments, not in the plan. A relaunch that
forgets them does not fail: **it does something else, silently.** With one file per part,
`/goal:auto <plan>` reads the boxes and resumes, which is the property the whole "the plan is
the state" design rests on.

**A run stops confiscating the checkout.** It works in the directory it was launched from, so
`cd` into a worktree and it is isolated while your main tree stays free.

**A run stops dying from a keystroke.** This one was observed, not designed for: a run living
in the interactive session is interrupted by navigating out of its progress view — *looking at
the run is the gesture that kills it*. It needs a session of its own regardless, and once that
session is born inside a worktree, isolation is free and the harness needs no worktree code at
all. `scripts/goal-launch.sh` is the one gesture that sets it up.

---

## 5. When you would still want several runs

Nothing above argues against doing several things at once. It argues about **where** the
parallelism lives. Reach for several runs when the work genuinely splits:

- per module, per plugin, per bounded context, per package in a monorepo;
- and only when the union of one part's `test_files` + `impl_files` shares **no path** with
  another's. One shared file and the two runs conflict at merge, whatever the story says.

`/goal:run-issue` writes that as N self-sufficient plans plus an ordering index
(`<work-id>-plans.md`), each plan carrying its full header — nothing inherits, because each
file is read alone by its own run. Launch one per file, in its own session.

A false split is worse than a sequential plan: two pull requests that conflict at merge,
discovered after both runs have already paid for themselves.

---

## What this argument does not cover

`/goal:auto` has never run end to end on the refactored harness. The 87 tests of
`plugins/goal/tests/` prove the structure — no mode conditionals survive, the gate judges the
tree it stands in, the launcher creates its worktree — and the numbers above come from runs of
the **old** harness. The first real launch remains the real test.
