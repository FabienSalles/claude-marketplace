# Autonomous execution — architecture

How `/goal:auto` is meant to run a locked plan without supervision: what enforces what, and
why each guarantee sits in the layer it sits in.

The rule that shapes everything: **a guarantee belongs to the lowest layer that can hold
it.** A rule written in prose is obeyed by a model. A rule written in JavaScript is
executed. A rule written in bash is a fact. Push each one down until it stops moving.

## The six layers

| # | Layer | Medium | Holds |
|---|---|---|---|
| 0 | The plan | markdown, gitignored, hashed | what to build, and the exact commands that prove it |
| 1 | Verification | bash (`goal-gate.sh`) | did this iteration pass — the only authority |
| 2 | Orchestration | JavaScript (`workflows/goal-auto.js`) | order, parallelism, halt, budget, model tiering |
| 3 | Advisory quality | agents (lenses, review skills) | what the gate structurally cannot see |
| 4 | Session lifecycle | the command + `/loop` | quota waits, context budget, resume |
| 5 | Remote surface | GitHub + Remote Control | where a human sees it and steers it |

Layers 0–2 are where correctness lives. Layer 3 can only ever *inform*. Layers 4–5 cannot
live inside the workflow at all, for reasons given below.

## Layer 1 is the trust anchor, and stays bash

The external evidence is unambiguous: LLM judges are poor at deciding whether code is
correct. Measured agreement with human ground truth sits at Kappa ≈ 0.21 (Java) and ≈ 0.10
(Python), and in one systematic study half of the wrong implementations in Java were judged
correct.[^judge] Nothing built on that signal may decide whether work advances.

An exit code has none of those properties. It is the anchor, and every other layer is
arranged so that no path reaches a commit without passing through it.

Concretely: `goal-gate.sh green` verifies, commits and ticks **inside one script**.
The orchestrator does not commit. It calls a script that commits only after it has verified,
so an orchestrator that misreads a result cannot produce a bad commit.

## Layer 2 is JavaScript because prose is a suggestion

The prose version of the loop ends with seventeen prohibitions (*never tick before the
gate*, *a halt is final*, *never touch the index*). One writes those sentences only about
things that are possible. In a script the ordering is instructions, and `break` executes.

The workflow also buys three things prose cannot express at all:

- **Parallel tracks as a primitive.** `parallel()` returns `null` for a thunk that throws
  instead of rejecting, which is exactly the plugin's own rule that one track failing must
  never cancel a healthy sibling.
- **A token ceiling.** `budget.remaining()` lets the run shed optional work before it hits
  the wall, instead of dying mid-iteration.
- **Per-stage model and effort.** The agent that runs a gate is a button (`effort: 'low'`).
  The agent that implements a slice is not. Today every subagent is identical.

**The workflow cannot touch the filesystem.** That is the load-bearing constraint of the
whole design: JS in a workflow has no disk and no shell, only `agent()`. Everything that
must read the repo goes through a script invoked by an agent — which is why
`goal-gate.sh` exists. It is not plumbing between two files; it is the boundary
between a language that cannot read the plan and a plan that must not be interpreted.

## Layer 3 informs and never blocks

See `adversarial-verification.md` for the lens catalogue and the required/optional rules.
The one architectural point: **a lens finding never stops a run.** A false positive that
kills a provably-green run at 3am costs more than the finding is worth, and the literature
puts the false-positive rate for requirement-conformance judgement high enough that this is
not a hypothetical.[^overcorrect]

Findings go to the GitHub issue. The developer adjudicates them awake.

## Layer 4 cannot live in the workflow

Three things the workflow structurally cannot do, and where they go instead:

**Wait for a quota.** A workflow script has no sleep, and when the quota is gone the agents
cannot run anyway. The waiting belongs to the command, via `/loop` and `ScheduleWakeup`, and
works only because the run is resumable from disk.

