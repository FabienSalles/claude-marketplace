# goal: an agent writes the code, a program decides whether it ships

Most autonomous coding loops stop when the tests pass. That is the problem: **when the only stop
condition is *the test passes*, editing the test is a valid way to stop.**

This plugin removes that. A plan declares, per slice, the exact command that proves it done, the
files it may touch, and how many diff lines it may spend. The plan is then hashed and frozen.
From there, a **program**, not a prompt, judges each slice by running the declared command and
reading its exit code. That program is the only thing in the system allowed to commit.

## What no other harness does

No single mechanism here is unique any more: a program judging by exit code, a hash-frozen plan,
a declared-paths allowlist and a test counterfactual each have an independent implementation
somewhere in the 2026 field. **The conjunction has not turned up anywhere**, and the first two
rows below have no independent implementation at all:

- **A *numeric* per-slice diff budget.** Each slice halts if it touches an undeclared file or
  outgrows its declared diff line count. Not advice, a refusal. The blast radius is a number.
- **The judge is also the sole committer.** A deterministic program (exit code, declared paths,
  diff budget, secret scan) verifies, commits and ticks inside one process the writing agent
  cannot reach. No commit exists that a program did not verify.
- **The pull request stays shippable at every slice.** A slice reaches the pull request only
  after the gate has proven it green on the branch; the plugin does not push and let CI find out.
  A run that stops at 3 slices of 15 leaves 3 commits you can put in production, with no breaking
  change the plan did not choose (see the delivery strategy in step 2 below).
- **The counterfactual test.** Before accepting a slice, the gate sets the implementation aside
  and runs the test again. If the test still passes, the slice is refused: it proved nothing.
- **A plan that lives.** At every checkpoint the plan is reconciled against what actually changed
  in the code, so the plan you resume from tomorrow describes the repository as it is. The
  checkboxes are the entire run state, so a killed run resumes at the first unticked box.

The full survey (thirteen mechanisms across eight harnesses read in depth, including the rows
where this plugin loses) is [`docs/comparison.md`](docs/comparison.md).

## Four steps, from ticket to pull request

| Step | You run | What it buys you |
|---|---|---|
| 1 | `/goal:spec <source>` | The ticket becomes a **functional contract**. Any source (Jira via MCP, a GitHub issue, a file, pasted text) is normalised, then grilled: every functional gap, ambiguity or unstated rule becomes a question asked *now*, and every business rule an observable criterion. Opt in and [`grill-adversarial`](skills/grill-adversarial/SKILL.md) attacks the story instead of completing it (the case the ticket forgot, the rule that contradicts another), so holes surface while they are still questions, not bugs in a landed slice |
| 2 | `/goal:plan <source>` | Every criterion is **mapped to the command that proves it**. The work is cut into independently shippable slices with [`product:vertical-slice`](../product/skills/vertical-slice/SKILL.md), and each slice gets a delivery strategy with [`product:delivery`](../product/skills/delivery/SKILL.md): a breaking change accepted and named, or an additive change with a cleanup slice scheduled behind it. The mode is chosen, and the plan is hashed and frozen on a feature branch |
| 3 · `manual` | `/goal` + `/goal:next` | **One slice per session, you read every diff.** `/goal:next` does not trust the checkbox: it re-runs the finished slice's acceptance commands from scratch, reconciles the plan against the real code, then hands you the next instruction. This is where your skills sharpen. Autonomy is not declared, it is prepared here |
| 4 · `commit+pr` | `/goal:supervise [plan]` | **The whole plan, unattended.** One fresh implementer per slice, a gate verdict on each, a pull request that stays shippable from the first landed slice, a halt classified and repaired or discarded *once*, and every run audited to improve the workflow |

