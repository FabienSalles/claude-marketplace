# goal — Autonomous Issue → PR Workflow

End-to-end recipe to go from **idea → GitHub issue → working pull request** with Claude Code's native `/goal` command, running on your **Claude Code subscription** (no API surcharge), with an automatically-regenerated execution log shipped in the PR diff so reviewers can audit what Claude actually did.

The plugin is **self-contained** — `gh` CLI and Claude Code ≥ 2.1.139 are the only hard prerequisites. Other plugins (`common`, `pocock`, `superpowers`, `craft`) enhance the workflow but the commands fall back to inlined behavior when they're not installed.

---

## At a glance — the chain

```
(idea)
  │
  └─ Upstream planning (any one of these — optional):
       ├─ BMAD: bmm:create-prd → bmm:create-epics-and-stories
       ├─ common: /spec-first-dev (5 phases, GATES, persists a spec)
       └─ Free-form: write a markdown spec by hand
  │
  └─ Step 0 — /draft-issue        ◀ this plugin
       │  Convert the spec into a properly-formatted GitHub issue
       │  (gh issue create with the sections /run-issue expects)
       │
       ▼
  └─ Session 1 — /run-issue <N>    ◀ this plugin
       │  Read the issue, grill the developer, lock a spec
       │  on a `feature/issue-<N>-…` branch, echo the /goal text
       │
       ▼
  └─ Session 2 — /goal (native)
       │  Autonomous turns inside `tmux claude` — TDD, verify,
       │  systematic-debug — until acceptance criteria hold
       │  Execution log refreshed at every Stop event by the
       │  plugin's Stop hook → .claude/plans/issue-<N>-execution-log.md
       │
       ▼
  └─ Session 3 — Review + PR
        Trace-test the diff, commit the execution log,
        gh pr create --body-file <spec>
```

## Why 3 sessions (not 1)

The temptation: drop `/goal "deliver issue 42"` and walk away. It usually fails because:

- **Ambiguity is unmovable from inside `/goal`.** The evaluator only sees what Claude has surfaced; it can't ask "what do you mean by X?". A wrong assumption made in turn 2 wastes turns 3–30.
- **Going in the wrong direction for an hour costs more than 10 minutes of upfront grilling.**
- **A scope-creeping diff is hard to review and harder to revert.** The Karpathy "trace test" (every changed line ↔ a spec line) needs a written contract to check against.

Splitting clarification from execution mirrors `/spec-first-dev`'s philosophy: **lift ambiguities → lock a spec → deliver against the spec**.

---

## What the plugin ships

| Component | Path | Role |
|---|---|---|
| [`/draft-issue`](commands/draft-issue.md) | `commands/draft-issue.md` | **Step 0** — spec → GitHub issue with normalized sections |
| [`/run-issue`](commands/run-issue.md) | `commands/run-issue.md` | **Session 1** — issue → grilled spec → feature branch + echoed `/goal` text |
| `issue-execution-log.sh` Stop hook | `hooks/issue-execution-log.sh` | Triggers the log extractor at every Stop event, only when on a matching branch (silent no-op elsewhere — zero overhead on normal sessions) |
| `extract-execution-log.py` | `scripts/extract-execution-log.py` | Parses the session JSONL into a PR-readable markdown summary |
| `done-criteria.template` | `templates/done-criteria.template` | Reusable baseline for the acceptance-criteria section of any spec |

---

## Prerequisites

### Hard requirements (this plugin cannot work without them)

| Item | Check | Fix |
|---|---|---|
| Claude Code ≥ 2.1.139 (for `/goal`) | `claude --version` | Update Claude Code |
| `gh` CLI authenticated | `gh auth status` | `gh auth login` |
| `tmux` (recommended for Session 2 detach) | `command -v tmux` | `brew install tmux` |
| `goal` plugin enabled | `jq '.enabledPlugins["goal@fabien-claude-marketplace"]' ~/.claude/settings.json` → `true` | `./setup.sh --pack goal` or `/plugin install goal@fabien-claude-marketplace` |
| Workspace trusted | `/trust` inside `claude` | once per workspace |

### Optional enhancers (the workflow falls back gracefully without them)

