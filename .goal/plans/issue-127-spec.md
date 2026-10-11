# Spec: Copilot closes the run

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/127 (ticket 2 of goal-multi-provider, .claude/plans/goal-multi-provider-backlog.md)
Work-id: issue-127
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
Status: plan locked by /goal:plan on 2026-10-11, base `origin/main@c0854bc`; functional contract settled by /goal:spec the same day.
Adversarial grill: ran
---

## Business intent

**Problem.** A run started with Copilot as the implementer still needs Claude to finish. The Copilot adapter refuses every role but the implementer (`plugins/goal/src/adapters/copilot/session.ts:111`), and the composite in `plugins/goal/scripts/goal-run.ts:105` sends the lens, the reviewer and the auditor to Claude. Ticket 1's own Copilot run proves it: its `lens`, `reviewer` and `auditor` stages all ran on `model=claude-sonnet-5-5` (`.goal/runs/issue-126/2026-10-11T09-36-24-317Z/.run.log`).

**Objective.** A run can go from the first iteration to its closing report with no Claude session at all, while the lens stays read-only, the reviewer posts only when the plan opts in, the auditor writes only its report, and the gate stays the only committer.

**Success signal.** On this Mac, a locked plan run with Copilot for every role lands, its pull request carries the run report and the review, and its log names Copilot for every session and Claude for none.

**Affected.** The developer running goals under priority 1 of the chantier (Copilot only, end to end): today they cannot drop Claude from a run. Nothing changes for a run that sets no provider.

The run's closing stage is where a delivered goal gets judged a second time (the lens), reviewed (the reviewer) and measured (the auditor). Moving it to Copilot completes the runner side of priority 1: after this ticket, only the interactive goal sessions (ticket 3) still require Claude.

## Reproduction
- `grep -n "role !== 'implementer'" plugins/goal/src/adapters/copilot/session.ts` → `111:    if (role !== 'implementer') throw new Error(\`the Copilot adapter launches the implementer only, not the ${role}\`);`
- `grep -n "role === 'implementer' ? copilot : claude" plugins/goal/scripts/goal-run.ts` → `105:          launch: (role, brief, options, stop) => (role === 'implementer' ? copilot : claude).launch(role, brief, options, stop),`
- `grep -E "^RUN tokens stage=(lens|reviewer|auditor)" .goal/runs/issue-126/2026-10-11T09-36-24-317Z/.run.log` → three lines, each with `model=claude-sonnet-5-5`.
- Measured on `origin/main@c0854bc`.

## Scope IN
- A launch setting, `GOAL_RUN_PROVIDER`, that names the provider of every session of the run.
- The lens, the reviewer and the run auditor running on Copilot.
- What each Copilot close session is refused, and what is checked after the closing stage.
- The composite findings carried from #228: the implementer's provider decides pause or sleep on exhaustion, a Claude implementer keeps its postmortem in a mixed run, the quota pause names the implementer's provider.

## Scope OUT
- The interactive goal sessions, `/goal:supervise`'s own session auditor included (ticket 3).
- Choosing the provider per action or by availability (ticket 15), and switching providers between two iterations (ticket 12).
- `git -C`, `git -c` and `gh` forms outside the reviewer's posting rule (ticket 6); the probe's timeout and the `402` pattern (ticket 12).
- A rebuilt PR body after a relaunch (audit FU2-C01, ticket 12).
- Any change to what a Claude close session is allowed or checked for.

