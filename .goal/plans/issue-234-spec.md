# Spec: Codex hosting tells the truth: README and Codex audit outcomes

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/234 (ticket 4a2 of goal-multi-provider, /Users/fabiensalles/projects/github/claude-marketplace/.claude/plans/goal-multi-provider-backlog.md)
Work-id: issue-234
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
Status: plan locked by /goal:plan on 2026-10-12, base `origin/main@9c85b6f`; functional contract settled by /goal:spec the same day.
Adversarial grill: ran
---

## Business intent

**Problem.** #233 merged with review leftovers that misreport what Codex hosting does, and they
will mislead ticket 4b, the first goal driven from Codex. On `origin/main@9c85b6f`:
- **README contradicts the shipped feature.** `plugins/goal/README.md:305` says
  "`/goal:supervise` still stops outside Claude Code", `:322` says "`/goal:supervise` itself is
  not yet usable from Codex", and `:316` keeps a dated note "(hypothesis measured on
  2026-10-12 …)".
- **The auditor cannot see Codex shell commands.** Codex 0.162 records them as
  `custom_tool_call` `exec`, and `src/digest.ts` reads only `function_call`. The few
  `function_call_output` it does read are all marked successful (`digest.ts:33`), although a
  real one carries `"exit_code":1`.
- **The transcript reader bypasses the `fs` adapter and scans everything.** `src/transcripts.ts`
  calls `readdirSync` from `node:fs` directly (`:1`, `:66`) over the developer's whole
  `~/.codex/sessions` history.
- **`supervise/SKILL.md` leaves Codex out where it matters.** Its tool list (`:10`) names no
  Codex tool, and the R7 network and write probes are described in prose, so each run invents
  its own.

**Objective.** A developer reading the goal README learns that supervise works from Codex and how
to refresh Codex's copy. The session auditor sees every command a Codex session ran, with its
real outcome, through the same reading scope as Claude's. Supervise under Codex runs the same
pre-launch probes every time.

**Success signal.** Ticket 4b is supervised from Codex by following the README alone, and that
run's session audit lists the Codex supervising session's commands with outcomes that match
their exit codes.

**Affected.** The developer driving 4b from Codex, and the session auditor whose findings fold
into each pull request.

## Reproduction

- `git show origin/main:plugins/goal/README.md | grep -n "still stops outside Claude Code\|not yet usable from Codex\|hypothesis measured"` → `305:` … "`/goal:supervise` still stops outside Claude Code."; `316:` … "(hypothesis measured on 2026-10-12: Codex served 3.6.0 while the repository was 3.8.0)"; `322:` "`/goal:supervise` itself is not yet usable from Codex."
- `git show origin/main:plugins/goal/src/digest.ts | grep -n function_call_output` → `33:      } else if (item.type === 'function_call_output') {` (followed by `outcomes.set(item.call_id, false)`).
- `git show origin/main:plugins/goal/src/transcripts.ts | grep -n "readdirSync\|node:fs"` → `1:import { accessSync, constants, readdirSync, statSync } from 'node:fs';`, `66:    ? readdirSync(codexRoot, { recursive: true, encoding: 'utf8' })`.
- `rollout-2026-10-09T10-57-30-…jsonl`: a `function_call_output` whose text carries `"exit_code":1` (15 outputs in that file).
- Survey of today's rollouts (`~/.codex/sessions/2026/10/12/*.jsonl`): shell commands appear as `('response_item', 'custom_tool_call', 'exec')` ×4 with `input` `const r = await tools.exec_command({cmd:"curl …", …})`, and `custom_tool_call_output` carrying `"exit_code":6`; `function_call` appears only for `js` (`mcp__cua_repl`).
- `codex plugin add goal@fabien-claude-marketplace` → `Installed plugin root: …/goal/3.9.0`; `codex plugin list` → `goal@fabien-claude-marketplace installed, enabled 3.9.0`; the `3.6.0/` cache directory is gone. The copy is taken from the local marketplace's checked-out working tree.

## Scope IN

- README lines 305, 316, 322.
- Codex shell commands and tool outputs in the session digest, with outcomes.
- The Codex session reading scope and its reading path.
- `supervise/SKILL.md`: the Codex tools in the host list, and the R7 probes as exact commands.

## Scope OUT

