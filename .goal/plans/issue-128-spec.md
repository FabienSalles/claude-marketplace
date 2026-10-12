# Spec: Copilot hosts the goal sessions

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/128 (ticket 3 of goal-multi-provider, /Users/fabiensalles/projects/github/claude-marketplace/.claude/plans/goal-multi-provider-backlog.md)
Work-id: issue-128
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
Status: plan locked by /goal:plan on 2026-10-11, base `origin/main@2bb3d55`; functional contract settled by /goal:spec the same day.
Adversarial grill: ran
---

## Business intent

**Problem.** Since #229 a run needs no Claude session, but the sessions that prepare and watch it still do. Copilot CLI 1.0.95 discovers all six goal skills from this repository's `plugins/goal`, yet every one of them starts with `node "${CLAUDE_PLUGIN_ROOT}/src/artifacts.ts"`, and Copilot hands that text to the model verbatim: it substitutes neither `${CLAUDE_PLUGIN_ROOT}` (10 occurrences) nor `$ARGUMENTS` (9), and exports no plugin-root variable to the shell. The first command of every goal skill therefore points nowhere under Copilot. `/goal:supervise` goes further and stops on purpose outside Claude Code (`plugins/goal/skills/supervise/SKILL.md:8-12`), because it expects `claude -p` and the `goal:goal-session-auditor` agent.

**Objective.** A developer can tick, spec, plan, supervise and checkpoint a goal from Copilot CLI alone, with the same skills, the same commands and the same artifacts as from Claude Code, and nothing changes for a developer who stays on Claude Code.