| Plugin | What it adds | If missing |
|---|---|---|
| `pocock` | `grill-me` / `grill-with-docs` skills for Phase 2 of `/run-issue` | Falls back to inlined baseline questions in `/run-issue` |
| `superpowers` | `verification-before-completion`, `systematic-debugging` activate during Session 2 | `/goal` evaluator still enforces criteria; Claude's native discipline applies |
| `craft` | `tdd-workflow-principles` (Karpathy trace test, common rationalizations, etc.) | Trace test is also referenced in `templates/done-criteria.template` |
| `common` | `/spec-first-dev` for richer upstream planning, plus shared hooks (CI reminder, git-add-empty, audit-trail) | `/draft-issue` accepts any markdown spec — BMAD or hand-written works |
| Language-specific (`vitest`, `php`, …) | `vitest-tdd-workflow` / `php-tdd-workflow` activate during Session 2 | `/goal` still validates against the spec's command-line criteria; the loop just lacks TDD scaffolding |

---

## The full recipe

### Step 0 — Draft the issue (optional but recommended)

If you don't have a GitHub issue yet, but you do have a spec (from `/spec-first-dev`, a BMAD story, or a hand-written markdown):

```bash
cd ~/projects/<repo>
claude
> /draft-issue .claude/plans/<feature>-spec.md
# or for inline content:
> /draft-issue inline
```

What happens:
1. Reads the source spec, extracts/normalizes the sections (`/draft-issue` understands BMAD story headings, spec-first-dev sections, and ad-hoc markdown).
2. Validates completeness — STOPS if no business intent or no command-line verifiable acceptance criteria.
3. Drafts the issue body with the exact section structure `/run-issue` expects.
4. Asks for confirmation (labels, milestone, assignee optional).
5. Runs `gh issue create --body-file …` and prints the issue URL + number.
6. Echoes: `Next step — /run-issue <N>`.

### Session 1 — Clarification (interactive, ~5–15 min)

```bash
cd ~/projects/<repo>
claude
> /run-issue 42
```

What happens:
1. Verifies preconditions (`gh auth`, in a repo, working tree clean).
2. Runs `gh issue view 42` and summarizes it back.
3. Asks for confirmation: "Is my reading correct?"
4. **Grills you, one question at a time**, each with a recommended answer. Picks the best available interview approach:
   1. `pocock:grill-with-docs` (if installed + `CONTEXT.md`/`docs/adr/` exist)
   2. `pocock:grill-me` (if installed)
   3. `common:spec-first-dev` Phase 1 questions (if installed)
   4. **Inlined baseline** (always works — Round 1 need / Round 2 system / Round 3 verifiability)
5. Drafts a spec at `.claude/plans/issue-42-spec.md` with command-line verifiable acceptance criteria.
6. Asks for explicit confirmation.
7. Creates `feature/issue-42-<slug>`, commits the spec.
8. Echoes the **exact `/goal` text** to paste in Session 2.

End state: branch checked out, spec committed, `/goal` text printed.

### Session 2 — Autonomous execution (in tmux, minutes to hours)

Fresh terminal:

```bash
cd ~/projects/<repo>
tmux new -s issue-42
claude
```

Paste the `/goal …` text Session 1 gave you. Claude shows `◎ /goal active`.

Automatic during this session:
- Claude reads `.claude/plans/issue-42-spec.md`.
- Implements iteratively — if a TDD skill is installed (`vitest-tdd-workflow` / `php-tdd-workflow`), red-green-refactor with cross-layer iterations.
- Runs tests + linter after each meaningful step.
- If `superpowers:verification-before-completion` is installed, it blocks any "done" claim without fresh command output.
- If `superpowers:systematic-debugging` is installed, it engages on test failures.
- **The Stop hook regenerates `.claude/plans/issue-42-execution-log.md` after every turn**, success or failure. The log slices from the first `/goal` command onward.
- Stops when **all spec acceptance criteria** hold, or after 30 turns.

You can:
- **Detach**: `Ctrl-B` then `D` — closes the terminal, Claude keeps working in the tmux session.
- **Re-attach**: `tmux attach -t issue-42`.
- **Abort cleanly**: re-attach, then `/goal clear`. The execution log captures up to that point either way.

### Session 3 — Review + PR (interactive, ~5 min)

```bash
cd ~/projects/<repo>
tmux attach -t issue-42  # see what happened (or open a new session)
```

Two artifacts are now in `.claude/plans/`:
- `issue-42-spec.md` — the contract written in Session 1
- `issue-42-execution-log.md` — auto-regenerated debug log of what Claude actually did

