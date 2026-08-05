# goal — Source → plan → gate-verified execution

## What it does

Turns any planning source (a Jira US, a GitHub issue, a spec file, a note you paste) into a
**locked plan**, then delivers it iteration by iteration under a judge that is a program and not
a prompt: `scripts/goal-gate.ts` decides whether a slice passed, and it is the only thing in the
system that commits.

The idea in one line: **don't hand a goal to an agent and walk away.** Lift the ambiguities and
build a Definition of Done a machine can check, *then* let a runner execute against that
contract, one reviewable slice at a time.

## The path that runs today

| Step | You run | What happens |
|---|---|---|
| 0 · chantier only | `/goal:tickets <chantier>` | Cuts an initiative carrying several outcomes into an ordered backlog of tickets, elaborated just-in-time — ticket 1 armed, the rest deliberately one-liners |
| 1 · optional | `/goal:spec <source>` | The functional contract: normalizes any source into `.claude/plans/<work-id>-spec.md`, grills the functional gaps closed, builds the functional DoD (an observable criterion per business rule), offers to mirror it as a GitHub issue |
| 2 | `/goal:plan <source>` | The executable contract: the technical grill, every business rule mapped to a command, decomposition into iterations, the commit policy and the remote, the locked plan on `feature/<work-id>-<slug>` — runs `/goal:spec` itself when a raw source still has functional holes |
| 3 | `node scripts/goal-run.ts <plan>` | The runner: ten preflight refusals, a base sweep, one `claude -p` implementer per iteration, a gate verdict on each, publication, close |
| 3 · watched | `/goal:supervise [plan]` | Launches the same runner in the background, classifies a halt (plan at fault / implementation at fault / unknown), repairs or discards **once**, then stops |
| — | `scripts/goal-gate.ts` | Judges each iteration and commits it. Nothing else in the system commits |
| 3 · manual | `/goal` (native) + `/goal:next` | The alternative under `Policy: manual` — the runner refuses that policy outright, since nothing may be committed |

**Steps 1–2 are deliberately not automated.** The ambiguity a source leaves cannot be lifted
from inside a run: an unattended implementer resolves it by guessing, and the guess surfaces
thirty turns later as work to throw away. The grill — functional in `/goal:spec`, technical in
`/goal:plan` — is the one place a human is load-bearing.

## Quick start

```bash
cd ~/projects/<repo>

claude
> /goal:spec CT-1234               # optional — the functional contract; Jira via MCP, a spec path, or 'inline'
> /goal:plan CT-1234               # the technical grill, then the locked plan on a feature branch
```

Then, from the branch the plan locked, either let a session watch the run:

```
> /goal:supervise .claude/plans/<work-id>-spec.md
```

or launch the runner yourself:

```bash
node <plugin>/scripts/goal-run.ts .claude/plans/<work-id>-spec.md
```

`/goal:supervise` resolves the plugin path through `${CLAUDE_PLUGIN_ROOT}`; a bare shell needs
the marketplace checkout's real path. Exit `0` landed · `1` the gate refused an iteration · `2`
refused before anything was attempted · `3` paused at a clean boundary, relaunch resumes there.

The run writes its records under `.claude/goal-runs/<work-id>/<run-id>/`: `.run.log` (the same
lines it prints), `.run.jsonl` (the same events, one versioned JSON line each), `.run.session`
(the implementer session ids, so a transcript can be found later) and the auditor's own
`report.md`. Only `<plan>.run.lock`, held while a run has the plan, stays beside the plan itself
in `.claude/plans/`.

## Why it is built this way

- **The judge is a program, not a prompt** (`scripts/goal-gate.ts` + `scripts/gate/*.ts`). A
  slice lands on an exit code, never on what an agent says about its own work. Scope, diff
  budget, removals, acceptance commands, determinism, the regression wall over earlier slices,
  and the bite check are each their own module, each with its own test file.
- **The implementer is not trusted with git.** It writes only inside the paths its gate block
  declares, and a `permissions.deny` rule takes `git commit`, `git push` and `git add` away from
  it. A brief is a sentence; the deny rule is the mechanism.
- **The plan is the whole state.** Checkboxes are the only progress marker, so a run that halts
  or pauses resumes at the first unticked box with no memory of the one before it. The plan is
  hashed, so a run cannot quietly rewrite the contract it is judged by.
- **One fresh session per iteration.** Each iteration is handed to its own `claude -p`
  implementer with the plan section as text — never the plan's path, which is how a real run
  once read the plan in another checkout and wrote the whole iteration into the wrong tree.
- **Small green slices, and they are real slices.** Decomposition runs on
  [`product:vertical-slice`](../product/skills/vertical-slice/SKILL.md); each iteration also
  carries a delivery strategy from [`product:delivery`](../product/skills/delivery/SKILL.md), so
  it can ship while the rest is unfinished.
