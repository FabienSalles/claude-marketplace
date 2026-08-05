# Autonomous execution — architecture

How a locked plan is run without supervision: what enforces what, and why each guarantee sits in
the layer it sits in.

The chain is `/goal:spec` → `/goal:plan` → `node goal-run.ts <plan>` →
`goal-gate.ts` → advisory agents → `/goal:supervise`. Only the middle of it is unattended.

The rule that shapes everything: **a guarantee belongs to the lowest layer that can hold it.**
A rule written in prose is obeyed by a model, which is to say sometimes. A rule written in a
program is executed. A rule that is an exit code is a fact. Push each one down until it stops
moving.

## The six layers

| # | Layer | Medium | Holds |
|---|---|---|---|
| 0 | The plan | markdown, gitignored, hashed | what to build, and the exact commands that prove it |
| 1 | Verification | TypeScript run natively by node (`goal-gate.ts`, nine modules under `gate/`) | did this iteration pass — the only authority, and the only thing that commits |
| 2 | Orchestration | a node process (`goal-run.ts`, seven modules under `run/`) | preflight, order, halt, quota wait, publication |
| 3 | Advisory quality | agents (reviewer, lens, auditor) | what the gate structurally cannot see |
| 4 | Session lifecycle | a command (`/goal:supervise`) | classify a halt, repair or discard, relaunch once |
| 5 | Remote surface | a draft pull request on the plan's declared remote | where a human sees it |

Layers 0–2 are where correctness lives. Layer 3 can only ever *inform*. Layer 4 is whatever is
left once everything mechanical has been pushed down, and it keeps shrinking — the quota wait
used to live there.

## Layer 1 is the trust anchor, and it is a script

The external evidence is unambiguous: LLM judges are poor at deciding whether code is
correct. Measured agreement with human ground truth sits at Kappa ≈ 0.21 (Java) and ≈ 0.10
(Python), and in one systematic study half of the wrong implementations in Java were judged
correct.[^judge] Nothing built on that signal may decide whether work advances.

An exit code has none of those properties. It is the anchor, and every other layer is
arranged so that no path reaches a commit without passing through it.

Concretely: `goal-gate.ts commit` verifies, commits and ticks **inside one process**, in that order.
The orchestrator does not commit. It calls a script that commits only after it has verified,
so an orchestrator that misreads a result cannot produce a bad commit.

The boundary of that anchor is worth naming. *Only the gate commits* used to lean on an
implementer denied `git commit`, `git push` and `git add` by a Claude Code settings rule, and on a
preflight check that `.claude/settings.local.json` contained those three strings — a substring
match an ALLOW list satisfied exactly as well as a DENY one. The current runner dropped that
check: it was also installed project-wide, so it restrained the developer's own session, and
permissions are read at session start, so it described a future session and never the running one.
The earlier bash runner enforced it and has since been deleted.

What holds the anchor now is detection rather than denial. `run/iteration.ts` snapshots HEAD around
the implementer and halts when it moved, which catches the case the rule was written for. The two
gaps that remain — a push, and a write into `.git/` — are named in `docs/open-questions.md` and are
what the visibility plan closes.

## Why layer 2 is a program, and this one

Four forms of the loop were tried. Each is named here by what it made impossible.

**`/goal` on its own.** There is no judge: the model decides when the work is done. That is why
`/goal:next` exists — it is "the only step that replays the acceptance commands independently"
(`commands/plan.md:731`), and skipping it means a green iteration is only ever
self-certified. Everything below is an answer to that one hole.

**A dynamic Workflow, the abandoned generation.** It takes a subagent to run `git status`. The
proof is checked into the repository: `agents/goal-runner.md` exists, and its whole trade is
that it "runs exactly one command and reports its exit code. […] Never interprets, never fixes,
never retries", because "a verdict must cross back as an exit code, not as a reading of the
output". An agent whose profession is to be a shell. Every `sed`, every `git status` costs a model call,
a latency and a notification. The abstraction fights the task: orchestrating *is* sequencing
deterministically, and a workflow turns every deterministic step non-deterministic. The defect
that shape produced: it initialised its own tracking of a published pull request to `false`, so on
a branch that already carries an open pull request the run retries `gh pr create` at every
iteration, never rewrites the body and never marks it ready — it lands all of the work and
silently publishes none of it.

