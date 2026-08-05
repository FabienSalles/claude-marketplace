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
| 1 | Direction | **bite check** — `impl_files` set aside, `gate1` required to fail | mechanical |
| 1 | Direction | lens on what the plan carries ticked | advisory |
| 2 | Iteration | plan declares a vertical slice + delivery strategy | frozen input |
| 2 | Iteration | **no-deletion check** under `no-bc-break` | mechanical |
| 3 | No regression | base sweep — every distinct declared command run against the untouched tree | mechanical |
| 3 | No regression | **every ticked iteration's gate commands replayed** at each iteration | mechanical |
| 3 | No regression | scope leak / parasitic artifact check | mechanical |
| 4 | Quality | the project's linter + static analysis, as gate commands | mechanical |
| 4 | Quality | reviewer on the pull request, once it is marked ready | advisory |
| 5 | Bounded | scope check against `test_files` / `impl_files` | mechanical |
| 5 | Bounded | **diff budget per iteration** | mechanical |
| 5 | Bounded | halt on the first refusal, nothing after it attempted | mechanical |
| 6 | Determinism | **`gate1` run three times, three passes required** | mechanical |
| 6 | Determinism | the whole plan hashed, re-derived and compared by every gate verb | mechanical |
| 6 | Determinism | `plan-guard.ts` across a repair between two runs | partial |

Eleven mechanical, two advisory, one frozen input and one that only half holds. That ratio is
the design.

One line left the table rather than moving: the **token budget floor**. It shed optional work
when a run got close to a ceiling, it lived in the abandoned Workflow runtime this loop used to
run on, and the runner that replaced it has no token accounting at all. Nothing in the current
loop stops a run on what it spends. Say that plainly rather than keep a row for it.

Two rows arrived with the runner rather than with the gate, and neither is where a reader
would look for it.

**The base sweep** is the highest-return mechanical check in the harness, and it is nearly
free: before a byte is written, every distinct command the plan declares is run once against
the untouched tree (`run/sweep.ts`, called from `run/preflight.ts:140`). A plan whose commands
were already red never spends an implementer on iteration 1 to discover it. `gate1` is
excluded on purpose — it is the bitten criterion, and it is *supposed* to fail without the
implementation. The hole is in what the sweep counts as declared: it follows every gate fence
in the file, whether or not that fence belongs to an iteration or to the Definition of Done,
and it runs before the plan hash of invariant 4 below has been derived — so it is the one place
the harness executes a line of the plan that nothing validated first.

**`plan-guard.ts`** is what makes "gate commands frozen in the plan" survive an edit between
two runs. `/goal:supervise` may repair a plan after a halt; the guard hashes every `gateN=` and
`dodN=` line so the repair can be proved not to have moved a bar. Two things keep its row above
at *partial*. It guards those lines and nothing else — see invariant 3. And nothing calls it
but the prompt it exists to constrain: `commands/supervise.md` runs it, `goal-run.ts` and
`goal-gate.ts` never do.

## The four new mechanisms

Everything above that is bold did not exist when this was written. All four shipped — three of
them as described, and **A took a different form**, recorded below where it was designed.

### A. A test must fail without the implementation

The single largest hole in the original design. When one agent writes both the test and the
code, it writes the test its code passes. That is specification gaming, structurally, and no
amount of judging catches it reliably.

**What shipped is not the split below.** The design here was a separate author agent and a RED
gate; what landed is the **bite check**: at verification time the gate sets the implementation
aside, re-runs the acceptance command, and requires it to **fail** (`gate/bite.ts`). Same
property, one agent instead of two, and it is checked on the finished slice rather than trusted
from an ordering. The design that follows is kept because it explains what the property is and
why it cannot be a judgement — read it as the reasoning, not as the implementation.

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

Iterations with nothing to test (doc, config) declare `test_files=` empty and skip 1–2. That
carve-out is also the invariant's off switch, which is invariant 3 below.

### B. The regression wall

Before this, each iteration replayed only its own gate commands and the global DoD ran once at
the end. So a slice that broke slice 3 was discovered at the end, after five more slices were
built on top of it.

Replay **every prior iteration's gate commands** at each gate (`gate/cross-iteration.ts`). Cost
grows linearly and they are the project's own fast commands. A regression is caught at the
iteration that caused it, which is the only moment where the halt is cheap and the cause is
obvious.

The wall reads the plan's ticked boxes to know which iterations are prior. That is the correct
source and it is also the wall's dependency: whatever can untick a box can shrink the wall.

### C. The diff budget

An iteration whose slice should be eighty lines and that produces two thousand has gone off
the rails, even when every command exits 0. Nothing before this noticed.

The plan declares `max_diff` per iteration; the gate compares `git diff --numstat` against it
(`gate/bounds.ts`). A bound the developer set while awake, enforced while asleep. Measured
against the declared paths alone, so a regenerated lockfile does not blow a budget nobody
authored.

Same shape, cheaper to write: under `no-bc-break`, **deletions and renames in pre-existing
files are refused outright**. The delivery rule ("additive only, never remove") was a sentence
in a prompt. `git diff --name-status` makes it a fact.

