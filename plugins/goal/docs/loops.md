# Loops — what each kind is for

Two unrelated things get called "the loop", and conflating them produces designs that cannot
work. Separate them first.

| | Where it runs | Can it sleep? | Survives the session? | Good for |
|---|---|---|---|---|
| **JS loop in a workflow** | inside the script | no | no | ordering, retry, convergence, fan-out |
| **`/loop` + `ScheduleWakeup`** | the main session | yes | no | waiting, pacing, babysitting |
| **`Monitor`** | background process | n/a, event-driven | no | reacting to something changing |
| **`CronCreate`** | the main session | yes | **no** — in-memory, dies with the session | nothing durable |
| **`RemoteTrigger`** | claude.ai, cloud | yes | **yes** | truly unattended, machine off |

The single most important line in that table: `CronCreate` is session-only. It is not the
tool for "run my plan at 3am while I sleep". `RemoteTrigger` is.

---

## A. Loops inside the workflow script

Plain JavaScript, so anything is expressible. The useful shapes:

### Loop-until-budget

```js
while (budget.total && budget.remaining() > 80_000) { … }
```

Already used to shed the advisory lenses before the run hits the wall. Generalises to any
optional work: extra verifiers, a deeper review pass, a second implementation attempt.

**Guard on `budget.total`.** With no target set, `remaining()` is `Infinity` and the loop
runs to the 1000-agent cap.

### Loop-until-dry

Keep going until K consecutive rounds find nothing new. The right shape for **discovery of
unknown size** — plan gaps, edge cases, missing invariants. Wrong for anything with a known
work list, which is why the iteration loop is a plain `for`.

Best use here is upstream: `/goal:run-issue`'s adversarial grill, looping until a round of
gap-hunters returns nothing new. Dedup against everything *seen*, never against what
survived judging, or rejected findings reappear every round and it never converges.

### Bounded escalation, without weakening "a halt is final"

The current rule is absolute: a gate exits non-zero, the run is over. It is absolute because
prose could not safely carry anything finer — I would have been the one deciding whether a
failure "really matters".

A script can carry a finer rule, and the self-healing literature gives the shape: map an
**observable failure signal** to an **inferred failure class**, attach a **targeted recovery
action** and a **recovery budget**, then **re-verify after recovery** and record the
whole thing.[^selfheal] The classes worth distinguishing:

| Signal | Class | Recovery | Budget |
|---|---|---|---|
| `git worktree add` fails, `gh` 5xx, network timeout | transient infrastructure | retry the command | 2 |
| gate output matches a known flaky signature | suspected flakiness | re-run **for information only**, verdict unchanged | 1 |
| gate fails on a test assertion | the code is wrong | none — halt | 0 |
| gate fails on scope leak or spec tampering | the executor misbehaved | none — halt | 0 |

The last two rows are why this does not become "retry until green". Recovery applies to the
*infrastructure around* the verification, never to the verdict. A test that fails is not a
signal to be recovered from.

Anti-pattern the same literature names: retries and circuit breakers do not distinguish a
timeout from stale context, a malformed argument, or semantic drift. A retry policy that
cannot name the class it is recovering from is a token furnace.

### Progressive model escalation

`opts.model` and `opts.effort` are per-agent. A cheap first attempt, then one retry at a
higher tier if and only if the failure class is "the implementer produced nothing coherent",
never "the tests fail".

### Judge panel / tournament

N implementations of one hard iteration, from different angles, judged, best kept. Expensive.
Worth it only for a slice flagged as hard in the plan, and the judging inherits every
reliability caveat in `adversarial-verification.md`.

### Nested workflows

`workflow(nameOrRef, args)` runs another workflow inline, one level deep. Lets `/goal:auto`
call a review workflow at the end without inlining it.

### Queue drain

A `for` over several **plans**, not iterations: run every locked plan in `.claude/plans/`
overnight, sequentially, stopping the queue at the first halt. Nothing in the design forbids
it, and it is the natural next step once one plan runs reliably.

---

## B. `/loop` and `ScheduleWakeup` — the session-level loop

This is where **waiting** lives, because a workflow script cannot sleep and, when the quota
is gone, its agents cannot run anyway.

`ScheduleWakeup` takes a delay clamped to [60, 3600] seconds, the prompt to re-fire, and a
reason. Uses that matter here:

- **Quota exhaustion.** Wake in 20–30 minutes, relaunch the same command. Safe because the
  durable state is the plan's `[x]` checkboxes.
- **Pacing an external wait.** Match the delay to what actually changes: a CI run that takes
  eight minutes deserves one check at ~480s, not eight at 60s.
- **A long fallback heartbeat.** When something else is the primary wake signal, 1200s+ so
  quiet wakeups stay rare.

The anti-pattern: short-interval polling for work the harness already notifies you about. A
background workflow re-invokes you when it finishes. Polling it is pure waste.

---

## C. `Monitor` — what people reach for loops to do

Not a loop, and usually the better answer. A background script whose every stdout line
becomes a notification. Three uses that fit this plugin exactly:

**Watch CI on the PR the run just opened.** Today a run ends at PR creation and never learns
whether CI went red. A monitor polling `gh pr checks` and emitting one line per check that
lands closes the loop between "the gate passed locally" and "it passes on the runner".

**Watch the steering control panel.** The workflow itself must stay write-only towards
GitHub (`steering-and-injection.md`). But a monitor outside it can poll the checkbox panel
and notify *me*, and I stop the workflow with `TaskStop`. The workflow stays pure; the
steering happens one level up. This is a cleaner split than making the workflow poll.

**Watch a halted branch's own re-verification** on a schedule, to catch rot when the base
moves.

Coverage rule that matters more than it looks: the filter must match every terminal state,
not only the happy one. A monitor grepping for the success marker stays silent through a
crash, and silence is indistinguishable from "still running".

---

## D. Truly unattended — `RemoteTrigger`

`CronCreate` lives in the session's memory and dies with it, and only fires while the REPL is
idle. It cannot run a plan overnight with the terminal closed.

`RemoteTrigger` creates a routine on claude.ai that runs cloud-side on a schedule, with its
own URL. That is the mechanism for "run this while I am away".

The blocker is not orchestration, it is environment: the gates are *your project's* commands,
dockerized. A cloud routine has to be able to run `make php/qa`, or it can drive the loop but
not verify it — and an unverifiable loop is exactly what this whole design refuses. Settle
the environment question before the scheduling one.

Also worth knowing: interactively-authenticated MCP servers may simply be absent in headless
runs.

---

## Ranked, for this plugin

1. **`ScheduleWakeup` for quota** — already documented in `/goal:auto --workflow`, costs nothing.
2. **`Monitor` on PR checks** — closes the largest open gap: nobody currently learns that CI went red.
3. **`Monitor` on the control panel** — makes remote steering work without touching the write-only invariant.
4. **Bounded escalation on infrastructure failures only** — kills the class of halts that are not about the code.
5. **Loop-until-dry in the grill** — upstream, where a found gap is cheapest.
6. **Queue drain over several plans** — only once one plan runs reliably.
7. **`RemoteTrigger`** — after the environment question is answered, not before.

---

[^selfheal]: *Self-Healing Agentic Orchestrators for Reliable Tool-Augmented LLM Systems* — <https://arxiv.org/pdf/2606.01416>
