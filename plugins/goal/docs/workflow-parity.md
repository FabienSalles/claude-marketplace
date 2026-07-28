# Workflow parity checklist

Every guarantee `commands/auto.md` makes today, and where the workflow rebuild must hold it.
The question is never "does the new thing do something similar" but "is the same property
still held, and by what".

**This was a target. It is now a status report.** The workflow exists, it is checked in at
`workflows/goal-auto.js`, the gate is `scripts/goal-gate.ts`, and both were built iteration by
iteration under `.claude/plans/issue-6-spec.md`. On 2026-07-26 the harness ran a real plan —
`.claude/plans/issue-3-spec.md`, four iterations, nobody watching — and finished green. What
that run proved and what it cost is at the end of this file, under *The first real run*.

Two things changed shape since the target was written, and every row below reflects them: the
gate is TypeScript run natively by node rather than bash, and there are **two** locks beside the
plan, `<plan>.run.lock` for the run and `<plan>.tick.lock` around the commit.

Status legend: **held** (the rebuild must hold this property, same or stronger enforcement) ·
**moved** (held, but by a different layer — say where) · **gap** (nothing holds it yet, even
in the spike) · **dropped on purpose**.

## Phase 0 — Plan resolution

| Guarantee | Status | Where |
|---|---|---|
| Resolve the most recent `*-spec.md`, excluding `*-cleanup-spec.md` | **moved** | the command, before launching. A cleanup plan is still only ever run by naming its path. |
| Several plausible candidates → ask | **moved** | the command. A workflow cannot ask. |

## Phase 1 — Preflight, eight refusals

All eight stay in the command, **on purpose**: each is a refusal that may need a human, and a
workflow script has no way to ask a question. `/goal:auto` runs the preflight first and
launches only if it passes.

| Check | Status | Note |
|---|---|---|
| 1. Policy is `commit` / `commit+pr` | **held twice** | the command. The gate no longer needs to re-check it: there is no state file to write. |
| 2. Branch is `feature/<work-id>…` | **moved** | the command. The workflow creates no branch of its own. |
| 3. Clean tree | **moved** | the command. |
| 4. the plan's directory is gitignored | **moved** | the command. Still load-bearing: the gate ticks the plan there on every iteration. Scoped to `.claude/plans/`, so a repository that tracks the rest of `.claude/` still runs. |
| 5. At least one unchecked iteration | **held** | the survey returns the unchecked set; empty → `done` with a reason, nothing runs. |
| 6. No cleanup iteration (`Trigger:` line) in a feature plan | **held** | named explicitly in the survey's inconsistency list, with the `*-cleanup-spec.md` exemption. |
| 7. No run already active | **replaced** | there is no run state to read. The command checks for a stale `<plan>.run.lock`, the only thing a dead run leaves behind. The first real run left exactly that when its process died, and `goal-gate.ts unlock` was the documented way out — the check earned its place the same day it was written. |
| 8. `gh` auth, remote, no open PR | **moved** | the command. |

## Phase 2 — State and resume

| Guarantee | Status | Where |
|---|---|---|
| Run state survives an interruption | **held, simpler** | the plan's `[x]` checkboxes are the state, ticked by bash after a green gate. No state file at all. |
| `spec_hash` computed once, carried forward, never recomputed mid-run | **held, stronger** | captured by the survey and held in a JavaScript variable, passed to every gate call. No file holds it, so nothing can rewrite it mid-run. |
| Resume from a clean boundary only | **moved** | the command. The workflow has no dirty-tree concept; it assumes the preflight ran. |
| `--continue` | **held, implicitly** | the survey only ever returns unchecked iterations, so relaunching *is* continuing. |
| `--resume-at <n>` needs `[ ]` restored first | **moved** | still a human action, still documented. The survey picks up whatever is unchecked. |
| Never `git restore` / `reset` / `checkout` to make it resumable | **held** | no agent in the workflow is given a git-mutating instruction other than through the gate script. |

## Phase 3 — The loop

