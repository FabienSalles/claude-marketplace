---
description: Autonomous execution of a locked plan, iteration after iteration, ending with a pushed branch and an open PR. Runs every remaining iteration in one turn, halts hard on the first failure without attempting the ones after it, and advances only when a verification script exits 0. Requires a commit or commit+pr policy; refuses under manual. Use it when the plan is frozen and you want the whole thing delivered while you are away.
argument-hint: Optional plan path (.claude/plans/<work-id>-spec.md), or `--continue`, or `--resume-at <n>`
---

# /goal:auto — Autonomous plan execution, up to the PR

You are the **orchestrator**. You run every remaining iteration of a locked plan in a
single turn and finish by opening the PR. You do not write production code: each
iteration is implemented by a **subagent** whose transcript stays out of your context,
so a fifteen-iteration run costs you barely more context than a two-iteration one.

Two things are not yours to decide.

**Whether an iteration passed** is decided by `scripts/goal-auto-gate.sh`, which replays
that iteration's acceptance commands and exits 0 or 1. You read the exit code. Your
opinion, and the subagent's report, decide nothing. This is the whole point: a subagent
that writes "all tests pass" cannot advance the loop.

**Whether to continue after a failure** is not a judgement call either. The answer is
always no. A halt ends the run there, and the iterations after it are never attempted.
That is what keeps a broken slice from costing the tokens of the five built on top of it.

Run this with Remote Control connected (`/remote-control`) if you want to follow it from
a phone: subagent progress syncs to connected devices. The machine must stay awake and
online for the session to survive.

## The state file

Path: `.claude/plans/<work-id>-auto-state`, flat `key=value`, one per line. You write it,
the gate script reads it.

| Key | Meaning |
|---|---|
| `state` | `running` / `halted` / `done`, so a later run knows what it is walking into |
| `spec` | path to the plan |
| `policy` | `commit` or `commit+pr`, read from the spec's `Policy:` line |
| `spec_hash` | normalized hash of the spec, detects a rewritten contract |
| `iteration` | number of the iteration in flight |
| `iteration_files` | space-separated paths that iteration may touch |
| `commit_msg` | conventional message for that iteration |
| `gate1`, `gate2`, … | that iteration's acceptance commands, one per key |
| `dod1`, `dod2`, … | the global Definition of Done, replayed once before shipping |

The last four are not composed here: they are copied verbatim out of the spec's `gate`
blocks, which the developer validated when the plan was locked.

## Phase 0 — Resolve the plan and the mode

Argument: `$ARGUMENTS`

- A path ending in `.md` → that is the plan.
- `--continue` or `--resume-at <n>` → resume mode, see Phase 2.
- Empty → the `.claude/plans/*-spec.md` most recently modified, **excluding
  `*-cleanup-spec.md`**. A cleanup plan is written after the feature plan it belongs to, so
  it is always the more recent of the two: resolving it here would run the removals before
  the change they clean up. A cleanup plan is only ever run by naming its path. Several
  equally plausible candidates → list them and ASK. None → STOP: _"No plan found. Run
  `/goal:run-issue` first."_

Derive `<work-id>` from the spec filename (`<work-id>-spec.md`, or `<work-id>-cleanup-spec.md`
when the path given is a cleanup plan — the work-id is the same in both cases).

## Phase 1 — Preflight, and refuse loudly rather than start badly

Every check is a refusal, not a warning. An unattended run that starts wrong is worse than
one that never starts. Run the commands and show what failed.

1. **Policy.** Read the `Policy:` line in the spec header.
   - `manual` → **STOP**: _"Policy is manual, so nothing may be committed and there is
     nothing to chain. Autonomous execution needs `commit` or `commit+pr`. Change the
     Policy line in the spec, or run the manual loop with `/goal` and `/goal:next`."_
   - Missing or unreadable → **STOP** and ask which policy applies. Never assume.
2. **Branch.** `git branch --show-current` must be `feature/<work-id>` or `feature/<work-id>-…`.
3. **Clean tree.** `git status --short` must be empty. Uncommitted work would end up in the
   first iteration's commit without anyone having reviewed it.