**Survive a session.** `resumeFromRunId` is same-session only. The durable state is the
plan's `[x]` checkboxes, ticked by bash after a green gate. A fresh run re-reads them and
resumes at the first unchecked iteration. That is the external-memory pattern the
long-horizon-agent literature converged on — state written to structured files and read
back explicitly, rather than carried in a context window.[^memory]

**Keep the context window honest.** The orchestrator's context must not grow with the
number of iterations. Two mechanisms: every implementation happens in a subagent whose
transcript never enters the orchestrator, and every command result crosses back through a
schema (`{exitCode, output}`) rather than as free transcript. A fifteen-iteration run costs
the orchestrator roughly what a two-iteration one costs.

**Never rely on auto-compaction inside a run.** Compaction is lossy and it fires when it
fires. When the context is genuinely spent, the correct move is the one `/goal:next` already
formalises: stop at an iteration boundary, verify the tree, and hand off to a fresh session
that reads the plan. A handoff at a clean boundary loses nothing, because the boundary state
is entirely on disk.

## Layer 5 — the GitHub surface, and the security invariant that shapes it

The run maps onto GitHub as: **the issue is the log, the PR is the deliverable.**

- run starts → a comment on the issue: plan, tracks, iteration count, policy
- a track halts → its branch is pushed and a comment carries the gate output verbatim,
  plus the iterations never attempted
- a track finishes → its own PR, and a comment linking it
- lens findings → appended to the PR body and the issue comment, marked advisory

Pushing a halted branch is a deliberate reversal of the old rule that nothing is pushed on
failure. Unattended, the alternative is that the only machine that knows what happened is
the one that is now asleep.

### The autonomous run is write-only towards GitHub

This is a hard invariant, and it is the answer to a real, recent attack class rather than a
theoretical concern. In February 2026 a single malicious GitHub **issue title** drove a
chain of authorization bypass, indirect prompt injection and environment-variable
exfiltration that ended with attacker code pushed into a coding agent's own source
repository and shipped to its npm package.[^clinejection] The pattern generalises: any
agent that reads attacker-controlled text and also holds write credentials is one
injection away from using them.

So:

- **The loop never reads issue or PR text.** Not titles, not bodies, not comments. Reading a
  source happens once, in `/goal:draft-issue`, under a human's eyes, and its output is the
  local plan.
- **The plan is the only instruction source**, it is gitignored, and its hash is checked at
  every iteration. An instruction that is not in the plan is not an instruction.
- **Gate commands come from the plan**, frozen by a human at lock time. The run installs
  nothing and resolves no dependency it was not told to.
- Agents that write to GitHub receive the text to post as data; they do not decide what to
  post from something they read there.

The cost of this invariant is real and worth naming: you cannot steer a run by commenting on
the issue.

That cost is recoverable without giving the invariant away, and `steering-and-injection.md`
is how: bound the remote vocabulary so that every verb may only *subtract*, reduce the
channel to a typed value in a script before any model sees it, and keep the agent that reads
GitHub separate from any agent that can act. The richest safe channel is a checkbox control
panel the run writes itself and reads back as a bit vector — you steer by ticking, and no
text authored by anyone else ever crosses.

## What is *not* worth moving into the workflow

Phase 4's history reshaping and Phase 5's cleanup PR run once, at the end, under a human's
eye. They are judgment, they are cheap in prose, and porting them buys nothing. Leave them.

---

[^judge]: *Are LLMs Reliable Code Reviewers? Systematic Overcorrection in Requirement Conformance Judgement* — <https://arxiv.org/html/2603.00539>, and *On the Effectiveness of LLM-as-a-judge for Code Generation and Summarization* — <https://arxiv.org/pdf/2507.16587>
[^overcorrect]: same, plus *Judge Reliability Harness* — <https://arxiv.org/html/2603.05399v1>
[^memory]: *Beyond Compaction: Structured Context Eviction for Long-Horizon Agents* — <https://arxiv.org/pdf/2606.11213>
[^clinejection]: CSA research note on the Cline GitHub Action prompt-injection chain — <https://labs.cloudsecurityalliance.org/research/csa-research-note-claude-code-github-action-prompt-injection/>
