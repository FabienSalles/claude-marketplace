# Parity checklist

A rewrite is judged guarantee by guarantee. The question is never "does the new thing do
something similar" but "is the same property still held, and by what". The class of bug this
exercise exists to catch is a property held *implicitly* by the old design's shape, silently lost
when the shape changes — the kind no test fails on, because no test was ever written for a thing
nobody had to state.

The file's name records the first exercise: the prose of `commands/auto.md` against its rewrite as
a Workflow. That rewrite is no longer what runs. The ledger below is the one that was never taken,
for the rewrite that actually shipped — **`scripts/goal-run.sh` against `scripts/goal-run.ts`**.

Three generations are checked in at once, and only the third executes a run today:

| | Size | Standing |
|---|---|---|
| `workflows/goal-auto.js` | 941 lines | abandoned, still reachable: `commands/auto.md:220` launches it and `scripts/goal-launch.sh:133` opens a session on `/goal:auto` |
| `scripts/goal-run.sh` | 594 lines | frozen, as the A/B reference the test harness selects with `GOAL_RUN_IMPL` |
| `scripts/goal-run.ts` + `scripts/run/*.ts` | 938 lines over 8 modules | the runner. `node goal-run.ts <plan>`, which is what `/goal:supervise` launches |

Status legend: **held** (same property, same enforcement) · **held verbatim** (the same sentences,
carried across on purpose) · **gained** · **lost** · **held by neither** (the port was faithful,
and the property was never mechanical to begin with).

## Phase 1 — Preflight

| Guarantee | Status | Where |
|---|---|---|
| Ten refusals, in one order: policy, remote, branch, clean tree, ignored plan directory, no cleanup iteration in a feature plan, no lock held, base green, branch caught up, deny rule | **held verbatim** | `run/preflight.ts` numbers 1 to 10 exactly as `goal-run.sh:98-213` does, wording included. Its own header says so. |
| Every refusal runs before the lock is taken — a run that starts wrong is worse than one that never starts | **held** | `preflight` is called at `goal-run.ts:54`, `createLock` at `:85`. |
| The base sweep replays each distinct command once, not once per declaration | **gained** | `run/sweep.ts:49` de-duplicates and `:62` announces the reduction. `goal-run.sh:174` runs the awk output line by line, so a six-iteration plan repeating the same command sweeps it six times. |
| Each passing check narrates | **gained** | `preflight.ts:100-104`, `:116`, `:128`, `:155`, `:173`. Bash narrates only the check it skips (`goal-run.sh:161`). On a run nobody is watching, the account of what passed is what says where a refusal came from. |
| "Only the gate commits" is a fact, not a sentence in the plan | **held by the HEAD snapshot alone** | The deny rule proved three substrings appeared somewhere in a file, which an ALLOW list naming the same verbs satisfied. `goal-run.sh:208` still greps for them; the current runner dropped the check rather than repair it. What holds the claim is `iteration.ts:98`/`:154`, which compares HEAD around the implementer and halts when it moved. |

## Phase 2 — The loop

| Guarantee | Status | Where |
|---|---|---|
| One implementer per iteration, the runner never implements | **held** | `iteration.ts:111` spawns `claude -p --agent goal:goal-run-implementer`, as `goal-run.sh:457` does. Held by discipline in both — a shell and a Node process can each write to disk. |
| The iteration travels as text; the plan's path never does | **held** | `iteration.ts:56-74`. Its header records why: handing that path over is what made a real run read the plan in another checkout, take its parent as the repository root, and write the whole iteration into the wrong tree with a correct `cwd` throughout. |
| HEAD before and after tells a committing implementer from one that wrote nothing | **held** | `iteration.ts:98`, `:154`, `:157` — `goal-run.sh:444`, `:479`. Two different failures, two different messages. |
| A quota window pauses and retries the same iteration, bounded | **held** | `iteration.ts:104-152` — `goal-run.sh:449-475`. Same defaults, same exit. |
| **The gate's own words reach the run's account** | **lost** | `goal-run.sh:500` appends the verdict to the log on every path and says it again on both refusal exits (`:517`, `:523`). `iteration.ts:173` captures that stdout and reads only `verdict.status`. The `HALT / REASON: / DETAIL:` block `gate/halt.ts:8` writes never leaves the process. |
| The implementer's own output survives the run | **traded** | Bash appends the whole capture to the log (`goal-run.sh:461`). The port renders each tool use as one line (`iteration.ts:29-54`) and records the session id beside the run (`report.ts:46-50`), so the transcript is findable rather than transcribed. Denser, and it loses the model's prose. |

## Phase 3 — Publication

