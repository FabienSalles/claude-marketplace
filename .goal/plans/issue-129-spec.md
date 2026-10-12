# Spec: Codex hosts the goal sessions, Claude executes the iterations

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/129 (ticket 4 of goal-multi-provider, /Users/fabiensalles/projects/github/claude-marketplace/.claude/plans/goal-multi-provider-backlog.md)
Work-id: issue-129
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
Status: plan locked by /goal:plan on 2026-10-12, base `origin/main@918f70c`; functional contract settled by /goal:spec the same day.
Adversarial grill: ran
---

## Business intent

**Problem.** Codex CLI already discovers the six goal skills, but cannot run them. Codex
0.162.0-alpha.17.2 lists `goal:spec`, `goal:plan`, `goal:next`, `goal:tickets`, `goal:supervise`
and `goal:grill-adversarial` from a cached copy of this repository's plugin, and loads a skill
body by reading its `SKILL.md` at `~/.codex/plugins/cache/fabien-claude-marketplace/goal/<version>/skills/<skill>/SKILL.md`.
Four things break from there:
- **No base-directory line.** Every skill on `origin/main@918f70c` derives `<root>` from
  `${CLAUDE_PLUGIN_ROOT}` or from a `Base directory for this skill:` line. Codex injects
  neither.
- **No Codex install commands.** The `cannot locate the goal plugin scripts` stop names
  install commands for Copilot and Claude Code only.
- **No sub-agent tool.** `/goal:supervise` needs one for `goal:goal-session-auditor`, and
  Codex has none.
- **Stale cache.** The cache Codex serves is 3.6.0, while `main` is 3.8.0.

**Objective.** A developer can spec, plan, supervise and checkpoint a goal from Codex CLI.
`goal-run.ts` executes the locked plan with Claude as implementer, and nothing changes for a
developer on Claude Code or Copilot.

