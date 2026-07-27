---
description: Autonomous execution of a locked plan by a checked-in workflow, iteration after iteration, ending with a pushed branch and an open PR. You preflight and launch; the workflow orders the iterations and the gate decides whether each one passed. Halts hard on the first refusal without attempting the ones after it. Requires a commit or commit+pr policy; refuses under manual. Use it when the plan is frozen and you want the whole thing delivered while you are away.
argument-hint: Optional plan path (.claude/plans/<work-id>-spec.md)
---

# /goal:auto — Autonomous plan execution, up to the PR

You **preflight and launch**. You are not the orchestrator: `workflows/goal-auto.js` is, and
it is checked in. You do not order the iterations, you do not implement, you do not commit and
you do not decide that anything passed. You refuse to start if the run cannot be trusted, you
hand the plan to the workflow, and you report what it returned.

That split is the whole design. The prose version of this command ended with seventeen
prohibitions — *never tick before the gate*, *a halt is final*, *never touch the index* — and
one writes those sentences only about things that are possible. In a script the ordering is
instructions and `break` executes; in a gate the verdict is an exit code. What is left here is
what genuinely belongs to a session: refusing to start badly, and reading the result.

Run this with Remote Control connected (`/remote-control`) if you want to follow it from
a phone: subagent progress syncs to connected devices. The machine must stay awake and
online for the session to survive.

## The plan is the state

There is no state file. The durable state of a run is the plan's own `- [x]` checkboxes,
ticked by the gate after a green verdict, and the plan's normalized hash, published by the
gate and carried by the workflow for the whole run. A fresh launch re-reads the boxes and
resumes at the first unchecked iteration, which is why an interrupted run needs no recovery
protocol: relaunch it.

Two locks live beside the plan, both taken and released by the gate: `<plan>.run.lock` for
the run and `<plan>.tick.lock` around the commit.

## Phase 0 — Resolve the plan and the mode

Argument: `$ARGUMENTS`

- A path ending in `.md` → that is the plan.
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
   ticks `[x]` in the spec on every iteration, and the spec lives under `.claude/`. Tracked,
   it turns into an undeclared modification the gate reads as a scope leak, so the run would
   halt on iteration 2 in a repository that is otherwise perfectly fine. STOP and tell the
   developer to add `.claude/` to `.gitignore` — never add it yourself, and never work around
   it by declaring the plan in `impl_files`.
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
7. **No run already holds the plan.** `<plan>.run.lock` present means another session is
   driving this branch, or one died without releasing it. STOP rather than run two loops on
   one tree, and report the two ways forward: wait, or release it yourself with
   `node <gate> unlock <plan>` once you know the holder's process is gone. Never remove the
   directory by hand — the gate is what took it.
8. **`gh` and the remote**, only when the policy is `commit+pr`: `gh auth status` succeeds,
   `git remote` is non-empty, and `gh pr list --head <branch>` shows no open PR. Check these
   now: discovering them after twelve green iterations wastes the whole run.
9. **node runs the gate**, which is TypeScript with no build step and no dependency. Prove it
   rather than assume it, because a node too old to strip types fails at the first gate call,
   twelve iterations of work later:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-gate.ts
   echo "exit=$?"
   ```

   Expect the usage lines on stderr and `exit=2` — misuse, which is the gate answering. Any
   other output is node refusing to execute the file: STOP and report it verbatim. Types are
   **not** checked at run time; that is a CI concern and never a gate.

Report each check with its real output, then state how many iterations remain and what will
happen at the end.

## Phase 2 — Launch the workflow

One call. The script is checked in, so nothing is generated per run:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/goal-auto.js",
  args: { plan: ".claude/plans/<work-id>-spec.md",
          gate: "node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-gate.ts" }
})
```

`gate` is passed explicitly because a workflow script has no environment to read
`${CLAUDE_PLUGIN_ROOT}` from: resolve it here, where the shell does it for you.

Then wait. Do not implement, do not run the gate yourself, do not tick anything, and do not
"help" a slow iteration. Announce that the run has started and how it will end.

## Phase 3 — Read what came back

The workflow returns one object, and it is the report:
`{ status, plan, iteration, detail, landed, notAttempted }`.

| `status` | What happened | What you do |
|---|---|---|
| `done` | every iteration landed, each gate-verified | report the branch, the PR and the iterations delivered |
| `halted` | a gate refused real work at `iteration` | print `detail` **verbatim** — reason, command, exit code, real output — then list `notAttempted`. Do not diagnose, do not fix, do not relaunch |
| `paused` | a clean boundary: the token floor, or an implementer that returned nothing | say what landed and that relaunching resumes at the first unchecked box |
| `refused` | the run never started: lock held, survey failed, an iteration unrunnable, no plan hash | print `detail` and stop. Nothing was attempted, so nothing needs undoing |

A halt leaves the tree **exactly as the implementer left it** — not clean. That is deliberate:
the evidence is what the developer needs. It also means the next launch fails preflight check
3 until they deal with it, which is the intended friction.

Parallel tracks are the workflow's concern, not this command's. A plan carrying `## Track`
headings has its independence **proved** before anything is created — one path declared by two
tracks refuses the whole run — then each track gets its own worktree, its declared preparation,
its own branch and its own PR, and they run at the same time. A halted track never cancels a
healthy sibling, so the report carries one entry per track under `tracks`, and the worktree of a
halted one is kept for you to inspect. Tracks need `gate` passed as an absolute path.

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

The PR targets the repository's default branch, unless the plan header carries a
`PR base: <branch>` line — a plan that stacks on an integration branch must, or its PR opens
against the wrong base and shows every commit the two branches do not share.

Under `commit+pr` the PR is not created at the end: it is opened as a **draft at the first
commit of the run** and its body is rewritten by every iteration after it, so a run that
halts at iteration 3 of 15 still leaves a draft a human can read instead of a local branch
nobody can see. Marking it ready is the last act of a `done` run.

## Phase 4 — The cleanup plan, when the spec says `now`

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

## Phase 5 — What the merge will leave behind

Close the report with the checklist from `templates/post-merge.template`, filled per that
file's **"How to fill it"** section. It is the last thing you print.

The run ends with a PR open, and the merge happens later — hours, days, in a session that
carries none of this context. Everything the run created and cannot itself remove (the
branch on both sides, the safety refs, the control labels on the issue, the plan's
placeholder checkboxes) survives that gap unless it is written down before the gap opens.
A run that reports only its PR is a run whose leftovers are found weeks later, by which
point a stale `goal:no-ship` has already blocked somebody's next launch.

Print it, never do it. Deleting a branch, a tag or a label is outside what this command
may touch, and the developer may be keeping any of them on purpose.

## Rules for THIS command

Four, where there were seventeen. The rest became machinery, which is the point.

- **You launch, you do not orchestrate.** No loop of your own, no gate call of your own, no
  commit, no tick, no line of production code.
- **You do not edit the plan**, beyond nothing at all: the gate hashes it and halts if it
  moved. A plan that is genuinely wrong is a refusal to report, not a file to fix mid-run.
- **A halt is final**, and the workflow already enforced it. Do not relaunch it, do not
  diagnose it, do not "just retry" the iteration that failed.
- **Never `--force`**, never delete a branch, never touch the index to tidy up.