- **The opt-in adversarial grill hunts unknown unknowns.**
  [`grill-adversarial`](skills/grill-adversarial/SKILL.md) enumerates the interaction's states,
  extracts the invariants, and builds the `(state × action)` matrix before iterations freeze.

## What the barriers actually hold

Each of these is a real mechanism with a real edge. Stated here so nobody plans against a
guarantee that is narrower than its slogan.

- **No commit the gate did not verify** — holds per slice. It is not the last barrier before
  publication: `goal-run.ts` publishes after every landed iteration and the global Definition of
  Done replays only at close (`run/close.ts`), so a DoD refusal arrives with the work already
  pushed.
- **The implementer is mechanically denied git** — the preflight reads for the deny rule as a
  substring of the raw settings JSON (`run/preflight.ts`), which an `allow` entry naming the same
  verb also satisfies. It binds a session started after it, not one already running.
- **A test that passes without the implementation halts the slice** (`gate/bite.ts`) — unless the
  iteration declares no `test_files`, which skips the check. `plan-guard.ts` hashes `gateN=` and
  `dodN=` lines, plus — per iteration — whether `test_files` is empty, so a repair emptying it
  moves the hash even though repairing a mistyped path in it does not.
- **The plan is hashed** (`gate/plan.ts`) — the hash normalizes ticks away.
- **Every claim is a command that ran** — except the gate's own refusal: `run/iteration.ts` exits
  on a refusal without copying the gate's `HALT` block into the run log. The log names the halt;
  the reason is only on the terminal.

## One generation left in this tree

`scripts/goal-run.ts` + `scripts/run/*.ts` (938 lines over 8 modules) is what `/goal:supervise`
launches and what the barriers above describe.

Five shipped artifacts have never been exercised by a real run: `commands/supervise.md` (whose
own frontmatter concedes the classifier is unproven, two halts being its whole evidence),
`scripts/plan-guard.ts`, `scripts/transcripts.ts`, `agents/goal-run-reviewer.md` (wired in
`run/close.ts`, never fired) and `agents/goal-session-auditor.md`. Treat them as proposals with
code attached.

`tests/run.sh` runs the suite once per runner in its list, refusing a nonzero `skipped` line
exactly as it refuses a failure. **CI exercises it on every invocation of
`bash plugins/goal/tests/run.sh`**.

## What the plugin ships

| Component | Path | Role |
|---|---|---|
| [`/goal:tickets`](commands/tickets.md) | `commands/tickets.md` | A chantier → an ordered backlog of outcome-sized tickets, elaborated just-in-time; opt-in GitHub milestone + issues |
| [`/goal:spec`](commands/spec.md) | `commands/spec.md` | Any source → the functional contract: functional grill, an observable criterion per business rule, opt-in adversarial grill and GitHub issue |
| [`/goal:plan`](commands/plan.md) | `commands/plan.md` | The technical grill → command-mapped DoD + iterations + policy + remote → the locked plan on a feature branch |
| [`/goal:supervise`](commands/supervise.md) | `commands/supervise.md` | Launches the runner, classifies a halt, repairs or discards once. **Never run** |
| [`/goal:next`](commands/next.md) | `commands/next.md` | Manual-loop checkpoint: verify the DoD, reconcile plan against code, emit the next `/goal` handoff |
| `goal-run.ts` + `run/*.ts` | `scripts/` | The runner: preflight, sweep, lock, iteration, publish, close, report |
| `goal-gate.ts` + `gate/*.ts` | `scripts/` | The judge, and the only committer. Exit 0 runnable · 1 `HALT` with a reason · 2 misuse. TypeScript run natively by node — no build, no dependency |
| `goal-deny-setup.sh` | `scripts/` | Unions the three deny rules into the tree's `.claude/settings.local.json`. Additive and idempotent; needs `jq`. Not a precondition of the runner, which never checks for it |
| `plan-guard.ts` | `scripts/` | Hashes every `gateN=`/`dodN=` line so a repair can prove it moved none. Used only by `/goal:supervise`. **Never run** |
| `transcripts.ts` | `scripts/` | Resolves a run's transcripts from its recorded session ids. Used only by `goal-session-auditor`. **Never run** |
| `goal-run-implementer`, `goal-run-lens`, `goal-run-auditor` | `agents/` | Spawned by the runner: one implementer per iteration, then an advisory lens and an auditor at close — neither able to undo what shipped |
| `goal-run-reviewer`, `goal-session-auditor` | `agents/` | Post-publication review and transcript audit. **Never run** |
| [`grill-adversarial`](skills/grill-adversarial/SKILL.md) | `skills/` | Opt-in, loaded during `/goal:spec`'s grill |
| [`product:vertical-slice`](../product/skills/vertical-slice/SKILL.md) · [`product:delivery`](../product/skills/delivery/SKILL.md) | *(plugin `product`)* | Loaded by `/goal:plan` Phase 3 (split + per-slice delivery), by `/goal:tickets` (cut + order), and `vertical-slice` alone by `/goal:spec` on a disputed size verdict |
| `tests/run.sh` | `tests/` | The suite for the gate, both runners, and the guards. Wraps `node --test` once per runner in its list, and additionally requires at least one pass, no failure and no skip — `node --test` alone exits 0 on a glob matching nothing, and a skip is an unknown result refused exactly as a failure |
| `done-criteria.template` · `goal-handoff.template` · `post-merge.template` | `templates/` | The DoD baseline, the `/goal` handoff `/goal:next` fills, and what a merged run leaves behind — printed, never executed |

