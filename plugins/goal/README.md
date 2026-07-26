# goal — Source → Plan → Autonomous `/goal` execution

## What it does

Turns **any planning source** (a Jira US, a GitHub issue, a spec file, a note you
paste) into a **validated, iterated plan**, then delivers it as working code with
Claude Code's native `/goal` command — iteration by iteration, each stopping with a
readable synthesis and an auto-regenerated audit log.

The idea in one line: **don't drop `/goal "deliver CT-1234"` and walk away.** First
lift the ambiguities and build a Definition of Done a machine can check, *then* let
`/goal` execute against that contract, one small reviewable slice at a time.

## Why it's different — what it does well

Native `/goal` alone is brittle: drop `/goal "deliver X"` and walk away and it drifts. This plugin wraps it with the disciplines that make autonomous execution actually hold:

- **A Definition of Done with teeth.** Every business rule maps to a command-line check, and the native `/goal` evaluator judges each iteration on the **real exit code and output** — not "looks done". A runner that merely "runs the verifications" can't tell whether the change did what was asked.
- **A fresh session per iteration.** `/goal:next` + `/clear` + a size-capped handoff mean a long run never rots its own context — the most expensive failure mode of hands-off agents.
- **Plan ↔ code reconciliation.** Between slices, `/goal:next` re-reads the repo and fixes stale plan claims before the next iteration, instead of trusting the plan blindly.
- **You stay the controller.** Git, commits, and PRs are opt-in (default manual) — nothing is branched in the spec phase or shipped behind your back.
- **Small green slices, and they are real slices.** Decomposition runs on [`product:vertical-slice`](../product/skills/vertical-slice/SKILL.md) — the core complexity is named, the splitting technique follows from it, and the granularity is sized for the policy you chose (a diff you review yourself is not the same slice as one an unattended agent must gate on a command). Each iteration also carries a **delivery strategy** from [`product:delivery`](../product/skills/delivery/SKILL.md), so it can ship while the rest is unfinished — and so an autonomous run only ever adds, never removes what it might need to roll back to.
- **It hunts the *unknown unknowns*.** The opt-in adversarial grill doesn't just re-read your prose — it enumerates the interaction's finite **states**, extracts the **invariants** that must always hold, and builds the full **`(state × action)` transition matrix** as a hostile user. Every unmodelled cell becomes an owned, tested rule. That's the class of edge case a one-pass Socratic or text-scan review structurally can't surface — and where this goes further than the competition.

## When to use it

Reach for `goal` when you want a **feature or issue delivered rigorously** — especially when the source is fuzzy, or the work is big enough to span several sessions and you want every slice reviewed and auditable.

Not the right tool when:
- you'll build it in **one sitting** without branch/handoff machinery → [`/spec-first-dev`](../common/commands/spec-first-dev.md)
- the task is a **non-feature** plan (a migration, a large refactor) you'll drive yourself → [`crispi-planning`](../common/skills/crispi-planning/SKILL.md) or native plan mode

Full map: [`docs/workflows-decision-guide.md`](../../docs/workflows-decision-guide.md).

## Quick start

```bash
cd ~/projects/<repo>
claude

# Step 0 (optional) — normalize a source
> /goal:draft-issue CT-1234                    # Jira, read via MCP
> /goal:draft-issue .claude/plans/x-spec.md    # a spec file
> /goal:draft-issue inline                     # paste a note

# Session 1 — build the plan
> /goal:run-issue CT-1234                       # or an issue number, a spec path, or 'inline'

# Session 2 — execute one iteration, then checkpoint
> <paste the /goal handoff>
> /goal:next                                    # verify + emit the next handoff
> /clear                                   # then paste the next handoff in a fresh session
```

**Learn more:** which workflow fits your task → [decision guide](../../docs/workflows-decision-guide.md) · the *unknown-unknowns* engine → [`grill-adversarial`](skills/grill-adversarial/SKILL.md) · how it's audited against competing frameworks → [`self-audit`](../self-audit/README.md).

## How it works

`goal` is a pipeline of four commands across two-plus sessions. Only `/goal` (native) writes code; the three `/goal:*` commands plan, checkpoint, and hand off. An optional **draft-issue** shapes the source, **run-issue** locks a plan, then **`/goal`** and **`/goal:next`** alternate — one iteration per fresh session — until the spec is done.

