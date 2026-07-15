# goal — Source → Plan → Autonomous `/goal` execution

## What it does

Turns **any planning source** (a Jira US, a GitHub issue, a spec file, a note you
paste) into a **validated, iterated plan**, then delivers it as working code with
Claude Code's native `/goal` command — iteration by iteration, each stopping with a
readable synthesis and an auto-regenerated audit log.

The idea in one line: **don't drop `/goal "deliver CT-1234"` and walk away.** First
lift the ambiguities and build a Definition of Done a machine can check, *then* let
`/goal` execute against that contract, one small reviewable slice at a time.

## How it works

Four commands, run in order across two-plus sessions:

```
(idea / Jira US / PRD / BMAD story / spec file / brainstorm)
  │
  ├─ /goal:draft-issue <source>     ◀ optional · Step 0
  │     normalize the source into a clean spec
  │     ASK: mirror it as a GitHub issue?   (default no)
  │     ASK: run the adversarial grill in /goal:run-issue?   (opt-in)
  │
  ├─ /goal:run-issue <source>       ◀ Session 1 · interactive
  │     read the source · grill to close gaps + build the DoD
  │     (opt-in) adversarial grill: enumerate states & invariants
  │     decompose into small FUNCTIONAL ITERATIONS
  │     ASK: commit/PR policy — manual | commit | commit+pr
  │     lock a plan on feature/<work-id>-<slug>, echo the /goal handoff
  │
  ├─ /goal (native)            ◀ Session 2 · one run per iteration
  │     implement the NEXT unchecked iteration test-first
  │     verify every business rule with a command, then STOP + synthesis
  │     execution log refreshed at every Stop
  │
  └─ /goal:next                     ◀ between iterations
        verify the finished iteration's DoD · reconcile plan vs codebase
        make the tree safe · re-emit the next /goal handoff
        you review → /clear → paste it into a fresh session
```

Everything runs on your **Claude Code subscription** (no API surcharge) in
interactive `claude`. **GitHub is optional at every step** — you're asked whether you
want an issue, and whether Claude should commit or open the PR.

### Two typical modes

| | **Pro** (e.g. Jira, no GitHub) | **Perso** (GitHub) |
|---|---|---|
| Source | Jira key via MCP, or paste | GitHub issue, or spec file |
| Issue creation | skipped | opt-in via `/goal:draft-issue` |
| Commit/PR policy | **manual** — you review + commit each iteration | **commit** or **commit+pr** for hands-off |
| Cadence | stop + synthesis after each iteration | same, or iterations back-to-back |

---

## What happens, and when

The exhaustive walk-through. Each command owns a distinct moment in the lifecycle.

### Step 0 — `/goal:draft-issue <source>` (optional)

Normalizes whatever you have into a clean spec so `/goal:run-issue` starts from a
consistent shape.

1. Reads the source (Jira via MCP / `gh` / file / inline paste).
2. Writes `.claude/plans/<work-id>-spec.md` and flags the gaps `/goal:run-issue` will grill.
3. **Phase 3b — asks** (`AskUserQuestion`) whether to run the **adversarial grill** in
   `/goal:run-issue`, and records the answer verbatim on the spec's `## Adversarial grill`
   line. Recommend **yes** for front / interactive work or when gaps were flagged.
4. **Phase 4 — asks** whether to mirror the spec as a GitHub issue (default no; `gh`
   only touched if you say yes).

It never writes production code, creates branches, or builds the DoD — that's
`/goal:run-issue`'s job.

### Session 1 — `/goal:run-issue <source>` (interactive, ~5–15 min)

Turns the source into a locked, executable plan.

1. **Phase 0–1** — resolves and reads the source, summarizes it back, asks you to confirm.
2. **Phase 2 — grills you one question at a time**: closes functional gaps, surfaces
   technical consequences, and maps **each business rule to a command-line check** so
   the Definition of Done has teeth.
3. **Phase 2b — adversarial grill (opt-in)**: if the spec's `## Adversarial grill` line
   says `requested` (or it's front / interactive and Phase 2 flagged gaps), loads the
   `goal:grill-adversarial` skill. It enumerates the interaction state space, extracts
   invariants, builds the `(state × action)` transition matrix, and turns every
   unmodelled hole into an owned + tested rule — the failures a Socratic grill misses.
4. **Phase 3 — decomposes** the work into small functional iterations, each an
   independently reviewable slice with its own files + acceptance criteria.
5. **Phase 4 — asks the commit/PR policy**: `manual` (default) / `commit` / `commit+pr`.
6. **Phase 5 — locks**: creates `feature/<work-id>-<slug>` and writes the plan
   (committing it only if the policy isn't `manual`).
7. **Phase 6 — echoes** the per-iteration `/goal` text for you to paste.

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
- **commit+pr** — plus, after the last iteration, push + `gh pr create`.

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
| [`grill-adversarial`](skills/grill-adversarial/SKILL.md) | `skills/grill-adversarial/SKILL.md` | Opt-in skill loaded in `/goal:run-issue` Phase 2b — enumerates states, invariants, and transitions before iterations freeze |
| `issue-execution-log.sh` Stop hook | `hooks/issue-execution-log.sh` | Regenerates the execution log at every Stop, only when **all three** hold: (1) branch `feature/<work-id>-…` for an existing spec, (2) `.claude/plans/<work-id>-spec.md` exists, (3) the transcript contains a `/goal` command. Silent no-op otherwise. |
| `extract-execution-log.py` | `scripts/extract-execution-log.py` | Parses the session JSONL into a readable markdown summary keyed by `<work-id>` |
| `done-criteria.template` | `templates/done-criteria.template` | Reusable baseline for the acceptance-criteria / DoD section of any plan |

The **work-id** generalizes the old issue number: `issue-<N>` for a GitHub issue, the
lowercased key (`ct-1234`) for Jira, a slug for a file/inline source.

Two artifacts live in `.claude/plans/`:

- `<work-id>-spec.md` — the contract (business rules, DoD, iterations)
- `<work-id>-execution-log.md` — auto-regenerated audit of what Claude did

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
| `pocock` | `grill-me` / `grill-with-docs` for Phase 2, composed by the adversarial grill | inlined baseline questions |
| `superpowers` | `verification-before-completion`, `systematic-debugging` in Session 2 | Claude's native discipline |
| `craft` / language TDD | `tdd-workflow-principles`, `php-tdd-workflow`, `vitest-tdd-workflow`… | trace test still in the template |
| `common` | `/spec-first-dev` upstream | `/goal:draft-issue` accepts any source |

The plugin is **self-contained**: the optional plugins enhance the workflow, but the
commands fall back to inlined behavior when they're absent.

---

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

### Manual log regeneration (snapshot mid-session)

```bash
python3 ~/projects/github/claude-marketplace/plugins/goal/scripts/extract-execution-log.py <work-id>
```

Auto-detects `<work-id>` from the `feature/<work-id>-…` branch when omitted, and finds
the most recent JSONL referencing the spec.

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