**Success signal.** Ticket 4 (#129) of this chantier is reconciled, specced, planned and supervised from Copilot sessions with `GOAL_RUN_PROVIDER=copilot`, its pull request lands, and no Claude session appears in any of its logs or transcripts.

**Affected.** The developer working under priority 1 of the chantier (Copilot only, end to end): today the runner side is Copilot-capable but every interactive goal session still requires Claude Code. A developer who stays on Claude Code sees no change.

This ticket closes priority 1. After it, the whole goal workflow (backlog, contract, plan, unattended run, supervision, audit) is reachable from a Copilot CLI session, and the plugin has one source both hosts read, so a plan can move between a Claude Code session and a Copilot session without either host running different code.

## Reproduction
- `copilot --version` → `GitHub Copilot CLI 1.0.95.`
- `copilot plugin list` → `No plugins installed.`
- `copilot --plugin-dir plugins/goal plugin list` → `External Plugins (via --plugin-dir):` / `• goal (v3.6.0)`
- `copilot --plugin-dir plugins/goal skill list` → under `Plugin skills:`: `grill-adversarial`, `next`, `plan`, `spec`, `supervise`, `tickets`
- `grep -o -h -E '\$\{?[A-Z_]*PLUGIN[A-Z_]*\}?|\$ARGUMENTS' plugins/goal/skills/*/SKILL.md | sort | uniq -c` → `10 ${CLAUDE_PLUGIN_ROOT}`, `9 $ARGUMENTS`
- `copilot --plugin-dir plugins/goal --no-ask-user -s -p '<load skill "spec", quote the node line of "Project artifact root" and the Source line, as received>'` → `node "${CLAUDE_PLUGIN_ROOT}/src/artifacts.ts" "$project"` and `$ARGUMENTS` (unsubstituted)
- Same session, allowed only `env`, `cut`, `grep`: `env | cut -d= -f1 | grep -i -E "plugin|skill|claude|copilot_(home|root|dir)"` → only `CLAUDE_*` names inherited from the parent Claude Code session; no plugin-root variable
- `sed -n 8,12p plugins/goal/skills/supervise/SKILL.md` → "Outside Claude Code there is no `claude -p` to spawn and no agent to invoke. State that reason and STOP before Phase 0 runs."
- `jq '.["fabien-claude-marketplace"].source' ~/.claude/plugins/known_marketplaces.json` → `{"source":"directory","path":"/Users/fabiensalles/projects/github/claude-marketplace"}` (Claude Code reads the goal plugin from this checkout)
- `copilot plugin marketplace add --help` → source accepts "owner/repo for GitHub, URL, or local path"

## Scope IN
- The six goal skills usable from Copilot CLI: `/goal:tickets`, `/goal:spec`, `/goal:plan`, `/goal:supervise`, `/goal:next`, and `goal:grill-adversarial` as `/goal:spec` invokes it.
- One documented way to make the goal plugin available to Copilot, reading the same source Claude Code reads (this repository's marketplace).
- `/goal:supervise` hosted in Copilot: launch, watch, classify, repair once, session audit, attribution, PR fold.
- The session audit run as a Copilot agent, covering every session that produced the run, whichever host or provider ran it.
- Copilot sessions in the attribution table, shown with what Copilot records.
- Manual delivery mode declared Claude-only when hosted in Copilot.

## Scope OUT
- Codex hosting the sessions (ticket 4, #129).
- Sharing generic, non-goal skills across agents (ticket 16, #140).
- A Copilot equivalent of Claude Code's `/goal` loop for manual mode.
- Publishing the plugin to a third-party marketplace (`awesome-copilot`).
- The security policy enforced in Copilot's hooks (ticket 6, #131).
- Any change to which provider a run uses: provider selection stays `GOAL_RUN_PROVIDER` / `GOAL_RUN_IMPLEMENTER` (#127).

## Business rules (functional DoD — one observable criterion per rule)
- **R1 — Six skills run under Copilot.** Each of the six goal skills, invoked from a Copilot session where the plugin is available, reaches its first artifact step with the plugin's own scripts → observed when: a Copilot session invoking each skill runs the artifact resolver against the real plugin directory and prints the resolved `root`, `plans` and `runs`, with no empty or literal placeholder in any command it runs.
- **R2 — Arguments reach the skill.** What the developer types after the command reaches the skill as its source argument, and an empty argument behaves as it does under Claude Code → observed when: `/goal:spec <path>` under Copilot selects exactly that file, and `/goal:spec` with no argument takes the documented empty-argument branch.
- **R3 — Same command names.** The commands the skills print in their handoffs (`/goal:tickets`, `/goal:spec`, `/goal:plan`, `/goal:supervise`, `/goal:next`) invoke the matching skill when typed in Copilot → observed when: each handoff line, pasted unchanged into a Copilot session, starts the named skill.
- **R4 — One source.** Claude Code and Copilot read the goal plugin from the same source, so both hosts run the same code; when Copilot holds a copy, bringing it current is one documented command → observed when: the README's Copilot install, followed on this Mac, makes Copilot list goal at the same version Claude Code loads, and a version bump on the source reaches Copilot through that one documented command.
- **R5 — Host and version named.** Each goal skill names the host it runs in and the plugin version on its first line of output → observed when: the first line a goal skill prints reads the host (Claude Code or Copilot) and the version from the plugin manifest, identically formatted on both hosts.
- **R6 — Unresolved root stops.** A goal skill that cannot locate its own scripts stops before running any command, names the host and the install command that fixes it, and writes nothing → observed when: a skill hosted without a resolvable plugin root prints "cannot locate the goal plugin scripts", the host, and the install command, and the working tree and `<plans>` are unchanged.
- **R7 — supervise hosted in Copilot.** `/goal:supervise` in a Copilot session launches `goal-run.ts`, watches it to its exit, classifies and repairs exactly as under Claude Code → observed when: a Copilot-hosted supervise runs a locked plan to exit 0, and on a seeded halt reports the same failure report block (Command, Output, Reproduce, Diagnosis, Next move) a Claude-hosted supervise reports.
- **R8 — The host never picks the run's provider.** supervise launches `goal-run.ts` with the developer's provider settings untouched, whichever host it runs in → observed when: a Copilot-hosted supervise with no provider setting launches a run whose log names Claude for every role, and with `GOAL_RUN_PROVIDER=copilot` a run whose log names Copilot for every role.
- **R9 — Session audit under Copilot.** Hosted in Copilot, supervise's audit phase runs the session auditor as a Copilot agent, and its findings fold into the PR body as under Claude Code → observed when: a Copilot-hosted supervise of a `commit+pr` run leaves a `### Session audit` section in the PR body, produced by a Copilot session.
- **R10 — The audit covers every session.** The session audit reads the transcripts of every session that produced the run (implementer, lens, reviewer, run auditor, supervising session) whichever host or provider ran each → observed when: auditing a run with Copilot roles under a Copilot-hosted supervise lists every one of those sessions as read, and the same holds for a Claude-hosted supervise of a run with Copilot roles.
- **R11 — Copilot rows in the attribution table.** A Copilot session's attribution row shows its duration, its model and what the Copilot session records (tokens when recorded, premium requests otherwise); its Cost cell shows the premium-request count or `—`, never a Claude-priced dollar figure → observed when: the attribution table of a run with Copilot sessions carries those rows filled that way, and `Total` says which rows its token and cost sums cover.
- **R12 — Manual mode is Claude-only.** Hosted in Copilot, `/goal:plan` offers `commit+pr` and says manual mode needs Claude Code's `/goal`; `/goal:next` hosted in Copilot on a manual plan stops and says the same → observed when: a Copilot-hosted plan session presents no manual option and names why, and a Copilot-hosted next on a manual plan stops with that message and changes nothing.
- **R13 — Claude Code unchanged.** Under Claude Code every goal skill behaves as today → observed when: each goal skill's existing checks and pinned texts still pass, and a Claude-hosted spec, plan, supervise and next on this repository produce the same artifacts and handoffs as before this ticket.
- **R14 — Cross-host continuation.** An artifact written by a goal skill hosted in one CLI is read and continued by the next skill hosted in the other → observed when: a contract written by `/goal:spec` in Claude Code is planned by `/goal:plan` in Copilot, and that plan is supervised from Claude Code, with no path, format or handoff adjusted by hand.
- **R15 — No self-answered question.** A goal skill that needs the developer's answer and has no one to ask (non-interactive host session) stops at that question instead of answering it → observed when: a skill run non-interactively under Copilot with its interactive question unanswered stops at that question and writes no artifact past it.

## States, invariants & transitions
- **States:**
  - Host: S1 Claude Code · S2 Copilot (interactive) · S3 Copilot (non-interactive, `-p`).
  - Plugin availability: A1 root resolved · A2 root unresolved.
  - Plan lifecycle: P0 no artifact · P1 contract · P2 locked plan (commit+pr) · P3 locked plan (manual) · P4 run in progress (lock held) · P5 halted · P6 landed.
  - Provider setting: V1 none (Claude) · V2 `GOAL_RUN_PROVIDER=copilot` · V3 mixed (`GOAL_RUN_IMPLEMENTER` differs).
- **Invariants:**
  - I1 Claude-hosted behaviour is unchanged (R13) — owner: transverse.
  - I2 No command runs against an empty or literal plugin path (R1, R6) — owner: each skill's first step; transverse.
  - I3 The host never changes the run's provider (R8) — owner: supervise.
  - I4 Handoff lines are identical across hosts and invoke the skill on both (R3) — owner: transverse.
  - I5 Both hosts run the same plugin source; a lag is visible on the first line (R4, R5) — owner: install documentation + every skill.
  - I6 Artifacts are host-neutral: same resolver, paths and format (R14) — owner: transverse.
  - I7 One run per plan at a time, whichever host launched it — owner: `goal-run.ts`'s existing lock, preserved.
  - I8 The audit covers every session that produced the run (R10) — owner: session auditor.
  - I9 No Claude-priced cost on a Copilot row (R11) — owner: supervise's attribution.
  - I10 A skill never answers its own question (R15) — owner: transverse.
- **Transition matrix:**
  - (any host, A2) × any skill → stopped, names host and install command, nothing written (I2).
  - (S1, A1) × any skill → today's behaviour (I1).
  - (S2, A1, P0) × `/goal:tickets` or `/goal:spec` → P1, artifacts under the resolved root (I6).
  - (S2, A1, P1) × `/goal:plan` → P2 only; manual not offered, reason named (R12).
  - (S2, A1, P3) × `/goal:next` → stopped, names Claude Code's `/goal`, nothing changed (R12).
  - (S2, A1, P3) × `/goal:supervise` → runs as under Claude Code today on that plan (no new behaviour; provider unchanged, I3).
  - (S2, A1, P2) × `/goal:supervise` with V1 / V2 / V3 → P4 with the provider the setting names (I3); exit → P5 or P6, report, audit (R9, R10, R11).
  - (S2, A1, P4 held by a Claude-hosted supervise) × `/goal:supervise` → run refused by the lock (exit 2), reported as a refusal (I7).
  - (S1, P1 written in S2) × `/goal:plan` and (S2, P2 written in S1) × `/goal:supervise` → continue unchanged (I6, R14).
  - (S3, A1) × any skill reaching an interactive question → stopped at the question (I10).
  - (S2, A1) × `/goal:spec` with the adversarial grill → `goal:grill-adversarial` runs; the Pocock grills it composes run only if installed in Copilot, otherwise skipped as the skill already allows.
  - Second pass over the matrix surfaced nothing new.

## Deferred decisions
- none

## Files (as found in source)
- `plugins/goal/skills/*/SKILL.md` — the six skills; every `${CLAUDE_PLUGIN_ROOT}` and `$ARGUMENTS` occurrence.
- `plugins/goal/skills/supervise/SKILL.md:8-12` — the "Outside Claude Code … STOP" clause.
- `plugins/goal/agents/goal-session-auditor.md:17` — reads transcripts under `~/.claude/projects/` only.
- `plugins/goal/skills/plan/SKILL.md:918-962` — the `/goal` handoff for manual mode.

## Flags for /goal:plan
- **Placeholder resolution under Copilot is the core unknown.** Copilot substitutes neither `${CLAUDE_PLUGIN_ROOT}` nor `$ARGUMENTS` and exports no plugin-root variable (measured). The plan must pick a mechanism that resolves the plugin's own path and the argument on both hosts without changing what Claude Code receives (R13), and measure it in a real Copilot session, not assume it.
- **Copilot install copies or links: unmeasured.** `copilot plugin marketplace add <local path>` is accepted; whether `plugin install` then snapshots the plugin (needing `copilot plugin update` per bump, R4) or reads the checkout live is not measured. Whether Copilot reads this repo's `.claude-plugin/marketplace.json` as-is is also unmeasured.
- **Slash-command naming under Copilot is unverified.** A Copilot model replied `/goal:spec` when asked how to invoke the skill; that is the model's claim, not a measurement (R3).
- **Copilot transcript location and format.** The session auditor and supervise's self-attribution read `~/.claude/projects/`; Copilot keeps sessions under `~/.copilot/session-state/` and `session-store.db` (seen on disk, format unread). R10 and R11 depend on reading them, including premium-request counts.
- **Copilot agent invocation from a skill.** R9 needs supervise, hosted in Copilot, to start the session auditor as a Copilot plugin agent; Copilot lists agents in plugins and has `--agent`, but invoking one from inside a session is unmeasured.
- **Background shell and wake-up under Copilot.** supervise starts `goal-run.ts` as a background shell and waits without tight polling; the Copilot tools for that are unmeasured.
- **Host detection.** R5, R12 and R6 need a skill to know which host runs it; how, on both hosts, is the plan's to decide.
- **Pinned texts.** Skill sentences are pinned word for word by tests (`artifact-skills.test.ts`, lesson of 0g); every reworded line must name the test that pins it.
- **Version bump** of the goal plugin (`plugin.json` and `marketplace.json`) per the repository's rule.

## Notes / decisions from source
- 2026-10-11 grill: scope is all six skills, not the four the issue names, because `/goal:spec` invokes `goal:grill-adversarial` and `/goal:tickets` reconciles after every shipped ticket.
- 2026-10-11 grill: supervise never overrides the provider; "Copilot only" means the developer sets `GOAL_RUN_PROVIDER=copilot`.
- 2026-10-11 adversarial grill: version skew between two installs is prevented by one shared source (the developer's call: "why not use the same package with the same source code?"), not guarded by a refusal; the version line (R5) only makes a lag visible.
- 2026-10-11 adversarial grill: manual delivery mode stays Claude-only; no Copilot `/goal` equivalent is built in this ticket.
- Measurement cost: the reproduction spent two Copilot prompts (one with no tools, one allowed only `env`, `cut`, `grep`).

## Flags resolved by /goal:plan (measured 2026-10-11, Copilot CLI 1.0.95)
- **Placeholders.** A probe plugin invoked as `/probe:echo alpha beta` received `$ARGUMENTS`, `${CLAUDE_PLUGIN_ROOT}` and `$1` literally (asked to copy them verbatim); Copilot substitutes none of them. Copilot does prefix every skill with `Base directory for this skill: <skill dir>`, the same line Claude Code injects. Decision: every `${CLAUDE_PLUGIN_ROOT}` and `$ARGUMENTS` line stays as it is (Claude Code substitutes them, R13), and each skill gains one shared `## Host` block telling a host that left them literal to read the plugin root as the directory two levels above that base directory, and the argument as the text typed after the command.
- **Install.** `COPILOT_HOME=<tmp> copilot plugin marketplace add /Users/fabiensalles/projects/github/claude-marketplace` → `Marketplace "fabien-claude-marketplace" added successfully.`; `copilot plugin install goal@fabien-claude-marketplace` → `Plugin "goal" installed successfully. Installed 6 skills.` and `It is loaded live from /Users/fabiensalles/projects/github/claude-marketplace/plugins/goal, so edits take effect on the next session — nothing was copied.` R4 holds natively: one source, and our `.claude-plugin/marketplace.json` is read as it is.
- **Slash naming.** `/probe:echo alpha beta` invoked the probe skill: the `plugin:skill` form works, so `/goal:spec` handoffs invoke the skill (R3).
- **Agents.** `copilot --plugin-dir plugins/goal --agent goal:goal-session-auditor -p …` → `AGENT_OK`; the bare name is refused with `available: goal:goal-run-implementer, goal:goal-session-auditor, goal:goal-run-lens, goal:goal-run-auditor, goal:goal-run-reviewer`. A Copilot session lists `task` (start an agent), `read_agent`, `bash`, `read_bash`, `stop_bash` among its tools.
- **Transcripts.** A Copilot session lives in `~/.copilot/session-state/<session-id>/events.jsonl`; `copilot --output-format json -p …` emits a `sessionId` equal to that directory name (measured: `aecfeba6-…` → the directory exists). Tool calls are `tool.execution_start` (`data.toolCallId`, `data.toolName`, `data.arguments.command|path`) and `tool.execution_complete` (`data.toolCallId`, `data.success`); usage is `session.usage_record` (`data.usage.model`, `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `cost` in premium requests, `maxPromptTokens`). Records also carry opaque `apiCallId` blobs: any fixture is written by hand, never copied from a real session.
- **No real Copilot run exists yet** in this repository's history (every `issue-126` session id resolves under `~/.claude/projects/`), so the runner's Copilot `sessionId` recording is exercised by fixtures only until the success signal's run.

## Business rules → commands
- R1, R2, R5, R6, R14 → `tests/skill-host.test.ts` (iteration 1): every skill carries the identical `## Host` block; the plugin root it describes (two levels above each skill's directory) contains every script a skill cites as `${CLAUDE_PLUGIN_ROOT}/…`; the block names the stop message, the install commands and the manifest the version line reads.
- R3 → measured above (`/probe:echo`); `tests/skill-host.test.ts` asserts every handoff command a skill prints names an existing skill (`/goal:<name>` ↔ `skills/<name>/`).
- R4 → measured above; `tests/skill-host.test.ts` asserts the README's Copilot install commands name the marketplace and the plugin exactly as `.claude-plugin/marketplace.json` declares them.
- R7, R8, R11 → `tests/supervise-host.test.ts` (iteration 3).
- R9, R10 → `tests/transcripts.test.ts` and `tests/digest.test.ts` (iteration 2), plus `tests/supervise-host.test.ts` for the agent invocation.
- R12, R15 → `tests/skill-host.test.ts` (iteration 1).
- R13 → `tests/artifact-skills.test.ts` and the other skill-pinning suites, unchanged and green in every gate; `dod1` for the whole suite.
- I1–I10 → each assigned to the iteration that owns its rule above; I1 and I6 are transverse (the pinning suites run in every `gate1`, `dod1` at close).

## Delivery strategy
Purely additive. The commands Claude Code receives are byte-identical (every `${CLAUDE_PLUGIN_ROOT}` line stays); the `## Host` block only adds instructions a host that left the placeholders literal acts on. `transcripts.ts` gains a second root and keeps its Claude results unchanged; `digest.ts` gains a second event shape and renders Claude transcripts as before. supervise's "Outside Claude Code … STOP" clause narrows to hosts that have neither a shell nor an agent tool. No flag: nothing existing changes behaviour under Claude Code, and the new behaviour is reachable only from Copilot. No cleanup.

## Blast radius
Empty. The skill texts are read by the hosts only; the pinned sentences in `tests/artifact-skills.test.ts`, `plan-premise.test.ts`, `spec-reproduction.test.ts`, `tickets-premise.test.ts`, `plan-closing.test.ts` and `report-format.test.ts` stay unchanged and green; `transcripts.ts` and `digest.ts` keep their CLI and output for Claude transcripts.

## Files NOT to touch
- `plugins/goal/scripts/goal-run.ts`, `plugins/goal/src/run/`, `plugins/goal/src/adapters/` — provider selection and the runner are #127's and stay as they are (R8).
- Every `${CLAUDE_PLUGIN_ROOT}` and `$ARGUMENTS` line of the skills and agents — rewording one breaks R13 and the pinned tests.
- `plugins/goal/agents/goal-run-*.md` — the run's own agents.

## Definition of Done (global, command-line verifiable)

```gate
dod1=bash plugins/goal/tests/run.sh
dod2=node node_modules/typescript/bin/tsc --noEmit
dod3=node scripts/verify.ts structure
dod4=bash plugins/goal/tests/support/mutate.sh
```

Also true, and not expressible as a command of its own:
- Every business rule above has a passing covering test (proven by `dod1`).

## Functional iterations

### Iteration 1 — The goal skills find their scripts and arguments under Copilot
- [x] Not done yet
- **Goal:** Every goal skill finds its plugin scripts and its argument when hosted in Copilot CLI, names its host and version first, and stops cleanly when it cannot
- **Shippable after it:** a developer who installs the plugin in Copilot with the README's two commands can run `/goal:tickets`, `/goal:spec`, `/goal:plan` (commit+pr) and `/goal:next` from Copilot; `/goal:supervise` still stops there, as today.
- **Files to touch:** `plugins/goal/skills/{spec,plan,next,tickets,supervise,grill-adversarial}/SKILL.md`, `plugins/goal/README.md` (+ `plugins/goal/tests/skill-host.test.ts` (test))
- **Business rules covered:** R1, R2, R3, R4, R5, R6, R12, R13, R14, R15
- **Delivery:** additive — one identical `## Host` block per skill, placed right after its `## Portability` section (or after the frontmatter for `grill-adversarial`, which has none), stating: Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` and `$ARGUMENTS`; a host that leaves them literal (Copilot CLI) reads the root as two levels above `Base directory for this skill:` and the argument as the text typed after the command (empty when none); the first output line is `goal <skill> · <host> · v<version from <root>/.claude-plugin/plugin.json>`; when `<root>/src/artifacts.ts` is missing the skill prints `cannot locate the goal plugin scripts`, the host, and the install commands (`copilot plugin marketplace add <repository>` then `copilot plugin install goal@fabien-claude-marketplace` under Copilot, `/plugin install goal@fabien-claude-marketplace` under Claude Code), and writes nothing; a skill with no one to answer its question (non-interactive session) stops at that question. `plan` (Phase 2c B) and `next` gain one host line each for R12: hosted in Copilot, `manual` is not offered and a manual plan stops `/goal:next`, both naming Claude Code's `/goal`. README gains a `### Copilot hosts the goal sessions` section with the two install commands, the live-load note, and the manual-mode limit.
- **Not machine-verifiable:** a real Copilot session running each skill end to end (the success signal's run covers it).

```gate
test_files=plugins/goal/tests/skill-host.test.ts
impl_files=plugins/goal/skills/spec/SKILL.md plugins/goal/skills/plan/SKILL.md plugins/goal/skills/next/SKILL.md plugins/goal/skills/tickets/SKILL.md plugins/goal/skills/supervise/SKILL.md plugins/goal/skills/grill-adversarial/SKILL.md plugins/goal/README.md
max_diff=450
commit_msg=feat(goal): the goal skills find their scripts and arguments under Copilot
# rule: R1 R2 R3 R4 R5 R6 R12 R14 R15 — host block, root resolution, stop, version line, manual limit; R13 — pinned skill texts unchanged
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/skill-host.test.ts plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/plan-premise.test.ts plugins/goal/tests/spec-reproduction.test.ts plugins/goal/tests/tickets-premise.test.ts plugins/goal/tests/plan-closing.test.ts plugins/goal/tests/report-format.test.ts
# rule: typecheck and lint of the slice's test
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/tests/skill-host.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 2 — The session audit reads Copilot sessions
- [x] Not done yet
- **Goal:** The session audit finds and digests every Copilot session a run produced or that supervised it, beside the Claude ones
- **Shippable after it:** `/goal:supervise` hosted in Claude Code audits a run whose roles ran on Copilot (`GOAL_RUN_PROVIDER=copilot`) instead of silently skipping those sessions.
- **Files to touch:** `plugins/goal/src/transcripts.ts`, `plugins/goal/src/digest.ts`, `plugins/goal/src/core/events.ts` (event type only, if `digest.ts` needs the Copilot fields typed), `plugins/goal/agents/goal-session-auditor.md` (+ `plugins/goal/tests/transcripts.test.ts`, `plugins/goal/tests/digest.test.ts` (tests))
- **Business rules covered:** R10, and the transcript half of R9
- **Delivery:** additive — `runTranscripts` gains a Copilot root (default `~/.copilot/session-state`, injectable for tests): a recorded session id resolves to `<copilot root>/<id>/events.jsonl` when that file exists, and Copilot sessions whose `events.jsonl` names the plan join the content scan; Claude results unchanged. `digest` renders a Copilot `events.jsonl` (`tool.execution_start` → name and `arguments.command` or `arguments.path`; `tool.execution_complete.success` → ok/error; JSONL line of the start) in the same `<line>: <name> <target> -> <status>` form. The agent file names both transcript homes. Fixtures are hand-written, carry no `apiCallId` or other opaque blob.
- **Not machine-verifiable:** none

```gate
test_files=plugins/goal/tests/transcripts.test.ts plugins/goal/tests/digest.test.ts
impl_files=plugins/goal/src/transcripts.ts plugins/goal/src/digest.ts plugins/goal/src/core/events.ts plugins/goal/agents/goal-session-auditor.md
max_diff=350
commit_msg=feat(goal): the session audit reads Copilot sessions
# rule: R10 — recorded and scanned Copilot sessions are listed and digested like Claude ones; Claude results unchanged
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/transcripts.test.ts plugins/goal/tests/digest.test.ts
# rule: typecheck and lint of the slice
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/src/transcripts.ts plugins/goal/src/digest.ts plugins/goal/src/core/events.ts plugins/goal/tests/transcripts.test.ts plugins/goal/tests/digest.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 3 — supervise watches a run from Copilot
- [ ] Not done yet
- **Goal:** /goal:supervise runs hosted in Copilot CLI: it launches and watches the run with the developer's provider settings, audits it through the session-auditor agent, and attributes Copilot sessions by what they record
- **Shippable after it:** priority 1 closes: a goal goes from backlog to merged PR from Copilot sessions alone (`GOAL_RUN_PROVIDER=copilot`).
- **Files to touch:** `plugins/goal/skills/supervise/SKILL.md`, `plugins/goal/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (+ `plugins/goal/tests/supervise-host.test.ts` (test))
- **Business rules covered:** R7, R8, R9, R11
- **Delivery:** additive — the "Outside Claude Code" clause stops only a host with neither a shell nor an agent tool; the background shell and the agent call are named for both hosts (Claude Code: background `Bash`, `Agent`; Copilot CLI: async `bash` with `read_bash`, `task` with `goal:goal-session-auditor`); one sentence forbids setting or unsetting `GOAL_RUN_PROVIDER` / `GOAL_RUN_IMPLEMENTER`; the attribution section reads a Copilot supervising session from `~/.copilot/session-state/<id>/events.jsonl` (`session.usage_record` summed by token class, `cost` as premium requests, `maxPromptTokens` as the window) and fills a Copilot row's Cost cell with the premium-request count or `—`, never a Claude-priced figure, with `Total` naming which rows its sums cover. Goal plugin 3.6.0 → 3.7.0 in both manifests.
- **Not machine-verifiable:** a real Copilot-hosted supervise of a landing run (the success signal's run covers it).

```gate
test_files=plugins/goal/tests/supervise-host.test.ts
impl_files=plugins/goal/skills/supervise/SKILL.md plugins/goal/.claude-plugin/plugin.json .claude-plugin/marketplace.json
max_diff=300
commit_msg=feat(goal): supervise watches a run from Copilot
# rule: R7 R8 R9 R11 — supervise hosted in Copilot launches, audits and attributes without overriding the provider; R13 — pinned supervise texts unchanged
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/supervise-host.test.ts plugins/goal/tests/skill-host.test.ts plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/report-format.test.ts
# rule: typecheck and lint of the slice's test
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/tests/supervise-host.test.ts' | gmake -f - -j2 --output-sync=target
```

## Out-of-band decisions captured during grill
- Q: How is behaviour under Copilot proven in the gates? A: deterministic node:test tests on the skill texts, the plugin layout and the transcript code; the live Copilot session stays under "Not machine-verifiable" and the success signal (ticket 4 through Copilot).
- Q: Resolution mechanism? A: keep every substituted line, add one host block per skill (developer confirmed the reading), no resolver script.
- Q: Policy and remote? A: `commit+pr`, `origin`.
- Delivery mode recorded `no-bc-break` without asking: the blast radius is empty.
