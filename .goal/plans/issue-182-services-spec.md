# Spec: A plan declares the services its gates need, and the gate owns their whole life

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/182
Source plan: /Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/issue-182-spec.md
Work-id: issue-182-services
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
Trigger: plan `issue-182-reap-spec.md` merged into `main`. Cut this plan's branch from a fresh `origin/main` after that merge: it builds on the process-group wrapper that plan ships.
---

## Business intent

**Problem.** The gate's wall clock on a declared command kills only the direct child it started; anything that command forked survives (`plugins/goal/src/gate/bounded.ts:8-12`, `spawnOptions()` at `:91-97`). During the issue-145 run (PR #175), `GOAL_CMD_TIMEOUT` (900 s) killed `gate1`'s shell, but three `goal-run.ts` processes and their parent `node --test` kept running for 17 to 57 minutes. The machine's load average reached 14, the next preflight measured the suite at 84.28 s against its ceiling and refused to start until the orphans were killed by hand (#182, Evidence). A command that exits on its own can leave the same kind of leftover behind, and nothing stops it either.

**Objective.** When the gate is done with a declared command, nothing that command started is still running, unless the plan declared it as a service, and a declared service lives exactly as long as the iteration that declares it, always running the code the gate is judging.

**Success signal.** After any unattended run, finished or refused, `ps` shows no process descended from a gate command or a declared service, and a later preflight's measurements are not skewed by leftovers of an earlier gate.

**Affected.** Every unattended run on the developer's machine, and every plan whose tests need a long-lived process (a server, a database). Today such a plan either leaks the process or cannot express it; after this, it declares the service and the gate owns its whole life.

This plan delivers the second half of that objective. Once `issue-182-reap-spec.md` has landed, a process one command starts for a later command is stopped at the end of the first; a declared service is the one way a process may outlive a command, and the gate stops it too, at a moment it controls.

## Scope IN

- Service keys in an iteration's gate block: `service<N>`, `service<N>_ready`, `service<N>_paths`.
- Start in declaration order, readiness, death between gates, stop in reverse order at the end of the gate's pass, whatever its outcome.
- Restart around every tree change the gate makes (the bite sets the implementation aside, then puts it back), driven by the declared paths.
- Replays of an earlier iteration's commands — the regression wall and the preflight base sweep — with that iteration's own services.
- The `/goal:plan` skill documents the service keys, so a plan can declare them.

## Scope OUT

- Services for the global Definition of Done (`dodN`).
- A process that deliberately detaches from a service (new session, daemonization).
- The run itself being interrupted while a service runs (tickets 4b and 7): it may leave a service alive.
- Two runs in sibling worktrees declaring services on the same port: nothing here arbitrates that.
- Restarting a service silently after it died.

## Business rules (each must map to a command in the DoD)

- **R6 — a declared service lives across its iteration's gates**, and nothing of it is running once the gate's pass ends, whatever the outcome → verified by `node --test plugins/goal/tests/gate-services.test.ts plugins/goal/tests/core-plan.test.ts`.
- **R7 — no gate starts before its services are ready**: each service's readiness command is re-run until it succeeds, within the clock → verified by the same command.
- **R8 — a service that never gets ready, or dies, refuses the iteration**: the remaining gates do not run, and the output names the service, what happened (never ready, or died after which gate) and the tail of its log; no silent restart → verified by the same command.
- **R9 — a service always runs the code the gate is judging**: when the gate changes the tree, a service whose declared paths changed is restarted before the next command, a service with no declared paths is always restarted, a service whose declared paths did not change keeps running → verified by the same command.
- **R10 — a service that cannot start without the implementation does not prove a bite**: the iteration is refused as an unproven bite → verified by the same command.
- **R11 — a replayed command runs with its own services**: the regression wall and the preflight base sweep start the services of the iteration a command comes from, ready, and stop them once its replay is done → verified by `node --test plugins/goal/tests/gate-cross-iteration.test.ts plugins/goal/tests/goal-run-sweep.test.ts`.
- **R12 — several services start in order and stop in reverse** → verified by `node --test plugins/goal/tests/gate-services.test.ts plugins/goal/tests/core-plan.test.ts`.

## States, invariants & transitions

- **States** (one declared service): `not started` · `starting (readiness pending)` · `ready` · `restarting` · `failed (never ready | died)` · `stopped`.
- **Invariants:**
  - **I5** — a gate command runs only while every service of its block is ready and runs the tree being judged. Sequence test: set the implementation aside, restore it, run the next gate; the service answered from the right tree each time. Owner: iteration 1.
  - **I6** — at the end of a gate pass, whatever its outcome (landed, refused, halted), no service of that pass is alive. Sequence test: a pass refused by a failing gate, then `ps` finds none of its services. Owner: iteration 1; re-verified by iteration 2 for replays.
  - **I4** (from the first plan) — the gate stops only processes in the tree of a command or a service it started. Transverse.
- **Transition matrix:** the service rows of the contract `issue-182-spec.md`.

## Delivery strategy

Purely additive: the service keys are new, and a plan that declares none runs exactly as it does after `issue-182-reap-spec.md`. No flag: an undeclared service changes nothing, and nothing in the repository declares one yet.

## Files NOT to touch