Ask Claude to apply the Karpathy trace test on its own work:

```text
Show me `git diff main --stat` then `git log --oneline main..HEAD`.
Apply the trace test: every changed line must trace to
.claude/plans/issue-42-spec.md under "Files to touch". Flag any drift.
```

If clean:

```bash
git add .claude/plans/issue-42-execution-log.md
git commit -m "docs: ship execution log for issue #42 review"
git push -u origin feature/issue-42-<slug>
gh pr create --fill --body-file .claude/plans/issue-42-spec.md
```

The PR description **is** the spec — reviewers see the exact contract. The execution log ships in the diff so they can audit how Claude got there.

---

## How to test the workflow end-to-end (first run)

### Setup (one-time, ~2 min)

```bash
# 1. Verify all hard prerequisites
claude --version              # ≥ 2.1.139
gh auth status                # logged in
command -v tmux               # installed

# 2. Refresh your marketplace + enable the plugin
cd ~/projects/github/claude-marketplace
git pull
./setup.sh --pack goal        # enables goal@fabien-claude-marketplace

# 3. Restart Claude Code so the new commands and Stop hook load
```

### First test run (~30 min total)

**Step 1 — pick a tiny test scenario.** Use a side project where stakes are low. Two paths:

- **You already have an issue**: skip to Session 1.
- **You don't**: write a short spec by hand and use `/draft-issue` to create the issue.

  Example minimal spec (drop it in `/tmp/test-spec.md`):

  ```markdown
  # Rename constant FOO to BAR

  ## Business intent
  Free up the FOO name for an upcoming feature; the old name is misleading.

  ## Scope IN
  - Rename `FOO` to `BAR` in `src/config.ts`
  - Update the one usage in `tests/config.test.ts`

  ## Scope OUT
  - Any other naming changes
  - Adding new tests

  ## Acceptance criteria
  - `pnpm test tests/config.test.ts` exits 0
  - `pnpm lint` exits 0
  - `git grep -n 'FOO' src/` returns nothing
  ```

  Then:
  ```bash
  cd <project>
  claude
  > /draft-issue /tmp/test-spec.md
  ```
  Confirm. Issue gets created. Note the number.

**Step 2 — run Session 1**:

```bash
claude
> /run-issue <issue-number>
```

Stay engaged. Answer the clarifying questions honestly. Aim for ~5 questions on a tiny issue.

**Step 3 — inspect Session 1 output before Session 2**:

```bash
git branch --show-current               # feature/issue-N-<slug>
cat .claude/plans/issue-N-spec.md       # readable, matches conversation
git log -1                              # the spec commit exists
git status                              # clean
```

If anything looks off, **STOP** and re-run Session 1 — better catch a misalignment now than after 30 turns of /goal.

**Step 4 — run Session 2 in tmux**:

```bash
tmux new -s issue-N
claude
> <paste the /goal text from Session 1>
```

Detach: `Ctrl-B`, then `D`. Take a break.

**Step 5 — re-attach and inspect**:

```bash
tmux attach -t issue-N
```

You'll see one of:
- ✅ **`◎ /goal active` cleared** — success. Read the last turn's output.
- 🔄 **Still running** — let it continue OR `/goal clear` to abort.
- ❌ **30 turns reached** — scope was too big or Claude got stuck. Read the execution log, refine the spec, re-launch.

**Step 6 — review the diff**:

```text
Show me the full diff. Apply the Karpathy trace test against
.claude/plans/issue-N-spec.md. Anything outside "Files to touch"?
```

If clean → push + PR. If not → ask Claude to revert the unrelated changes.

**Step 7 — open the PR**:

```bash
git add .claude/plans/issue-N-execution-log.md
git commit -m "docs: ship execution log"
git push -u origin feature/issue-N-<slug>
gh pr create --fill --body-file .claude/plans/issue-N-spec.md
```

### Success criteria for the workflow itself

After your first end-to-end run, the workflow is "working for you" if:
- Session 1 took ≤15 min and the spec is something you'd happily hand to a colleague.
- Session 2 ran without you needing to intervene more than once.
- Session 3 review found ≤1 unrelated change (ideally 0).
- The final PR description **matches** what's actually in the diff.