- Claude and Copilot transcript reading and digesting: unchanged.
- Provider health (ticket 12), Codex as implementer (ticket 10).
- `common`'s failing `Stop` hook under Codex.

## Business rules (each must map to a command in the DoD)

- **R1 — README states supervise works from Codex.** → verified by `tests/skill-host.test.ts` (iteration 2: no "still stops outside Claude Code" nor "not yet usable from Codex" anywhere in the README; the Codex section describes supervising with its launch command).
- **R2 — Refresh stated as fact.** → verified by `tests/skill-host.test.ts` (iteration 2: the README says re-running `codex plugin add goal@fabien-claude-marketplace` copies the local marketplace's checked-out working tree; no "hypothesis measured").
- **R3 — Every Codex shell command is digested.** → verified by `tests/digest.test.ts` (iteration 1: a recorded `custom_tool_call` `exec` running two commands digests to two entries naming both).
- **R4 — Real outcomes.** → verified by `tests/digest.test.ts` (iteration 1: exit codes 0, 1, none, a missing output and fewer chunks than commands digest to `ok`, `failed`, `unknown`, `unknown`, `unknown`).
- **R5 — Codex scope like Claude's.** → verified by `tests/transcripts.test.ts` (iteration 1: of three rollouts, only this project's naming the plan is returned, at any date).
- **R6 — Codex sessions read through the fs adapter.** → verified by `tests/transcripts.test.ts` (iteration 1: `transcripts.ts` imports no `readdirSync`; a missing root returns none).
- **R7 — Codex tools in supervise's host list.** → verified by `tests/supervise-host.test.ts` (iteration 2: the host-tools paragraph names Claude Code, Copilot CLI and Codex CLI with their tools).
- **R8 — Pinned pre-launch probes.** → verified by `tests/supervise-host.test.ts` (iteration 2: the `## Under Codex` section gives the probe commands verbatim and a refusal naming the failing probe).
- **R9 — Nothing changes for Claude and Copilot.** → verified by every gate1 (existing transcript, digest and prose checks unchanged) and `dod1`.

## States, invariants & transitions

- **States** (one Codex tool call, as the digest meets it):
  - C1 `exec` with one command, output `exit_code` 0.
  - C2 `exec` with one command, `exit_code` ≠ 0.
  - C3 `exec` with N commands and N exit codes.
  - C4 `exec` whose output carries fewer exit codes than commands (a yielded, still-running
    command).
  - C5 output without any `exit_code` (non-shell tool, MCP `js`, `apply_patch`).
  - C6 call with no output at all (session ended or crashed mid-call).
  - C7 output text that is not parseable.
  - Reading scope: R-a this project naming the plan; R-b this project, plan not named; R-c
    another project naming the plan; R-d no `~/.codex/sessions`.
- **Invariants:**
  - I1 nothing is reported `ok` without an exit code 0 that belongs to it (owner: R4).
  - I2 every shell command a Codex session ran is visible to the auditor (owner: R3).
  - I3 the README never contradicts what the plugin does (owner: R1, R2).
  - I4 the auditor opens no session outside the project (owner: R5).
  - I5 Claude and Copilot digests are unchanged (owner: R9, transverse).
- **Transition matrix:**
  - C1 → `ok`.
  - C2 → `failed`.
  - C3 → N entries, each with its own outcome.
  - C4 → paired commands get their codes; unpaired ones are `unknown` (I1).
  - C5 → `unknown`.
  - C6 → `unknown`.
  - C7 → `unknown`.
  - R-a → read. R-b, R-c → not opened. R-d → empty, no error.
  - Supervise under Codex × probe fails → refused, the failing probe named (R8). × probes pass
    → launches.
  - Claude or Copilot transcript → as before (I5).

- Invariant owners as checks: I1, I2 by iteration 1's `digest.test.ts`; I4 by iteration 1's `transcripts.test.ts`; I3 by iteration 2's `skill-host.test.ts`; I5 transverse in every gate1.

## Delivery strategy

Purely additive on the Codex side: a Codex shell command that was invisible becomes an entry, an
outcome that read `ok` becomes `failed` or `unknown`, and the Codex reader narrows to this
project's sessions. Claude and Copilot digests and readers do not change (R9). README and skill
prose are corrected in place. No flag, no cleanup. Patch bump to 3.9.1 in iteration 2 so Codex's
cache re-copies the corrected skill.

