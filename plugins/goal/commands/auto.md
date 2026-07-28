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
2. **Remote.** Read the `Remote:` line in the spec header. It names the git remote this run
   pushes to, and the repository its pull request opens on. Missing, empty, or not a plain
   remote name → **STOP**: _"The plan declares no remote. Add a `Remote:` line to its header."_
   **Never fall back to `origin`.** A bare push takes the default remote and `gh pr create`
   targets a fork's **parent**, so guessing here means a run on a fork pushes to the fork and
   opens its pull request upstream — on somebody else's repository, unattended, with nobody
   watching. The refusal is the feature; a default would reintroduce exactly what it removes.
3. **Branch.** `git branch --show-current` must be `feature/<work-id>` or `feature/<work-id>-…`.
   The workflow now holds this one too, and refuses before taking the lock. That is not a
   pointless duplicate: the version here is executed by a model, the one in the workflow is a
   fact — the same reasoning `workflow-parity.md` applies to the policy.
4. **Clean tree.** `git status --short` must be empty. Uncommitted work would end up in the
   first iteration's commit without anyone having reviewed it.
5. **What the run writes is out of git's sight.** Check the plan's own directory, not the
   whole `.claude/`: many repositories track `.claude/` on purpose for the commands, skills
   and settings shared with the team, and that is none of this run's business.

   ```bash
   git check-ignore -q "$(dirname <plan>)"
   ```

   That directory is what the run writes into: the spec, ticked `[x]` on every iteration,
   the execution log the Stop hook rewrites next to it, and the run lock. Visible to git,
   each becomes an undeclared modification the gate reads as a scope leak, so the run would
   halt on iteration 2 in a repository that is otherwise perfectly fine. The command also
   fails when a spec was committed before the ignore rule existed — `check-ignore` answers no
   for a tracked path, and a tracked plan leaks exactly the same way. STOP and tell the
   developer to ignore `.claude/plans/`, untracking any spec already committed. Never add the
   rule yourself, and never work around it by declaring the plan in `impl_files`.

   `.claude/goal-runs/`, where the audit report lands, is written after the last commit and
   no gate call follows it. Not ignored, it leaves one untracked file behind and nothing
   halts: mention it in the launch report, do not refuse over it.
6. **Iterations.** The spec must hold at least one `- [ ]`. None left → report the plan is
   already complete and STOP.
7. **No cleanup iteration in a feature plan.** An iteration carrying a **Trigger** line
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
8. **No run already holds the plan.** `<plan>.run.lock` present means another session is
   driving this branch, or one died without releasing it. STOP rather than run two loops on
   one tree, and report the two ways forward: wait, or release it yourself with
   `node <gate> unlock <plan>` once you know the holder's process is gone. Never remove the
   directory by hand — the gate is what took it.
9. **`gh` and the declared remote**, only when the policy is `commit+pr`: `gh auth status`
   succeeds, `git remote get-url <the Remote: line>` resolves, and `gh pr list --head <branch>`
   shows no open PR. Check the remote by the name the plan gave, not merely that some remote
   exists: a plan naming `upstream` on a clone that only has `origin` fails at the push, twelve
   green iterations later.