If any of those failed, the failure mode tells you which session to tighten next time:
- Spec unclear → grill harder in Session 1.
- `/goal` ran 30 turns and didn't converge → spec was too big; split next time.
- Scope creep in diff → spec didn't list a "Files NOT to touch" section explicitly.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/run-issue` or `/draft-issue` not recognized | Plugin not enabled, or Claude Code not restarted after install | `./setup.sh --pack goal`, then restart `claude` |
| `gh issue view` / `gh issue create` errors auth | `gh` token missing or expired | `gh auth refresh -h github.com -s repo,read:org` |
| `/run-issue` says "current branch is dirty" | Uncommitted changes | `git stash` (or commit), then re-run |
| `/goal` not recognized | Workspace not trusted | `/trust` in this workspace |
| `/goal` hangs forever | `disableAllHooks` set somewhere | Check `~/.claude/settings.json` |
| Execution log not regenerating during Session 2 | Branch name doesn't match `feature/issue-<N>-…`, or no spec at `.claude/plans/issue-<N>-spec.md` | Both are the hook's preconditions — verify with `git branch --show-current` and `ls .claude/plans/` |
| Execution log generated but huge (>2 MB) | Long `/goal` session with many tools | Acceptable for first runs; if it bothers reviewers, the script truncates per-block (script edits welcome) |
| Subscription rate-limit hit during Session 2 | 5h window ran out | Wait + `claude --resume` — the goal is restored |

---

## Cost expectations

Everything in this workflow runs on your **Claude Code subscription** — no API surcharge — provided you use **interactive `claude`** (not `claude -p`, which historically billed via API).

The `/goal` evaluator runs on your configured small fast model (Haiku by default) and is included in subscription rates. Per Anthropic's `/goal` docs:

> Evaluation tokens are billed on the small fast model configured for your provider and are typically negligible compared to main-turn spend.

The 5-hour rate-limit window applies normally. If you use the `statusline` plugin, the countdown is visible — glance at it before launching a long Session 2.

---

## Files this workflow uses

| Path | Purpose |
|---|---|
| `commands/draft-issue.md` | Step 0 — spec → GitHub issue |
| `commands/run-issue.md` | Session 1 — issue → spec + branch |
| `hooks/hooks.json` | Registers the Stop hook |
| `hooks/issue-execution-log.sh` | Stop hook that triggers the extractor on matching branches |
| `scripts/extract-execution-log.py` | Parses the session JSONL into markdown |
| `templates/done-criteria.template` | Reference template for acceptance criteria |
| `.claude/plans/issue-<N>-spec.md` | Per-issue contract — committed in Session 1 |
| `.claude/plans/issue-<N>-execution-log.md` | Auto-regenerated debug log — committed in Session 3 |

### Manual log regeneration (snapshot mid-session)

```bash
python3 ~/projects/github/claude-marketplace/plugins/goal/scripts/extract-execution-log.py 42
```

Auto-detects the branch (`feature/issue-N-…`) and the most recent JSONL referencing the spec. Writes `.claude/plans/issue-42-execution-log.md`.

---

## When to move to Pattern B (full automation via GitHub Actions)

After 5–10 issues run smoothly through this plugin, you may want to remove the manual Session 1/2/3 toggling. The successor pattern uses [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action) triggered by an `@claude` mention in an issue comment.

Trade-offs:
- ✅ Fully autonomous — no terminal needed.
- ❌ Loses the interactive grilling phase — all clarification must be in the issue + comments from the start.
- ❌ Tokens billed differently — check the action's billing mode against your subscription.
- ❌ Your local skills/hooks aren't loaded into the GitHub runner — publish the marketplace publicly or vendor it in `.github/`.

Worth exploring **only** when the grilling phase has become so routine that you write tight issues from the start.

---

## See also

- [`/goal` official docs](https://code.claude.com/docs/en/goal)
- [Karpathy CLAUDE.md (forrestchang/andrej-karpathy-skills)](https://github.com/forrestchang/andrej-karpathy-skills) — the trace-test heuristic applied in Session 3
- [`common:spec-first-dev`](../common/commands/spec-first-dev.md) — the inspiration for the gated, spec-first flow (chain into `/draft-issue` after Phase 3)
- [`craft:tdd-workflow-principles`](../craft/skills/tdd-workflow-principles/SKILL.md) — cross-language TDD principles used during Session 2
