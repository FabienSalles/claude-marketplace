# Spec: The gate's commands leave no process behind, except the services a plan declares

Source: ticket 0d of goal-multi-provider (gh issue #182)
Source plan: /Users/fabiensalles/projects/github/claude-marketplace/.claude/plans/goal-multi-provider-backlog.md
Work-id: issue-182
Status: spec — functional contract settled; /goal:plan builds the executable plan.
Adversarial grill: ran — it surfaced declared services (Q6–Q12) and the rule that the gate only ever stops what a command or a service started.

## Business intent

**Problem.** The gate's wall clock on a declared command kills only the direct child it started; anything that command forked survives (`plugins/goal/src/gate/bounded.ts:8-12`, `spawnOptions()` at `:91-97`). During the issue-145 run (PR #175), `GOAL_CMD_TIMEOUT` (900 s) killed `gate1`'s shell, but three `goal-run.ts` processes and their parent `node --test` kept running for 17 to 57 minutes. The machine's load average reached 14, the next preflight measured the suite at 84.28 s against its ceiling and refused to start until the orphans were killed by hand (#182, Evidence). A command that exits on its own can leave the same kind of leftover behind, and nothing stops it either.

**Objective.** When the gate is done with a declared command, nothing that command started is still running, unless the plan declared it as a service, and a declared service lives exactly as long as the iteration that declares it, always running the code the gate is judging.

**Success signal.** After any unattended run, finished or refused, `ps` shows no process descended from a gate command or a declared service, and a later preflight's measurements are not skewed by leftovers of an earlier gate.

**Affected.** Every unattended run on the developer's machine, and every plan whose tests need a long-lived process (a server, a database). Today such a plan either leaks the process or cannot express it; after this, it declares the service and the gate owns its whole life.

Stopping leftovers alone would break any block where one command starts a process another command uses. Declared services keep that possible on purpose, so the only processes allowed to outlive a command are the ones the plan names, and the gate stops those too, at a moment it controls.

## Reproduction

```text
$ GOAL_CMD_TIMEOUT=2 node repro.ts   # spawnSync(`sh -c 'sleep 61; true' <marker> & sleep 62`, spawnOptions()), then pgrep -fl <marker>
status=null signal=SIGKILL error=spawnSync /bin/sh ETIMEDOUT
survivors after timeout: 44059 sh -c sleep 61; true goal182-44057
```

Run on `origin/main@dadaefc`, 2026-10-10: the gate's clock fired and killed the shell, and the grandchild kept running.

## Scope IN

- Every declared command the gate runs: the `gateN` and `dodN` lines, the bite re-run, the regression-wall replay of earlier iterations, the preflight base sweep.
- Processes a command leaves behind, whether the gate stopped it on its clock or it exited on its own.
- Services declared in an iteration's gate block: start, readiness, restart, failure, stop.
- What the gate reports about every process it stopped.

## Scope OUT

- A process that deliberately detaches from the command (new session, daemonization). A process orphaned because the command died is **not** detached and stays in scope.
- The run itself being interrupted (Ctrl+C, SIGTERM, crash) while a command or a service runs: the runner's signals belong to tickets 4b and 7. An interrupted run may leave a service alive.
- The implementer, lens, reviewer and auditor sessions: the runner owns them.
- Services for the global Definition of Done (`dodN`): a service belongs to one iteration's gate block only.
- A per-command timeout declared in the plan.

## Business rules (functional DoD — one observable criterion per rule)

- **R1 — nothing survives a command stopped on its clock.** → observed when: a command that starts a background process and then hangs past the clock leaves no process from it running once the gate moves on, the orphaned grandchild included.
- **R2 — nothing survives a command that exits on its own.** → observed when: a command that starts a background process and exits green (or red) leaves no process from it running once the gate moves on.
- **R3 — stopping leftovers never changes the verdict.** → observed when: a green command whose leftover was stopped is still judged green; a command stopped on its clock is still judged as it is today.
- **R4 — every stop is reported.** → observed when: the gate output names the cause (clock reached after N s, or leftovers after exit, or service stopped) and one line per stopped process with its pid and command line; a command that left nothing behind adds no such line.
- **R5 — the gate stops only what it started.** → observed when: processes outside the command's or the service's own tree (the runner, the gate, a sibling worktree's run, the developer's own processes) are still running after the gate has stopped a command or a service.
- **R6 — a declared service lives across its iteration's gates.** → observed when: a process declared as a service in an iteration's gate block is running during every `gateN` of that iteration, and nothing of it is running once the iteration ends, whatever the outcome (landed, refused, halted).
- **R7 — no gate starts before its services are ready.** → observed when: each service declares a readiness command; the gate re-runs it until it succeeds, within the clock, and runs no `gateN` of the iteration before every service's readiness has succeeded.
- **R8 — a service that never gets ready, or dies, refuses the iteration.** → observed when: a service whose readiness never succeeds within the clock, or that stops between two gates, leaves the remaining gates unrun, the iteration refused, and the output naming the service, what happened (never ready, or died after which gate) and its output. The gate never restarts it silently.
- **R9 — a service always runs the code the gate is judging.** → observed when: each time the gate changes the tree (the bite sets the implementation aside, puts it back, or a new implementer attempt rewrites it), a service whose declared paths changed is restarted before the next gate; a service with no declared paths is always restarted; a service whose declared paths did not change keeps running.
- **R10 — a service that cannot start without the implementation does not prove a bite.** → observed when: during the bite, a service that fails to get ready on the tree without the implementation makes the gate refuse the iteration, saying the bite is unproven, rather than counting it as a bite.
- **R11 — a replayed command runs with its own services.** → observed when: the regression wall or the preflight sweep replays an earlier iteration's gate command with the services that iteration's block declares running and ready, and stops them once the replay is done.
- **R12 — several services start in order and stop in reverse.** → observed when: services start in their declaration order, each ready before the next starts, and stop in the reverse order.

## States, invariants & transitions

- **States** (one declared command): `running` · `exited, nothing left` · `exited, leftovers alive` · `clock reached, tree alive` · `stopping` · `done, reported`.
- **States** (one declared service): `not started` · `starting (readiness pending)` · `ready` · `restarting` · `failed (never ready | died)` · `stopped`.
- **Invariants:**
  - **I1** — when the gate moves on from a command (next command, verdict, commit, restore after bite), no process of that command's attached tree is alive, except declared services. Owner: the gate, on the one path every call site shares. Transverse.
  - **I2** — the verdict depends only on the command's exit code and the clock, as today, plus R8 and R10 for services. Owner: the gate.
  - **I3** — every stopped process is reported once; no stop, no report. Owner: the gate.
  - **I4** — the gate stops only processes in the tree of a command or a service it started. Owner: the gate.
  - **I5** — a gate command runs only while every service of its block is ready and runs the tree being judged. Owner: the gate.
  - **I6** — at the end of an iteration, whatever its outcome, no service of that iteration is alive. Owner: the gate.
- **Transition matrix** (resolved cells):
  - (`running`, clock reached) → `clock reached, tree alive` → `stopping` → `done, reported`; verdict as today (I1, I2, I3).
  - (`running`, command exits) → `exited, nothing left` → `done` with no stop line; or → `exited, leftovers alive` → `stopping` → `done, reported`; verdict from the exit code (R2, R3).
  - (`stopping`, a process ignores a polite stop or spawns children) → still `done` with nothing alive (I1).
  - (service `starting`, readiness succeeds) → `ready`; (`starting`, clock reached) → `failed (never ready)` → iteration refused (R8).
  - (service `ready`, dies between gates) → `failed (died)` → remaining gates unrun, iteration refused (R8).
  - (service `ready`, tree changed on a declared path or no paths declared) → `restarting` → `ready` before the next gate (R9); tree changed elsewhere → stays `ready`.
  - (service `restarting` during the bite, never ready) → bite unproven, iteration refused (R10).
  - (service any state, iteration ends) → `stopped`, reported (I6).
  - (gate command starts a process meant for a later command, not declared as a service) → stopped at the end of that command (I1); the later command fails on its own merits.
  - (run interrupted) → out of scope.

## Deferred decisions

- none

## Files (as found in source)

- `plugins/goal/src/gate/bounded.ts` — `spawnOptions()`, the wall clock every declared command runs under; its header calls the surviving grandchild "scope, not a bug".

## Flags for /goal:plan

- `spawnSync`'s `timeout` signals only the direct child: stopping a whole attached tree on the clock, and reaping after a normal exit, probably means leaving `spawnSync` or running the command in its own process group. The choice reaches every call site of `spawnOptions()`.
- Declared services need a new kind of entry in the gate block (the service command, its readiness command, its declared paths), parsed and validated with the rest of the plan; `/goal:plan`'s template and the preflight's plan checks must know it.
- R9 needs to know which paths the bite, the restore and a new attempt change; the bite and the attempt loop are where those tree changes happen.
- Two runs in sibling worktrees can declare services on the same port; nothing in this contract arbitrates that.
- The preflight's wall ceiling measures the base sweep: services starting and stopping inside it now count toward that measurement.
- Ticket 0d grew from "nothing survives" to declared services in this grill, against an appetite of one day per ticket; the plan may need to split it into several plans.

## Notes / decisions from source

- Q1: leftovers are stopped whether the command was stopped on its clock or exited on its own.
- Q2: only processes that stay attached are in scope; a deliberate detach is out.
- Q3: a stopped leftover never changes the verdict.
- Q4: the report gives the cause and one line per stopped process (pid, command line).
- Q5: an interrupted run is out of scope (tickets 4b, 7).
- Q6–Q7: a command may start a process meant for later commands only by declaring it as a service, stopped at the end of the iteration; services are in this ticket.
- Q8: a service serves its own iteration's gates only, and must be restarted when a change affects it.
- Q9: a service declares the paths it depends on; it restarts only when one of them changed, and always when none is declared.
- Q10: readiness is a declared command the gate re-runs until it succeeds, within the clock.
- Q11: a service that never gets ready or dies refuses the iteration, with no silent restart.
- Q12: a service that cannot start without the implementation leaves the bite unproven.