4. **The plan is out of git's sight.** `git check-ignore -q .claude/` must succeed. The run
   ticks `[x]` in the spec and writes the state file on every iteration, and both live under
   `.claude/`. Tracked, they turn into an undeclared modification the gate reads as a scope
   leak, so the run would halt on iteration 2 in a repository that is otherwise perfectly
   fine. STOP and tell the developer to add `.claude/` to `.gitignore` — never add it
   yourself, and never work around it by declaring the plan in `iteration_files`.
5. **Iterations.** The spec must hold at least one `- [ ]`. None left → report the plan is
   already complete and STOP.
6. **No cleanup iteration in a feature plan.** An iteration carrying a **Trigger** line
   ("flag at 100% for 7 days", "zero reads logged") asserts something about production
   that this run cannot observe, and that will only become true after the PR it sits in is
   merged and live. Running it inside the feature plan would delete the fallback in the
   same PR that introduces what falls back to it. Find one in a `*-spec.md` and **STOP**:
   report it, and tell the developer to move it out with `/goal:run-issue`.

   **This check does not apply when the plan being run is itself the cleanup plan**
   (`*-cleanup-spec.md`), which is where those iterations legitimately live. There the
   trigger gates the **merge**, not the run: under `Cleanup: now` the PR is opened as a
   draft and waits for it, and under `later` the developer decided the trigger holds by
   running the plan at all. Do not re-litigate it here, or the cleanup plan becomes
   unrunnable by the very command written to run it.
7. **No run already active.** `<work-id>-auto-state` with `state=running` means another
   session is driving this branch. STOP rather than run two loops on one tree.

   **Skip this check in resume mode** (`--continue`, `--resume-at <n>`). An interrupted
   run — rate limit, closed session, machine asleep — leaves `state=running` behind,
   because only an exit-1 gate ever writes `halted`. Enforcing the check there would refuse
   the exact recovery this command documents. In resume mode the developer is asserting no
   other session is driving; say so in the report rather than silently assuming it.
8. **`gh` and the remote**, only when the policy is `commit+pr`: `gh auth status` succeeds,
   `git remote` is non-empty, and `gh pr list --head <branch>` shows no open PR. Check these
   now: discovering them after twelve green iterations wastes the whole run.

Report each check with its real output, then state how many iterations remain and what will
happen at the end.

## Phase 2 — Initialize, or resume from a clean boundary

**Fresh run.** Write the state file with `state=running`, `spec`, `policy`, `iteration` =
the first unchecked iteration's number, the `dod1..dodN` lines copied verbatim from the
`gate` block under the spec's `## Definition of Done`, and `spec_hash`:

```bash
sed 's/^- \[x\]/- [ ]/' <spec> | shasum | cut -d' ' -f1
```

Normalizing the ticks before hashing is what lets the gate allow a checkbox change while
still catching any other edit to the contract.

**Resume.** A run only resumes from a boundary where the previous iteration is committed
and the tree is clean, because a half-finished iteration is a state only the developer can
adjudicate.

- Tree clean, last iteration committed → resume at the first unchecked iteration.
- Tree dirty, or `state=halted` → **do not resume on your own**. Report the iteration that
  was in flight and the current `git status`, then offer exactly two ways forward and WAIT:
  - `/goal:auto --resume-at <n>` — redo iteration `n` from scratch, after the developer has
    dealt with the working tree themselves. **Restore `[ ]` on iteration `n` first.** The
    loop runs the *unchecked* iterations, so a slice left ticked by a gate that passed
    before a commit that failed would be skipped by the very run meant to redo it.
  - `/goal:auto --continue` — iteration `n` is actually fine, carry on with the next one.

Never `git restore`, `git reset` or `git checkout` anything to "make it resumable". That
decision belongs to the developer.

## Phase 3 — The loop

Repeat this for every unchecked iteration, in order, in this same turn. Announce each
iteration as you start it so the run is readable from a phone.

1. **Read the iteration** in the spec: Goal, Files to touch, Business rules covered, and
   its `gate` block.
