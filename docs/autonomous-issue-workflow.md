# Autonomous Issue → PR Workflow

End-to-end recipe to deliver a working pull request from a GitHub issue in **3 sessions**, running on your Claude Code subscription (no API surcharge).

Pattern A from the `/goal` discussion: interactive clarification first, autonomous execution second, human review + PR third.

---

## Why 3 sessions, not 1

The temptation: drop `/goal "deliver issue 42"` and walk away. It usually fails because:

- **Ambiguity is unmovable from inside `/goal`.** The evaluator only sees what Claude has surfaced; it can't ask "what do you mean by X?". A wrong assumption made in turn 2 wastes turns 3–30.
- **Going in the wrong direction for an hour costs more than 10 min of upfront grilling.**
- **A scope-creeping diff is hard to review and harder to revert.** The Karpathy "trace test" needs a written contract to check against.

The 3-session split mirrors `/business-first-dev`'s philosophy: **lift ambiguities → lock a spec → deliver against the spec**.

---

## Prerequisites

| Item | Check | Fix |
|---|---|---|
| Claude Code ≥ 2.1.139 (for `/goal`) | `claude --version` | Update Claude Code |
| `gh` CLI authenticated | `gh auth status` | `gh auth login` |
| `tmux` installed | `command -v tmux` | `brew install tmux` |
| `common` plugin enabled (provides `/run-issue`) | `jq '.enabledPlugins["common@fabien-claude-marketplace"]' ~/.claude/settings.json` returns `true` | `./setup.sh --pack common` |
| Workspace trusted | `/trust` inside `claude` | `/trust` once per workspace |

Optional but strongly recommended (they shape Session 2 quality):

| Plugin | Why it matters |
|---|---|
| `pocock` | Provides `grill-me` / `grill-with-docs` for the Session 1 interview |
| `superpowers` | Provides `verification-before-completion` and `systematic-debugging` — bedrock skills for the autonomous Session 2 |
| `craft` | Provides `tdd-workflow-principles` (incl. the Karpathy trace test, common rationalizations table) |
| One of `php-tdd-workflow` / `vitest-tdd-workflow` | Stack-specific TDD discipline during Session 2 |

---

## The three sessions

### Session 1 — Clarification (interactive, ~5–15 min)

Inside the target project:

```bash
cd ~/projects/your-side-project
claude
```

At the prompt:

```text
/run-issue 42
```

What the command does (defined in `plugins/common/commands/run-issue.md`):

1. Verifies preconditions (`gh auth`, in a repo, working tree clean).
2. Runs `gh issue view 42` and summarizes the issue.
3. Asks: **"Is my reading correct? Anything to add?"**
4. **Grills you, one question at a time**, each with a recommended answer.
5. Drafts a spec at `.claude/plans/issue-42-spec.md` (business intent, scope IN/OUT, files to touch, command-line acceptance criteria).
6. Shows the spec, asks for explicit confirmation.
7. Creates `feature/issue-42-<slug>`, commits the spec.
8. Echoes the **exact `/goal` text** to paste in Session 2.

End state:
- Branch checked out, spec committed
- `/goal` text printed in your terminal — copy it

### Session 2 — Autonomous execution (in tmux, minutes to hours)

Fresh terminal:

```bash
cd ~/projects/your-side-project
tmux new -s issue-42
claude
```

Paste the `/goal …` text Session 1 gave you. Claude shows `◎ /goal active`.

What happens automatically:
- Claude reads `.claude/plans/issue-42-spec.md`
- Implements iteratively — if a TDD skill is loaded (`vitest-tdd-workflow` / `php-tdd-workflow`), red-green-refactor with cross-layer iterations
- Runs tests + linter after each meaningful step
- `verification-before-completion` blocks any "done" claim without fresh command output
- `systematic-debugging` engages if a test fails (root-cause investigation, no symptom patching)
- Stops when **all spec acceptance criteria** hold, or after 30 turns