## Business rules (functional DoD — one observable criterion per rule)
- R1 No provider setting means today's run, byte for byte. → observed when: a run with neither `GOAL_RUN_PROVIDER` nor `GOAL_RUN_IMPLEMENTER` launches exactly what it launches today (the launch golden is unchanged).
- R2 `GOAL_RUN_PROVIDER=copilot` puts every session of the run on Copilot. → observed when: the implementer, the lens, the reviewer and the auditor of such a run are each launched through Copilot.
- R3 `GOAL_RUN_IMPLEMENTER`, when set, overrides the implementer alone. → observed when: `GOAL_RUN_PROVIDER=copilot GOAL_RUN_IMPLEMENTER=claude` runs Claude as implementer and Copilot for the close; `GOAL_RUN_IMPLEMENTER=copilot` alone still runs Copilot as implementer and Claude for the close, as shipped in 3.5.
- R4 `GOAL_RUN_PROVIDER` accepts `claude` or `copilot` only. → observed when: any other value refuses the run with exit 2, listed with every other faulty setting, before anything is written.
- R5 A run with every role on Copilot never starts Claude. → observed when: such a run lands with no `claude` executable reachable.
- R6 Copilot's availability is checked before anything is written whenever any role is on Copilot. → observed when: with Copilot missing or unauthenticated, `GOAL_RUN_PROVIDER=copilot GOAL_RUN_IMPLEMENTER=claude` is refused at launch with the same messages ticket 1 shows, and no run directory exists.
- R7 Each close session's provider is named in the log. → observed when: every lens, reviewer and auditor stage line, or a line beside it, names `copilot` or `claude`.
- R8 A Copilot close session gets the same role instructions as its Claude counterpart. → observed when: the instructions the Claude agent file gives each role (lens, reviewer, auditor) reach the Copilot session for that role.
- R9 A Copilot lens or reviewer cannot write a file. → observed when: a file write it attempts is refused before it executes, and the refusal is named in the log.
- R10 A Copilot auditor writes its report and nothing else. → observed when: it writes `report.md` in the run directory; any other file write is refused before it executes.
- R11 No Copilot close session can stage, commit, push or rewrite a ref. → observed when: the ten git commands the implementer is denied are refused for the lens, the reviewer and the auditor too.
- R12 A Copilot reviewer writes to GitHub only when the plan opts in, and only as a comment review. → observed when: without a `Review: comment` header, any GitHub write it attempts is refused before it executes and its review reaches the run log as text; with the header, it posts one comment review opening with the banner that names the goal-run-reviewer AI agent, and `REQUEST_CHANGES` is refused. The lens and the auditor can never write to GitHub.
- R13 After a closing stage with any session on Copilot, every change it made is named. → observed when: every tracked or untracked file, every change to HEAD, the git directory or a ref (what the implementer tamper check watches), and `.claude/settings.json` and `.claude/settings.local.json`, that differs from its state just before the first close session is named in the log; the run directory is excluded; the files are left in place and the run's exit code does not change.
- R14 A failing Copilot close session never changes the run's outcome. → observed when: a lens, reviewer or auditor that ends exhausted, rate-limited, crashed or non-zero leaves the run's exit code what the gate and the Definition of Done made it, and the log names the role, its failure class and Copilot's own words; nothing is retried and nothing pauses.
- R15 The implementer's provider alone decides what an exhausted quota does. → observed when: a Claude implementer sleeps and relaunches as today, a Copilot implementer pauses, whatever provider the close uses; the pause line names the implementer's provider instead of a hard-coded "Copilot".
- R16 A Claude implementer keeps its postmortem in a mixed run. → observed when: with `GOAL_RUN_PROVIDER=copilot GOAL_RUN_IMPLEMENTER=claude`, a failing Claude implementer leaves the same postmortem lines a Claude-only run leaves.

## States, invariants & transitions
- **States:**
  - S0 no provider setting: every role on Claude.
  - S1 `GOAL_RUN_IMPLEMENTER=copilot` (with no `GOAL_RUN_PROVIDER`, or `GOAL_RUN_PROVIDER=claude`): Copilot implements, Claude closes.
  - S2 `GOAL_RUN_PROVIDER=copilot` (with no `GOAL_RUN_IMPLEMENTER`, or `=copilot`): every role on Copilot.
  - S3 `GOAL_RUN_PROVIDER=copilot GOAL_RUN_IMPLEMENTER=claude`: Claude implements, Copilot closes.
  - S4 `GOAL_RUN_PROVIDER=claude`, no implementer setting: every role on Claude, as S0.
  - SX a faulty value in either setting: refused at launch.
  - Close sub-states, crossed with S0–S4: Definition of Done passed or refused; pull request opened or none (`commit` policy); `Review: comment` header present or absent; each close session succeeded or failed.
