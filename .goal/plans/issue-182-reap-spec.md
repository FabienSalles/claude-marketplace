# Spec: The gate's commands leave no process behind

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/182
Source plan: /Users/fabiensalles/projects/github/claude-marketplace/.goal/plans/issue-182-spec.md
Work-id: issue-182-reap
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
---

## Business intent

**Problem.** The gate's wall clock on a declared command kills only the direct child it started; anything that command forked survives (`plugins/goal/src/gate/bounded.ts:8-12`, `spawnOptions()` at `:91-97`). During the issue-145 run (PR #175), `GOAL_CMD_TIMEOUT` (900 s) killed `gate1`'s shell, but three `goal-run.ts` processes and their parent `node --test` kept running for 17 to 57 minutes. The machine's load average reached 14, the next preflight measured the suite at 84.28 s against its ceiling and refused to start until the orphans were killed by hand (#182, Evidence). A command that exits on its own can leave the same kind of leftover behind, and nothing stops it either.

**Objective.** When the gate is done with a declared command, nothing that command started is still running, unless the plan declared it as a service, and a declared service lives exactly as long as the iteration that declares it, always running the code the gate is judging.

**Success signal.** After any unattended run, finished or refused, `ps` shows no process descended from a gate command or a declared service, and a later preflight's measurements are not skewed by leftovers of an earlier gate.

**Affected.** Every unattended run on the developer's machine, and every plan whose tests need a long-lived process (a server, a database). Today such a plan either leaks the process or cannot express it; after this, it declares the service and the gate owns its whole life.

This plan delivers the first half of that objective: nothing a declared command started outlives it. Declared services are the second plan, `issue-182-services-spec.md`, which starts once this one has merged. No plan in `.claude/plans` or `.goal/plans` leaves a process running for a later command, so stopping leftovers breaks nothing in between.

## Scope IN

- Every command run through `bounded()` + `spawnOptions()`: the `gateN` lines, the determinism re-runs, the regression wall, the bite, the `dodN` lines at close, the secret scan, the preflight base sweep.
- Processes a command leaves behind, whether the gate stopped it on its clock or it exited on its own.
- What the gate reports about every process it stopped.

## Scope OUT

- Declared services: plan `issue-182-services-spec.md`.
- A process that deliberately detaches from the command (new session, daemonization). A process orphaned because the command died is **not** detached and stays in scope.
- The run itself being interrupted (Ctrl+C, SIGTERM, crash): tickets 4b and 7.
- The implementer, lens, reviewer and auditor sessions: the runner owns them.
- A per-command timeout declared in the plan.

## Business rules (each must map to a command in the DoD)

- **R1 — nothing survives a command stopped on its clock**, the orphaned grandchild included → verified by `node --test plugins/goal/tests/gate-group-run.test.ts plugins/goal/tests/bounded.test.ts`.
- **R2 — nothing survives a command that exits on its own**, green or red → verified by the same command.
- **R3 — stopping leftovers never changes the verdict**: a green command whose leftover was stopped is still green; a command stopped on its clock still fails as it does today → verified by the same command.
- **R4 — every stop is reported**: the cause (clock reached after N s, or leftovers after exit) and one line per stopped process with its pid and command line; a command that left nothing behind adds no such line → verified by the same command.
- **R5 — the gate stops only what it started**: a process outside the command's tree is still running after the gate stopped the command → verified by the same command.

## States, invariants & transitions

- **States** (one declared command): `running` · `exited, nothing left` · `exited, leftovers alive` · `clock reached, tree alive` · `stopping` · `done, reported`.
- **Invariants:**
  - **I1** — when the gate moves on from a command, no process of that command's attached tree is alive. Sequence test: a tree whose members ignore SIGTERM and keep spawning while being stopped still ends with nothing alive. Owner: iteration 1.
  - **I2** — the verdict depends only on the command's exit code and the clock, as today. Owner: iteration 1.
  - **I3** — every stopped process is reported once; no stop, no report. Owner: iteration 1.
  - **I4** — the gate stops only processes in the tree of a command it started. Sequence test: a sibling process started outside the command survives. Owner: iteration 1.
