# Loops — what each kind is for

Several unrelated things get called "the loop", and conflating them produces designs that
cannot work. The distinction that decides everything is **where a loop runs**, because that is
what fixes whether it can wait: a process can sleep, a session has to be woken, a scheduler
outlives both.

Four loops exist in this plugin. Three of them run inside one Node process. The fourth is a
command that has never been executed once.

---

## The loop that runs the work — `goal-run.ts:92-98`

A plain `for` over the plan's unchecked boxes: implement, publish, next.

**The work list is known before the loop starts, so the loop is a `for` and not a
convergence.** Nothing an iteration does changes which iterations remain; a refusal is
`process.exit`, not a `break` with a recovery branch. Any shape that keeps going until nothing
new is found belongs upstream, where the plan is still being written — against a frozen plan it
would only be a way to keep going after a refusal, which is the one thing the design refuses.

Two properties of the loop body are easy to read backwards, so state them plainly:

- **Publication is inside the loop.** `publisher.publish(n)` pushes and rewrites the pull
  request on every landed iteration (`run/publish.ts:100`, `:139`). A run that halts at 3 of 15
  has already put three iterations on the remote.
- **The global Definition of Done runs after the loop, not inside it.** `goal-run.ts:100` calls
  `close()`, and `run/close.ts:47` is where `gate dod` finally replays the whole suite against
  the whole branch. `gate/ship.ts:11` describes that check as *"the barrier replayed once before
  anything ships"*. It is not a barrier: everything shipped N iterations earlier. The order is a
  real decision — a halt leaves something readable rather than an invisible branch — but it is
  not the order the barrier's own words claim, and nothing else in the run reconciles the two.

## The loop that proves the work first — `goal-run.ts:64-83`

Before a single iteration is handed to an implementer, every unchecked one is put through
`gate check`. **A plan that would fail on its third iteration never spends the first two.**

This shape has no box in the taxonomy below. It does not wait, converge or fan out: it walks a
work list to reject it before consuming it, which is the same instinct as the base sweep
(`run/preflight.ts:130-141`) applied to the plan's structure rather than to the tree.

It is also where the run's contract is captured — one `plan_hash` per iteration, carried into
`runIteration` and into `close`. Worth knowing what that hash does not cover: `gate/plan.ts:29-30`
normalizes every `- [x]` back to `- [ ]` before hashing, so **unticking a box removes an
iteration from this loop's list without moving the hash it locks**.

## The loop that waits — `run/iteration.ts:104-152`

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

**A sleeping loop is indistinguishable from a stuck one from outside.** The log has to say so —
it does, once, before sleeping (`run/iteration.ts:150`) — or one invisible wait has been traded
for another.

## The loop nobody has run — `commands/supervise.md`

The only loop written since, and the only one at session level: launch `node goal-run.ts` in the
background, wait for it to exit, read the exit code, classify a halt as a plan fault or an
implementation fault, repair the plan inside a closed set or discard the tree, relaunch **once**,
then stop.

Two decisions in it are worth more than the procedure:

- **Classify before repairing, never the reverse.** The two halts it was written from exited with
  the same code and the same message and needed opposite responses. Getting the call wrong either
  burns the implementer's real work or ships a plan quietly rewritten to stop refusing it.
- **One relaunch, then stop** (`supervise.md:112-120`). The bound is not a budget, it is a
  refusal: *"an agent that keeps relaunching optimizes for the run continuing, not for the work
  being right."*

It has never been executed. Neither has anything it is the sole caller of: `scripts/plan-guard.ts`,
`scripts/transcripts.ts` and `agents/goal-session-auditor.md` are referenced by `supervise.md` and
by their own tests, and by nothing else.

And the classifier reads evidence that is not there. `supervise.md:63-65` says to read the gate's
own `HALT` block back from the run log. `run/iteration.ts:186-193` exits on a gate refusal without
ever reading `verdict.stdout` — the block is printed by the gate into a captured buffer and
dropped. **The one loop that reacts to a halt is told to classify from output the run never
writes.**