Two extra commands frame the path: `/goal:tickets <chantier>` upstream, when an initiative is too
big for one spec (ticket 1 detailed, the rest deliberately one-liners), and the runner's own
auditors downstream (see [the components table](#what-the-plugin-ships)).

**Steps 1–2 are deliberately not automated.** The ambiguity a source leaves cannot be lifted from
inside a run: an unattended implementer resolves it by guessing, and the guess surfaces thirty
turns later as work to throw away. The grill is the one place a human is load-bearing, for
minutes rather than hours.

**→ [`docs/walkthrough.md`](docs/walkthrough.md) is every step of all of this, with the concrete
reason for each one.**

## Two modes, and you pick one per plan

Asked during `/goal:plan`, **before** the work is split, because it changes how the work is split.

|  | `manual` | `commit+pr` |
|---|---|---|
| Who judges a slice | you, reading the diff | `goal-gate.ts`, by exit code |
| Who commits | you | the gate, and only the gate |
| Slice size | fine: one reviewable diff | coarser: one verifiable unit |
| You run | `/goal` then `/goal:next`, per slice | `/goal:supervise`, once |
| Pushes, opens a PR | never | yes, as it lands |
| Catch a mistake | at the next slice | at the pull request |
| Needs a `Remote:` line | no | yes, and it is never guessed |

**`manual` is the default**, and the right choice on unfamiliar code, on anything delicate, and
the first few times you use the plugin at all. Claude never commits, never pushes, never opens a
pull request. **Nothing is ever staged for you**, deliberately: staging is your review step, and
tidying the tree "to make it safe" would remove the very thing you were about to look at. The
handoff `/goal:next` emits lands on your clipboard, so it survives clearing the session. You
correct each slice at the moment it is cheap to correct: the blast radius of a bad slice is that
slice.

**`commit+pr` is where you hand over the whole feature and leave**, overnight or over lunch.
Every guarantee in this README is doing its work here, because you are not there to catch
anything. A run that stops at 3 slices of 15 still leaves a pull request you can merge and
deliver, not a local branch. The blast radius of a bad *plan* is the whole run, which is exactly
why the plan is grilled and frozen before anything starts.

Switching later means editing the `Policy:` line in the plan. The runner **refuses a `manual` plan
outright** rather than quietly committing under a policy that says it may not.

## Quick start

Both modes share the same first step: the plan.

```bash
cd ~/projects/<repo>

claude
> /goal:spec CT-1234    # the functional contract: Jira via MCP, a GitHub issue, a file, or 'inline'
> /goal:plan CT-1234    # the technical grill, the mode, then the locked plan on a feature branch
```

Then, from the branch the plan locked:

**Under `manual`**: one slice per session, and you review between them.

```text
> /goal <paste the handoff /goal:plan just gave you>
> /goal:next                       # verifies, reconciles, hands you the next one
```

**Under `commit+pr`**: the whole plan, once.

```text
> /goal:supervise .claude/plans/<work-id>-spec.md
```

Exit `0` landed · `1` the gate refused a slice · `2` refused before anything was attempted ·
`3` paused at a clean boundary, relaunch resumes there.

## Prerequisites

| Item | Needed for | Note |
|---|---|---|
| Node 24 | the runner and the gate | Types are stripped at run time, never checked; `tsc --noEmit` is a CI concern |
| Git-ignored `.claude/plans/` and `.claude/goal-runs/` | every run | Preflight refuses a plan directory git can see. The run records must be out of git's sight too: the gate would read them as an undeclared scope leak. The rest of `.claude/` may stay tracked |
| `betterleaks` or `gitleaks` | any push | The push is refused, not skipped, when neither is installed |
| `gh` authenticated | `Policy: commit+pr`, or a GitHub source | `gh auth login` |
| Atlassian MCP | a Jira source | Or paste with `inline` |

Optional plugins enhance and never gate: `pocock` (grill skills), `superpowers`
(`verification-before-completion`, `systematic-debugging`), `craft` and the language TDD packs.
The commands fall back to inlined behaviour when they are absent.

## Why you can leave it

Autonomy is only worth having if walking away is reasonable. That is what the harness buys:

- **The run spends its own time, not yours.** Your judgment is load-bearing for minutes (the
  grill, the plan, the mode) and the slices land while you are in another session, or asleep.
- **It verifies without getting tired.** Nine refusals before a byte is written, a base sweep,
  then per slice: the declared command replayed, the declared paths enforced, the diff budget
  counted, the test proven to bite, a secret scan before any push. A pace no human review
  sustains.
- **Every freedom is bounded by a refusal.** An agent left alone optimizes for finishing; here
  you are not releasing a model into the wild. You are handing a frozen plan to a program that
  refuses whatever the plan did not declare. Unattended never means unwatched.
- **A run you can kill.** It survives a killed process, a quota window, and an auto-updater that
  shuts down every Claude Code instance mid-slice. Checkboxes are the whole state; a relaunch
  tomorrow resumes at the first unticked box.
- **Something readable, and deliverable, at every stop.** A draft pull request is opened at the
  first landed slice and rewritten by each one after it. A halted run leaves work a human can
  open and merge, not a local branch nobody can see.
- **You were not there, and it does not matter.** Every stage is timed into a JSON event stream;
  an auditor writes a report naming what halted the run and which failures recur across earlier
  runs; an advisory reviewer reads the result with eyes the gate does not have. It has caught a
  real defect the gate structurally could not see.

## What the barriers actually hold

Each of these is a real mechanism with a real edge. Stated here so nobody plans against a
guarantee narrower than its slogan.

- **No commit the gate did not verify.** This holds per slice, absolutely. At run level it is
  narrower: slices publish as they land, so a global Definition-of-Done refusal arrives with the
  earlier slices already pushed. The **last** slice's push is held behind that barrier, so a
  single-slice run publishes nothing before it passes.
- **The implementer cannot commit, push or stash.** What enforces this is *detection*, not
  denial. Three snapshots bracket each session: the commit pointer, every ref including the stash,
  and the git directory's configuration and hooks. A permissions rule was tried and removed: it
  was read as a substring of raw JSON, which an `allow` entry satisfied just as well; it also
  restrained the developer's own session, and permissions are read at session start, so it
  described a future session and never the running one.
- **A test that passes without the implementation halts the slice**, unless the slice declares no
  `test_files`, which skips the check entirely. It proves the *new* test bites; **it does not
  prove a pre-existing test in the same files was not quietly weakened.**
- **The plan is hashed**, but the hash normalises ticks away, so un-ticking a finished slice would
  be invisible to it. A separate monotonicity check closes that, refusing a commit when the ticked
  set has shrunk since the run started.
- **The declared command is bounded by a 900-second wall clock; the implementer session is not.**
  There is no turn cap and no iteration ceiling. A session circling an impossible slice circles
  until the usage allowance runs out.
- **Nothing is read from GitHub except a pull request number and its state.** The one weak point is
  named: the reviewer agent holds `Bash`, so nothing mechanically stops it reading the pull request
  it posts to. There the invariant is prose again.

More, including the axes that are entirely empty: [`docs/comparison.md`](docs/comparison.md).

## What the plugin ships

| Component | Path | Role |
|---|---|---|
| [`/goal:tickets`](skills/tickets/SKILL.md) | `skills/` | Chantier → ordered backlog, elaborated just-in-time; opt-in GitHub milestone + issues |
| [`/goal:spec`](skills/spec/SKILL.md) | `skills/` | Any source → the functional contract; opt-in adversarial grill and GitHub issue |
| [`/goal:plan`](skills/plan/SKILL.md) | `skills/` | The technical grill → command-mapped DoD, slices, policy, remote → the locked plan on a branch |
| [`/goal:supervise`](skills/supervise/SKILL.md) | `skills/` | Launches the runner, classifies a halt, repairs or discards once. **Never exercised by a real run** |
| [`/goal:next`](skills/next/SKILL.md) | `skills/` | Manual-loop checkpoint: replay the DoD, reconcile plan against code, emit the next handoff |
| `goal-run.ts` + `run/*.ts` | `scripts/` + `src/run/` | The runner: 1,641 lines, the entry point plus 14 modules (preflight, sweep, lock, iteration, publish, close, report) |
| `goal-gate.ts` + `gate/*.ts` | `scripts/` + `src/gate/` | The judge, and the only committer: 1,120 lines, the entry point plus 11 modules. Exit 0 runnable · 1 `HALT` with a reason · 2 misuse |
| `ports.ts` + `adapters/*.ts` | `src/` | The `CommandRunner`, `Clock` and `FileSystem` ports, and the real adapters that back them: every process spawn, wait and disk access in production code goes through one, so a rule is observable against a double instead of a repository fixture |
| `core/*.ts` | `src/core/` | The pure business rules (scope, bounds, commands, ticked, cross-iteration, never) the gate evaluates, plus verdict and preflight: no process, no clock, no disk |
| `transcripts.ts` · `digest.ts` | `src/` | Resolve a run's transcripts and compress them to a tool-call digest. `transcripts.ts` runs on every failed implementer attempt |
| `plan-guard.ts` | `src/` | Hashes every `gateN=`/`dodN=` line, plus whether each iteration's `test_files` is empty, so a supervised repair can prove it disarmed nothing. Nothing under `src/` calls it; only `/goal:supervise`'s prose asks a model to. **Never run** |
| `goal-run-implementer` · `goal-run-lens` · `goal-run-auditor` | `agents/` | Spawned by the runner: one implementer per slice, then an advisory lens and an auditor at close |
| `goal-run-reviewer` · `goal-session-auditor` | `agents/` | Post-publication review and transcript audit. **Never fired** |
| [`grill-adversarial`](skills/grill-adversarial/SKILL.md) | `skills/` | Opt-in, loaded during `/goal:spec`'s grill |
| [`product:vertical-slice`](../product/skills/vertical-slice/SKILL.md) · [`product:delivery`](../product/skills/delivery/SKILL.md) | *(plugin `product`)* | Loaded by `/goal:plan` to split the work and give each slice a shipping strategy |
| `tests/run.sh` | `tests/` | 444 tests across 54 files. Wraps `node --test` and additionally refuses a zero-pass run, an undeclared skip, and a missing summary (a bare `node --test` exits 0 on a glob matching nothing) |
| `done-criteria.template` · `goal-handoff.template` · `post-merge.template` | `templates/` | The DoD baseline, the handoff `/goal:next` fills, and the merge-day checklist. Printed, never executed |

The **work-id** generalises the old issue number: `issue-<N>` for a GitHub issue, the lowercased
key (`ct-1234`) for Jira, a slug for a file or inline source. The plan lives at
`.claude/plans/<work-id>-spec.md`; a run's records go to
`.claude/goal-runs/<work-id>/<run-id>/`: `.run.log`, `.run.jsonl`, `.run.session` and the
auditor's `report.md`. Only `<plan>.run.lock` stays beside the plan.

## Troubleshooting

Every row is a refusal the code can still reach today.

| Symptom | Cause | Fix |
|---|---|---|
| Exit 2, "the base is not green" | a command the plan holds every slice to already fails on the untouched tree | Fix the base. The sweep runs before a byte is written, so nothing needs undoing |
| Exit 2, "the plan's directory is visible to git" | `.claude/plans/` is not git-ignored | Ignore that directory, untracking any spec already committed |
| Exit 2, "Policy is manual" | the runner has nowhere to put the work | That plan is for the manual loop: run it with `/goal` and `/goal:next`, or change the `Policy:` line |
| Exit 2, "the plan declares no Remote line" | never defaulted to `origin` | Write the remote on the plan. Guessing here pushes a fork's work to its parent |
| Exit 2, "the branch is behind &lt;base&gt;" | the base moved after the branch was cut | Rebase, then relaunch. A green sweep against a stale base certifies nothing anyone will merge into |
| Exit 2, "another run holds this plan" | a `<plan>.run.lock` survived a dead run | `node <plugin>/scripts/goal-gate.ts unlock <plan>` once you know the holder is gone |
| Exit 1, a slice was refused | the gate halted | The reason is in the run log and on the terminal. Reproduce it from the repo root: `node <plugin>/scripts/goal-gate.ts verify <plan> <n>` |
| Exit 3, "the quota still looks exhausted" | the usage window did not reopen within the retries | Relaunch when it has. Checkboxes are the whole state, so it resumes at the first unticked box |
| Exit 3, "the implementer wrote nothing in this tree" | the work went somewhere else | Look for it in another checkout before assuming it does not exist: this is what a wrong working directory looks like from here |
| The gate halts on files you considered in scope | the slice's declared paths do not match reality | The declared list is the contract. Fix it in the plan, or keep the change out of this slice |
| The run finishes but the review is not on the pull request | a safety hook refuses to post under your GitHub identity without explicit consent | Expected, and not a failure: the review text is in the run log; posting is opt-in via a `Review: comment` header |

## Cost

Everything runs on your **Claude Code subscription**: the runner spawns `claude -p`, so no API
surcharge, and the 5-hour rate-limit window applies normally. A quota-exhausted implementer is
slept through and retried against the same slice, bounded, then paused rather than spun. A burst
rate limit gets seconds of backoff instead.

## Long runs and the auto-updater

**Observed, 2026-08-05:** installing an update to Claude Code shuts down every running instance on
the machine, including a `claude -p` implementer mid-slice. A run left unattended for hours is
exactly the shape an update lands under. The runner absorbs this: exit 143 is classified as a
shutdown rather than quota exhaustion and retried after a fixed 5s backoff, up to 5 attempts; every
implementer is spawned with `DISABLE_AUTOUPDATER=1`; and preflight *warns*, never refuses, when
your own `~/.claude/settings.json` sets neither `env.DISABLE_AUTOUPDATER` nor
`"autoUpdatesChannel": "stable"`. Setting one of those stops the updater shutting down *other*
instances while a run is in flight. That file is yours; the plugin will not write to it.

## See also

- [`docs/walkthrough.md`](docs/walkthrough.md): every step, and the concrete reason for it
- [`docs/adr/0001-shape-of-the-autonomous-loop.md`](docs/adr/0001-shape-of-the-autonomous-loop.md): why a command over a runner over `claude -p`, and the three shapes built and deleted before it
- [`docs/comparison.md`](docs/comparison.md): the field, the table, and where this loses
- [`docs/autonomous-architecture.md`](docs/autonomous-architecture.md): which layer holds which guarantee
- [`docs/target-harness.md`](docs/target-harness.md): the properties an unattended loop must hold
- [`docs/why-not-parallel.md`](docs/why-not-parallel.md): parallel tracks were built, measured, removed
- [`docs/open-questions.md`](docs/open-questions.md): what is still undecided, and what would settle it
- [`../../docs/workflows-decision-guide.md`](../../docs/workflows-decision-guide.md): `goal` vs the lighter workflows
