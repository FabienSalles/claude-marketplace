# ADR-0001: A slash command over a Node runner over `claude -p` sessions, judged by a program

## Status

- **Status**: Accepted
- **Date**: 2026-08-06
- **Authors**: FabienSalles
- **Supersedes**: three earlier shapes of the same loop, all built and all removed

## Context

The goal was to deliver a planned feature without sitting in front of it — a loop that takes a
frozen plan and turns it into a reviewed pull request.

Four shapes were built for this. Three were deleted. This record exists because the reasoning
behind each deletion is not recoverable from the surviving code — the whole point of the current
shape is that the things it does *not* do leave no trace. Each rejected shape also left a real
defect on a real run; those defects illustrate the reasons below, they are not the reasons.

One rule emerged and now decides every placement question in the harness:

> A rule written in prose is obeyed by a model, which is to say sometimes. A rule written in a
> program is executed. A rule that is an exit code is a fact. Push each guarantee down to the
> lowest layer that can hold it.

The decision below is that rule applied to the loop itself.

## Decision

The loop is **a slash command, over a Node process, over one `claude -p` session per slice, with a
separate Node program as the judge.**

Concretely, four layers, each chosen against a specific alternative:

1. **A program orchestrates, not an agent.** `goal-run.ts` sequences the run. Checking whether the
   tree is clean is a system call, not a model call.
2. **The program is Node, not bash.** Fifteen modules, each with its own test file, none over
   200 lines.
3. **Each slice is implemented by a fresh `claude -p` session**, not a subagent of the
   orchestrator.
4. **A separate program judges and commits.** `goal-gate.ts` runs the command the plan declared,
   reads the exit code, and is the only thing in the system that stages, commits and ticks.
5. **A slash command sits on top** to classify a halt and decide whether to repair or discard.

The principle that falls out, and the one-line version of this whole document:

> **The model is used exactly where something has to be judged — implementing, classifying,
> reviewing — and nowhere else. Every deterministic step is a program.**

## Consequences

### Positive

- **A verdict is an exit code, so it cannot be argued with.** The measured agreement between an
  LLM judge and human ground truth on code correctness is Kappa ≈ 0.21 (Java) and ≈ 0.10 (Python);
  in one systematic study half the wrong Java implementations were judged correct. Nothing built
  on that signal decides whether work advances.
- **Verify, commit and tick happen in one process the writing agent cannot reach.** An
  orchestrator that misread a result cannot produce a bad commit, because the orchestrator does
  not commit.
- **Each slice starts cold.** No context leaks from one slice into the next, and the plan's
  checkboxes are the only memory — so a run killed at 3am and relaunched the next day resumes
  correctly with no state carried anywhere.
- **Every implementer session is persisted separately**, which is the only reason a per-session
  audit is possible at all.
- **Whole classes of bug disappear structurally.** A typed list cannot produce the empty regex
  alternative that broke the bash generation.
- **Each module is independently testable**, which is what 266 tests over 30 modules rests on.

### Negative

- **It is bound to Claude Code.** The runner spawns `claude -p`. Nothing here ports to another
  agent runtime without rewriting the layer that spawns sessions.
- **It requires a shell and a disk.** This is deliberate — preflight reads the settings file, the
  sweep spawns the project's own commands — but it rules out any environment that offers neither.
- **It requires Node 24**, for native TypeScript execution with no build step.
- **The halt classifier is unproven.** Two halts are the entire evidence behind it. It says so in
  its own description, and it relaunches once and then stops rather than trusting itself twice.
- **More moving parts than a single script.** Two entry points, twenty-six modules and an agent
  definition per role is more to hold in your head than 594 lines of bash — the trade is that no
  single piece is more than a screenful.

### Neutral

- **Types are stripped at run time and never checked there.** `tsc --noEmit` is a CI concern, not
  a runtime one. This is what buys the no-build, no-dependency, no-lockfile property.
- **The upstream half of the pipeline stays interactive.** `/goal:spec` and `/goal:plan` ask one
  question at a time and a human answers. That is not a consequence of this decision — it is the
  deliberate exception to it, recorded under *What is deliberately not a program* below.

## Alternatives considered

### Option 1: `/goal` on its own

