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
| 2. Branch is `feature/<work-id>…` | **moved** | the command. For tracks the workflow creates the branches itself, named from the plan. |
| 3. Clean tree | **moved** | the command. |
| 4. `.claude/` is gitignored | **moved** | the command. Still load-bearing: the gate ticks the plan there on every iteration. |
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

## Phase 3 bis — Parallel tracks

| Guarantee | Status | Where |
|---|---|---|
| Tracks run concurrently | **held** | `parallel()` over tracks. |
| A halted track never cancels a healthy one | **held, stronger** | each track returns a result object; nothing throws across tracks. |
| One worktree per track, branched from the **default** branch | **held** | `git worktree add … -b feature/<work-id>-<suffix> <defaultBranch>`. |
| Each track addresses the plan by an **absolute** path | **held** | the workflow builds absolute paths, since the plan is absent from the worktrees. |
| Gate runs from the worktree root | **held** | every runner is given the track's directory as cwd. |
| One PR per track | **held** | the ship stage runs inside each track. |
| Re-verify (gate + DoD) before pushing | **held** | the DoD runs per track, in its worktree, after its last iteration. |
| **Only one writer to the spec** | **found broken, fixed** | see below. |
| Tracks are provably disjoint before anything is created | **held, was a gap** | `goal-gate.ts tracks` intersects the declared paths of every track's iterations and refuses on overlap, naming both tracks and the shared path. Subtree declarations count. Iteration 11, with tests. |
| `Branch suffix:` collisions refused | **held, was a gap** | same verb: a missing suffix, a duplicated suffix, or one iteration number claimed by two tracks each refuse the whole run before a worktree exists. |
| Remove shipped worktrees, keep halted ones, never delete a branch | **held** | `git worktree remove` after a track ships; a halted track returns before reaching it. |

### The race this checklist exists to catch

`auto.md` holds "only one writer to the spec" by being single-threaded: *"You are
single-threaded, so there is no race on the shared file."* The workflow is not. Tracks run in
separate worktrees, but the plan lives in the main tree's `.claude/` and every track addresses
it by absolute path — so two tracks reaching their GREEN gate at the same moment both
read the whole file and both write the whole file, and one tick is silently lost. They also
collided on a fixed `$spec.new` temp filename.

The spike answered it with a `mkdir`-based lock (atomic and portable, unlike `flock` on
macOS). **The rebuild landed it, and split it in two**, which the spike had not: a
`<plan>.tick.lock` around the read-check-write of the commit, and a `<plan>.run.lock` taken for
the whole run — the second closes a hole the spike still had, where two *sessions* could
implement the same iteration. The tick lock is registered in `heldLocks` and removed by a
`process.on('exit')` handler; the run lock survives the process **on purpose**, and only
`goal-gate.ts unlock` hands it back. Two regression tests pin them, in
`tests/gate-commit.test.ts`: *a run lock is exclusive, and unlock hands it back*, and *a commit
is refused while another writer holds the tick lock*.

This is the class of bug the parity exercise exists to find: a property held *implicitly* by
the old design's shape, silently lost when the shape changes.

## Phase 4 — Ship

| Guarantee | Status | Where |
|---|---|---|
| Global DoD as a last barrier, nothing pushed if it fails | **held** | per track; on failure the branch is pushed and the issue commented, no PR. |
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