You can:
- **Detach**: `Ctrl-B` then `D` — closes the terminal, Claude keeps working in the tmux session
- **Re-attach**: `tmux attach -t issue-42`
- **Abort cleanly**: re-attach, then `/goal clear`

### Session 3 — Review + PR (interactive, ~5 min)

```bash
cd ~/projects/your-side-project
tmux attach -t issue-42   # see what happened (or open a new session)
```

Ask Claude to apply the Karpathy trace test on its own work:

```text
Show me `git diff main --stat` then `git log --oneline main..HEAD`.
Apply the trace test: every changed line must trace to
.claude/plans/issue-42-spec.md under "Files to touch". Flag any drift.
```

If the review is clean:

```bash
git push -u origin feature/issue-42-<slug>
gh pr create --fill --body-file .claude/plans/issue-42-spec.md
```

The PR description **is** the spec — your reviewer (CodeRabbit, teammate, future-you) sees the exact contract.

---

## How to test the workflow end-to-end

### Setup (one-time, ~2 min)

```bash
# 1. Verify all prerequisites
claude --version              # ≥ 2.1.139
gh auth status                # logged in
command -v tmux               # installed

# 2. Refresh your marketplace (pulls /run-issue + template)
cd ~/projects/github/claude-marketplace
git pull
./setup.sh --pack common      # re-enable common to pick up the new command

# 3. Restart Claude Code so the new slash command loads
```

### First test run (~30 min total)

**Step 1 — pick a tiny test issue.** Use a side project where stakes are low. Pick an issue with a verifiable end state, ideally ≤30 LOC of diff. Examples:
- Rename a constant + add a regression test
- Add a missing validation rule + one passing test
- Fix a typo in a user-visible string + a snapshot/test update

If no such issue exists, **create one**: `gh issue create -t "Test: rename FOO to BAR" -b "Rename the constant FOO to BAR in src/config.ts and update the one test that references it."`

**Step 2 — run Session 1.**

```bash
cd ~/projects/<side-project>
claude
> /run-issue <issue-number>
```

Stay engaged. Answer the clarifying questions honestly. Aim for ~5 questions on a tiny issue.

**Step 3 — inspect Session 1 output before Session 2.**

```bash
# Open a second terminal (don't close Session 1's claude yet)
cd ~/projects/<side-project>
git branch --show-current               # feature/issue-N-<slug>
cat .claude/plans/issue-N-spec.md       # readable, matches conversation
git log -1                              # the spec commit exists
git status                              # clean
```

If anything looks off, **STOP** and re-run Session 1 — better catch a misalignment now than after 30 turns of /goal.

**Step 4 — run Session 2 in tmux.**

```bash
tmux new -s issue-N
claude
> <paste the /goal text from Session 1>
```

Detach: `Ctrl-B`, then `D`. Take a break.

**Step 5 — re-attach and inspect.**

```bash
tmux attach -t issue-N
```

You'll see one of:
- ✅ **`◎ /goal active` cleared, indicator gone** — success. Read the last turn's output.
- 🔄 **Still running** — let it continue OR `/goal clear` if you want to abort.
- ❌ **30 turns reached** — scope was too big or Claude got stuck. Read the transcript, refine the spec, re-launch.

**Step 6 — review the diff.**

Inside the still-attached claude session:

```text
Show me the full diff. Apply the Karpathy trace test against
.claude/plans/issue-N-spec.md. Anything outside "Files to touch"?
```

If clean → push + PR. If not → ask Claude to revert the unrelated changes, or revert manually (`git checkout main -- path/to/unrelated`).

**Step 7 — open the PR.**

```bash
git push -u origin feature/issue-N-<slug>
gh pr create --fill --body-file .claude/plans/issue-N-spec.md
# or with a title override:
# gh pr create --title "Issue #N: <short>" --body-file .claude/plans/issue-N-spec.md
```

Open it in the browser, look at the diff one more time, merge or request review.

### Success criteria for THIS workflow itself (meta)

