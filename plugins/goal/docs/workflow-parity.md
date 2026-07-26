# Workflow parity checklist

Every guarantee `commands/auto.md` makes today, and where the workflow rebuild must hold it.
The question is never "does the new thing do something similar" but "is the same property
still held, and by what".

**This is a target, not a status report.** The workflow does not exist yet; it is built
iteration by iteration under `.claude/plans/issue-6-spec.md`. Each row is a claim the rebuild
has to earn, and the reference spike on `wip/issue-6-harness-spike` is only evidence that the
shape works — not that it is held.

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
workflow script has no way to ask a question. `/goal:auto --workflow` runs the preflight
first and launches only if it passes.

| Check | Status | Note |
|---|---|---|
| 1. Policy is `commit` / `commit+pr` | **held twice** | the command. The gate no longer needs to re-check it: there is no state file to write. |
| 2. Branch is `feature/<work-id>…` | **moved** | the command. For tracks the workflow creates the branches itself, named from the plan. |
| 3. Clean tree | **moved** | the command. |
| 4. `.claude/` is gitignored | **moved** | the command. Still load-bearing: the gate ticks the plan there on every iteration. |
| 5. At least one unchecked iteration | **held** | the survey returns the unchecked set; empty → `done` with a reason, nothing runs. |
| 6. No cleanup iteration (`Trigger:` line) in a feature plan | **held** | named explicitly in the survey's inconsistency list, with the `*-cleanup-spec.md` exemption. |
| 7. No run already active | **replaced** | there is no run state to read. The command checks for a stale `<plan>.lock` instead, which is the only thing a dead run leaves behind. |
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
| An iteration with no gate halts rather than inventing one | **held** | `goal-gate.sh` refuses a block with no `gate1`; the workflow turns that into a `paused`. |
| Gate decides, exit code only | **held** | `green` verifies, commits and ticks inside one script. |
| Halt is final, remaining iterations not attempted | **held, stronger** | `break` in JavaScript, and the not-attempted list is computed and reported. |
| Tick only after the gate, commit only after the tick | **held, stronger** | all three inside one bash script, in that order. |
| `git status --short` empty after commit | **held** | checked by `green` before it returns 0. |
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
| Tracks are provably disjoint before anything is created | **gap** | currently a survey judgement, not a proof. |
| `Branch suffix:` collisions refused | **gap** | same. |
| Remove shipped worktrees, keep halted ones, never delete a branch | **held** | `git worktree remove` after a track ships; a halted track returns before reaching it. |

### The race this checklist exists to catch

`auto.md` holds "only one writer to the spec" by being single-threaded: *"You are
single-threaded, so there is no race on the shared file."* The workflow is not. Tracks run in
separate worktrees, but the plan lives in the main tree's `.claude/` and every track addresses
it by absolute path — so two tracks reaching their GREEN gate at the same moment both
read the whole file and both write the whole file, and one tick is silently lost. They also
collided on a fixed `$spec.new` temp filename.

The spike answered it with a `mkdir`-based lock (atomic and portable, unlike `flock` on
macOS) around the read-check-write, a PID-suffixed temp file, and an `EXIT` trap so no failure
path leaves the lock behind, plus three regression tests: a held lock blocks the tick without
committing, a green run releases it, a failing run releases it. **The rebuild must land the
same three tests**, or the property is unproven whatever the code looks like.

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

## Answered in the spike, still to be earned by the rebuild

The spec-write race, history reshaping before the first push, worktree cleanup for shipped
tracks, `Delivery mode:` / `Breaks:` in the PR body, and preflight check 6 in the survey. Each
has a known answer on `wip/issue-6-harness-spike`; none of them is held until an iteration
lands it with its own gate.

## Known gaps, in priority order

1. **Track disjointness as a proof, not a judgement.** `auto.md` requires proving the file
   sets pairwise disjoint *before creating anything*, because a false track means two PRs that
   conflict at merge. The workflow asks the survey agent to notice it, which is a judgement
   about a mechanical property. The proof is easy — parse `impl_files` from each track's
   gate blocks, intersect the sets, refuse on overlap or on a suffix collision — and it
   belongs in a script called before the first `git worktree add`.
That is the only remaining gap. It is not a correctness hole in what the gate enforces — it
is a proof the prose version required and the script version currently assumes.