| Guarantee | Status | Where |
|---|---|---|
| A draft pull request opens at the first landing and its body is rewritten after every one after it | **held** | `publish.ts:57-60` — `goal-run.sh:247-250`. A run that halts partway leaves something a human can read. |
| A publication failure is sticky for the rest of the run, never retried per iteration | **held** | `publish.ts:64-66` — `goal-run.sh:252`. Six sites set it in each. |
| The `## Landed` section names the iterations that landed | **gained, structurally** | `publish.ts:47-55` maps each landed number through `iterationHeading`. `goal-run.sh:235` builds a grep alternation out of the accumulated string, and the leading space that string always carries makes the alternation start empty — PR #24's `## Landed` was blank for every landed iteration, in a script that had already shipped across seven of them. A lookup per number cannot fail that way; the port did not repair the pattern, it stopped assembling one. |
| Whether a pull request already exists is asked of `gh`, not assumed | **held** | `publish.ts:128-134` — `goal-run.sh:308-310`. |
| History is reshaped before the first push | **held by neither** | Both count `fixup!`/`squash!` subjects and refuse (`publish.ts:74-88`, `goal-run.sh:259-270`). Both open on a comment saying reshaping happens here, and neither reshapes. The refusal is the whole behaviour, and it is the right one — rewriting history nobody has reviewed, unattended, is worse than stopping. What drifted is the comment. |

## Phase 4 — Close

| Guarantee | Status | Where |
|---|---|---|
| The global Definition of Done is replayed once over the whole plan | **held** | `close.ts:47` — `goal-run.sh:537`. |
| …as the last barrier before anything ships | **held by neither** | `goal-run.ts:92-98` calls `publisher.publish(n)` inside the loop — push at `publish.ts:100`, pull request at `:139` — and `close` runs the DoD afterwards at `:100`. `goal-run.sh:511` orders it the same way, `mirror` inside the iteration and the DoD after the loop. `gate/ship.ts:11` still describes itself as "the barrier replayed once before anything ships" and its halt message still says nothing has been pushed. Both sentences are false of both runners. |
| The pull request is marked ready only if *this* run opened one, never one `gh` merely reports | **held, and typed** | `close.ts:29-33` declares a `PublishState` threaded from the publisher's own bookkeeping. `goal-run.sh:544` reads three globals — `publishes` at `:218`, `pr_open` and `pr_blocked` at `:243-244` — three hundred lines from where it tests them. Same condition, one of the two checkable by a compiler. |
| The lens and the auditor are advisory: asked, logged, never able to change what happens next | **held** | `close.ts:107`, `:123` — `goal-run.sh:567`, `:583`. |
| Their answers outlive the process that asked for them | **lost, then restored** | `goal-run.sh:568` and `:584` append them to the log; the port dropped it, so a lens finding existed only for as long as the run. `report.ts:25-32` is the repair, and its comment names the loss. |

## What the port lost, and what it costs

**The gate's refusal is the one thing a halted run has to say, and the port stopped saying it.**
`gate/halt.ts:8` writes `HALT`, a `REASON:` and a `DETAIL:` on its own stdout. `iteration.ts:173`
captures that stdout and never reads it: the halt path at `:186-193` prints a wall message of its
own and exits. Neither stdout nor `<plan>.run.log` carries the block.

That is not a cosmetic loss, because something downstream is written against it.
`commands/supervise.md:63-65` instructs its classifier to *"read the log tail back to the gate's
own `HALT` block — `REASON:` and `DETAIL:`, written by `plugins/goal/scripts/gate/halt.ts`. That
text is the only evidence there is; do not re-run the gate to get a second opinion."* So the one
piece of evidence the supervisor is forbidden to reconstruct is the one the runner never writes. A
classifier whose log stops at `STOP iteration 5 was refused by the gate` can tell a plan fault from
an implementation fault only by guessing, and guessing wrong means either burning the implementer's
real work or quietly rewriting a plan until it stops refusing.

**The advisory agents' answers.** Lost the same way, and already repaired: `report.record`
(`report.ts:28`) appends them to the log, and `close.ts:81`, `:108`, `:124` call it. It is worth
recording as a loss anyway, because it was found by reading rather than by a failing test — the
same way the halt block would have to be.

## What the port gained

**Modules a test can call.** `tests/goal-run-close.test.ts:7` imports `close` and
`tests/goal-run-publish.test.ts:7` imports `createPublisher`, then drives them against a fake
reporter with no process spawned at all. A shell function is reachable only by running the script
that contains it, which is why every assertion about `goal-run.sh` has to go through a fixture
repository.

**A bug class removed rather than fixed.** The `## Landed` section, above. What went out with the
grep is not one bug but the room for it: a pattern assembled out of run state can be malformed by
that state, a lookup per number cannot be.