| Guarantee | Status | Where |
|---|---|---|
| One subagent per iteration, orchestrator never implements | **held** | the orchestrator is JavaScript. It cannot implement. |
| The gate reads its own inputs, never composed ones | **held, stronger** | it parses the plan itself; no intermediate file exists to go stale or be appended to. |
| Declared paths are bare, no markdown, no glob | **held, stronger** | copied verbatim from the plan's `gate` block; the block is validated and the gate rejects backticks and globs. |
| Acceptance commands are the plan's real commands | **held, stronger** | copied verbatim. No model composes one. |
| An iteration with no gate halts rather than inventing one | **held** | `goal-gate.ts` refuses a block with no `gate1` (R2), and the survey runs `check` on every unchecked iteration **before** the first implementer, so an unrunnable slice is known at the start of the night. |
| Gate decides, exit code only | **held** | `goal-gate.ts commit` verifies, commits and ticks inside one process, in that order. |
| Halt is final, remaining iterations not attempted | **held, stronger** | `break` in JavaScript, and the not-attempted list is computed and reported. |
| Tick only after the gate, commit only after the tick | **held, stronger** | all three inside one process, in that order, under the tick lock. |
| `git status --short` empty after commit | **held** | the scope check runs before the commit and stages only declared paths, so anything else halts first. |
| Commit message carries no AI trailer | **held** | it comes from the plan's `commit_msg`, frozen by a human. |
| Subagent brief built from `goal-handoff.template` | **dropped on purpose** | see *Deliberate divergences*. |

## Phase 3 bis — Parallel tracks — **dropped on purpose**

Every guarantee below was held, and all of it was removed on 2026-07-28 under
`.claude/plans/goal-single-run-spec.md`. Recorded rather than deleted, because the reasoning
is the useful part.

The workflow served two execution modes — sequential, and parallel by worktree — in one code
path, with the mode inferred from an absence (`DIR === undefined` meant sequential). Nine sites
branched on it. The run of 2026-07-27 failed on the two sites where the branch had been
forgotten: the implementer's brief never mentioned the worktree, so two of four tracks wrote
into the main checkout while their gates judged an untouched one; and the regression wall
replayed a sibling track's gate command against a branch that could not carry its fix. Both
failures were silent, because a site that never asked got sequential behaviour by default —
which is precisely wrong in track mode.

Measured, not argued: that run cost 942,390 tokens and landed 1 iteration of 6, against 82,438
tokens for 4 of 4 on the sequential run the day before. Parallelism never saved tokens — same
work plus N orchestrations — and the only thing it could buy was wall-clock, which is the
cheapest resource an unattended overnight run has.

**What replaces it.** A run works in the directory it was launched from, so isolation is a
property of that directory rather than a mode: `cd` into a worktree, then `claude`. Parallelism
is several runs, one per plan file, and the concurrency cap being per workflow means nothing is
lost by moving it up. Disjointness is proven once at planning time, where a human reads the file
lists, instead of at run time where discovering it costs the whole run.

The one guarantee that had to survive is *the gate judges the tree it stands in* — the property
the whole launch-from-a-worktree flow rests on. It moved out of the deleted `gate-tracks.test.ts`
into `gate-plan.test.ts` before the deletion, so coverage never dipped.

### The race this section existed to catch, and why it is now moot

`auto.md` held "only one writer to the spec" by being single-threaded: *"You are single-threaded,
so there is no race on the shared file."* The workflow was not, and two tracks reaching GREEN at
the same moment both read and wrote the whole plan, losing a tick.

The rebuild answered it with two `mkdir`-based locks (atomic and portable, unlike `flock` on
macOS): a `<plan>.tick.lock` around the read-check-write of the commit, and a `<plan>.run.lock`
taken for the whole run — the second closing a hole where two *sessions* could implement the same
iteration. **Both remain, and both still matter**: one run per plan does not mean one run per
machine, and the run lock is what stops a second session driving the same plan. The tick lock is
registered in `heldLocks` and removed by a `process.on('exit')` handler; the run lock survives the
process on purpose, and only `goal-gate.ts unlock` hands it back. Two regression tests pin them in
`tests/gate-commit.test.ts`.

This is the class of bug the parity exercise exists to find: a property held *implicitly* by the
old design's shape, silently lost when the shape changes. It is also, twice over, the class this
section documents — the second time being the mode conditionals that removing tracks deleted.

## Phase 4 — Ship

| Guarantee | Status | Where |
|---|---|---|
| Global DoD as a last barrier, nothing pushed if it fails | **held** | on failure the branch is pushed and the issue commented, no PR. |
| **Reshape the history before the first push, under either policy** | **held** | a reshape stage runs after the DoD and before the ship branch, so it happens under `commit` too and never needs a force. |
| `commit` → report, no push | **held** | `ship` is false, or the policy is not `commit+pr`. |
| `commit+pr` → push then `gh pr create`, never `--force` | **held** | stated in the ship prompt. |
| PR body lists only this PR's iterations | **held** | the delivered list is passed explicitly. |
| PR body carries `Delivery mode:` and, under `allow-bc-break`, `Breaks:` | **held** | in the ship prompt. |
| `Refs #N`, never `Closes` | **held** | stated in the ship prompt. |