10. **node runs the gate**, which is TypeScript with no build step and no dependency. Prove it
   rather than assume it, because a node too old to strip types fails at the first gate call,
   twelve iterations of work later:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-gate.ts
   echo "exit=$?"
   ```

   Expect the usage lines on stderr and `exit=2` — misuse, which is the gate answering. Any
   other output is node refusing to execute the file: STOP and report it verbatim. Types are
   **not** checked at run time; that is a CI concern and never a gate.
11. **Nothing in the run may stop to ask the developer.** This is the check that makes a
    backgrounded run possible, and skipping it is what makes one look dead. The run executes
    `git commit`, `git push`, `gh pr create`, the gate, and every acceptance command the plan
    declares — in Manual mode, which is the default, each of those is a permission prompt.
    Nobody is watching, so nothing answers: the session parks in `Needs input`, no iteration
    advances, and from the outside that is indistinguishable from agents that died.

    Read what the settings ask for, then confirm what the session actually runs, because
    `Shift+Tab` overrides the file and only the status bar badge knows:

    ```bash
    python3 -c "import json,os;[print(p, json.load(open(p)).get('permissions',{}).get('defaultMode')) for p in [os.path.expanduser('~/.claude/settings.json'),'.claude/settings.json','.claude/settings.local.json'] if os.path.exists(p)]"
    ```

    Accept `auto` — the classifier approves, and pushing the working branch plus opening the
    pull request for the work asked for run unprompted — or `bypassPermissions`. Accept Manual
    or `acceptEdits` only when the developer states that allow rules already cover git, `gh`,
    node and the plan's gate commands; that is their call to make, not yours to infer from a
    settings file. Anything else → **STOP** and say what to relaunch with:
    `claude --permission-mode auto`, or `Shift+Tab` before launching.

    Say one more thing under `auto`, and only once: the classifier pauses auto mode after three
    consecutive blocks and resumes prompting. A run that stalls mid-way in the background with
    no halt report is that, not a crash — reattach and answer it.
12. **The base is already green.** Every check above proves the run *can* start; this one proves
    it is worth starting. Collect the distinct commands from the plan's `dod` block and from
    every iteration's `gate2..N`, and run each one **now, on the untouched tree**. They are the
    project's own CI — tests, lint, static analysis, container check — and they must already
    pass before a single line is written.

    **Exclude `gate1` from this sweep.** It is the bitten criterion: it is *supposed* to fail
    without the implementation, so requiring it green here would refuse every honest plan.

    Any other command failing means the base is red before the run touches it. **STOP**, print
    the failing command and its output verbatim, and say the failure predates the plan. Do not
    start, and do not fold the repair into the plan: an iteration that inherits a red base burns
    its full implementation before the gate refuses it for something it never touched, and the
    developer reads a halt that names their slice for a defect that was there first.

    **A base that does not exist yet is not a red base.** On a plan that bootstraps a project the
    sweep's commands cannot run at all: `pnpm exec vitest run` against a tree with no
    `package.json` exits 1 on `ERR_PNPM_NO_PKG_MANIFEST`, and it keeps exiting 1 until the
    iteration that creates the toolchain lands. Refusing there makes every bootstrap plan
    unrunnable by the one command written to run it, and the developer's only way out is to
    build by hand the thing they wrote a plan for.

    So the plan says so, rather than the sweep guessing. A `Bootstrap: <iteration>` header line
    names the iteration that brings the toolchain into existence, and the sweep is **skipped
    while that iteration is still unticked**. Once it is ticked every later launch sweeps
    normally, which is what stops the exemption from becoming a permanent hole in the check —
    the run that most needs a green base is the second one, not the first. No `Bootstrap:` line
    means the sweep always runs. Report the skip and name the iteration, so a reader never
    mistakes an exempted sweep for a green one.

    This is the cheapest check in the list and the one that saves the most: it costs one sweep
    of commands that already exist, against a run that can otherwise spend its entire budget on
    an iteration that was never going to land. It exists because a run halted at iteration 1 on
    three pre-existing static-analysis errors, in files no iteration declared, after ten minutes
    of implementation — every one of them visible from a single command nobody had run.
13. **The branch is up to date with what it forked from.** Run `git fetch --prune` in its own
    call, then prove the base is an ancestor of `HEAD`:

    ```bash
    git merge-base --is-ancestor <base> HEAD
    git log --oneline HEAD..<base>
    ```

    `<base>` is the plan's `PR base:` line when it has one, the repository's default branch
    otherwise. Behind it → **STOP** and say which commits are missing. Never rebase or merge
    yourself: history is the developer's, and an unattended run is the worst moment to move it.

    A stale branch poisons both of the checks before it. Check 11 sweeps a base that is not the
    one the work will merge into, so it certifies green against the past; and the run implements
    against files the base has since changed, so its diff conflicts at merge and its gates judge
    code nobody will ship. Both failures surface long after the tokens are spent. The fix is one
    fetch and one ancestry test, and it belongs here rather than in the developer's habits.

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

### Backgrounding the run

Say this once the workflow is launched, because the whole point of `/goal:auto` is that the
developer leaves. **Backgrounding does not stop anything**: `←` on an empty prompt, or `/bg`,
hands the conversation to the supervisor process, and the workflow, its subagents and their
shell commands carry over and keep running. The terminal is free, and the machine has to stay
awake — this is local, not cloud.

Coming back: `claude agents` lists the session, `←` from a row attaches to it, and `/workflows`
shows the live progress tree. Read a row before concluding anything from it:

| Row says | What it means |
|---|---|
| running | the loop is advancing, nothing to do |
| `Needs input` | a permission prompt is waiting, which preflight 10 exists to prevent. Attach and answer it; the run resumes where it parked |
| finished | Phase 3 below, the report is in the transcript |

`Ctrl+X Ctrl+K` stops every background subagent in the session, and that is the only thing
that kills a run from the outside — never suggest it as a way to "check" on one. A run stopped
that way leaves the plan's checkboxes exactly where they were, so relaunching resumes at the
first unchecked box.

## Phase 3 — Read what came back

The workflow returns one object, and it is the report:
`{ status, plan, dir, branch, sha, iteration, detail, landed, notAttempted }`.

`dir`, `branch` and `sha` say which tree, which branch and which commit the report is about, on
every exit path but one: a run whose probe could not establish where it stands says so instead,
because naming the tree is exactly what failed. Report them — with several worktrees on one
machine, "the working tree of the halted iteration" is not an address.

| `status` | What happened | What you do |
|---|---|---|
| `done` | every iteration landed, each gate-verified | report the branch, the PR and the iterations delivered |
| `halted` | a gate refused real work at `iteration` | print `detail` **verbatim** — reason, command, exit code, real output — then list `notAttempted`. Do not diagnose, do not fix, do not relaunch |
| `paused` | a clean boundary: the token floor, or an implementer that returned nothing | say what landed and that relaunching resumes at the first unchecked box |
| `refused` | the run never started: lock held, survey failed, an iteration unrunnable, no plan hash | print `detail` and stop. Nothing was attempted, so nothing needs undoing |

A halt leaves the tree **exactly as the implementer left it** — not clean. That is deliberate:
the evidence is what the developer needs. It also means the next launch fails preflight check
4 until they deal with it, which is the intended friction.

**A run works where you launched it, and that is the whole of its isolation.** It creates no
worktree and knows of none: launch it from a checkout and it uses that checkout, launch it from
a worktree and it is isolated. So run it from a session of its own — `cd` into a worktree, then
`claude` — for two reasons that both cost a whole run when ignored. The main checkout stays free
while it works. And a run living in your interactive session dies from a keystroke: navigating
out of its progress view interrupts it, which makes looking at the run the gesture that kills it.

**Parallelism is several runs, not a mode.** One plan that splits into independent parts is
written as several plan files, each self-sufficient, and you launch one run per file. The
concurrency cap is per workflow, so nothing is lost by moving the parallelism up here — and
proving the parts disjoint happens once, at planning time, where a human can read the file lists.

### What goes in a PR body

**Only the iterations this PR actually delivers.** Never the whole plan. One plan can
produce several PRs — the separate cleanup plan, and any sibling plan a split produced — so
pasting the contract into each would repeat it over PRs that each realise a part of it,
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
  unnamed convention here is a refusal on check 3 at the worst moment.
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
