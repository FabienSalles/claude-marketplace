# goal — Source → Plan → Autonomous `/goal` execution

End-to-end recipe to go from **any planning source → a validated, iterated plan
→ working code** with Claude Code's native `/goal` command, on your **Claude Code
subscription** (no API surcharge), with an automatically-regenerated execution
log so you can audit what Claude actually did.

The source is **whatever you have**: a Jira US (read live via the Atlassian MCP),
a GitHub issue, a spec file, or a note you paste inline. **GitHub is optional at
every step** — you're asked whether you want an issue, and whether Claude should
commit or open the PR. Nothing is imposed.

The plugin is **self-contained**. The only hard requirement is Claude Code
≥ 2.1.139 (for `/goal`). `gh` is needed only for the GitHub paths; the Atlassian
MCP only for a Jira source. Other plugins (`common`, `pocock`, `superpowers`,
`craft`, language conventions) enhance the workflow but the commands fall back to
inlined behavior when they're absent.

---

## At a glance — the chain

```
(idea / Jira US / PRD / BMAD story / spec file / brainstorm)
  │
  └─ Step 0 — /draft-issue <source>            ◀ optional
       │  Normalize the source into a clean spec.
       │  ASK: want a GitHub issue mirror? (default no)
       │
       ▼
  └─ Session 1 — /run-issue <source>
       │  Read the source (Jira MCP / gh / file / inline).
       │  Grill: close functional gaps, surface technical consequences,
       │  and BUILD the missing Definition of Done.
       │  Decompose into small FUNCTIONAL ITERATIONS (the review checkpoints).
       │  ASK: commit/PR policy — manual | commit | commit+pr.
       │  Lock a plan on feature/<work-id>-<slug>, echo the per-iteration /goal.
       │
       ▼
  └─ Session 2 — /goal (native), one run per iteration
       │  Loads project convention + TDD skills, implements the NEXT unchecked
       │  iteration test-first, verifies every business rule with a command,
       │  then STOPS with an explanatory SYNTHESIS.
       │  Commit/push/PR only as far as the chosen policy allows.
       │  Execution log refreshed at every Stop → .claude/plans/<work-id>-execution-log.md
       │
       ▼
  └─ Between iterations — you review the synthesis + diff, commit
        (yourself in manual mode), then re-paste the same /goal for the next.
```

Two typical modes:

| | **Pro** (e.g. Jira, no GitHub) | **Perso** (GitHub) |
|---|---|---|
| Source | Jira key via MCP, or paste | GitHub issue, or spec file |
| Issue creation | skipped | opt-in via `/draft-issue` |
| Commit/PR policy | **manual** — you review + commit each iteration | **commit** or **commit+pr** if you want it hands-off |
| Cadence | stop + synthesis after each iteration | same, or run iterations back-to-back |

## Why split clarification from execution

The temptation: drop `/goal "deliver CT-1234"` and walk away. It usually fails:

- **Ambiguity is unmovable from inside `/goal`.** The evaluator only sees what
  Claude surfaced; it can't ask "what do you mean by X?". A Jira US's silence
  becomes a wrong assumption in turn 2 that wastes turns 3–30.
- **A US rarely ships a Definition of Done.** Without command-line criteria the
  evaluator has nothing objective to check. Session 1 builds that DoD.
- **A scope-creeping diff is hard to review and harder to revert.** Small
  functional iterations + the Karpathy trace test keep each diff reviewable.

Splitting mirrors `/spec-first-dev`'s philosophy: **lift ambiguities → lock a
plan → deliver against it**, iteration by iteration.

---

## What the plugin ships

| Component | Path | Role |
|---|---|---|
| [`/draft-issue`](commands/draft-issue.md) | `commands/draft-issue.md` | **Step 0** — any source → normalized spec, with an **opt-in** GitHub issue |
| [`/run-issue`](commands/run-issue.md) | `commands/run-issue.md` | **Session 1** — source → grilled plan (DoD + functional iterations) + commit/PR policy + per-iteration `/goal` handoff |
| `issue-execution-log.sh` Stop hook | `hooks/issue-execution-log.sh` | Regenerates the execution log at every Stop, only when **all three** hold: (1) branch matches `feature/<work-id>-…` for a spec that exists, (2) `.claude/plans/<work-id>-spec.md` exists, (3) the session's transcript contains a `/goal` command. Silent no-op otherwise. |
| `extract-execution-log.py` | `scripts/extract-execution-log.py` | Parses the session JSONL into a readable markdown summary keyed by `<work-id>` |
| `done-criteria.template` | `templates/done-criteria.template` | Reusable baseline for the acceptance-criteria / DoD section of any plan |

The **work-id** generalizes the old issue number: `issue-<N>` for a GitHub
issue, the lowercased key (`ct-1234`) for Jira, a slug for a file/inline source.

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
| `pocock` | `grill-me` / `grill-with-docs` for Phase 2 | inlined baseline questions |
| `superpowers` | `verification-before-completion`, `systematic-debugging` in Session 2 | Claude's native discipline |
| `craft` / language TDD | `tdd-workflow-principles`, `php-tdd-workflow`, `vitest-tdd-workflow`… | trace test still in the template |
| `common` | `/spec-first-dev` upstream | `/draft-issue` accepts any source |