## Phase 5 — Cleanup plan

**Dropped on purpose.** It runs once, at the end, under a human's eye, and is cheap in prose.
The workflow returns the delivered iterations and PR URLs, which is what the command needs to
continue into Phase 5.

## Deliberate divergences

**The implementer reads the plan instead of receiving a pasted brief.** `auto.md` builds the
subagent brief from `templates/goal-handoff.template` and insists the blast radius be pasted
in, because *"the subagent cannot see the spec's other sections, and a rule naming a list it
cannot read is not a rule"*. The workflow gives the agent the plan path and names the sections
that bind it.

The trade: no transcription step, so nothing can be lost or reworded on the way in — but the
agent now sees the whole plan, including iterations that are not its own. That is acceptable
because the plan is trusted (a human froze it) and because the gate's scope check is what
actually stops it from touching anything else. It is a real difference and it is stated here
rather than hidden.

**The lens set is derived, not declared.** No plan syntax change; the derivation rules read
sections `/goal:run-issue` already produces.

## Answered in the spike, earned by the rebuild

The spec-write race, history reshaping before the first push, worktree cleanup for shipped
tracks, `Delivery mode:` / `Breaks:` in the PR body, track disjointness as a proof. Each had a
known answer on `wip/issue-6-harness-spike`; each is now held by an iteration that landed with
its own gate. The spike was never merged and never read by an iteration, which was the point.

One of them changed on the way. **Reshaping became an assertion rather than a rewrite**: the
gate is the only committer and it never amends, so a `fixup!` commit cannot come from the run.
If one is there anyway the run **refuses to push** and says to fold it by hand — rewriting
history nobody has reviewed, unattended, is worse than stopping.

## The first real run

`.claude/plans/issue-3-spec.md`, four iterations, on 2026-07-26. Four commits, each carrying
the `commit_msg` its slice froze, four boxes ticked, tree clean, the plan's own DoD green when
replayed by hand afterwards. `ship: false` was enforced by the `goal:no-ship` label on the
issue: nothing pushed, no PR opened. **82 438 tokens** across the four slices, 23 agents,
about thirty minutes.

The auditor's report is at `.claude/goal-runs/<sha>.md`, and its most useful finding is not
about the plan it ran:

> The most expensive iteration was the php rename — 28 039 tokens — and its diff is the
> **smallest** of the run, +16/−12 across 6 files. Cost tracks the number of files and gates
> touched, not the number of lines written.

That matters for `max_diff`: a budget bounds the diff, and the diff is not what a slice costs.

**What the run cost before it worked, which is the part worth keeping.** Three launches failed
before this one, and none of the three was caught by a gate:

1. `args` reaches a workflow script as a **JSON string**, not as the object the launch site
   writes. `args.plan` was `undefined` and the run died in 5 ms having spawned nothing.
2. Agents defined by a plugin are addressed **namespaced** — `goal:goal-runner`, not
   `goal-runner`. Six call sites were wrong; the run died on its first `agent()`.
3. The agent registry is a **snapshot taken when the session starts**. An agent created during
   a session is unusable in that session, so the run has to be launched from a fresh one.

Every iteration from 7 to 14 had a green gate, and every one of those gates was `node --check`.
They proved the file **parses**. None of them proved it **starts**. That gap is the honest
lesson of this exercise, and it is why the first real run is an iteration of the plan rather
than a victory lap.

## Known gaps

1. **An uncaught throw leaves the run lock held.** The loop releases it on every exit path it
   controls, but a crashed process is not one of them — observed once, when a run died mid-survey
   and left `<plan>.run.lock` behind. Recovery is documented (preflight check 7,
   `goal-gate.ts unlock`) and it worked, but it is prose, not machinery.
2. **`node --check` is not a smoke test.** Nothing exercises the launch path itself, which is
   how three consecutive dead-on-arrival defects reached a green branch.
3. **The reader holds plain `Bash`**, not a scoped `gh api` grant — the agent `tools:` field
   cannot express one. See `steering-and-injection.md`, which states the residual risk.