After your first end-to-end run, the workflow is "working for you" if:
- Session 1 took ≤15 min and the spec is something you'd happily hand to a colleague
- Session 2 ran without you needing to intervene more than once
- Session 3 review found ≤1 unrelated change (ideally 0)
- The final PR description **matches** what's actually in the diff (no surprises)

If any of those failed, the failure mode tells you which session to tighten next time:
- Spec unclear → grill harder in Session 1
- `/goal` ran 30 turns and didn't converge → spec was too big; split next time
- Scope creep in diff → spec didn't list a "Files NOT to touch" section explicitly

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/run-issue: command not found` in claude | `common` plugin not enabled or Claude Code not restarted after install | `./setup.sh --pack common`, then restart `claude` |
| `gh issue view` errors `not authenticated` | `gh` token missing or expired | `gh auth refresh -h github.com -s repo,read:org` |
| `/run-issue` says "current branch is dirty" | Uncommitted changes | `git stash` (or commit), then re-run |
| `/goal` shows nothing happens / hangs | Workspace not trusted | `/trust` in this workspace |
| `/goal` returns instantly with success | Condition was already true at start (rare); or evaluator misread the spec | Tighten criterion #3 — "git diff shows files X, Y, Z" — to force visible work |
| Subscription rate-limit hit during Session 2 | The 5h window ran out | Wait for the reset (visible in your statusline), then `claude --resume`. The goal is restored. |
| Branch slug has weird characters | Issue title had unicode the `sed` slugifier missed | Manually rename the branch: `git branch -m feature/issue-N-<clean>` |
| Spec keeps "evolving" during Session 2 | Spec wasn't tight enough; Claude is exercising judgement | Stop, `/goal clear`, update the spec by hand, re-launch |

---

## Cost expectations

Everything in this workflow runs on your **Claude Code subscription** — no API surcharge — as long as you use **interactive `claude`** (not `claude -p`, which historically billed via API).

The `/goal` evaluator runs on your configured small fast model (Haiku by default) and is included in subscription rates. Per Anthropic's `/goal` docs:

> Evaluation tokens are billed on the small fast model configured for your provider and are typically negligible compared to main-turn spend.

The 5-hour rate-limit window applies normally. Your `statusline` plugin shows the countdown — glance at it before launching a long Session 2.

---

## Files this workflow uses

| Path | Purpose |
|---|---|
| `plugins/common/commands/run-issue.md` | The `/run-issue` slash command (Session 1) |
| `plugins/common/templates/done-criteria.template` | Reusable acceptance-criteria pattern, referenced by `/run-issue` when drafting specs |
| `.claude/plans/issue-<N>-spec.md` | Per-issue contract, committed alongside the implementation |

---

## When to move to Pattern B (full automation via GitHub Actions)

After 5–10 issues run smoothly through Pattern A, you may want to remove the manual Session 1/2/3 toggling. The successor pattern uses [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action) triggered by an `@claude` mention in an issue comment.

Trade-offs:
- ✅ Fully autonomous — no terminal needed
- ❌ Loses the interactive grilling phase — all clarification must be in the issue + comments from the start
- ❌ Tokens billed differently — check the action's billing mode against your subscription
- ❌ Your local skills/hooks aren't automatically loaded into the GitHub runner — need to publish the marketplace publicly or vendor it in `.github/`

Worth exploring **only** when Pattern A's grilling phase has become so routine that you're writing the same questions every time. At that point you've internalized the spec format and can write tight issues from the start.

---

## See also

- [`/goal` official docs](https://code.claude.com/docs/en/goal)
- [`plugins/common/commands/run-issue.md`](../plugins/common/commands/run-issue.md) — the slash command itself
- [`plugins/common/templates/done-criteria.template`](../plugins/common/templates/done-criteria.template) — acceptance-criteria reference
- [`plugins/common/commands/business-first-dev.md`](../plugins/common/commands/business-first-dev.md) — the inspiration for the gated, spec-first flow
- [Karpathy CLAUDE.md (forrestchang/andrej-karpathy-skills)](https://github.com/forrestchang/andrej-karpathy-skills) — the trace-test heuristic applied in Session 3 review
