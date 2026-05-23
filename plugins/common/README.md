# common

Shared hooks, agents, slash commands, and meta skills used across every project.

## Install

```text
/plugin install common@fabien-claude-marketplace
```

Or `./setup.sh --pack common` (dev mode). The pack also writes `skillListingBudgetFraction = 0.06` to `~/.claude/settings.json` so the full skill catalog fits in context.

## Skills (4)

| Skill | Purpose |
|---|---|
| [`context-window-management`](skills/context-window-management/SKILL.md) | Rules for keeping response quality high as conversations grow — offload to files, suggest fresh sessions, read selectively, session handoff template |
| [`crispi-planning`](skills/crispi-planning/SKILL.md) | 5-phase planning framework (Context, Research, Implementation design, Structured plan, Implementation) with file persistence to avoid over-planning |
| [`expert-persona-skills`](skills/expert-persona-skills/SKILL.md) | Short persona prompts for non-code expert analysis (security audits, product, competitive, vendor evaluation, architecture review) |
| [`product-research`](skills/product-research/SKILL.md) | 2-phase workflow (gather cheap, synthesize expensive) for market/competitive/technology research before BMAD product briefs |

## Slash commands (4)

| Command | Purpose |
|---|---|
| [`/business-first-dev`](commands/business-first-dev.md) | 5-phase business-first feature workflow — understand business before code, produce a validated spec, then implement with iterative checkpoints. Can be chained into [`goal:/draft-issue`](../goal/commands/draft-issue.md) to materialize the spec as a GitHub issue. |
| [`/feature-tdd-dev`](commands/feature-tdd-dev.md) | Guided feature development with TDD workflow and architecture focus |
| [`/deep-review`](commands/deep-review.md) | Adversarial 3-agent code review producing ~2 high-impact comments per PR |
| [`/research`](commands/research.md) | Objective research separating investigation from implementation to avoid confirmation bias |

> The autonomous issue→PR workflow (`/run-issue`, `/draft-issue`, execution log Stop hook) has moved to its own [`goal`](../goal/) plugin. Install it alongside this one to use the chain `business-first-dev → draft-issue → run-issue → /goal → PR`.

## Agents

| Agent | Purpose |
|---|---|
| [`ui-engineer`](agents/ui-engineer.md) | Frontend / UI specialist agent (component design, responsive layouts, code review for modern best practices) |

## Hooks (9)

| Hook | Event | Purpose |
|---|---|---|
| [`audit-trail.sh`](hooks/audit-trail.sh) | PostToolUse | Append every tool call to a local audit log |
| [`git-add-empty.sh`](hooks/git-add-empty.sh) | PostToolUse | `git add -N` newly created files so diffs are visible |
| [`notify-sound.sh`](hooks/notify-sound.sh) | Notification / Stop | Play a sound on notifications and turn-end |
| [`block-claude-coauthor.sh`](hooks/block-claude-coauthor.sh) | PreToolUse | Block any `git commit` whose message contains an AI-assistant `Co-Authored-By` trailer (Claude / ChatGPT / Copilot / …) |
| [`remind-ci-before-commit.sh`](hooks/remind-ci-before-commit.sh) | PreToolUse | Reminder before `git commit`: run full quality pipeline first (coding style, static analysis, tests) |
| [`remind-skills.py`](hooks/remind-skills.py) | PreToolUse | Remind to read relevant skills before editing `.php` / `Test.php` / `.twig` files |
| [`warn-clock-bypass.py`](hooks/warn-clock-bypass.py) | PreToolUse | Warn when raw `new Date()` / `new DateTime()` / `Carbon::now()` appears in production code instead of an injectable Clock |
| [`warn-test-file-edit.sh`](hooks/warn-test-file-edit.sh) | PreToolUse | Confirm before editing a test file (unless the user asked for it) |
| [`warn-use-git-mv.sh`](hooks/warn-use-git-mv.sh) | PreToolUse | Block raw `mv` on tracked files, suggest `git mv` instead |