The **work-id** generalizes the old issue number: `issue-<N>` for a GitHub issue, the lowercased
key (`ct-1234`) for Jira, a slug for a file or inline source. Two artifacts live in
`.claude/plans/`: `<work-id>-spec.md`, the contract, and `<work-id>-execution-log.md`, the
regenerated audit.

## Prerequisites

| Item | Needed for | Note |
|---|---|---|
| Node 24 | the runner and the gate | Types are stripped at run time, never checked; `tsc --noEmit` is a CI concern |
| `jq` | `goal-deny-setup.sh` | |
| A git-ignored `.claude/` | every run | Preflight refuses a plan directory git can see: the spec, the ticked box and the run log would read as an undeclared scope leak |
| `gh` authenticated | `Policy: commit+pr`, or a GitHub source | `gh auth login` |
| Atlassian MCP | a Jira source | Or paste with `inline` |

Optional plugins enhance and never gate: `pocock` (`grill-me` / `grill-with-docs`, composed by
the adversarial grill), `superpowers` (`verification-before-completion`,
`systematic-debugging`), `craft` and the language TDD packs. The commands fall back to inlined
behavior when they are absent.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Exit 2, "the plan's directory is visible to git" | `.claude/` is tracked | Ignore it, untracking any spec already committed |
| Exit 2, "Policy is manual" | the runner has nowhere to put the work | Change the `Policy:` line, or run the manual loop with `/goal` and `/goal:next` |
| Exit 2, "the plan declares no Remote line" | never defaulted to `origin` | Write the remote on the plan. Guessing here pushes a fork's work to its parent |
| Exit 2, "another run holds this plan" | a `<plan>.run.lock` survived a dead run | `node <plugin>/scripts/goal-gate.ts unlock <plan>` once you know the holder is gone |
| Exit 2, "the base is not green" | a command the plan will hold every iteration to already fails | Fix the base. The sweep runs before a byte is written, so nothing needs undoing |
| Exit 1, an iteration was refused | the gate halted | The log names the iteration but not the reason. Reproduce it from the repo root: `node <plugin>/scripts/goal-gate.ts verify <plan> <n>` |
| Exit 3, paused | quota exhausted, or the implementer wrote nothing | Relaunch: the checkboxes are the whole state, so it resumes at the first unticked box |
| The gate halts on files you considered in scope | the iteration's declared paths do not match reality | The declared list is the contract. Fix it in the spec, or keep the change out of this iteration |

## Cost

Everything runs on your **Claude Code subscription** — the runner spawns `claude -p`, so no API
surcharge, and the 5-hour rate-limit window applies normally. A quota-exhausted implementer is
slept through and retried against the same iteration, bounded, then paused rather than spun.

Every run has its auditor write a report to `.claude/goal-runs/<work-id>/<run-id>/report.md`:
elapsed seconds per iteration, what halted it, and which failures recur across earlier reports.
At close, that report is folded into the pull request body under `## Run report`, replaced whole
on every rerun of the same PR.

## See also

- [`docs/workflows-decision-guide.md`](../../docs/workflows-decision-guide.md) — `goal` vs
  [`/spec-first-dev`](../common/commands/spec-first-dev.md) vs
  [`crispi-planning`](../common/skills/crispi-planning/SKILL.md)
- [`docs/autonomous-architecture.md`](docs/autonomous-architecture.md) — which layer holds which
  guarantee, and why
- [`docs/target-harness.md`](docs/target-harness.md) — the properties an unattended loop must hold
- [`docs/why-not-parallel.md`](docs/why-not-parallel.md) — parallel tracks were built, measured
  and removed
- [`docs/open-questions.md`](docs/open-questions.md) — what is still undecided, with what would
  have to be measured