The prose version of the same loop ended in seventeen prohibitions (*never tick before the
gate*, *a halt is final*, *never touch the index*), and the workflow reduced them to four. One
writes those sentences only about things that are possible, so that reduction was real. It was
not worth its price.

**A bash script, since deleted.** The right instinct, stated in its own header: a workflow has no
shell, so there every `sed` and every `git status` crosses through a subagent — "here a command is
a command". Wrong material. 594 lines in one file cannot follow the convention the plugin holds
itself to, one module per group of business rules, which is what `gate/` does across nine of them.
The defect found on the first real use: `pr_body` built a regex alternation from `landed`, which
accumulated from an empty string; the leading space became an empty alternative, BSD `grep`
refused it, and the pull request body stayed empty for six iterations.

**A command that launches a node script that launches `claude -p`.** What each part buys:

- **the script**, against the workflow: `git status` is a system call, not a model call.
- **node**, against bash: 938 lines across 8 modules — the same total as the abandoned Workflow,
  but each with its own test file and the largest under 200 lines — and whole classes of bug
  disappear structurally, since `landed: string[]` (`run/publish.ts:44`) cannot produce bash's
  empty alternative.
- **`claude -p`**, against a subagent: one fresh, bounded session per iteration, no context
  leaking from one slice into the next, each one persisted separately — which is what makes a
  session auditor possible at all.
- **the command**, against a binary: classifying a halt is a judgment, and Claude Code already
  owns the loop.

The constraint that shaped the second form — no disk, no shell, only `agent()` — is exactly the
one the two forms after it rejected. `run/preflight.ts` reads the settings file itself;
`run/sweep.ts` spawns the plan's own commands. Having a shell is the design, not a leak in it.

What falls out is the principle: **the model is used exactly where something has to be judged —
implementing, classifying, reviewing — and nowhere else.** Every deterministic step is a
program. The workflow had that inverted; `/goal` on its own had deleted the program.

## Layer 3 informs and never blocks

See `adversarial-verification.md` for the lens catalogue and the required/optional rules. The
one architectural point: **a lens finding never stops a run.** A false positive that kills a
provably-green run at 3am costs more than the finding is worth, and the literature puts the
false-positive rate for requirement-conformance judgement high enough that this is not a
hypothetical.[^overcorrect]

The three agents are invoked at the close, after everything is committed and pushed, which makes
that rule structural rather than a promise: none of them can undo what the gate already
verified. Their answers land in `<plan>.run.log` (`run/close.ts:108`) and, for the auditor, in
`.claude/goal-runs/<sha>.md`. The developer adjudicates them awake.

## Layer 4 — what survives the process

**Durable state is the plan's `[x]` boxes**, ticked by the gate in the same process that
verified and committed (`gate/scope.ts`). A fresh run re-reads them and resumes at the first
unchecked iteration. That is the external-memory pattern the long-horizon-agent literature
converged on — state written to structured files and read back explicitly, rather than carried
in a context window.[^memory]

**The quota wait moved down.** It used to sit here, on the grounds that a workflow script has no
sleep. It now lives in the runner, which detects the window from the shape of a failed call,
sleeps, retries the same iteration and gives up into a pause rather than spinning
(`run/iteration.ts:104-152`). That is this page's own rule applied to itself.

**What is left at layer 4 is the part that is not mechanical**: reading a non-zero exit and
saying which of two very different things happened — the plan's contract was wrong, or the
implementation was. The runner's four exit codes exist for that call and no other
(`goal-run.ts:13-17`), and `/goal:supervise` makes it. It says so itself: the rule was written
from two halts, and it is a hypothesis rather than a proven procedure.

It is also where the layering leaks today. On a gate refusal the runner exits without ever
writing the gate's own output to the log (`run/iteration.ts:186-193`), and that HALT block is
the only evidence the classifier has to read. A layer whose entire job is to classify is being
fed by a layer that throws the evidence away.

**Never rely on auto-compaction inside a run.** Compaction is lossy and it fires when it
fires. When the context is genuinely spent, the correct move is the one `/goal:next` already
formalises: stop at an iteration boundary, verify the tree, and hand off to a fresh session
that reads the plan. A handoff at a clean boundary loses nothing, because the boundary state
is entirely on disk.

## Layer 5 — the remote surface, and the security invariant that shapes it