2. **Rewrite the state file whole**, never append to it: `state`, `spec`, `policy`,
   `spec_hash` **carried forward verbatim from Phase 2, never recomputed** — recomputing it
   here re-baselines the contract on every iteration, so a spec rewritten during iteration 1
   would be blessed at iteration 2 and the tampering check would be dead for the rest of the
   run. Then **the iteration's `gate` block, copied verbatim**, plus `iteration` = its
   number. Appending leaves the previous iteration's keys in place and the gate would
   replay a stale command against this one; it halts on a duplicated key for that reason.

   **Copy, never compose.** `iteration_files`, `commit_msg` and `gate1`, `gate2`, … are
   already written in the plan, in this exact `key=value` form, validated by the developer
   at lock time. Transcribe those lines and nothing else. You do not derive `iteration_files`
   from the prose "Files to touch", you do not word a commit message, and you do not decide
   which acceptance criterion becomes a command — that decision was made when the plan was
   frozen, on purpose, by someone who was there. Reformulating any of it here reintroduces
   exactly the run-time interpretation the block exists to remove.

   Two ways the block can be wrong, and both are a halt rather than a repair:

   - **No `gate` block, or no `gate1` in it** → the plan predates this format or the slice
     was never gateable. Do not write commands for it. STOP, name the iteration, and tell
     the developer to add the block with `/goal:run-issue`.
   - **A line the gate script will reject** — a backtick, a glob, a markdown annotation in
     `iteration_files` — → STOP and report it. Fixing it here would mean editing the
     contract mid-run, which the spec hash catches anyway.
3. **Spawn one subagent** with the brief below, and wait for it. Do not implement anything
   yourself, and do not run the tests yourself at this point.
4. **Run the gate** and read its exit code:
   ```bash
   ${CLAUDE_PLUGIN_ROOT}/scripts/goal-auto-gate.sh .claude/plans/<work-id>-auto-state
   ```
   It replays the acceptance commands, and checks scope leak, parasitic artifacts and spec
   tampering.
   - **Exit 1** → the run is over. Set `state=halted`, print the script's output verbatim
     (reason, command, exit code, real output), then list the iterations that were **not
     attempted**, and STOP. Do not fix, do not retry, do not move on.
   - **Exit 0** → continue to step 5.
5. **Tick `[x]`** on that iteration in the spec. Only now, never before the gate.
6. **Commit**, exactly as `templates/goal-handoff.template` prescribes for the `commit`
   policy, so the manual and autonomous paths behave identically:
   ```bash
   git add -- <the declared files>
   git commit -m "<commit_msg>"
   git status --short
   ```
   `git status --short` must come back empty. If it does not, a file escaped the declared
   list: **set `state=halted`**, report, and do not commit again on top. Every halt writes
   `halted`, wherever it happens — that is what a later resume reads to know it is walking
   into a run that ended badly rather than one that was merely interrupted.
7. **Push and open the draft PR**, only under `commit+pr`, and only on the **first commit
   of the run**:
   ```bash
   git push -u <remote> <branch>
   gh pr view --json number --jq .number || gh pr create --draft --title "<title>" --body "<body>"
   ```
   A branch already carrying a PR is pushed and nothing else is created — one branch, one
   PR, for the whole run. On the iterations after the first, push and rewrite the existing
   body with `gh pr edit --body`, so what is reviewable always matches what has landed.
   Opening it at the first commit rather than at the end is what makes a halt visible: a
   run that stops at iteration 3 of 15 still leaves a draft a human can read, instead of a
   local branch nobody can see.
8. **Next iteration**, or Phase 4 when none is left.

### The subagent brief

Build it from `templates/goal-handoff.template`, filled per that file's "How to fill it"
section, with **two deliberate differences**:

- **Remove the `[x]` step.** The template has the executor tick the box as its last act.
  Here you tick it, and only after the gate passed, so an iteration can never be marked
  done before it is proven done. Leave the step in and that guarantee is gone.
- **Remove the commit/PR policy block.** You commit, not the subagent, so there is one
  writer to the index.

**Fill `<delivery-mode>` from the spec, and fold both branch blocks to the active branch.**
Under `no-bc-break` the subagent may not change the shape of anything listed in the spec's
`## Blast radius`, and may not remove anything at all. Paste that blast radius into the
brief: the subagent cannot see the spec's other sections, and a rule naming a list it
cannot read is not a rule.

Everything else stays: the convention skills to load, the delivery rule (additive only, no
removal, flag off and never flipped), TDD with a visible RED, one interface test per data
set asserting real content, and the structured synthesis. Tell the subagent its report is
advisory and that the gate is replayed independently.

The delivery rule is what makes an unattended run safe to halt at any point: every
iteration leaves the previous behaviour reachable, so a halt is an incomplete feature and
never a broken one. A subagent that "tidied up" the old path while it was there removed
the rollback of a change nobody has seen in production yet.