---

## The full recipe

### Step 0 — Draft (optional)

Use it to normalize a source and, **if you want**, mirror it as a GitHub issue:

```bash
cd ~/projects/<repo>
claude
> /draft-issue CT-1234          # Jira, read via MCP
> /draft-issue .claude/plans/x-spec.md
> /draft-issue inline
```

It writes `.claude/plans/<work-id>-spec.md`, flags the gaps `/run-issue` will
grill, then **asks** whether to create a GitHub issue (default no).

### Session 1 — Plan (interactive, ~5–15 min)

```bash
claude
> /run-issue CT-1234            # or an issue number, a spec path, or 'inline'
```

What happens:
1. Resolves the source and reads it (Jira MCP / `gh` / file / paste).
2. Summarizes it back and asks you to confirm.
3. **Grills you one question at a time** — closing functional gaps, surfacing
   technical consequences, and mapping **each business rule to a command-line
   check** so the Definition of Done has teeth.
4. **Decomposes** the work into small functional iterations (each an independently
   reviewable slice with its own files + acceptance criteria).
5. **Asks the commit/PR policy**: `manual` (default) / `commit` / `commit+pr`.
6. Creates `feature/<work-id>-<slug>`, writes the plan (committing it only if the
   policy isn't `manual`).
7. Echoes the **per-iteration `/goal` text** to paste.

### Session 2 — Execute, one iteration at a time

Paste the `/goal` text. It implements the **next unchecked** iteration test-first,
verifies the criteria (running the commands, not asserting from memory), marks the
iteration `[x]`, and **stops with a structured synthesis**:

> **Fait** · **Pourquoi** · **Règles métier couvertes** · **À reviewer** ·
> **Commit suggéré** · **Reste**

Commit behavior follows the policy:
- **manual** — Claude commits nothing. You read the synthesis, review the diff,
  and commit the iteration yourself.
- **commit** — Claude commits the iteration (conventional message, **no
  `Co-Authored-By` trailer**), no push/PR.
- **commit+pr** — plus, after the last iteration, push + `gh pr create`.

Then re-paste the **same** `/goal` text for the next iteration. Repeat until the
spec has no unchecked iterations.

### Between iterations / at the end — review

Two artifacts live in `.claude/plans/`:
- `<work-id>-spec.md` — the contract (business rules, DoD, iterations)
- `<work-id>-execution-log.md` — auto-regenerated audit of what Claude did

Apply the trace test on the diff:

```text
Show `git diff --stat` and the last iteration's synthesis. Every changed line
must trace to this iteration's "Files to touch" in .claude/plans/<work-id>-spec.md.
Flag any drift.
```

Clean → commit (manual mode) or you're done (commit/commit+pr).

---

## Manual log regeneration (snapshot mid-session)

```bash
python3 ~/projects/github/claude-marketplace/plugins/goal/scripts/extract-execution-log.py <work-id>
```

Auto-detects `<work-id>` from the `feature/<work-id>-…` branch when omitted, and
finds the most recent JSONL referencing the spec.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/run-issue` / `/draft-issue` not recognized | Plugin not enabled or Claude not restarted | enable + restart `claude` |
| Jira source won't read | Atlassian MCP not connected in this session | connect it, or paste with `inline` |
| `gh` errors on the GitHub path | token missing/expired | `gh auth refresh -h github.com -s repo,read:org` |
| `/run-issue` says "branch is dirty" | uncommitted changes | `git stash` or commit, then re-run |
| `/goal` not recognized | workspace not trusted | `/trust` |
| Execution log not regenerating | one of the 3 hook preconditions failed: (1) branch `feature/<work-id>-…` with an existing spec, (2) `.claude/plans/<work-id>-spec.md` present, (3) transcript contains a `/goal` command | verify (1) `git branch --show-current`, (2) `ls .claude/plans/`, (3) that you actually launched `/goal`. Or regenerate manually. |
| Claude committed with a `Co-Authored-By` trailer | policy `commit`/`commit+pr` and the trailer slipped in | the handoff forbids it; amend to strip it |

---

## Cost expectations

Everything runs on your **Claude Code subscription** (no API surcharge) when you
use **interactive `claude`**. The `/goal` evaluator runs on your small fast model
and is included. The 5-hour rate-limit window applies normally.

---

## See also

- [`/goal` official docs](https://code.claude.com/docs/en/goal)
- [`common:spec-first-dev`](../common/commands/spec-first-dev.md) — the gated,
  spec-first inspiration; chain into `/draft-issue` after its Phase 3
- [`craft:tdd-workflow-principles`](../craft/skills/tdd-workflow-principles/SKILL.md)
  — cross-language TDD used during Session 2