**A publication state that is declared.** `PublishState` at `close.ts:29-33` replaces three shell
globals whose only definition was the order in which they happened to be assigned.

## What neither runner carries, and the Workflow did

Recorded because `goal-auto.js` is still checked in and still invocable, so somebody will read it
and take it for a description of what runs.

- **A cost ceiling.** `goal-auto.js:53` declares an 80k-token floor and `:751` stops the loop under
  it. It was already inert there: `:664` logs that the floor does nothing unless a directive armed
  `budget.total`. Neither `goal-run.sh` nor `goal-run.ts` has any token accounting at all — no
  budget, no turn cap, no wall-clock bound.
- **Parallel tracks.** Removed on purpose, on 2026-07-28. The argument is `why-not-parallel.md`.
- **A remote steering channel.** The control panel and the `goal:stop` label live only in
  `goal-auto.js:406-419`. A run launched by `node goal-run.ts <plan>` is stoppable by killing the
  process, and `run/lock.ts:36-44` is what hands the plan's lock back when you do.
- **A check the Workflow never had, and both later runners do.** The HEAD comparison around the
  implementer (`iteration.ts:98`, `:154`) has no equivalent anywhere in `goal-auto.js`. The default
  entry point — `/goal:auto`, which is what `goal-launch.sh` opens — is therefore the weakest of
  the three paths. The deny rule used to be a second such check; `goal-run.sh` still enforces it and
  the current runner dropped it, for reasons `steering-and-injection.md` gives in full.

The first real run of that generation stays worth its record: `.claude/plans/issue-3-spec.md`, four
iterations, 2026-07-26, **82 438 tokens** across 23 agents in about thirty minutes, four commits
each carrying the `commit_msg` its slice froze. Its auditor's most useful finding was not about the
plan it ran — the most expensive iteration produced the smallest diff of the run, +16/−12 across 6
files. Cost tracks the number of files and gates touched, not the number of lines written, which is
what `max_diff` bounds.

## The ledger nothing enforces

`GOAL_RUN_IMPL` is the seam the two runners were meant to be proven equal through:
`tests/support/goal-run-harness.ts:13` reads it, `:254` spawns `bash goal-run.sh` or
`node goal-run.ts` accordingly. **Nothing ever sets it.**
`.github/workflows/validate.yml:263` runs `bash plugins/goal/tests/run.sh`, which invokes
`node --test` once, with the default. Measured, both ways:

| | Passed | Skipped |
|---|---|---|
| `bash plugins/goal/tests/run.sh` (what CI runs) | 188 | 6 |
| `GOAL_RUN_IMPL=node bash plugins/goal/tests/run.sh` | 194 | 0 |

The six are the behaviours the port added and the shell never received, each guarded by a
`NODE_ONLY` skip reason. `tests/run.sh` refuses an unreadable summary, a failure, and an empty
suite — it never reads the `skipped` line, so they pass out of sight. CI proves the frozen runner
and, for anything above module level, proves nothing about the one that ships.

The A/B those two rows exist to feed has not been run: `git log -- plugins/goal/scripts/goal-run.sh`
shows two commits, none since the port, and no comparative measurement is checked in. A frozen
reference nobody measures against is a second copy of the contract, not a control.

## Known gaps

1. **The contract is written twice.** Thirty-one text fragments of forty characters or more are
   byte-identical between the two runners: the ten refusals, the implementer's brief, the pull
   request body, the lens and auditor briefs. `run/preflight.ts:1` states the intent — *"worded
   exactly as `goal-run.sh` words them"* — which is exactly why nothing but this ledger keeps them
   equal. The port was planned in three steps and stopped after two: the third, converting what no
   longer needs a subprocess into imports, is what would have removed the duplication.
2. **`workflows/goal-auto.js` is verified by nothing.** `tsconfig.json` scopes the type check to
   `plugins/goal/scripts/**` and `plugins/goal/tests/*`, so `tsc --noEmit` never opens it, and no
   `node --check` runs anywhere in CI. Its only coverage is `tests/goal-auto.test.ts` under a
   runtime rebuilt by hand in `tests/support/workflow-runtime.ts` — a simulation, which is what
   the earlier edition of this file already conceded while that generation was the live one. It
   remains the file `/goal:auto` and `goal-launch.sh` reach.
3. **A killed process still leaves the run lock held.** `run/lock.ts:36-44` releases on exit, INT
   and TERM. `kill -9` is not one of them. Recovery stays prose — the preflight's check 7, then
   `goal-gate.ts unlock` — and that remains the right trade: a lock that frees itself on a signal
   is a lock that frees itself while another run holds it.