## Files NOT to touch

- `plugins/goal/src/run/**`, `plugins/goal/src/gate/**`, `plugins/goal/scripts/**`.
- `plugins/goal/src/adapters/fs.ts` — `readDir` over the three `YYYY/MM/DD` levels is enough; no new adapter method.
- The Claude and Copilot branches of `digest.ts` and `transcripts.ts`.
- Any live `~/.codex/sessions` file: fixtures are inline, scrubbed of `creator_user_id` and `creator_account_id`.

## Definition of Done (global, command-line verifiable)

```gate
dod1=bash plugins/goal/tests/run.sh
dod2=node node_modules/typescript/bin/tsc --noEmit
dod3=node scripts/verify.ts structure
dod4=bash plugins/goal/tests/support/mutate.sh
```

Also true, and not expressible as a command of its own:
- Every business rule above has a passing covering test (proven by `dod1`)
- The success signal (4b supervised from Codex, its audit matching exit codes) is observed after merge

## Functional iterations

### Iteration 1 — The session auditor sees every Codex command with its real outcome
- [x] Not done yet
- **Goal:** The session auditor sees every shell command a Codex session ran, one entry per command with an ok, failed or unknown outcome, reading only this project's Codex sessions that name the plan, through the fs adapter.
- **Shippable after it:** an audit of a Codex-hosted session no longer hides shell commands nor reports a failed one as ok.
- **Files to touch:** `plugins/goal/src/digest.ts`, `plugins/goal/src/transcripts.ts` (+ `plugins/goal/tests/digest.test.ts`, `plugins/goal/tests/transcripts.test.ts` (test))
- **Business rules covered:** R3, R4, R5, R6
- **Delivery:** additive Codex branch; Claude and Copilot branches untouched.
- **Not machine-verifiable:** none

Measured format (codex-cli 0.162, rollouts of 2026-10-07 and 2026-10-12): a shell command is a
`response_item` with `payload.type: "custom_tool_call"`, `payload.name: "exec"`, `payload.input`
a JS script calling `tools.exec_command({cmd: "<command>", …})` once or more; its result is
`custom_tool_call_output` with the same `call_id`, whose `output` is a list of `input_text` items.
Each executed command contributes one item whose text is a JSON object with `chunk_id` and
`exit_code`, in command order (observed `[1,0,0]` for three commands); other `text(...)` items
without `chunk_id` may sit between them. Pair the Nth command with the Nth `chunk_id` item; when the
counts differ, or an item does not parse, the unpaired commands are `unknown`. A `function_call`
output follows the same rule (an `exit_code` decides, otherwise `unknown`). Scope: read
`session_meta.payload.cwd` (first line) and skip rollouts of another project before scanning their
body for the plan name; walk `YYYY/MM/DD` with `fs.readDir`.

```gate
test_files=plugins/goal/tests/digest.test.ts plugins/goal/tests/transcripts.test.ts
impl_files=plugins/goal/src/digest.ts plugins/goal/src/transcripts.ts
max_diff=300
commit_msg=fix(goal): the session auditor sees every Codex command with its real outcome
# rule: R3 R4 R5 R6 Codex commands digested one per exec_command with ok/failed/unknown, project-scoped, through the fs adapter; R9 Claude and Copilot unchanged
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/digest.test.ts plugins/goal/tests/transcripts.test.ts
# rule: the project still typechecks and lints
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/src/digest.ts plugins/goal/src/transcripts.ts plugins/goal/tests/digest.test.ts plugins/goal/tests/transcripts.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 2 — The README and supervise tell the truth about Codex
- [ ] Not done yet
- **Goal:** The README describes supervising from Codex and refreshing Codex's copy as facts, and /goal:supervise names Codex's tools and runs the same pinned network and write probes before every Codex launch.
- **Shippable after it:** a developer following the README alone supervises from Codex on 3.9.1.
- **Files to touch:** `plugins/goal/README.md`, `plugins/goal/skills/supervise/SKILL.md`, `plugins/goal/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (+ `plugins/goal/tests/skill-host.test.ts`, `plugins/goal/tests/supervise-host.test.ts` (test))
- **Business rules covered:** R1, R2, R7, R8
- **Delivery:** prose corrected in place; patch bump.
- **Not machine-verifiable:** the success signal (4b driven from Codex).