- **Invariants:**
  - I1 S0 is today's run byte for byte. Owner: the launch (R1).
  - I2 The gate is the only committer whatever the provider. Owner: the Copilot adapter's denials (R11), with the gate's existing checks.
  - I3 A Copilot lens or reviewer leaves the tree as it found it; a Copilot auditor adds only its report. Owner: the Copilot adapter's refusals (R9, R10) and the after-close check (R13).
  - I4 Nothing written to GitHub by a Copilot close session unless the plan opted in, and then only a comment review. Owner: the Copilot adapter (R12).
  - I5 A run that needs Copilot finds out at launch, before writing anything. Owner: the launch (R6).
  - I6 An advisory session never changes the run's exit code. Owner: the close stage (R14).
  - I7 The implementer's provider alone owns the quota policy and the postmortem. Owner: the composite (R15, R16).
  - I8 Every session's provider is readable from the log. Owner: the run's narration (R7).
- **Transition matrix:**
  - (S0, launch) → today's run; I1 holds.
  - (S1, launch) → as shipped in 3.5; the close stays on Claude, with no after-close check (Claude close sessions are unchanged).
  - (S2 or S3, launch with Copilot missing or unauthenticated) → refused, exit 2, no run directory; I5 holds even when the implementer is Claude (S3).
  - (SX, launch) → refused, exit 2, every faulty setting listed.
  - (S2 or S3, Definition of Done passed, pull request opened) → lens and reviewer on Copilot in parallel, then the auditor; I3 holds through R9, R10 and R13, I4 through R12.
  - (S2 or S3, `commit` policy, no pull request) → lens and auditor only, no reviewer; I3 holds.
  - (S2 or S3, Definition of Done refused) → the auditor still runs; the after-close check compares with the tree just before it, so a tree left changed by the refused Definition of Done is not attributed to it.
  - (S2 or S3, reviewer without the header attempts a GitHub write) → refused before it executes; review kept as log text.
  - (S2 or S3, reviewer with the header attempts `REQUEST_CHANGES`) → refused; a comment review is allowed.
  - (S2 or S3, any close session writes a file outside its allowance) → refused before it executes; if a write still happens, R13 names it and the run's outcome is unchanged.
  - (S2 or S3, a close session exhausted, rate-limited or crashed) → the run's exit code unchanged, the failure named; no retry, no pause (R14).
  - (S2 or S3, auditor fails) → no report, so nothing is folded into the pull request, as today for a failed Claude auditor.
  - (S3, implementer exhausted) → Claude's sleep and relaunch, as today (R15).
  - (S3, implementer fails) → Claude's postmortem, as in a Claude-only run (R16).
  - (S2, implementer exhausted) → pause; the pause line names Copilot (R15).
  - (S2 or S3, relaunch after a pause at publication) → the close reruns on the same providers.