Claude Code's native goal loop, handed the feature as a single goal.

- **Advantages**: nothing to build; nothing to install; the developer sees every diff.
- **Disadvantages**: **all-or-nothing, and no judge.** One goal for a whole feature goes too far
  in one stride: the smallest problem puts everything back in question, and what a failed run
  leaves is one huge diff nobody can judge or salvage — nothing deliverable. The arithmetic of
  long horizons is against it too: per-step accuracy compounds, so 99% per step is one success
  in three by step 100, and a context carrying its own earlier errors grows measurably more
  likely to err — the documented remedy is decomposition into small, independently verifiable
  subtasks, which is exactly what a slice is. And the model decides when the work is done, so
  every green step is self-certified.
- **Reason for rejection**: rejected at feature scale, **kept per slice** — one of the two
  supported modes. The plugin never hands `/goal` more than one slice, each cut as a functional
  delivery, so progress is iterative and a run that dies mid-plan still leaves every landed
  slice shippable instead of nothing. At that scale the remaining hole is self-certification,
  and with a human reviewing each slice the human is the judge — it is only unacceptable
  *unattended*. `/goal:next` exists precisely to plug that gap: it is the only step that replays
  a finished slice's acceptance commands independently instead of trusting its checkbox.
  Everything else in this ADR is the answer to the question *what replaces the human when nobody
  is watching.*

### Option 2: a dynamic Workflow (941 lines, since deleted)

The orchestration expressed as a workflow script whose only primitive is spawning agents.

- **Advantages**: parallelism and structured fan-out come free; progress is visible in the
  workflow UI; the script is deterministic even though the steps are not.
- **Disadvantages**: **it takes a subagent to run `git status`.** The generation shipped an agent
  whose entire job was to run one command and report its exit code, because a verdict had to cross
  back as an exit code rather than as a reading of the output. An agent whose profession is to be
  a shell. Every `sed`, every `git status` costs a model call, a latency and a notification.
- **Reason for rejection**: the abstraction fights the task, on every axis at once. Sequential
  and parallel control flow was genuinely hard to express in it, and every guarantee had to be
  bolted on as one more check in one more step — the workflow grew heavier at each iteration and
  a run's execution time grew with it. Each of those steps was decided by an agent, where the
  same decision as deterministic code costs nothing and cannot drift — less reliable, for no
  gain, on input that is already a frozen plan with predefined steps. A dynamic workflow earns
  its keep on open-ended work — research, exploration, judgement fanned out over an unknown
  space — not on a plan a program can sequence. The field's own guidance draws the same line:
  Anthropic's *Building Effective Agents* separates workflows — LLMs orchestrated through
  predefined code paths, buying predictability and consistency on well-defined tasks — from
  agents directing their own process, worth their cost only where flexibility is the point; and
  12-Factor Agents says the control-flow half plainly: own the loop, keep what retries, pauses
  or terminates out of the model's hands. The defect that shape produced, for the record:
  it initialised its own tracking of a published pull request to `false`, so on a branch that
  already carried an open pull request it retried creating one at every slice, never rewrote the
  body and never marked it ready — **it landed all of the work and silently published none of
  it.**
  One piece of evidence in its favour is worth recording: the prose version of the same loop ended
  in seventeen prohibitions (*never tick before the gate*, *a halt is final*, *never touch the
  index*), and the workflow reduced them to four. One writes those sentences only about things
  that are possible, so that reduction was real. It was not worth its price.

### Option 3: a bash script (`goal-run.sh`, 594 lines)

- **Advantages**: **the right instinct**, and its own header said so — a workflow has no shell, so
  there every `sed` and every `git status` crosses through a subagent, whereas here *a command is
  a command*. No runtime to install. Trivially inspectable.
- **Disadvantages**: wrong material. 594 lines in one file cannot follow the convention the plugin
  holds itself to — one module per group of business rules — and bash has no type that would stop
  a list from degrading into a string.