**Success signal.** Ticket 4b (#147) is reconciled, specced, planned and supervised from Codex
sessions, with Claude as implementer, and its pull request merges.

**Affected.** The developer, whose priority 2 is Codex hosting the interactive sessions on the
ChatGPT subscription, with Claude (`claude -p`, Max subscription) doing the iterations.

Ticket 3 made the skills host-neutral for Copilot, and #231 moved the shared rules into
`plugins/goal/shared/`. This ticket adds a third host to that model. It does not add a new
implementer: `goal-run.ts` keeps the loop, the gate and the commit, and runs Claude as it does
today.

## Reproduction

- `which codex` → `/Users/fabiensalles/.local/bin/codex`; `codex --version` → `codex-cli 0.162.0-alpha.17.2`; `codex login status` → `Logged in using ChatGPT`.
- `grep -n -A1 'goal@fabien-claude-marketplace' ~/.codex/config.toml` → `96:[plugins."goal@fabien-claude-marketplace"]` / `enabled = true`; marketplace `source_type = "local"`, `source = "/Users/fabiensalles/projects/github/claude-marketplace"`.
- `codex plugin list | grep goal@` → `goal@fabien-claude-marketplace  installed, enabled  3.6.0`.
- `git show origin/main:plugins/goal/.claude-plugin/plugin.json | grep version` → `"version": "3.8.0"`.
- Probe `codex exec --sandbox read-only --skip-git-repo-check "<list goal skills; quote Base directory / CLAUDE_PLUGIN_ROOT / ARGUMENTS lines of goal:spec; name ask-user, background-shell and sub-agent tools>"` (13 241 tokens):
  - skills: `goal:grill-adversarial`, `goal:next`, `goal:plan`, `goal:spec`, `goal:supervise`, `goal:tickets`;
  - "The body of `goal:spec` is not in my context. … I would load it by reading … `/Users/fabiensalles/.codex/plugins/cache/fabien-claude-marketplace/goal/3.6.0/skills/spec/SKILL.md`";
  - ask-user `functions.request_user_input`; background shell `functions.exec_command` + `functions.write_stdin`; sub-agent "none";
  - the session logged `hook: Stop Failed`.
- `git show origin/main:plugins/goal/skills/spec/SKILL.md` `## Host` → "A host that leaves it literal (Copilot CLI) reads `<root>` as two levels above `Base directory for this skill:`"; install commands name `copilot plugin …` and `/plugin install …` only.
- `grep -n "sandbox\|network_access" ~/.codex/config.toml` → no match (Codex defaults apply).

## Scope IN

- The six goal skills usable from a Codex CLI session: `spec`, `plan`, `next`, `tickets`,
  `supervise`, `grill-adversarial`.
- `/goal:supervise` from Codex: launch, watch, classify, repair once, audit, fold.
- Codex install, upgrade and launch documented.
- The session auditor and the attribution table reading a Codex supervising transcript.

## Scope OUT

- Codex as implementer (ticket 10). Under Codex the run's implementer, lens, reviewer and
  auditor stay Claude.
- Codex's native goal loop (ticket 10).
- Provider health, fallback and swap (ticket 12). A missing `claude` is reported, not routed
  around.
- `manual` mode under Codex: refused, as under Copilot.
- Sharing generic, non-goal skills with Codex (ticket 16).

## Business rules (each must map to a command in the DoD)

- **R1 — Six skills run under Codex.** → verified by `tests/skill-host.test.ts` (iteration 1: every skill's bootstrap resolves `<root>` for a host that reads `SKILL.md` itself) + the success signal's live run (not machine-verifiable).
- **R2 — Root without a base-directory line.** → verified by `tests/skill-host.test.ts` (iteration 1: the bootstrap derives `<root>` as two levels above the directory of the `SKILL.md` read when no `Base directory for this skill:` line exists).
- **R3 — Codex in the version line.** → verified by `tests/skill-host.test.ts` (iteration 1: `shared/host.md` names `Codex CLI` among the hosts).
- **R4 — Codex install commands in the stop.** → verified by `tests/skill-host.test.ts` (iteration 1: the stop names `codex plugin marketplace add <repository>` then `codex plugin add goal@fabien-claude-marketplace`).
- **R5 — Install, upgrade and launch documented.** → verified by `tests/skill-host.test.ts` (iteration 1: README's Codex section names the install, the refresh by re-running `codex plugin add`, the invocation, and the supervising launch command).
- **R6 — Claude implements under Codex.** → verified by `tests/supervise-host.test.ts` (iteration 3: the Codex host never sets `GOAL_RUN_PROVIDER` or `GOAL_RUN_IMPLEMENTER`).
- **R7 — Network and writes checked before launch.** → verified by `tests/supervise-host.test.ts` (iteration 3: under Codex, supervise probes network and the out-of-repo writes before launching, and on failure prints `codex -s workspace-write -c sandbox_workspace_write.network_access=true --add-dir "$HOME/.claude"` and launches nothing).
- **R8 — Session audit through Claude.** → verified by `tests/supervise-host.test.ts` (iteration 3: under Codex, Phase 7 runs `claude -p --agent goal:goal-session-auditor`).
- **R9 — An audit that cannot run says so.** → verified by `tests/supervise-host.test.ts` (iteration 3: a failed `claude -p` audit is reported with its error and folds no `### Session audit`).
- **R10 — Codex transcript read and audited.** → verified by `tests/transcripts.test.ts` + `tests/digest.test.ts` (iteration 2: a Codex rollout naming the plan is found and its `function_call` items are digested).
- **R11 — Codex supervising row.** → verified by `tests/supervise-host.test.ts` (iteration 3: the row reads `token_usage_record` deduplicated by `response_id`, `model_context_window` as the window, cost `—`, `Total` names its rows).
- **R12 — Manual refused under Codex.** → verified by `tests/skill-host.test.ts` (iteration 1: `plan` and `next` refuse `manual` hosted in Copilot or Codex).
- **R13 — Questions under Codex.** → verified by `tests/skill-host.test.ts` (iteration 1: the host rules name Codex's user-input tool; the non-interactive stop stands) + live run (not machine-verifiable).
- **R14 — Nothing changes elsewhere.** → verified by every gate1 (the prose and transcript suites stay green) and `dod1`.

## States, invariants & transitions

- **States:**
  - S1 Codex, current plugin cached: full.
  - S2 Codex, stale cache (pre-Codex skills).
  - S3 Codex, skill catalog entry only, body not read.
  - S4 Codex, `claude` missing or unauthenticated.
  - S5 Codex non-interactive (`codex exec`).
  - S6 Codex default sandbox (no network, writes limited to the workspace).
  - S7 Codex launched with `workspace-write` + network + the added write dirs.
  - S8 Same plan touched from two hosts across sessions (spec in Claude Code, plan in Codex).
  - S9 Claude Code or Copilot host (unchanged).
- **Invariants:**
  - I1 no command runs on an empty or literal plugin path (owner: R1, R2).
  - I2 `goal-run.ts` alone owns the loop, the gate and the commit; the host never sets the
    provider (owner: R6).
  - I3 a run never starts where it cannot finish its network and out-of-repo writes (owner: R7).
  - I4 nothing reports an audit that did not run (owner: R8, R9).
  - I5 a lagging install is visible: version line and README upgrade path (owner: R3, R5).
  - I6 Claude Code and Copilot behaviour is unchanged (owner: R14, transverse).
  - I7 plans and artifacts are host-agnostic: any host reads what another wrote (owner:
    transverse, via the shared resolver).
- **Transition matrix:**
  - S1 × invoke skill → runs (I1, I3 for supervise).
  - S2 × invoke skill → old skill text: no Codex version line, so the lag is visible (I5).
    Remedy: README upgrade.
  - S3 × invoke skill → the host reads the body first; acting from the description alone
    prints no version line, so the miss is visible (I5).
  - S4 × supervise → `goal-run.ts` fails on its first Claude stage and the report classifies
    it; the audit reports it did not run (R9). Provider health stays ticket 12.
  - S5 × any skill with a question → stops at the question (R13).
  - S6 × supervise → refused before launch, launch command printed, no run directory (R7).
  - S6 × spec/plan/next/tickets → allowed: they write only inside the repository.
  - S7 × supervise → run launches, Claude stages run (R6), audit through `claude -p` (R8).
  - S8 × read a plan written by another host → allowed (I7).
  - S9 × anything → unchanged (I6).
  - Developer picks `manual` under Codex → not offered, or `/goal:next` stops (R12).

- Each invariant is carried by a check: I1 and I5 by iteration 1's gate1, I2, I3 and I4 by iteration 3's, I7 by iteration 2's (a plan written by any host is found by its needle), I6 transverse in every gate1.

## Delivery strategy

Purely additive: a third host beside Claude Code and Copilot, and a third transcript format beside
Claude's and Copilot's. Nothing existing reads anything that changes shape; the Claude Code and
Copilot wording is extended, not replaced, and every existing prose and transcript suite stays
green (R14). No flag, no cleanup. The goal plugin is bumped in iteration 3 so Codex's cache, which
keys on the version, re-copies the skills.

## Files NOT to touch

- `plugins/goal/src/run/**`, `plugins/goal/src/gate/**`, `plugins/goal/scripts/**` — the run and the gate do not change.
- `plugins/goal/src/adapters/**` — no new provider; Claude stays the implementer.
- `plugins/common/**` — its `Stop` hook failing under Codex is out of scope.
- `~/.codex/config.toml` — the plan documents the launch command, it never edits the developer's Codex config.

## Definition of Done (global, command-line verifiable)

```gate
dod1=bash plugins/goal/tests/run.sh
dod2=node node_modules/typescript/bin/tsc --noEmit
dod3=node scripts/verify.ts structure
dod4=bash plugins/goal/tests/support/mutate.sh
```

Also true, and not expressible as a command of its own:
- Every business rule above has a passing covering test (proven by `dod1`)
- The success signal (ticket 4b driven from Codex) is observed after merge, not inside this run

## Functional iterations

### Iteration 1 — The goal skills run from a Codex session
- [ ] Not done yet
- **Goal:** Every goal skill finds its plugin root, names Codex, gives the Codex install commands and refuses manual mode when hosted in Codex, and the README says how to install, refresh, invoke and launch it there.
- **Shippable after it:** spec, plan, next, tickets and grill-adversarial are usable from Codex; supervise still needs iteration 3.
- **Files to touch:** the 6 `plugins/goal/skills/*/SKILL.md`, `plugins/goal/shared/host.md`, `plugins/goal/README.md` (+ `plugins/goal/tests/skill-host.test.ts`, `plugins/goal/tests/prose-duplicates.test.ts` (test))
- **Business rules covered:** R1, R2, R3, R4, R5, R12, R13
- **Delivery:** additive wording beside the Claude Code and Copilot rules.
- **Not machine-verifiable:** a real Codex session invoking each skill (success signal).

The bootstrap stays identical in the six skills (the duplicate guard allowlists it by its first
words, so a reworded opening must move the allowlist entry with it). It gains: a host that injects
no base-directory line and reads `SKILL.md` itself (Codex CLI) takes `<root>` as two levels above
that file's directory. The stop adds `codex plugin marketplace add <repository>` then
`codex plugin add goal@fabien-claude-marketplace` under Codex. README: the Codex section states
that `codex plugin marketplace upgrade` refreshes Git marketplaces only, so a local marketplace is
refreshed by re-running `codex plugin add goal@fabien-claude-marketplace` (hypothesis measured
on 2026-10-12: Codex served 3.6.0 while the repository was 3.8.0), and gives the supervising launch
command `codex -s workspace-write -c sandbox_workspace_write.network_access=true --add-dir "$HOME/.claude"`.

```gate
test_files=plugins/goal/tests/skill-host.test.ts plugins/goal/tests/prose-duplicates.test.ts
impl_files=plugins/goal/shared/host.md plugins/goal/skills/spec/SKILL.md plugins/goal/skills/plan/SKILL.md plugins/goal/skills/next/SKILL.md plugins/goal/skills/tickets/SKILL.md plugins/goal/skills/supervise/SKILL.md plugins/goal/skills/grill-adversarial/SKILL.md plugins/goal/README.md
max_diff=300
commit_msg=feat(goal): the goal skills run from a Codex session
# rule: R1 R2 R3 R4 R5 R12 R13 the bootstrap, the host rules, the stop and the README cover Codex; R14 every prose suite still holds
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/skill-host.test.ts plugins/goal/tests/prose-duplicates.test.ts plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/plan-premise.test.ts plugins/goal/tests/plan-closing.test.ts plugins/goal/tests/gate-locks.test.ts plugins/goal/tests/spec-reproduction.test.ts plugins/goal/tests/tickets-premise.test.ts plugins/goal/tests/report-format.test.ts plugins/goal/tests/supervise-host.test.ts
# rule: the project still typechecks and lints
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/tests/skill-host.test.ts plugins/goal/tests/prose-duplicates.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 2 — A Codex session transcript is found and audited
- [ ] Not done yet
- **Goal:** The session auditor finds the Codex rollouts that name a plan and digests their tool calls, beside Claude and Copilot transcripts.
- **Shippable after it:** a run supervised from Codex can have its supervising session audited.
- **Files to touch:** `plugins/goal/src/transcripts.ts`, `plugins/goal/src/digest.ts`, `plugins/goal/agents/goal-session-auditor.md` (+ `plugins/goal/tests/transcripts.test.ts`, `plugins/goal/tests/digest.test.ts` (test))
- **Business rules covered:** R10
- **Delivery:** additive reader beside the Claude and Copilot ones; a missing `~/.codex/sessions` is not an error.
- **Not machine-verifiable:** none

Measured format (2026-10-12, codex-cli 0.162.0-alpha.17.2): rollouts live at
`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`, one JSON object per line with `type` and `payload`;
tool calls are `type: "response_item"` with `payload.type: "function_call"`, `payload.name`,
`payload.arguments` (a JSON string) and `payload.call_id`; `session_meta.payload.cwd` holds the
working directory. Tests use recorded fixtures, never the developer's real sessions.

```gate
test_files=plugins/goal/tests/transcripts.test.ts plugins/goal/tests/digest.test.ts
impl_files=plugins/goal/src/transcripts.ts plugins/goal/src/digest.ts plugins/goal/agents/goal-session-auditor.md
max_diff=350
commit_msg=feat(goal): the session auditor reads Codex transcripts
# rule: R10 a Codex rollout naming the plan is found and digested; R14 Claude and Copilot transcripts are read as before
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/transcripts.test.ts plugins/goal/tests/digest.test.ts
# rule: the project still typechecks and lints
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/src/transcripts.ts plugins/goal/src/digest.ts plugins/goal/tests/transcripts.test.ts plugins/goal/tests/digest.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 3 — A run is supervised from a Codex session
- [ ] Not done yet
- **Goal:** /goal:supervise run from Codex checks network and writes before launching, runs Claude as implementer, audits through claude -p, and reports its own Codex usage with cost shown as a dash.
- **Shippable after it:** the whole goal workflow runs from Codex, with Claude executing the iterations.
- **Files to touch:** `plugins/goal/skills/supervise/SKILL.md`, `plugins/goal/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (+ `plugins/goal/tests/supervise-host.test.ts` (test))
- **Business rules covered:** R6, R7, R8, R9, R11
- **Delivery:** additive host branch in supervise; minor version bump.
- **Not machine-verifiable:** a real Codex-supervised run (success signal: ticket 4b).

Under Codex: background shell is `exec_command` read with `write_stdin`; there is no agent tool,
so Phase 7 runs `claude -p --agent goal:goal-session-auditor` from the shell, and a failure is
reported with its error instead of an audit. Before launching, a one-line network probe and a write
probe into `$HOME/.claude` decide; on failure, print the launch command and launch nothing. The
supervising row sums `token_usage_record.payload.usage` once per `response_id` over the run's
window (input = `input_tokens` minus `cached_input_tokens`, cache read = `cached_input_tokens`,
cache write = `cache_write_input_tokens`, output = `output_tokens`), takes `model_context_window`
from `event_msg` `token_count` as the window, and shows cost `—`.

```gate
test_files=plugins/goal/tests/supervise-host.test.ts
impl_files=plugins/goal/skills/supervise/SKILL.md plugins/goal/.claude-plugin/plugin.json .claude-plugin/marketplace.json
max_diff=250
commit_msg=feat(goal): supervise watches a run from Codex
# rule: R6 R7 R8 R9 R11 supervise under Codex checks before launch, keeps Claude as implementer, audits through claude -p and reports its own usage; R14 every prose suite still holds
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/supervise-host.test.ts plugins/goal/tests/skill-host.test.ts plugins/goal/tests/prose-duplicates.test.ts plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/report-format.test.ts
# rule: the project still typechecks, lints, and the marketplace structure holds after the bump
gate2=printf '%b\n' '.PHONY: all types lint structure' 'all: types lint structure' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/tests/supervise-host.test.ts' 'structure:\n\tnode scripts/verify.ts structure' | gmake -f - -j2 --output-sync=target
```

## Deferred decisions

- none

## Files (as found in source)

- `plugins/goal/skills/*/SKILL.md` — the `## Host` bootstrap and its stop.
- `plugins/goal/shared/host.md` — the version line.
- `plugins/goal/skills/supervise/SKILL.md` — host tools, Phase 7 audit, attribution.
- `plugins/goal/README.md` — install documentation.

## Flags for /goal:plan

- **Codex served a stale cache (3.6.0) of a local marketplace.** Measure how
  `codex plugin marketplace upgrade` refreshes a local-source plugin, and whether a version bump
  is what triggers it. R5 depends on that.
- **`sandbox_workspace_write.network_access` is my belief about Codex's config key, not
  verified.** Verify it, and the exact dirs `goal-run.ts` writes outside the repository (run
  locks per 0g, `~/.claude` for `claude -p`, `gh` config), before writing R7's command.
- **A `Stop` hook failed during the Codex probe.** Codex runs plugin hooks. Identify which
  plugin's hook failed, and whether the goal plugin's own `hooks/` run under Codex and behave.
- **Codex transcript format** (`~/.codex/sessions/…`) is unread. `transcripts.ts` and the
  digest must parse its tool calls and token counts (R10, R11), the way #128 added Copilot.
- **Codex's user-input tool may exist only in some modes.** Confirm when `request_user_input`
  is available, so R13's non-interactive stop triggers rather than a hang.

## Out-of-band decisions captured during grill

- Q: Policy, delivery mode, remote? A: `commit+pr`; `no-bc-break` recorded unasked (empty blast radius: a third host and a third transcript format, nothing existing changes shape); `origin`.
- Probes settled the five spec flags: `sandbox_workspace_write.network_access=true` verified (`curl` 000 → 200); workspace-write writes `/tmp/goal-locks-<uid>` and `$TMPDIR` but not `~/.claude` (hence `--add-dir "$HOME/.claude"`); `codex plugin marketplace upgrade` refreshes Git marketplaces only; the failing `Stop` hook is `common`'s `notify-sound.sh`, the goal plugin registers no hooks; the Codex rollout format is recorded in iteration 2.

## Notes / decisions from source

- Session audit under Codex runs through `claude -p` (Claude already executes the iterations
  here, so the dependency exists).
- Codex supervising row: tokens shown, cost `—` (ChatGPT subscription).
- `manual` refused under Codex, same rule as Copilot.
- Sandbox: the developer chose `workspace-write` + network + added write dirs over
  `danger-full-access`, with a pre-launch check that refuses and prints the command.
- Success signal mirrors ticket 3's: the next ticket (4b) is driven from Codex.
- Backlog correction: the 2026-10-12 reconciliation wrote "no goal skill reaches Codex today".
  That was wrong: the plugin is installed and enabled in Codex, at a stale 3.6.0.