| Step | Command | When | What it does |
|---|---|---|---|
| 0 · optional | `/goal:draft-issue <source>` | before you start | Normalize any source (Jira / issue / file / note) into a clean spec; ask whether to mirror it as a GitHub issue and whether to run the adversarial grill. |
| 1 | `/goal:run-issue <source>` | Session 1 · interactive | Grill to close gaps + build a command-checkable **DoD** → decompose into small functional iterations → lock the plan on `feature/<id>` → echo the first `/goal` handoff. |
| 2 | `/goal` *(native)* | Session 2 · per iteration | Implement the next unchecked iteration test-first, verify each rule by **running its command**, then stop with a synthesis. |
| ↻ | `/goal:next` | between iterations | Verify the finished iteration's DoD, reconcile plan ↔ code, emit the next handoff. You `/clear` and paste it into a fresh session. |
| ⚡ *alternative to 2 + ↻* | `/goal:auto` | once, then unattended | Runs **every** remaining iteration in one turn and ends with a pushed branch and an open PR. One subagent per iteration (isolated context, so the orchestrator's context stays flat), and after each one a **verification script** replays the acceptance commands: the loop advances only on its exit code, never on what the subagent claims. Halts hard on the first failure without attempting the ones after it. Needs `commit` or `commit+pr`; refuses under `manual`. No new hook. **Parallel tracks:** when the plan declares independent tracks with disjoint file sets, each runs in its own git worktree and ends in its **own PR**, and one track halting never stops the others. |

Everything runs on your **Claude Code subscription** (no API surcharge); **GitHub is optional at every step** — you're asked whether you want an issue, and whether Claude should commit or open the PR.

### Two typical modes

| | **Pro** (e.g. Jira, no GitHub) | **Perso** (GitHub) |
|---|---|---|
| Source | Jira key via MCP, or paste | GitHub issue, or spec file |
| Issue creation | skipped | opt-in via `/goal:draft-issue` |
| Commit/PR policy | **manual** — you review + commit each iteration | **commit** or **commit+pr** for hands-off |
| Cadence | stop + synthesis after each iteration | same, or iterations back-to-back |

Each command owns a distinct moment in the lifecycle — here is the detail behind the table above:

### Step 0 — `/goal:draft-issue <source>` (optional)

Normalizes whatever you have into a clean spec so `/goal:run-issue` starts from a
consistent shape.

1. Reads the source (Jira via MCP / `gh` / file / inline paste).
2. Writes `.claude/plans/<work-id>-spec.md` and flags the gaps `/goal:run-issue` will grill.
3. **Asks** (`AskUserQuestion`) whether to run the **adversarial grill** in
   `/goal:run-issue`, and records the answer verbatim on the spec's `## Adversarial grill`
   line. Recommend **yes** for front / interactive work or when gaps were flagged.
4. **Asks** whether to mirror the spec as a GitHub issue (default no; `gh`
   only touched if you say yes).

It never writes production code, creates branches, or builds the DoD — that's
`/goal:run-issue`'s job.

### Session 1 — `/goal:run-issue <source>` (interactive, ~5–15 min)

Turns the source into a locked, executable plan.

1. **Resolves and reads** the source, summarizes it back, asks you to confirm.
2. **Grills you one question at a time**: closes functional gaps, surfaces
   technical consequences, and maps **each business rule to a command-line check** so
   the Definition of Done has teeth.
3. **Adversarial grill (opt-in)**: if the spec's `## Adversarial grill` line
   says `requested` (or it's front / interactive and gaps were flagged), loads the
   `goal:grill-adversarial` skill. It enumerates the interaction state space, extracts
   invariants, builds the `(state × action)` transition matrix, and turns every
   unmodelled hole into an owned + tested rule — the failures a Socratic grill misses.
4. **Decomposes** the work into small functional iterations, each an
   independently reviewable slice with its own files + acceptance criteria.
5. **Asks the commit/PR policy**: `manual` (default) / `commit` / `commit+pr`.
6. **Locks**: creates `feature/<work-id>-<slug>` and writes the plan
   (never committed: `.claude/` is gitignored in most projects, and the plan reaches
   the reviewer through the PR body instead).
7. **Echoes** the per-iteration `/goal` text for you to paste.

### Session 2 — `/goal` (native), one iteration at a time

Paste the `/goal` text. It loads project convention + TDD skills, implements the
**next unchecked** iteration test-first, verifies the criteria by **running the
commands** (not asserting from memory), marks the iteration `[x]`, and **stops with a
structured synthesis**:

> **Fait** · **Pourquoi** · **Règles métier couvertes** · **À reviewer** ·
> **Commit suggéré** · **Reste**

Commit behavior follows the policy:

- **manual** — Claude commits nothing. You read the synthesis, review the diff, commit yourself.
- **commit** — Claude commits the iteration (conventional message, **no `Co-Authored-By` trailer**), no push/PR.
- **commit+pr** — plus push, and one PR per branch: opened as a **draft at the first commit**, its body updated by every iteration after it, marked ready at the last. A run that halts halfway still leaves something reviewable.

The execution log is refreshed at **every Stop** by the `issue-execution-log.sh` hook.

### Between iterations — `/goal:next`

The checkpoint that makes a fresh session safe. It verifies the finished iteration's
DoD, reconciles the plan with what actually changed in the codebase, makes the working
tree safe (clean, or fully staged — in manual mode it never stages, leaving the tree
for your review), and confirms the next iteration is doable cold. It then **re-emits
the next `/goal` handoff**.

It does **not** clear context or launch `/goal` — Claude Code can't self-chain — so
you `/clear` and paste the handoff into a fresh session. Repeat until the spec has no
unchecked iterations.

---

## Why split clarification from execution

Dropping `/goal "deliver CT-1234"` and walking away usually fails:

- **Ambiguity is unmovable from inside `/goal`.** The evaluator only sees what Claude
  surfaced; it can't ask "what do you mean by X?". A US's silence becomes a wrong
  assumption in turn 2 that wastes turns 3–30.
- **A US rarely ships a Definition of Done.** Without command-line criteria the
  evaluator has nothing objective to check. Session 1 builds that DoD.
- **A scope-creeping diff is hard to review and harder to revert.** Small functional
  iterations + the Karpathy trace test keep each diff reviewable.

This mirrors `/spec-first-dev`'s philosophy: **lift ambiguities → lock a plan →
deliver against it**, iteration by iteration.

---

## What the plugin ships

| Component | Path | Role |
|---|---|---|
| [`/goal:draft-issue`](commands/draft-issue.md) | `commands/draft-issue.md` | **Step 0** — any source → normalized spec; opt-in GitHub issue; asks whether to run the adversarial grill |
| [`/goal:run-issue`](commands/run-issue.md) | `commands/run-issue.md` | **Session 1** — source → grilled plan (DoD + functional iterations) + commit/PR policy + per-iteration `/goal` handoff |
| [`/goal:next`](commands/next.md) | `commands/next.md` | **Between iterations** — verify DoD, reconcile plan vs codebase, make the tree safe, re-emit the next `/goal` handoff (you `/clear` + paste) |
| [`/goal:auto`](commands/auto.md) | `commands/auto.md` | **Unattended alternative to Session 2** — preflight, then one subagent per iteration until the PR is open; halts on the first failure |
| [`grill-adversarial`](skills/grill-adversarial/SKILL.md) | `skills/grill-adversarial/SKILL.md` | Opt-in skill loaded during `/goal:run-issue`'s adversarial grill — enumerates states, invariants, and transitions before iterations freeze |
| [`product:vertical-slice`](../product/skills/vertical-slice/SKILL.md) | *(plugin `product`)* | Loaded by `/goal:run-issue` Phase 3 — the procedure that turns a spec into thin vertical iterations sized and ordered for the chosen policy (manual review vs `/goal:auto`) |
| [`product:delivery`](../product/skills/delivery/SKILL.md) | *(plugin `product`)* | Loaded by `/goal:run-issue` Phase 3 and by every execution session — gives each iteration a way to reach production while the rest is unfinished (flag, additive, expand/contract), plus the gated cleanup iteration |
| `goal-auto-gate.sh` | `scripts/goal-auto-gate.sh` | The gate `/goal:auto` calls after each iteration. Replays that iteration's acceptance commands and checks scope leak / parasitic artifacts / spec tampering, then exits 0 or 1. **Verifies only, mutates nothing**: no tick, no commit, no push. Not a hook. |
| `issue-execution-log.sh` Stop hook | `hooks/issue-execution-log.sh` | Regenerates the execution log at every Stop, only when **all three** hold: (1) branch `feature/<work-id>-…` for an existing spec, (2) `.claude/plans/<work-id>-spec.md` exists, (3) the transcript contains a `/goal` command. Silent no-op otherwise. |
| `test_goal-auto-gate.sh` | `tests/test_goal-auto-gate.sh` | 21 assertions over the gate: the green path (and that it mutates nothing), the five halts, the checks that cannot run, an untrustworthy state file, the DoD, misuse. Run it with `bash plugins/goal/tests/test_goal-auto-gate.sh` |
| `extract-execution-log.py` | `scripts/extract-execution-log.py` | Parses the session JSONL into a readable markdown summary keyed by `<work-id>` |
| `done-criteria.template` | `templates/done-criteria.template` | Reusable baseline for the acceptance-criteria / DoD section of any plan |

The **work-id** generalizes the old issue number: `issue-<N>` for a GitHub issue, the
lowercased key (`ct-1234`) for Jira, a slug for a file/inline source.

Two artifacts live in `.claude/plans/`:

- `<work-id>-spec.md` — the contract (business rules, DoD, iterations)
- `<work-id>-execution-log.md` — auto-regenerated audit of what Claude did

### Regenerate the log manually (mid-session snapshot)

```bash
python3 ~/projects/github/claude-marketplace/plugins/goal/scripts/extract-execution-log.py <work-id>
```

Auto-detects `<work-id>` from the `feature/<work-id>-…` branch when omitted, and finds the most recent JSONL referencing the spec.

---

## Prerequisites

### Hard requirement

| Item | Check | Fix |
|---|---|---|
| Claude Code ≥ 2.1.139 (for `/goal`) | `claude --version` | Update Claude Code |
| `goal` plugin enabled | `/plugin` list, or check settings | `/plugin install goal@…` then restart |
| Workspace trusted | `/trust` inside `claude` | once per workspace |

### Conditional (only for the path you use)

| Item | Needed when | Fix |
|---|---|---|
| Atlassian MCP connected | source is a **Jira** key | connect the Atlassian MCP in this session |
| `gh` CLI authenticated | source is a **GitHub issue**, or you opt into an issue / `commit+pr` | `gh auth login` |
| `tmux` | you want a hands-off Session 2 (perso) | `brew install tmux` |

### Optional enhancers (graceful fallback)

| Plugin | Adds | If missing |
|---|---|---|
| `pocock` | `grill-me` / `grill-with-docs` for the grilling step, composed by the adversarial grill | inlined baseline questions |
| `superpowers` | `verification-before-completion`, `systematic-debugging` in Session 2 | Claude's native discipline |
| `craft` / language TDD | `tdd-workflow-principles`, `php-tdd-workflow`, `vitest-tdd-workflow`… | trace test still in the template |
| `common` | `/spec-first-dev` upstream | `/goal:draft-issue` accepts any source |

The plugin is **self-contained**: the optional plugins enhance the workflow, but the
commands fall back to inlined behavior when they're absent.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/goal:run-issue` / `/goal:draft-issue` not recognized | Plugin not enabled or Claude not restarted | enable + restart `claude` |
| Jira source won't read | Atlassian MCP not connected in this session | connect it, or paste with `inline` |
| `gh` errors on the GitHub path | token missing/expired | `gh auth refresh -h github.com -s repo,read:org` |
| `/goal:run-issue` says "branch is dirty" | uncommitted changes | `git stash` or commit, then re-run |
| `/goal` not recognized | workspace not trusted | `/trust` |
| Execution log not regenerating | one of the 3 hook preconditions failed | verify (1) `git branch --show-current`, (2) `ls .claude/plans/`, (3) that you actually launched `/goal`. Or regenerate manually. |
| Claude committed with a `Co-Authored-By` trailer | policy `commit`/`commit+pr` and the trailer slipped in | the handoff forbids it; amend to strip it |
| `/goal:auto` refuses to start | policy is `manual`, tree dirty, wrong branch, or a PR already open | read the refusal: each one names the failing check. Fix it and re-run |
| `/goal:auto` halted mid-run | an acceptance command failed, or a scope leak / parasitic artifact / spec rewrite was detected | the halt is printed verbatim: reason, command, exit code, real output, then the iterations that were not attempted. Re-run the gate yourself to reproduce, from the repository root: `~/.claude/plugins/…/goal/scripts/goal-auto-gate.sh .claude/plans/<work-id>-auto-state` (the gate reads the tree it stands in) |
| `/goal:auto` stopped mid-run without halting | the turn ended (rate limit, closed session, interruption) | resume from the last clean boundary with `/goal:auto --continue`, or redo the interrupted slice with `/goal:auto --resume-at <n>` |
| The gate halts on files you did consider in scope | the iteration's *Files to touch* list does not match reality | the declared list is the contract. Fix the list in the spec, or keep the change out of this iteration |

---

## Cost expectations

Everything runs on your **Claude Code subscription** (no API surcharge) when you use
**interactive `claude`**. The `/goal` evaluator runs on your small fast model and is
included. The 5-hour rate-limit window applies normally.

---

## See also

- [`/goal` official docs](https://code.claude.com/docs/en/goal)
- [`common:spec-first-dev`](../common/commands/spec-first-dev.md) — the gated,
  spec-first inspiration; chain into `/goal:draft-issue` after its Phase 3
- [`craft:tdd-workflow-principles`](../craft/skills/tdd-workflow-principles/SKILL.md)
  — cross-language TDD used during Session 2
- [`docs/workflows-decision-guide.md`](../../docs/workflows-decision-guide.md) — when to
  reach for `goal` vs `/spec-first-dev` vs `crispi-planning`