## Phase 3 bis — Parallel tracks

Skip this entirely if the spec has no `## Track` heading. With tracks, everything above
still applies **inside** a track; what changes is that tracks run at the same time, in
separate worktrees, and each ends in its own PR.

### Verify the tracks are actually independent

The spec claims independence. Prove it before creating anything, because a false track
means two PRs that conflict at merge:

- Collect every track's declared "Files to touch" and check the sets are **pairwise
  disjoint**. One shared file and the tracks are not independent. STOP and report the
  overlap, naming the file and the two tracks.
- Each track must carry a `Branch suffix:`. Two tracks with the same suffix would fight
  over one branch. STOP if they collide.

### Set up one worktree per track

This is the one place `/goal:auto` creates worktrees, and only because parallel tracks
cannot share an index. Branch each track from the repository's **default branch**, not
from another track, so every PR is independently mergeable:

```bash
git worktree add .worktrees/<work-id>-<suffix> -b feature/<work-id>-<suffix> <default-branch>
```

Each track gets its own state file, `.claude/plans/<work-id>-<suffix>-auto-state`, whose
`spec` key holds an **absolute** path. The spec lives in the main tree's `.claude/`, which
is gitignored and therefore absent from the worktrees, so a relative path would not resolve.

### Run the tracks

Spawn **one subagent per track, all in the same message** so they run concurrently. Each
subagent gets its worktree path, the **absolute** path of its state file, and the
iterations of its track only. It runs them sequentially: implement, then call the gate
script itself for fast feedback, and stop at its first failure without attempting the rest
of its own track.

Tell each subagent to **run the gate from its worktree root**. The gate reads the tree it
is standing in, so a scope check launched from anywhere else is checking the wrong tree —
it halts rather than pass, but the halt is a confusing one about the wrong repository.

You keep two things for yourself, because they cannot be made safe in parallel:

- **The spec is yours alone to write.** Subagents never tick `[x]`. They report which
  iterations passed; you tick them when they return, one result at a time. You are
  single-threaded, so there is no race on the shared file.
- **Shipping is yours.** When a track's subagent returns, re-run the gate and the global
  DoD **yourself in that track's worktree** before pushing. The subagent ran the gate too,
  but a claim of success is not a verified one, and re-verifying costs one command.

### One track failing does not stop the others

Tracks are independent by definition, so a failure in one says nothing about the rest. Let
every other track finish and open its PR. Never cancel a healthy track because a sibling
broke: you would throw away work that is provably fine.

Record the halted track's reason, leave its worktree and branch in place for the developer
to inspect, and report at the end:

```
piste astro  3/3 vertes   PR #12
piste php    HALT iteration 2 (phpstan exit 1)   worktree conserve
piste craft  2/2 vertes   PR #14
```

### Cleaning up

Remove the worktrees of tracks that shipped (`git worktree remove <path>`), and **keep**
the worktree of any halted track: it holds the state the developer needs to diagnose.
Never delete a branch.

## Phase 4 — Ship

1. **Global Definition of Done**, replayed as one last barrier. All iterations green
   individually does not prove the whole holds:
   ```bash
   ${CLAUDE_PLUGIN_ROOT}/scripts/goal-auto-gate.sh .claude/plans/<work-id>-auto-state --dod
   ```
   Exit 1 → set `state=halted`, report, and stop. Nothing is pushed.
2. **Reshape the history**, per the `git` skill §E, under **either** policy and before
   either branch below. One commit per iteration is the right unit while the run is in
   flight — it is what makes an interrupted run diagnosable — but it is not what a reviewer
   should read. Fold every commit that only repaired an earlier one on this branch into the
   commit it repaired, keep the rest, and leave the log a sequence of units someone would
   want to bisect to. Do it without asking, since nobody is there to answer, and do it
   **now**, while nothing is pushed, so it never needs a force. Report the before/after log.
3. **Policy `commit`** → report: iterations delivered, commits made, and that pushing is
   left to the developer. Then set `state=done` and stop — **unless the spec says
   `Cleanup: now`**, in which case go to Phase 5 and run the cleanup plan under the same
   policy: it commits on its own branch and opens no PR, because `commit` forbids one.
   Say plainly that the two branches are local and that the developer pushes and stacks
   the PRs themselves, cleanup last and as a draft.