- **Transition matrix:** see the contract `issue-182-spec.md`; the service rows belong to the second plan.

## Delivery strategy

Additive in behaviour that anything reads: no plan in the repository relies on a process surviving its command (`.claude/plans`, `.goal/plans`, measured on `dadaefc`), and `bounded()` / `spawnOptions()` have no consumer outside `plugins/goal`. No flag: a leftover nobody declared is the defect, not a mode. Every command still enters through the same `runner.run(bounded(command), [], spawnOptions())` call, so the six call sites keep their shape.

## Files NOT to touch

- `plugins/goal/src/core/plan.ts` (the service keys are the second plan's)
- `plugins/goal/src/gate/commands.ts`, `plugins/goal/src/gate/bite.ts`, `plugins/goal/src/gate/ship.ts`, `plugins/goal/src/run/sweep.ts` (call sites keep their shape)
- `plugins/goal/src/adapters/claude/` (agent sessions are the runner's)

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

### Iteration 1 — Every declared command runs in its own process group, stopped and reported as a whole
- [x] Not done yet
- **Goal:** When the gate is done with a declared command, on its clock or after it exits, nothing the command started is still running, and the gate's output lists what it stopped.
- **Shippable after it:** an unattended run no longer leaves orphaned test runners loading the machine; a gate output shows the pid and command line of every leftover it stopped.
- **Files to touch:** `plugins/goal/src/gate/group-run.ts` (new: runs the command in its own process group, enforces the clock, stops the group on the clock and after exit, lists what it stopped, returns the command's verdict), `plugins/goal/src/gate/bounded.ts` (routes `bounded()` through it, rewrites the header that called the surviving grandchild "scope"), `plugins/goal/tests/gate-group-run.test.ts` (new), `plugins/goal/tests/bounded.test.ts`
- **Business rules covered:** R1, R2, R3, R4, R5 · invariants I1–I4
- **Delivery:** additive; no flag
- **Not machine-verifiable:** the wrapper's behaviour on Linux is proven by the Ubuntu CI run, not by a local gate

Implementation notes, verified by a probe on macOS (Node 24): a child spawned with `detached: true` leads its own process group, and `process.kill(-pgid, 'SIGKILL')` stops the orphaned grandchild too; `ps -A -o pid=,pgid=,command=` lists the members to report. The group can already be empty when the kill lands (`ESRCH`), which must be tolerated, and stopping repeats until the group is empty. A command stopped on its clock keeps failing exactly as today for its callers (`status !== 0`), and `GOAL_CMD_TIMEOUT` keeps its meaning. No module header comment: `scripts/no-module-headers.sh` refuses one.

```gate
test_files=plugins/goal/tests/gate-group-run.test.ts plugins/goal/tests/bounded.test.ts
impl_files=plugins/goal/src/gate/group-run.ts plugins/goal/src/gate/bounded.ts
max_diff=350
commit_msg=fix(goal): stop every process a gate command leaves behind
# rule: R1–R5 — nothing a declared command started survives it, every stop is reported, verdicts and foreign processes untouched
gate1=node --test plugins/goal/tests/gate-group-run.test.ts plugins/goal/tests/bounded.test.ts
# rule: the goal plugin remains type-safe
gate2=node node_modules/typescript/bin/tsc --noEmit
# rule: the project lint holds
gate3=node node_modules/eslint/bin/eslint.js --config eslint.config.js plugins scripts
```

## Out-of-band decisions captured during grill

- Q: How does the gate stop a whole tree while staying synchronous?
  A: A Node wrapper launched by `spawnSync` runs the command in its own process group (~50 ms per command); not an async rewrite of the gate.
- Q: How should the execution sessions handle commits and the PR?
  A: `commit+pr`, pushing to `origin`.
- Q: Which delivery mode applies?
  A: `no-bc-break`, recorded without a question: the blast radius is empty.
- Q: One plan or two?
  A: Two chained plans: this one, then `issue-182-services-spec.md` once this one has merged.