### D. Determinism of the new test

Run the iteration's acceptance command **three times** at the gate and require three passes —
the acceptance pass itself spends the first of the three (`gate/commands.ts`). A test that
passes two times out of three is not a gate, it is a coin. This costs two extra runs of one
scoped command and removes the largest source of "it was green last night".

## The five invariants, and what each is worth today

The six properties are what the loop owes. The five sentences below are what the harness says
about *itself* — in the pull request body it writes, in the preflight lines it narrates, in the
brief it hands the implementer. Those are the sentences a reader will quote back, so they are
the ones that have to be accurate.

All five are dented today. A document of invariants that lies about its own state is worse than
no document.

**1. No commit exists that a gate did not verify.** Holds per slice, and holds well:
`goal-gate.ts` is the only thing in the system that stages, commits and ticks
(`gate/scope.ts:136-152`), and the implementer's brief forbids all three (`run/iteration.ts:73`).
It does not hold as a *run* barrier. `gate/ship.ts:11-13` calls the global Definition of Done
"the barrier replayed once before anything ships", and its halt text says "Nothing has been
pushed" (`ship.ts:54`) — but the loop pushes and opens the pull request after every landed
iteration (`goal-run.ts:92-98`), and the DoD replays only afterwards, in `close()`
(`goal-run.ts:100` → `run/close.ts:47`). When the DoD refuses, the branch is already public and
the pull request body already claims every commit was verified. The invariant is true of every
commit and false of the sentence the run publishes about them.

**2. The implementer is mechanically denied git.** ~~The mechanism named is a `permissions.deny`
rule in `.claude/settings.local.json`, checked by three `String.includes` on the raw
file.~~ **Resolved for the current runner**, which dropped the check
rather than repair it: an `allow` list naming those same three commands satisfied it, the rule was
installed project-wide so it also restrained the developer's own session, and it was read once
before the loop, so it bound a session started after it and not one already running. The earlier
bash runner enforced it and has since been deleted. The claim now rests on the HEAD snapshot in
`run/iteration.ts`, which is
executed. Nothing surveys remote refs across the implementer, and a
`git push` moves neither HEAD nor the working tree, so it passes both post-implementer checks
(`run/iteration.ts:154-162`). And what the implementer writes inside the git directory is
invisible to `git status --porcelain -uall` — verified — therefore invisible to the scope
check, and then executed by the gate, which runs outside the permission system entirely. What
actually holds this invariant is the HEAD-before / HEAD-after comparison, not the file the
preflight reads.

**3. A test that passes without the implementation halts the slice.** The bite check is the
sharpest thing in the harness, and it works: `gate/bite.ts` sets
`impl_files` aside, re-runs `gate1`, requires a failure, and restores by overwrite with a
fingerprint taken on both sides. It has a legal off switch. `gate/bite.ts:52-57` prints `SKIP`
and returns when `test_files` is empty, and `plan-guard.ts:18` hashes only `gateN=` and `dodN=`
lines — so emptying `test_files` is an edit `commands/supervise.md:73` explicitly authorises a
supervisor to make, and the guard answers `OK: no gate or dod line moved.` The tool that exists
to prove no bar moved certifies that the bar was removed.

**4. The plan is hashed.** Stronger than it sounds, holed in one place. `gate/plan.ts:29-30`
hashes the *whole* plan rather than its gate lines, so for the length of a run `impl_files`,
`max_diff` and the prose are pinned too, and every gate verb re-derives the hash and refuses a
mismatch. The normalisation is what leaks: the hash is taken with every `- [x]` rewritten to
`- [ ]`, because a tick is the one edit an iteration may legitimately make. That makes an
untick equally invisible — and the regression wall replays only ticked iterations, so unticking
iteration 3 removes its commands from every iteration after it without moving a hash. The plan
lives in a directory the preflight requires gitignored (`run/preflight.ts:93`), so no scope
check sees the edit either. Separately: the hash is self-derived at the start of the run
(`goal-run.ts:64-83`). It pins the plan against the executor, never against whatever edited it
between the human grill and the launch.

**5. Every claim is a command that ran.** The gate honours it. The runner drops it at the one
moment it matters most. `gate/halt.ts:8` writes the verdict — `HALT`, `REASON:`, `DETAIL:` — on
its own stdout; `run/iteration.ts:173` captures that stdout and reads nothing out of it but the
exit status. On a refusal the run prints one line and exits (`iteration.ts:191-193`); on a gate
that could not run at all, the same (`iteration.ts:186-189`). The block never reaches the log.
`commands/supervise.md:63-65` calls that block "the only evidence there is" and forbids
re-running the gate for a second opinion — so the classifier that must choose between rewriting
the plan and discarding the tree, two opposite repairs, chooses blind. The pull request body
carries the same defect in miniature: `run/publish.ts:54` states "No commit exists that a gate
did not verify" as static text, never as the output of anything.

## Roles are capability restriction, not organisation

The community material calls this "agent teams" and frames it as a lead supervising peers.
That framing does not apply here, and adopting it would undo the point of the whole design:
a lead deciding what runs next is exactly the model-decided ordering the script exists to
remove.