### Rule → proof
- R1 → the launch golden (`goal-run-launch-golden.test.ts`), replayed by every iteration's `gate1`.
- R2, R3, R7, R14, R15, R16 → `goal-run-copilot.test.ts` (iteration 1; R2's reviewer half and R5 in iteration 3).
- R4 → `core-settings.test.ts` and `goal-run-settings.test.ts` (iteration 1).
- R6 → `goal-run-copilot-availability.test.ts` (iteration 1).
- R8, R9, R10, R11 → `adapter-copilot.test.ts`, on the argv and brief each role receives (iteration 1).
- R13 → `goal-run-copilot-close-check.test.ts` (iteration 2).
- R12 → `copilot-gh.test.ts` for the interposed `gh`, and `adapter-copilot.test.ts` for the reviewer's argv (iteration 3).
- Invariants I1–I8 are each carried by the rule tests above; I1 is transverse (every `gate1` replays the launch golden).

## Delivery strategy
Purely additive. `GOAL_RUN_PROVIDER` is new, and when it is unset every run launches what it launches today (R1, the launch golden). `GOAL_RUN_IMPLEMENTER=copilot` keeps its shipped meaning. The Copilot adapter used to refuse the close roles; accepting them is new behaviour nobody depends on. The log gains lines naming each close session's provider beside the existing `RUN stage=` and `RUN tokens` lines, which `/goal:supervise` and the run auditor keep reading unchanged. No flag: the setting is the opt-in. Nothing to clean up.

Between iterations 1 and 3, `GOAL_RUN_PROVIDER=copilot` puts the lens and the auditor on Copilot while the reviewer stays on Claude; the README says so until iteration 3 lands.

## Files NOT to touch
- `plugins/goal/src/adapters/claude/` — the Claude adapter's launches are pinned by R1.
- `plugins/goal/agents/*.md` — read as the role instructions (R8), never edited for Copilot.
- `plugins/goal/src/gate/` — the gate's verdict and commit authority do not depend on the provider.

## Definition of Done (global, command-line verifiable)

Only invariants valid on the untouched base and at every intermediate base. All four pass on `origin/main@c0854bc`.

```gate
# rule: R1-R16, all existing and delivered plugin behaviour stays covered
dod1=bash plugins/goal/tests/run.sh
# rule: the port, both adapters and the runner stay type-correct
dod2=node node_modules/typescript/bin/tsc --noEmit
# rule: manifest parity, test wiring, module boundaries, doc anchors, lint and repository structure stay valid
dod3=node scripts/verify.ts structure
# rule: existing structural and gate proofs keep detecting their designated violations
dod4=bash plugins/goal/tests/support/mutate.sh
```

`dod3` runs `npm ci` and needs network and process-table access; run it with the permissions it needs, never weaken it.

## Functional iterations

### Iteration 1 — Copilot runs the lens and the auditor
- [x] Not done yet
- **Goal:** With `GOAL_RUN_PROVIDER=copilot`, the lens and the run auditor run on Copilot, read-only except for the auditor's report, while a Claude implementer in the same run keeps its quota sleep and its postmortem.
- **Shippable after it:** a Copilot-only run whose lens and auditor never start Claude; only the reviewer still does.
- **Files to touch:** `plugins/goal/src/core/settings.ts`, `plugins/goal/src/ports.ts`, `plugins/goal/src/adapters/copilot/session.ts`, `plugins/goal/scripts/goal-run.ts`, `plugins/goal/src/run/iteration.ts`, `plugins/goal/src/run/close.ts`, the harness and fake agents, the report golden, README, plugin version (+ the tests below).
- **Business rules covered:** R2 (implementer, lens, auditor), R3, R4, R6, R7, R8, R9, R10, R11, R14, R15, R16; R1 replayed.
- **Delivery:** additive, `GOAL_RUN_PROVIDER` unset keeps today's run.
- **Not machine-verifiable:** none.
- **Measured on Copilot 1.0.95 during planning, to build on rather than re-measure:**
  - `--allow-all-tools --deny-tool write`: the file tool is refused, but `echo hi > redir.txt` in the shell writes the file. A close role must not get `--allow-all-tools`.
  - Without `--allow-all-tools`, with `--no-ask-user`: a command matching `--allow-tool shell(<cmd>)` runs, `git checkout -b x` is refused, a shell redirection is refused, and `--allow-tool write(<absolute path>)` lets exactly that path be written, every other write refused with "no interactive user response". The `view` tool reads a file with no allowance.
  - A refusal arrives as a `tool.execution_complete` event with `error.code` `denied`, the shape the adapter already reports as `RUN implementer: refused …`; it must name the close role, not `implementer`.
  - The default GitHub MCP tools are read-only (`get_copilot_space`, `list_copilot_spaces`, `get_file_contents`, `search_code`, `search_users`; reported by the model).
- **Shape:** the close roles get an allowlist instead of `--allow-all-tools`: `shell(git log)`, `shell(git show)`, `shell(git diff)`, `shell(git status)`, `shell(git blame)`, `shell(git grep)`, `shell(git ls-files)`, `shell(git rev-parse)`, `shell(git branch)`, `shell(cat)`, `shell(head)`, `shell(tail)`, `shell(grep)`, `shell(ls)`, `shell(wc)`, plus the ten git denials; the auditor alone adds `write(<absolute path of its report.md>)`. The role's instructions are the body of `plugins/goal/agents/goal-run-<role>.md` without its frontmatter, placed before the brief. `GOAL_RUN_IMPLEMENTER`, when set, overrides the implementer only. Copilot's availability is probed at launch whenever any role resolves to Copilot. The quota decision reads the implementer's provider through `onExhausted`, which the composite forwards; the composite also forwards `postmortem`. Bump goal to 3.6.0 in `plugin.json` and `marketplace.json`; README gains `GOAL_RUN_PROVIDER` in the settings table.

```gate
test_files=plugins/goal/tests/adapter-copilot.test.ts plugins/goal/tests/goal-run-copilot.test.ts plugins/goal/tests/goal-run-copilot-availability.test.ts plugins/goal/tests/core-settings.test.ts plugins/goal/tests/goal-run-settings.test.ts
impl_files=plugins/goal/src/core/settings.ts plugins/goal/src/ports.ts plugins/goal/src/adapters/copilot/ plugins/goal/scripts/goal-run.ts plugins/goal/src/run/iteration.ts plugins/goal/src/run/close.ts plugins/goal/tests/support/goal-run-harness.ts plugins/goal/tests/support/test-agents.ts plugins/goal/tests/fixtures/report-golden.json plugins/goal/README.md plugins/goal/.claude-plugin/plugin.json .claude-plugin/marketplace.json
max_diff=900
commit_msg=feat(goal): Copilot can run the lens and the run auditor
# rule: R2-R4, R6-R11, R14-R16 and I1-I3, I5-I8, with Claude's launches unchanged
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/adapter-copilot.test.ts plugins/goal/tests/goal-run-copilot.test.ts plugins/goal/tests/goal-run-copilot-availability.test.ts plugins/goal/tests/core-settings.test.ts plugins/goal/tests/goal-run-settings.test.ts plugins/goal/tests/goal-run-copilot-failures.test.ts plugins/goal/tests/goal-run-launch-golden.test.ts plugins/goal/tests/goal-run-report-golden.test.ts plugins/goal/tests/agent-port.test.ts plugins/goal/tests/provider-neutral.test.ts plugins/goal/tests/goal-run-second-adapter.test.ts plugins/goal/tests/goal-run-close-smoke.test.ts
# rule: the settings, the port, the Copilot adapter and the runner stay type-correct and lint-clean
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/src/core/settings.ts plugins/goal/src/ports.ts plugins/goal/src/adapters/copilot plugins/goal/scripts/goal-run.ts plugins/goal/src/run/iteration.ts plugins/goal/src/run/close.ts plugins/goal/tests/support/goal-run-harness.ts plugins/goal/tests/support/test-agents.ts plugins/goal/tests/adapter-copilot.test.ts plugins/goal/tests/goal-run-copilot.test.ts plugins/goal/tests/goal-run-copilot-availability.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 2 — Every change a Copilot close makes is named
- [ ] Not done yet
- **Goal:** After a closing stage with any session on Copilot, the log names every file, HEAD, git-directory, ref and `.claude/settings*.json` change made since just before the first close session, leaving them in place and the exit code unchanged.
- **Shippable after it:** a developer reading a Copilot-closed run's log knows whether the close left anything behind, and what.
- **Files to touch:** `plugins/goal/src/run/close.ts`, `plugins/goal/src/run/gitwatch.ts` (reused, not duplicated), the harness (+ `plugins/goal/tests/goal-run-copilot-close-check.test.ts`).
- **Business rules covered:** R13; I3's after-close half.
- **Delivery:** additive; a Claude close is not checked (R1).
- **Not machine-verifiable:** none.

```gate
test_files=plugins/goal/tests/goal-run-copilot-close-check.test.ts
impl_files=plugins/goal/src/run/close.ts plugins/goal/src/run/gitwatch.ts plugins/goal/tests/support/goal-run-harness.ts plugins/goal/tests/support/test-agents.ts plugins/goal/tests/fixtures/report-golden.json
max_diff=450
commit_msg=feat(goal): a Copilot close names every change it leaves behind
# rule: R13 and I3, with a Claude close unchecked and unchanged
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/goal-run-copilot-close-check.test.ts plugins/goal/tests/goal-run-copilot.test.ts plugins/goal/tests/goal-run-close-smoke.test.ts plugins/goal/tests/goal-run-report-golden.test.ts plugins/goal/tests/goal-run-launch-golden.test.ts
# rule: the close stage and the git watch stay type-correct and lint-clean
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/src/run/close.ts plugins/goal/src/run/gitwatch.ts plugins/goal/tests/support/goal-run-harness.ts plugins/goal/tests/support/test-agents.ts plugins/goal/tests/goal-run-copilot-close-check.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 3 — Copilot reviews the pull request
- [ ] Not done yet
- **Goal:** The reviewer runs on Copilot too, writing to GitHub only as a comment review and only under a `Review: comment` header, so a `GOAL_RUN_PROVIDER=copilot` run starts no Claude session at all.
- **Shippable after it:** priority 1's runner side: a run from first iteration to closing review with Copilot alone.
- **Files to touch:** `plugins/goal/src/adapters/copilot/` (the reviewer's allowlist and the interposed `gh`), `plugins/goal/src/ports.ts`, `plugins/goal/src/run/close.ts`, `plugins/goal/scripts/goal-run.ts`, the harness and fake agents, README (+ `plugins/goal/tests/copilot-gh.test.ts`, `adapter-copilot.test.ts`, `goal-run-copilot.test.ts`).
- **Business rules covered:** R12, R2 (reviewer), R5; I4.
- **Delivery:** additive.
- **Not machine-verifiable:** none.
- **Shape:** the reviewer's allowlist adds `shell(gh pr view)` and `shell(gh pr diff)`; under `Review: comment` it adds the review subcommand of `gh pr`, and the run puts first on the reviewer's PATH a `gh` that refuses `--request-changes`, `-r` and every GitHub write but a comment review, then hands the call to the real `gh`. Without the header, no GitHub write is allowed at all. Tests drive the interposed `gh` against a fake real `gh` and never reach the network. R5 is proven by a run with every role on Copilot and no `claude` reachable on PATH.

```gate
test_files=plugins/goal/tests/copilot-gh.test.ts plugins/goal/tests/adapter-copilot.test.ts plugins/goal/tests/goal-run-copilot.test.ts
impl_files=plugins/goal/src/adapters/copilot/ plugins/goal/src/ports.ts plugins/goal/src/run/close.ts plugins/goal/scripts/goal-run.ts plugins/goal/tests/support/goal-run-harness.ts plugins/goal/tests/support/test-agents.ts plugins/goal/tests/fixtures/report-golden.json plugins/goal/README.md
max_diff=600
commit_msg=feat(goal): Copilot reviews the pull request, so a run needs no Claude session
# rule: R12, R2 and R5, with I4 held by the interposed gh
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/copilot-gh.test.ts plugins/goal/tests/adapter-copilot.test.ts plugins/goal/tests/goal-run-copilot.test.ts plugins/goal/tests/goal-run-close-smoke.test.ts plugins/goal/tests/goal-run-report-golden.test.ts plugins/goal/tests/goal-run-launch-golden.test.ts
# rule: the Copilot adapter, the close stage and the runner stay type-correct and lint-clean
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/src/adapters/copilot plugins/goal/src/ports.ts plugins/goal/src/run/close.ts plugins/goal/scripts/goal-run.ts plugins/goal/tests/support/goal-run-harness.ts plugins/goal/tests/support/test-agents.ts plugins/goal/tests/copilot-gh.test.ts plugins/goal/tests/adapter-copilot.test.ts plugins/goal/tests/goal-run-copilot.test.ts' | gmake -f - -j2 --output-sync=target
```

## Deferred decisions
- none

## Files (as found in source)
- `plugins/goal/src/adapters/copilot/session.ts` — the Copilot adapter; refuses every role but the implementer today.
- `plugins/goal/scripts/goal-run.ts` — the composite that routes roles to providers.
- `plugins/goal/src/run/iteration.ts` — the quota pause keyed on `provider === 'copilot'` (#228).
- `plugins/goal/src/run/close.ts` — the closing stage: lens and reviewer in parallel, then the auditor.
- `plugins/goal/agents/goal-run-lens.md`, `goal-run-reviewer.md`, `goal-run-auditor.md` — each role's instructions and tool list on Claude.

## Flags for /goal:plan
- How each role's instructions reach Copilot (R8) is unmeasured: Copilot custom agents, or the agent file's body prepended to the brief. Ticket 1's implementer ran with no `--agent`; measure before choosing.
- The write allowance per role (R9, R10) and the GitHub write rule (R12) need Copilot's own mechanism, measured on 1.0.95: whether `--deny-tool` can deny file writes except one path, and whether `shell(gh)` patterns can allow `gh pr review --comment` while refusing the rest. If a refusal cannot be expressed natively, say so before planning around it.
- Recorded Copilot outputs exist for the implementer only (`tests/fixtures/providers/copilot/1.0.95/`); the close roles need their own, scanned with `betterleaks dir` before commit (ticket 1's publication was refused on opaque `apiCallId` blobs).
- Two Copilot sessions run at once (lens and reviewer): check that they do not share or corrupt Copilot's local session state.
- R13 reuses the implementer tamper check's snapshot helpers (HEAD, git directory, refs) from the close stage rather than duplicating them; the two `.claude/settings*.json` paths are the only ignored files it adds.
- `GOAL_RUN_PROVIDER` joins the strict settings parsed once at launch (0b); the README settings table and the `RUN settings` line gain it.
- Plugin version bump (minor) and the launch golden: R1 pins it unchanged.

## Notes / decisions from source
- Q: How does the developer ask for Copilot on the close? A: one run-level setting, `GOAL_RUN_PROVIDER`; `GOAL_RUN_IMPLEMENTER` keeps its shipped meaning.
- Q: Both settings set? A: `GOAL_RUN_PROVIDER` sets every role, `GOAL_RUN_IMPLEMENTER` then overrides the implementer alone.
- Q: Read-only guarantee on Copilot? A: refused before it executes, plus a check after the close; the run is not undone, it is already pushed.
- Q: `Review: comment` with a Copilot reviewer? A: posts as the Claude reviewer does; without the header, every GitHub write is refused.
- Q: A failing Copilot close session? A: the run keeps its outcome, the failure is named, nothing retries.
- Q: Scope of the after-close check? A: tracked, untracked, HEAD, the git directory and refs (what the implementer tamper check watches), and `.claude/settings.json` / `.claude/settings.local.json`; run directory excluded; files left in place. Amended at /goal:plan: the tamper check watches no ignored tree file, contrary to the first wording.
- Q (at /goal:plan, R12): Copilot's `shell(gh pr review)` pattern admits every flag (per its help; the probe is blocked by a local hook). A: R12 unchanged; the run puts a `gh` on the Copilot reviewer's PATH that refuses `--request-changes` and every GitHub write but a comment review, then delegates to the real `gh`.
- #228's composite findings are carried here because this ticket rewrites the composite (backlog reconciliation, 2026-10-11).