The run maps onto GitHub as a single object: **a draft pull request, opened at the first landed
iteration and its body rewritten by every one after it** (`run/publish.ts:57-60`), so a run that
halts at 3 of 15 still leaves something a human can read instead of a local branch nobody can
see. At the close, if the global Definition of Done passes, that pull request is marked ready
and reviewed (`run/close.ts:59-80`). Nothing is ever written to an issue.

Pushing is no longer something that happens *on* a halt: it has already happened, at every
landed iteration (`run/publish.ts:100`). The old rule that nothing is pushed on failure was
first reversed, and then made moot.

That ordering costs one guarantee, and it is the sharpest layering fault on this page.
`gate/ship.ts:11` describes the global Definition of Done as the barrier replayed once before
anything ships, because every slice gate only ever saw its own slice. But the runner publishes
inside the loop (`goal-run.ts:95`) and only calls that barrier at the close
(`goal-run.ts:100`). Per slice the invariant holds — no commit exists that a gate did not
verify. At run level, the last barrier guards nothing it could still stop.

### The autonomous run is write-only towards GitHub

This is a hard invariant, and it is the answer to a real, recent attack class rather than a
theoretical concern. In February 2026 a single malicious GitHub **issue title** drove a
chain of authorization bypass, indirect prompt injection and environment-variable
exfiltration that ended with attacker code pushed into a coding agent's own source
repository and shipped to its npm package.[^clinejection] The pattern generalises: any
agent that reads attacker-controlled text and also holds write credentials is one
injection away from using them.

So:

- **The loop never reads issue or PR text.** The one thing it reads back from GitHub is a
  number — `gh pr view --json number` (`run/publish.ts:129`) — and it reads it only to decide
  whether to create a pull request or edit the one that exists. Reading a source happens once,
  in `/goal:spec`, under a human's eyes, and its output is the local plan.
- **The plan is the only instruction source**, it is gitignored — a plan directory visible to
  git is a refusal, not a warning (`run/preflight.ts:93`) — and its hash is checked at every
  iteration. An instruction that is not in the plan is not an instruction.
- **Gate commands come from the plan**, frozen by a human at lock time. The run installs
  nothing and resolves no dependency it was not told to.
- Agents that write to GitHub receive the text to post as data; they do not decide what to
  post from something they read there.

The last bullet is the weak one and deserves to be named as such: the reviewer is briefed to
read the plan and the branch's commits (`agents/goal-run-reviewer.md`), but it holds `Bash`, so
nothing mechanically stops it from reading the pull request it is posting to. There the
invariant is prose again.

The cost of this invariant is real and worth naming: you cannot steer a run by commenting on
the issue.

That cost is recoverable without giving the invariant away, and `steering-and-injection.md`
is how: bound the remote vocabulary so that every verb may only *subtract*, reduce the
channel to a typed value in a script before any model sees it, and keep the agent that reads
GitHub separate from any agent that can act. The richest safe channel is a checkbox control
panel the run writes itself and reads back as a bit vector — you steer by ticking, and no
text authored by anyone else ever crosses.

## What is deliberately not a program

The grill is. `/goal:spec` and `/goal:plan` ask one question at a time and a human answers
(`commands/spec.md:96`, `commands/plan.md:110`), and that is the step that decides what is being built. Nothing
downstream can recover from a plan that is wrong, because every mechanism below it checks the
plan against itself. Automating it would move the one judgment with no fallback into the layer
with the weakest guarantees.

Not everything outside the runner is there by choice, though. The cleanup plan and the
post-merge checklist that once lived as prose in the abandoned command are now
`templates/post-merge.template`, printed rather than executed, and no runner carries them further
than that.

---

[^judge]: *Are LLMs Reliable Code Reviewers? Systematic Overcorrection in Requirement Conformance Judgement* — <https://arxiv.org/html/2603.00539>, and *On the Effectiveness of LLM-as-a-judge for Code Generation and Summarization* — <https://arxiv.org/pdf/2507.16587>
[^overcorrect]: same, plus *Judge Reliability Harness* — <https://arxiv.org/html/2603.05399v1>
[^memory]: *Beyond Compaction: Structured Context Eviction for Long-Horizon Agents* — <https://arxiv.org/pdf/2606.11213>
[^clinejection]: CSA research note on the Cline GitHub Action prompt-injection chain — <https://labs.cloudsecurityalliance.org/research/csa-research-note-claude-code-github-action-prompt-injection/>