- `plugins/goal/src/gate/group-run.ts` beyond reusing it (the first plan's)
- `plugins/goal/src/adapters/claude/` (agent sessions are the runner's)
- `plugins/goal/templates/goal-handoff.template`

## Definition of Done (global, command-line verifiable)

```gate
# rule: the whole goal suite stays green, every business rule's test included
dod1=node scripts/verify.ts goal-gate
# rule: the goal plugin remains type-safe
dod2=node node_modules/typescript/bin/tsc --noEmit
# rule: structure, lint, doc anchors and module headers hold
dod3=node scripts/verify.ts structure
# rule: the split index names every plan of issue 182, and every file it names exists
dod4=for f in "/Users/fabiensalles/projects/github/claude-marketplace/.goal/plans"/issue-182*-spec.md; do grep -q "$(basename "$f")" "/Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/issue-182-plans.md" || exit 1; done; for f in $(grep -oE 'issue-182[a-z-]*-spec\.md' "/Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/issue-182-plans.md"); do test -f "/Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/$f" || exit 1; done
```

Also true, and not expressible as a command of its own:
- Every business rule above has a passing covering test (proven by `dod1`)

## Functional iterations

### Iteration 1 — An iteration's declared services run around its gates and its bite
- [x] Not done yet
- **Goal:** A plan declares the services its gates need, and the gate starts them ready before the first gate, restarts them when the code they depend on changes, refuses the iteration when one fails, and stops them all when its pass ends.
- **Shippable after it:** a plan can test against a server or a database across its gates without leaking it; an iteration whose service never gets ready or dies is refused with the service's log.
- **Files to touch:** `plugins/goal/src/core/plan.ts` (accepts and validates `service<N>`, `service<N>_ready`, `service<N>_paths`), `plugins/goal/src/gate/services.ts` (new: start, readiness, liveness, restart, stop through the group wrapper), `plugins/goal/src/gate/verbs.ts` (`verify()` owns the services' life), `plugins/goal/src/gate/commands.ts` (no gate runs on a dead service), `plugins/goal/src/gate/bite.ts` (restart around the set-aside and the restore, unproven bite), `plugins/goal/skills/plan/SKILL.md` (documents the keys), `plugins/goal/tests/gate-services.test.ts` (new), `plugins/goal/tests/core-plan.test.ts`
- **Business rules covered:** R6, R7, R8, R9, R10, R12 · invariants I5, I6
- **Delivery:** additive; no flag
- **Not machine-verifiable:** none

Implementation notes: `service<N>` and `service<N>_ready` are required together, `service<N>_paths` is optional (absent: always restarted); numbers give the start order. A service's output goes to a file beside the run's event log (the directory of `GOAL_RUN_JSONL` when the gate has one, the OS temp directory otherwise), and its last 4000 characters are shown when it fails. A new implementer attempt is a new `verify()`, so services never outlive one pass. No module header comment.

```gate
test_files=plugins/goal/tests/gate-services.test.ts plugins/goal/tests/core-plan.test.ts
impl_files=plugins/goal/src/core/plan.ts plugins/goal/src/gate/services.ts plugins/goal/src/gate/verbs.ts plugins/goal/src/gate/commands.ts plugins/goal/src/gate/bite.ts plugins/goal/skills/plan/SKILL.md
max_diff=650
commit_msg=feat(goal): run the services a gate block declares around its gates
# rule: R6–R10, R12 — declared services start ready, follow the judged tree, fail loudly, and never outlive the pass
gate1=node --test plugins/goal/tests/gate-services.test.ts plugins/goal/tests/core-plan.test.ts
# rule: the goal plugin remains type-safe
gate2=node node_modules/typescript/bin/tsc --noEmit
# rule: the project lint holds
gate3=node node_modules/eslint/bin/eslint.js --config eslint.config.js plugins scripts
```

### Iteration 2 — A replayed command runs with the services of the iteration it comes from
- [ ] Not done yet
- **Goal:** The regression wall and the preflight base sweep replay an earlier iteration's commands with that iteration's services running and ready, and stop them once the replay is done.
- **Shippable after it:** a plan whose services serve several iterations keeps its regression wall and its preflight green; nothing a replay started survives it.
- **Files to touch:** `plugins/goal/src/gate/cross-iteration.ts`, `plugins/goal/src/core/rules/cross-iteration.ts` (two identical commands are deduplicated only when their services are identical too), `plugins/goal/src/run/sweep.ts`, `plugins/goal/tests/gate-cross-iteration.test.ts`, `plugins/goal/tests/goal-run-sweep.test.ts`
- **Business rules covered:** R11 · invariant I6 for replays
- **Delivery:** additive; no flag
- **Not machine-verifiable:** none

```gate
test_files=plugins/goal/tests/gate-cross-iteration.test.ts plugins/goal/tests/goal-run-sweep.test.ts
impl_files=plugins/goal/src/gate/cross-iteration.ts plugins/goal/src/core/rules/cross-iteration.ts plugins/goal/src/run/sweep.ts
max_diff=300
commit_msg=feat(goal): replay earlier gates with their own services
# rule: R11 — a replayed command runs with its own iteration's services, stopped after the replay
gate1=node --test plugins/goal/tests/gate-cross-iteration.test.ts plugins/goal/tests/goal-run-sweep.test.ts
# rule: the goal plugin remains type-safe
gate2=node node_modules/typescript/bin/tsc --noEmit
# rule: the project lint holds
gate3=node node_modules/eslint/bin/eslint.js --config eslint.config.js plugins scripts
```

## Out-of-band decisions captured during grill

- Q: How is a service written in a gate block?
  A: Three numbered keys: `service<N>`, `service<N>_ready` (required together), `service<N>_paths` (optional).
- Q: Where does a service's output go?
  A: A file beside the run's event log, shown (last 4000 characters) only when the service fails.
- Q: How should the execution sessions handle commits and the PR?
  A: `commit+pr`, pushing to `origin`.
- Q: Which delivery mode applies?
  A: `no-bc-break`, recorded without a question: the keys are new and nothing declares one yet.
- Q: Why two iterations and not three?
  A: Declared paths share every file and the same test command with the lifecycle, so they are one slice; replays touch disjoint files.