What is real is that each stage should hold **only the tools its job needs**. Four agents are
invoked by the current runner:

| Role | Tools | Invoked |
|---|---|---|
| implementer | Read, Write, Edit, Grep, Glob, Bash | once per iteration (`run/iteration.ts:111`) |
| reviewer | Read, Grep, Glob, Bash | at close, only if the pull request went ready (`run/close.ts:80`) |
| lens | Read, Grep, Glob, Bash | at close, only if the global DoD passed (`run/close.ts:107`) |
| auditor | Read, Write, Grep, Glob, Bash | at close, whatever the verdict (`run/close.ts:123`) |

Three roles this table used to carry have lost their caller. The **runner** is gone because the
script runs its own commands (`run/iteration.ts:173`); the **reporter** is gone because
publication calls `gh` directly (`run/publish.ts`); the **reader** is gone because nothing
remote is read at all. Their definitions are still in `agents/`, invoked only by the abandoned
Workflow runtime this loop used to run on.

And the restriction the run actually stands behind is not the `tools:` field. All four are
launched as separate `claude -p` processes under `--permission-mode auto`, so what takes git
away from the implementer is the `permissions.deny` rule the preflight demands — which is why
invariant 2 above is about a file and not about a frontmatter line.

Restriction, not hierarchy. Nobody supervises anybody: the script sequences, the gate decides.

## Why not a workflow

This section used to argue for the Workflow against the published anti-pattern. The Workflow
was abandoned, twice over, and the half of the argument that survived is worth keeping straight
from the half that did not.

Two earlier generations preceded the one that runs today — a Workflow (941 lines, abandoned and
unreachable from any command) and a bash script (594 lines, since deleted) — and
`scripts/goal-run.ts` + `scripts/run/*.ts` is what runs now.

**What survived.** The published guidance warns against Claude generating an orchestration
script on the fly, per run — genuinely wasteful for a repeatable task, since you pay a model to
reinvent the same control flow every night. The resolution was to **check the script in** and
invoke it by path, and that is still exactly what happens: `commands/supervise.md` launches
`node goal-run.ts <plan>`. A static script invoked by path was the answer to the anti-pattern,
and it outlived the runtime it was first written for.

**What did not.** The Workflow's own constraint was sold as load-bearing: no disk, no shell,
only `agent()`. That is precisely what the two generations after it rejected. The bash runner
that followed it stated the counter-argument in its own header, in one line — a workflow has no
shell, so every `sed` and every `git status` crosses through a subagent, which is simultaneously
the run's latency and its notification flood. The current runner has a disk and a shell, by
choice.

**What still holds against agent teams.** Teams put a model in charge of what runs next. Here,
what runs next is the plan.

**What is still not written down.** Why bash first and why Node after was never decided in the
open — `docs/open-questions.md` §6 poses the question ("the orchestrator is bash, and that was
never a decision"), makes the maintainability case module by module, and closes nothing.

## The honest cost

Per iteration, before: **one** subagent.

Per iteration now: **one** implementer, and nothing else — the script spawns the gate itself
rather than through a runner agent. Three agents fire once, at close: reviewer, lens, auditor.
So one model call per iteration, plus three for the whole run, plus no orchestrator context at
all: the thing that sequences is a node process, not a session.

The comparison is a shape and not a number. The often-quoted **23 agents and 82 438 tokens** is
the abandoned Workflow's run of 2026-07-26 over four iterations, and it has
never been remeasured against the Node runner. Worse, it cannot be remeasured from inside:
the runner keeps no token accounting of any kind, so there is no ceiling and nothing to shed.
"Leave the lenses off under a budget" is no longer advice the loop can act on, because the loop
cannot see a budget.

The lens is no longer behind a flag either. `run/close.ts:107` asks it once, unconditionally,
as soon as the global DoD passes. What replaced the flag is placement — one lens at close
instead of two per landed iteration — and that is the cheaper end of the same trade-off, not
the same trade-off.

The mechanical additions stayed cheap: B, C and D are code in the gate, run by the process
that was going to run anyway, and A ended up adding no agent at all.

## What this changes in what already exists

- The gate is `scripts/goal-gate.ts` and the rules under `scripts/gate/`, one module per group
  of business rules. It is the single authority and the only thing that commits.
- The plan's `gate` block gained `test_files`, `impl_files` and `max_diff`.
- The per-iteration body is: implementer → gate → publish (`goal-run.ts:92-98`). There is no
  steering read: nothing remote is consulted at an iteration boundary.
- Publication is per-iteration, not a closing stage: push and a draft pull request at the first
  landing, the body rewritten at every one after it, and the global Definition of Done only
  once the loop is over. That inverts the order invariant 1 was written for.
- A gate refusal exits inside the loop, so `close()` is never reached — no lens, no reviewer,
  no audit report on exactly the runs that would be worth reading.
- `docs/adversarial-verification.md` lost its most important lens to the bite check. That is
  the promotion principle working as intended: the sensitivity lens stopped being a judgement.