- **Reason for rejection**: maintainability, before any defect. 594 lines of shell in one file
  were hard to read, hard to change and not a base to industrialise — no modules, no types — so
  the move was to a language readable and popular enough to be worked on for years. The field
  converged on the same move: serious harnesses live in typed, tooled languages — Claude Code in
  TypeScript, Goose in Rust, and OpenAI rewrote Codex CLI from TypeScript to native Rust when
  demands grew. Rewrites go toward stricter languages, never toward shell. The defect
  found on its first real use confirmed the call: the pull-request body built a regex alternation
  from the list of landed slices, which accumulated from an empty string; the leading space
  became an empty alternative; BSD `grep` refused it; **the pull request body stayed empty for
  six slices.** In the Node rewrite that bug is unrepresentable — the equivalent value is a typed
  array.

### Option 4: a compiled binary instead of a slash command on top

- **Advantages**: one artefact, no dependency on the host agent, scriptable from anywhere.
- **Reason for rejection**: **classifying a halt is a judgement, and it is the one thing left at
  that layer.** The two halts on record exited with the *same code* and the *same wall message*
  and needed *opposite* responses — one was a plan defect, one was an implementation defect.
  Getting that call wrong either burns the implementer's real work or ships a plan quietly
  rewritten until it stops refusing. That is a job for a model, and Claude Code already owns the
  session loop a model would need. A binary would have to re-implement it.

### Option 5: subagents instead of `claude -p`

- **Advantages**: cheaper to spawn; results come back as structured values; no process boundary.
- **Reason for rejection**: three properties are lost. A subagent shares the parent's context, so
  slice N inherits whatever slice N−1 said; it is not separately persisted, so no per-session
  audit is possible; and it is not bounded by its own process, so the runner cannot compare `HEAD`
  before and after it, snapshot the git directory around it, or classify its exit code. Every
  detection guarantee in the harness depends on the implementer being a *process*.

## References

- [`autonomous-architecture.md`](../autonomous-architecture.md) — the six layers this decision
  produced, and which guarantee sits in each
- [`walkthrough.md`](../walkthrough.md) — what the resulting loop actually does, step by step
- [`comparison.md`](../comparison.md) — how the choice reads against the rest of the field
- [`why-not-parallel.md`](../why-not-parallel.md) — a related deletion: parallel tracks were built,
  measured and removed
- [`open-questions.md`](../open-questions.md) — what this decision left undecided
- *Are LLMs Reliable Code Reviewers? Systematic Overcorrection in Requirement Conformance
  Judgement* — <https://arxiv.org/html/2603.00539>
- *On the Effectiveness of LLM-as-a-judge for Code Generation and Summarization* —
  <https://arxiv.org/pdf/2507.16587>
- *Building Effective Agents* (workflows over predefined code paths vs self-directing agents) —
  <https://www.anthropic.com/engineering/building-effective-agents>
- *12-Factor Agents* (own your control flow; small, focused agents) —
  <https://github.com/humanlayer/12-factor-agents>
- *Solving a Million-Step LLM Task with Zero Errors* (error compounding; decomposition into
  minimal verifiable subtasks) — <https://arxiv.org/pdf/2511.09030>
- *OpenAI Rewrites Codex CLI from TypeScript to Rust* —
  <https://www.infoq.com/news/2025/06/codex-cli-rust-native-rewrite>

## Implementation notes

**What is deliberately not a program.** `/goal:spec` and `/goal:plan` interrogate a human, one
question at a time, and that is the step that decides *what is being built*. Nothing downstream can
recover from a plan that is wrong, because every mechanism below it checks the plan against itself.
Automating it would move the one judgement with no fallback into the layer with the weakest
guarantees. It is acceptable as a manual step only because it runs **once per plan**, not once per
change.

**Both rejected generations are deleted, not archived in the tree.** The Workflow generation
outlived its replacement by months because a plugin's `workflows/*.js` are registered as invokable
skills, so it stayed launchable by name the whole time — carrying the publication defect described
in Option 2. It was removed on 2026-08-06; git history is where it lives now. A rejected
orchestrator left in the tree is not documentation, it is a second entry point.

**This decision is falsifiable.** If a future run shows the halt classifier doing more harm than an
unconditional stop would, Option 4 becomes the better shape and layer 5 should be deleted rather
than improved — the layer has been shrinking since the beginning (the quota wait used to live
there and moved down into the runner), and shrinking it to nothing is a legitimate end state.