Pinned probes (verified 2026-10-12): network, each must print a code other than `000`:
`curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://api.github.com` and
`curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${ANTHROPIC_BASE_URL:-https://api.anthropic.com}"`
(`claude` calls `https://api.anthropic.com`; it answered `404`, i.e. reachable). Write:
`f="$HOME/.claude/.goal-write-probe-$$" && touch "$f" && rm -f "$f"`. On failure, name the probe,
print `codex -s workspace-write -c sandbox_workspace_write.network_access=true --add-dir "$HOME/.claude"`,
launch nothing. README: line 305's supervise sentence and line 322 go; line 316's parenthetical
becomes the fact that `codex plugin add goal@fabien-claude-marketplace` copies the local
marketplace's checked-out working tree (refresh from the branch Codex should run).

```gate
test_files=plugins/goal/tests/skill-host.test.ts plugins/goal/tests/supervise-host.test.ts
impl_files=plugins/goal/README.md plugins/goal/skills/supervise/SKILL.md plugins/goal/.claude-plugin/plugin.json .claude-plugin/marketplace.json
max_diff=200
commit_msg=fix(goal): the README and supervise tell the truth about Codex
# rule: R1 R2 R7 R8 the README and supervise describe Codex as shipped, with pinned probes; R9 every prose suite still holds
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/skill-host.test.ts plugins/goal/tests/supervise-host.test.ts plugins/goal/tests/prose-duplicates.test.ts plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/report-format.test.ts
# rule: the project still typechecks, lints, and the marketplace structure holds after the bump
gate2=printf '%b\n' '.PHONY: all types lint structure' 'all: types lint structure' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/tests/skill-host.test.ts plugins/goal/tests/supervise-host.test.ts' 'structure:\n\tnode scripts/verify.ts structure' | gmake -f - -j2 --output-sync=target
```

## Deferred decisions

- none

## Files (as found in source)

- `plugins/goal/README.md` — lines 305, 316, 322.
- `plugins/goal/src/digest.ts` — Codex outcome classification.
- `plugins/goal/src/transcripts.ts` — Codex reading scope and `node:fs` import.
- `plugins/goal/skills/supervise/SKILL.md` — host tools paragraph and `## Under Codex` probes.

## Flags for /goal:plan

- **Pairing commands to exit codes inside one `exec` output is a hypothesis.** The output is a
  sequence of text chunks, each a JSON object with `exit_code`. Order-based pairing must be
  proven on a recorded fixture before it is relied on, and anything ambiguous is `unknown`
  (R4).
- **The project scope needs the rollout's `session_meta.payload.cwd`** (measured present), so a
  rollout is filtered before its body is scanned for the plan name (R5).
- **The `fs` adapter may lack a recursive directory read.** `fs.readDir` serves Copilot's flat
  layout, while Codex nests `YYYY/MM/DD`. The adapter may need a method, and its in-memory twin
  the same.
- **Which Claude endpoint the network probe reaches** (R8) must be the one `claude -p` uses,
  verified, not guessed.
- Fixtures must be recorded, scrubbed Codex rollouts, never the developer's live sessions. A
  recording carries account ids (`creator_user_id`, `creator_account_id`) to strip, per ticket
  1's lesson on scanning recordings before commit.

## Out-of-band decisions captured during grill

- `commit+pr`, `origin`; `no-bc-break` recorded unasked (empty blast radius).
- Probes settled the spec flags: order-based pairing of `exec_command` to `chunk_id` items verified on recorded rollouts; `session_meta.payload.cwd` present; `fs.readDir` over `YYYY/MM/DD` suffices; `claude` calls `https://api.anthropic.com` (binary strings; no `ANTHROPIC_BASE_URL` set).

## Notes / decisions from source

- Codex tool outputs without an exit code are `unknown`, never `ok` (developer).
- Codex reading scope mirrors Claude's: project sessions naming the plan, any date (developer);
  the ticket's first outcome line said "within the run's window" and is amended.
- One digest entry per `exec_command`, not per `exec` call (developer).
- Both lower-priority leftovers are in scope: supervise's host list and pinned probes (developer).
- `codex plugin add goal@fabien-claude-marketplace` was run on 2026-10-12 with the developer's
  consent to verify the refresh; Codex now serves 3.9.0.
