# Loops: what each kind is for

Several unrelated things get called "the loop", and conflating them produces designs that
cannot work. The distinction that decides everything is **where a loop runs**, because that is
what fixes whether it can wait: a process can sleep, a session has to be woken, a scheduler
outlives both.

Four loops exist in this plugin. Three of them run inside one Node process. The fourth is a
command that has never been executed once.

---

## The loop that runs the work: `goal-run.ts`

A plain `for` over the plan's unchecked boxes: implement, publish, next.

**The work list is known before the loop starts, so the loop is a `for` and not a
convergence.** Nothing an iteration does changes which iterations remain; a refusal is
`process.exit`, not a `break` with a recovery branch. Any shape that keeps going until nothing
new is found belongs upstream, where the plan is still being written. Against a frozen plan it
would only be a way to keep going after a refusal, which is the one thing the design refuses.

Two properties of the loop body are easy to read backwards, so state them plainly:

- **Publication is inside the loop, for every iteration but the last.**
  `goal-run.ts` calls `publisher.publish(n)` as each iteration lands, and skips it on the
  final one. The skip is keyed to `iterations[iterations.length - 1]`, the last of the *requested*
  list, never to whichever iteration a halt lands on: every iteration that lands publishes in the
  same loop body, immediately. On a 15-iteration run refused at iteration 4, the three that landed
  are all on the remote.
- **The global Definition of Done runs after the loop, and the last push waits behind it.**
  `goal-run.ts` calls `close()`, `run/close.ts#close` replays `gate dod` against the whole branch,
  and only on a green verdict does `run/close.ts` publish the iteration held back.
  `gate/ship.ts` describes that check as *"the barrier replayed once before anything ships"*.
  On a one-iteration plan that is literally true. On a longer one it is a barrier in front of the
  last slice and behind all the others, which is a real decision (a halt leaves something
  readable rather than an invisible branch), but not the one the barrier's own words claim.

## The loop that proves the work first: `goal-run.ts`

Before a single iteration is handed to an implementer, every unchecked one is put through
`gate check`. **A plan that would fail on its third iteration never spends the first two.**

This shape has no box in the taxonomy below. It does not wait, converge or fan out: it walks a
work list to reject it before consuming it, which is the same instinct as the base sweep
(`run/preflight.ts`) applied to the plan's structure rather than to the tree.

It is also where the run's contract is captured: one `plan_hash` per iteration, carried into
`runIteration` and into `close`, and beside it the ticked set. The hash alone does not cover ticks:
`gate/plan.ts` normalizes every `- [x]` back to `- [ ]` before hashing, so an untick moves
nothing in it. **That is why the ticked set travels separately**: `gate/ticked.ts` compares
what `check` published against what is on disk at `commit` and halts on any iteration that
disappeared (`goal-gate.ts`), for the length of this run.

## The loop that waits: `run/iteration.ts`

A quota window is detected from the shape of a failed implementer call, slept through, and the
**same** iteration retried, bounded by `GOAL_RUN_QUOTA_MAX_RETRIES` (default 3) and defaulting
to a 1800-second sleep.

This is the line this document previously got wrong, and getting it wrong had a cost: it said a
script cannot sleep, so the waiting had to be lifted to the session with `/loop` and
`ScheduleWakeup`, and `autonomous-architecture.md` repeated it. A process can sleep. Once layer
2 stopped being a workflow, the wait came back down to the iteration boundary where the state
already lives, and no session-level mechanism was ever needed.

Safe for the reason the whole design is resumable: the durable state is the plan's checkboxes,
so a relaunch resumes at the first unticked box and a wait needs no state at all.

**A sleeping loop is indistinguishable from a stuck one from outside.** The log has to say so
(it does, once, before sleeping: `run/iteration.ts`), or one invisible wait has been traded
for another.

## The loop nobody has run: `skills/supervise/SKILL.md`

The only loop written since, and the only one at session level: launch `node goal-run.ts` in the
background, wait for it to exit, read the exit code, classify a halt as a plan fault or an
implementation fault, repair the plan inside a closed set or discard the tree, relaunch **once**,
then stop.

Two decisions in it are worth more than the procedure:

- **Classify before repairing, never the reverse.** The two halts it was written from exited with
  the same code and the same message and needed opposite responses. Getting the call wrong either
  burns the implementer's real work or ships a plan quietly rewritten to stop refusing it.
- **One relaunch, then stop** (`skills/supervise/SKILL.md`). The bound is not a budget, it is a
  refusal: *"an agent that keeps relaunching optimizes for the run continuing, not for the work
  being right."*

