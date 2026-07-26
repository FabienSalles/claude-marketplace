# Target harness

What the autonomous loop must guarantee, and by what. Nothing here is about any particular
plan — a plan is only the input.

## The six properties, restated as testable claims

The loop must make each of these true *without anyone reading the code afterwards*:

1. **Direction** — what lands implements the intent, not a reading of it that happens to make the checks pass.
2. **Iteration** — each slice ships something reachable, and the previous behaviour survives it.
3. **No regression** — nothing that worked before this slice stops working.
4. **Quality** — the code meets the project's bar, not "it compiles".
5. **Bounded** — a slice that goes off the rails is stopped by the machine, not noticed later.
6. **Deterministic tests** — a green run means the same thing tomorrow.

The organising rule: **mechanical or advisory, never in between.** A property held by an exit
code is held. A property held by a model's opinion is a hint. Mixing the two produces a
system whose guarantees nobody can state.

## The mechanisms

| # | Property | Mechanism | Kind |
|---|---|---|---|
| 1 | Direction | **Test author ≠ implementer**, verified RED before any implementation | mechanical |
| 1 | Direction | conformance lens on the landed commit | advisory |
| 2 | Iteration | plan declares a vertical slice + delivery strategy | frozen input |
| 2 | Iteration | **no-deletion check** under `no-bc-break` | mechanical |
| 3 | No regression | **all prior iterations' gates replayed** at each iteration | mechanical |
| 3 | No regression | scope leak / parasitic artifact check | mechanical |
| 4 | Quality | the project's linter + static analysis, as gate commands | mechanical |
| 4 | Quality | review pass with the repo's own review skills, on the finished branch | advisory |
| 5 | Bounded | scope check against `test_files` / `impl_files` | mechanical |
| 5 | Bounded | **diff budget per iteration** | mechanical |
| 5 | Bounded | token budget floor, halt on first failure | mechanical |
| 6 | Determinism | **new test run N times, N passes required** | mechanical |
| 6 | Determinism | gate commands frozen in the plan, copied verbatim | mechanical |

Eleven mechanical, two advisory. That ratio is the design.

## The four new mechanisms

Everything above that is bold does not exist yet. They are the reason this document exists.

### A. The test author is not the implementer

The single largest hole in the current design. When one agent writes both the test and the
code, it writes the test its code passes. That is specification gaming, structurally, and no
amount of judging catches it reliably.

Split the iteration into two agents with **disjoint write permissions**, enforced by the same
scope check that already exists:

```
gate block:
  test_files=tests/FooTest.php
  impl_files=src/Foo.php
```

1. **Author** may write only `test_files`. It writes the test from the plan's business rule,
   never from an implementation that does not exist yet.
2. **RED gate** — mechanical: the slice's test command must exit **non-zero**, and the diff
   must touch only `test_files`. A test that passes before the implementation exists is a
   test that asserts nothing. This is the assertion-strength check, as an exit code. It
   stages the tests and records a seal over their staged content. **It commits nothing** — a
   commit holding only a failing test is not a functional slice, and the history must stay a
   sequence of them.
3. **Implementer** may write only `impl_files`. Editing a test is caught by the working-tree
   diff, and re-staging a weakened one is caught by the seal.
4. **GREEN gate** — everything else, then **one commit for the whole slice**: the tests and
   the code that makes them pass, under the message the plan froze.

This is what makes "direction" mechanical. The test is written against the intent, by
something that has no stake in the implementation being easy.

Iterations with nothing to test (doc, config) declare `test_files=` empty and skip 1–2.

### B. The regression wall

Today each iteration replays only its own gate commands, and the global DoD runs once at the
end. So a slice that breaks slice 3 is discovered at the end, after five more slices were
built on top of it.

Replay **every prior iteration's gate commands** at each gate. Cost grows linearly and they
are the project's own fast commands. A regression is caught at the iteration that caused it,
which is the only moment where the halt is cheap and the cause is obvious.

### C. The diff budget

An iteration whose slice should be eighty lines and that produces two thousand has gone off
the rails, even when every command exits 0. Nothing currently notices.

The plan declares `max_diff` per iteration; the gate compares `git diff --numstat` against
it. A bound the developer set while awake, enforced while asleep.

Same shape, cheaper to write: under `no-bc-break`, **deletions in pre-existing files are
refused outright**. The delivery rule ("additive only, never remove") is currently a sentence
in a prompt. `git diff --numstat` makes it a fact.

### D. Determinism of the new test

Run the iteration's new test **three times** at the GREEN gate and require three passes. A
test that passes two times out of three is not a gate, it is a coin. This costs three runs of
one scoped command and removes the largest source of "it was green last night".

## Roles are capability restriction, not organisation

The community material calls this "agent teams" and frames it as a lead supervising peers.
That framing does not apply here, and adopting it would undo the point of the whole design:
a lead deciding what runs next is exactly the model-decided ordering the script exists to
remove.

What is real is that each stage should hold **only the tools its job needs**, which
plugin `agents/` definitions express directly:

| Role | Tools | Why |
|---|---|---|
| author | Read, Write, Edit | writes tests, cannot run the suite to tune them |
| implementer | Read, Write, Edit, Bash | writes code, cannot open test files (scope check) |
| runner | Bash | runs one command, reports the exit code, cannot edit anything |
| lens | Read, Grep, Bash | reads and judges, cannot change what it judges |
| reporter | Bash | posts pre-written text, never reads GitHub |

Restriction, not hierarchy. Nobody supervises anybody: the script sequences, the gate decides.

## Why a workflow, against the stated anti-pattern

The published guidance says to avoid dynamic workflows for *"repeatable, well-defined tasks
with predictable token budgets"* and to prefer agent teams for *"work already decomposed into
known roles"*. Both descriptions fit this loop, so the objection deserves a direct answer.

The anti-pattern is about **Claude generating an orchestration script on the fly, per run**.
That is genuinely wasteful for a repeatable task: you pay a model to reinvent the same
control flow every night. The resolution is not to abandon the workflow — it is to **check
the script in**. A static script invoked by path is the answer to the anti-pattern, not an
instance of it.

The agent-teams objection fails for a different reason: teams put a model in charge of what
runs next. Here, what runs next is the product.

## The honest cost

Per iteration, before: **one** subagent.

Per iteration, after: author + implementer + 2 runners (RED and GREEN gates, cheap model) +
up to 4 lenses. Six to eight agents where there was one.

That is not free and it should not be defended as if it were. Two consequences to accept
deliberately:

- **Lenses default to off.** They are advisory, they are measurably unreliable, and they are
  the most expensive stage. Turn them on for a plan that matters.
- **The mechanical additions are cheap**: B, C and D are shell, run by the existing runner.
  The expensive part is the agents, and only A adds one.

## What this changes in what already exists

- `goal-gate.sh` gains: RED mode, prior-gate replay, diff budget, deletion refusal,
  N-run determinism. It stays the single authority.
- The plan's `gate` block gains `test_files`, `impl_files`, `max_diff`.
  the scope checked at each gate is whichever of the two belongs to that stage.
- The workflow's per-iteration body becomes: state → author → RED gate → implementer →
  GREEN gate → lenses.
- `docs/adversarial-verification.md` loses its most important lens to mechanism A. That is
  the promotion principle working as intended: the sensitivity lens stops being a judgement.