---

## The taxonomy, and what it is still for

| | Where it runs | Can it sleep? | Survives the session? | Used here |
|---|---|---|---|---|
| **a loop inside a process** | the process | **yes** | no | the three inside `goal-run.ts` |
| **`/loop` + `ScheduleWakeup`** | the main session | yes | no | nowhere — `/goal:supervise` is this shape, hand-rolled |
| **`Monitor`** | background process | n/a, event-driven | no | nowhere |
| **`CronCreate`** | the main session | yes | **no** — in-memory, dies with the session | nowhere |
| **`RemoteTrigger`** | claude.ai, cloud | yes | **yes** | nowhere |

Four of the five primitives are unused, and the table earns its place anyway, because it is what
stops the same mistake being made twice. `CronCreate` is session-only: it is not the tool for "run
my plan at 3am while I sleep", however much its name suggests otherwise. `RemoteTrigger` is the
only row that survives the terminal closing.

## Recovery classes — what may be retried, and what may not

The rule that survived every generation: **recovery applies to the infrastructure around the
verification, never to the verdict.** A test that fails is not a signal to be recovered from.
Map an observable failure signal to an inferred failure class, attach a targeted action and a
budget, then re-verify.[^selfheal]

| Signal | Class | Recovery | Built? |
|---|---|---|---|
| implementer call reports a usage limit | the model is unavailable | sleep, retry the same iteration | yes, budget 3 (`run/iteration.ts:135-151`) |
| gate exits anything but 0 or 1 | **no verdict exists** | none — pause, tree untouched | yes (`run/iteration.ts:186-189`) |
| gate exits exactly 1 | the code or the contract is wrong | none — halt | yes (`run/iteration.ts:191-193`) |
| `git push` rejected, `gh` non-zero | transient infrastructure | retry the command | no — publication blocks stickily (`run/publish.ts:100-108`) |
| gate output matches a known flaky signature | suspected flakiness | re-run **for information only**, verdict unchanged | no |

The first three rows are why "a halt is final" is no longer the whole rule and did not weaken:
the run distinguishes *the gate refused* from *the gate could not be asked*, which the old binary
could not express and which is exactly the distinction `/goal:supervise` has to make afterwards.

Anti-pattern the same literature names: retries and circuit breakers do not distinguish a timeout
from stale context, a malformed argument, or semantic drift. **A retry policy that cannot name the
class it is recovering from is a token furnace.**

## The gap that is still open

Nothing ever learns whether CI went red. A run no longer stops at PR creation — `close()` replays
the Definition of Done, marks the pull request ready, and invokes a reviewer, a lens and an auditor
— but every one of those happens inside the process, and no `gh pr checks` is called anywhere in
`scripts/`. The run exits, and nothing outside it ever asks. `Monitor` is the shape that fits: a
background script whose every stdout line becomes a notification.

Coverage rule that matters more than it looks, and that the exit codes already respect: **the
filter must match every terminal state, not only the happy one.** `goal-run.ts:13-17` publishes
four (landed, halted, refused, paused) precisely so that a watcher cannot mistake one for
another. A monitor grepping only for the success marker stays silent through a crash, and silence
is indistinguishable from "still running".

## Truly unattended, and why the scheduling is not the blocker

The gates are *your project's* commands, dockerized. A cloud routine has to be able to run
`make php/qa`, or it can drive the loop but not verify it — and an unverifiable loop is exactly
what this whole design refuses. **Settle the environment question before the scheduling one.**
Also worth knowing: interactively-authenticated MCP servers may simply be absent in headless runs.

---

[^selfheal]: *Self-Healing Agentic Orchestrators for Reliable Tool-Augmented LLM Systems* — <https://arxiv.org/pdf/2606.01416>