It has never been executed. Neither has anything it is the sole caller of: `src/plan-guard.ts`,
`src/transcripts.ts` and `agents/goal-session-auditor.md` are referenced by `skills/supervise/SKILL.md` and
by their own tests, and by nothing else.

The evidence it classifies from is written. `skills/supervise/SKILL.md` says to read the gate's own
`HALT` block back from the run log, and on a gate refusal `run/iteration.ts` passes
`verdict.stdout` and `verdict.stderr`, concatenated, to `reporter.record()`, which appends them
to the run's own log, `.claude/goal-runs/<work-id>/<run-id>/.run.log` (`run/report.ts#record`).
`tests/goal-run-halt-log.test.ts` asserts the block
reaches the log even when the gate splits it across both streams. **What is untested is the
classification itself, not its input.**

---

## The taxonomy, and what it is still for

| | Where it runs | Can it sleep? | Survives the session? | Used here |
|---|---|---|---|---|
| **a loop inside a process** | the process | **yes** | no | the three inside `goal-run.ts` |
| **`/loop` + `ScheduleWakeup`** | the main session | yes | no | nowhere: `/goal:supervise` is this shape, hand-rolled |
| **`Monitor`** | background process | n/a, event-driven | no | nowhere |
| **`CronCreate`** | the main session | yes | **no**: in-memory, dies with the session | nowhere |
| **`RemoteTrigger`** | claude.ai, cloud | yes | **yes** | nowhere |

Four of the five primitives are unused, and the table earns its place anyway, because it is what
stops the same mistake being made twice. `CronCreate` is session-only: it is not the tool for "run
my plan at 3am while I sleep", however much its name suggests otherwise. `RemoteTrigger` is the
only row that survives the terminal closing.

## Recovery classes: what may be retried, and what may not

The rule that survived every generation: **recovery applies to the infrastructure around the
verification, never to the verdict.** A test that fails is not a signal to be recovered from.
Map an observable failure signal to an inferred failure class, attach a targeted action and a
budget, then re-verify.[^selfheal]

| Signal | Class | Recovery | Built? |
|---|---|---|---|
| implementer call reports a usage limit | the model is unavailable | sleep, retry the same iteration | yes, budget 3 (`run/iteration.ts`) |
| gate exits anything but 0 or 1 | **no verdict exists** | none: pause, tree untouched | yes (`run/iteration.ts`) |
| gate exits exactly 1 | the code or the contract is wrong | none: halt, verdict already in the log | yes (`run/iteration.ts`) |
| `git push` rejected, `gh` non-zero | transient infrastructure | retry the command | no: publication blocks stickily (`run/publish.ts`) |
| gate output matches a known flaky signature | suspected flakiness | re-run **for information only**, verdict unchanged | no |

The first three rows are why "a halt is final" is no longer the whole rule and did not weaken:
the run distinguishes *the gate refused* from *the gate could not be asked*, which the old binary
could not express and which is exactly the distinction `/goal:supervise` has to make afterwards.

Anti-pattern the same literature names: retries and circuit breakers do not distinguish a timeout
from stale context, a malformed argument, or semantic drift. **A retry policy that cannot name the
class it is recovering from is a token furnace.**

## The gap that is still open

Nothing ever learns whether CI went red. A run no longer stops at PR creation (`close()` replays
the Definition of Done, marks the pull request ready, and invokes a reviewer, a lens and an auditor),
but every one of those happens inside the process, and no `gh pr checks` is called anywhere in
`scripts/` or `src/`. The run exits, and nothing outside it ever asks. `Monitor` is the shape that fits: a
background script whose every stdout line becomes a notification.

Coverage rule that matters more than it looks, and that the exit codes already respect: **the
filter must match every terminal state, not only the happy one.** `goal-run.ts` publishes
four (landed, halted, refused, paused) precisely so that a watcher cannot mistake one for
another. A monitor grepping only for the success marker stays silent through a crash, and silence
is indistinguishable from "still running".

## Truly unattended, and why the scheduling is not the blocker

The gates are *your project's* commands, dockerized. A cloud routine has to be able to run
`make php/qa`, or it can drive the loop but not verify it, and an unverifiable loop is exactly
what this whole design refuses. **Settle the environment question before the scheduling one.**
Also worth knowing: interactively-authenticated MCP servers may simply be absent in headless runs.

---

[^selfheal]: *Self-Healing Agentic Orchestrators for Reliable Tool-Augmented LLM Systems*: <https://arxiv.org/pdf/2606.01416>