4. **Policy `commit+pr`** → `git push -u <remote> <branch>` (never `--force`), then
   `gh pr create`, ready for review. Then set `state=done` and report the PR URL.

   The PR is not created here for the first time: under `commit+pr` it was opened as a
   **draft at the first commit of the run** (see Phase 4 step 7), so what happens here is
   `gh pr ready` plus a final body rewrite covering every iteration the branch delivers.
   A run that halts therefore already has a reviewable draft, which is what makes the
   halted-branch report of `R19` land somewhere a human can read it.

### What goes in a PR body

**Only the iterations this PR actually delivers.** Never the whole plan. One plan can
produce several PRs (parallel tracks, plus the separate cleanup plan), so pasting the
contract into each would repeat it three times over PRs that each realise a third of it,
and a reviewer could not tell which part is theirs to check.

Write, for each iteration in this PR: its goal in one line, the business rules it covers,
and the command that proves them. Add the `Delivery mode:` and, under `allow-bc-break`, the
`Breaks:` lines, because a reviewer must see a contract change without reconstructing it.

**Link, do not copy.** When a GitHub issue backs the work, `/goal:run-issue` has already
published the plan there, so reference it with `Refs #N`. Use **`Refs`, never `Closes`**:
several PRs come from one plan and only one of them could close the issue, so closing is
the developer's call once every PR is merged. With no issue, the PR body stands alone and
no plan is copied anywhere.

## Phase 5 — The cleanup plan, when the spec says `now`

Read the spec's `Cleanup:` header line. `none` or `later` → the run is over, report and
stop. `later` also means saying where the cleanup plan sits and that its trigger has to
hold before anyone runs it.

`now` → run `.claude/plans/<work-id>-cleanup-spec.md` as a second run, after the feature
PR is open, with two differences that matter:

- **Branch from the feature branch, not from the default branch**, and name it
  `feature/<work-id>-cleanup`. Cleanup deletes the flag and the old path, which only makes
  sense once the new path is in: cutting from the default branch would produce a PR that
  deletes something its own base still depends on. The name matters because the cleanup run
  goes through the same preflight, whose branch check expects `feature/<work-id>-…` — an
  unnamed convention here is a refusal on check 2 at the worst moment.
- **Target the feature branch, and open it as a draft**:
  `gh pr create --draft --base feature/<work-id>-<slug>`. GitHub shows only the cleanup
  diff and retargets the PR when the feature PR merges. The draft is what preserves the
  rollback window: the feature ships and soaks with the flag on, and the cleanup cannot be
  merged by accident while that is happening. Put the trigger at the top of its body, as
  the condition for marking it ready.

Everything else is a normal run: same preflight, same gate, same halt rules. A cleanup
that fails its gate halts like any other iteration and leaves the feature PR untouched
and mergeable, which is the point of it being a separate PR.

Report both PRs at the end, and state the sequence: the feature PR merges, production
confirms, then the developer marks the cleanup PR ready and merges it. Never mark it
ready yourself, and never merge either one.

## Rules for THIS command

- **You never implement.** Every line of production code comes from a subagent.
- **You never decide that an iteration passed.** The gate script's exit code decides. If
  you find yourself reasoning about whether a failure "really matters", stop and halt.
- **You never decide what gets verified either.** The `gate` blocks are copied out of the
  plan, verbatim. Writing a command the plan does not contain is inventing the contract.
- **Never tick `[x]` before the gate, never commit before the tick.** That order is what
  makes an interrupted run diagnosable.
- **A halt is final.** It ends the run until the developer restarts it explicitly. Never
  auto-resume, never retry, never skip to the next iteration.
- **Never touch the index or the tree to tidy up.** No `git add` outside the declared list,
  no `git reset`, no `git restore`, no `git checkout`.
- **The spec is the contract and you do not edit it**, beyond ticking `[x]`. The gate hashes
  it and halts if it changed. If the plan is genuinely wrong, halt and say so.
- **Announce every step.** This run is meant to be readable from a phone while it happens.
- **Worktrees only for parallel tracks**, never otherwise, and never delete a branch. A
  halted track keeps its worktree so the developer can inspect it.
- **You are the only writer to the spec**, in every mode. Subagents report, you tick.
