# Comparison: what the field does, and where this loses

Written to be checked, not to persuade. Every claim about another tool comes from that tool's own
repository, documentation or paper, read in **August 2026**; every claim about this one names the
file that settles it. Both halves rot: the external half when those projects ship, the internal
half when this one does.

Companion documents: [`prior-art.md`](prior-art.md) is the older, deeper record of the twelve
commercial and academic tools; [`comparatif-fonctionnel.md`](comparatif-fonctionnel.md) is a French
rendering of that same material for a non-engineering reader, and predates the survey below.

**One rule of reading:** the section that produces work is *[Where the field wins](#where-the-field-wins)*.
Everything above it is positioning; only that section is a to-do list.

---

## What is being compared

A human and a model write a plan together. The plan is cut into slices, and each slice declares
**in advance**: the exact command that proves it done, the files it may touch, a maximum number of
diff lines, and its commit message. The plan is then hashed and frozen.

A loop then runs each slice in a fresh model session. A **program** (not a model) judges the
result by running the declared command and reading its exit code, and that same program is the
only thing in the system permitted to commit. A slice is refused if its test would still pass with
the implementation removed. The run never reads issue text, pull-request text or comments.

Full mechanics: [`walkthrough.md`](walkthrough.md).

---

## The honest headline

**No single mechanism here is unique any more.** Between the 2026 wave of verification harnesses
and two arXiv preprints, every individual pillar has an independent implementation somewhere:

| Pillar | Who else has it |
|---|---|
| A program judges by exit code | **NodeProof** (`pass: exitCode === 0`), **axiom** (`cmd_succeeds`, Python stdlib, no model in the verification path) |
| The plan is frozen by hash | **planning-with-files** (`/plan-attest` seals the plan with SHA-256; hooks refuse a tampered body), **Rel(AI)Build** (spec content-addressed at approval, HMAC lockfile) |
| Declared-paths allowlist | **java-harness-agent** (`scope_guard.py` parses `## Allowed Scope`), **Proof-or-Stop** (scope frozen into a contract bound to declared files) |
| A counterfactual on the tests | **greenproof** (snapshots the tests, re-runs the *originals* against the agent's code) |
| Fresh session judges, not the builder | **proof-loop** ("The verifier must be a fresh session. The agent that built the change does not judge whether the change is done.") |

What has **not** turned up anywhere is the conjunction, and inside it, two things in particular:

1. **A numeric per-slice diff ceiling.** Not one of the eight harnesses read in depth bounds the
   size of a change. Path allowlists are common; a line budget is not. It is the only bound in
   this system that is a number rather than a judgement.
2. **The judge is also the sole committer.** Elsewhere the model commits and *then* something
   reviews: `claude-code-harness` auto-commits per task before its review runs; in
   `java-harness-agent` the model holds `Bash(git commit *)` in its own allowlist and decides when
   to invoke the deterministic gates. Here, verify → commit → tick happen inside one process the
   writing agent cannot reach.

Say that, and the positioning survives contact with the field. Say "nobody makes the plan
binding", and a reader with a search engine falsifies it in a minute — `planning-with-files` and
`Rel(AI)Build` both do. [`comparatif-fonctionnel.md`](comparatif-fonctionnel.md) carried exactly
that overclaim until 2026-08-20 and now scopes it to the spec-driven family.

---

## The four mechanisms, and how narrow each really is

### 1. The judge is a program, and it is the only committer

**What it is.** `goal-gate.ts` runs the slice's declared command against the tree it is standing
in, and stages, commits and ticks the plan in that same process. Nothing else in the codebase
commits. One grep proves it: `src/gate/scope.ts` is the only file with `git add` and
`git commit` calls in the whole `scripts/` + `src/` tree.

**Why it is not a model.** Measured agreement between an LLM judge and human ground truth on code
correctness sits at Kappa ≈ 0.21 (Java) and ≈ 0.10 (Python), and one systematic study saw half the
wrong Java implementations judged correct.[^judge]

**Where others land.** `NodeProof` judges identically and is the closest match on this row.
`proof-loop`'s gate is 95 lines that parse a `verdict.json`: every input to it was written by a
model session, so the loop still ends in a model's self-report, mechanically checked.
`Goalkeeper` defines a `validator.command` but its gate is a subagent emitting the string
`VERDICT: approve`. `SWE-agent`, the academic reference, writes the diff to a file and hands it
back to the *same* model as a review message.

**Where it is narrower than it sounds.** An exit code cannot see a hollow shim that satisfies the
test, a `.todo`, or an assertion on mere existence. `Goalkeeper`'s reviewing subagent can, and
that is a real trade, not a defect in their design.

### 2. The plan is hashed and frozen

**What it is.** The whole plan file is digested, ticks normalised away, and every gate verb
re-derives the hash and refuses a mismatch. So `impl_files`, `max_diff` and the prose are pinned
alongside the commands.

**Where others land.** This used to be the strongest claim in the deck and it no longer is.
`planning-with-files` ships SHA-256 plan sealing with hooks that refuse a tampered body.
`Rel(AI)Build` content-addresses the spec at approval and stamps an HMAC lockfile.
**`Proof-or-Stop` goes further than this project does:** it binds evidence freshness at *every*
gate by matching `materialHash` / `headHash` against the live tracked tree, where this hashes the
plan at plan time only. That is a mechanism worth stealing, not dismissing.

The spec-driven family (`spec-kit`, `Agent OS`, `AWS Kiro`, `Tessl`, `OpenSpec`, `BMAD`,
`cc-sdd`, `Tsumiki`) still produces excellent plans and ships nothing to hold an agent to one.
Against *that* family the claim holds exactly as written.

### 3. Blast radius is declared before the work

**What it is.** Each slice names the files it may touch and a maximum diff size, both checked
against `HEAD` before anything is committed. An undeclared path halts; an over-budget slice halts.

**Where others land.** Path bounds exist elsewhere (`java-harness-agent`, `Proof-or-Stop`).
`Goalkeeper` has the polarity inverted: `non_goals` lists what is out of scope, which cannot
enumerate what nobody thought of. **The line budget has no counterpart in anything read.** The
nearest thing is a published technique, *Change Budget for Coding Agents*, not a shipped harness.

Cursor, the market leader, documents its own guardrails as "guardrails at best, not a security
boundary", retired its denylist, routes unauthorised calls to a classifier that is itself a model,
and concludes "always use version control so you can roll back". That is a deliberate trade for
speed, and it names the price of this one: **this is much slower to land a slice.**

### 4. The test must have been red

**What it is.** Before a slice is accepted, its implementation is set aside, the acceptance command
is re-run, and it must **fail**. If it still passes, the slice is refused: the test asserted
nothing. The restore is then verified by fingerprinting the tree before and after, so an acceptance
command with side effects halts rather than silently corrupting the tree.

**Why it matters more than it sounds.** Codex's published loop "runs your test suite again and
again, fixing failures until everything passes". When the only stop condition is *the test passes*,
**editing the test is a valid path to stopping.** This turns the condition into *the test passes
and it failed without this code*, which makes rewriting the test useless as a strategy rather than
merely forbidden.

**Where others land, and this is the row that changed.** The rule itself is not new: it is
SWE-bench's dataset admission criterion, and `SWT-Bench` operationalises fail-to-pass as an
evaluation metric. Both are **evaluation** harnesses, checking it once in a throwaway container.
`Tsumiki` binds each task to a red/green/refactor cycle as instruction. `java-harness-agent`
carries the anti-tautology idea in a skill, unenforced.

**`greenproof` is the real find.** It runs the counterfactual in the *opposite* direction:
snapshot the test files before the agent runs, then re-run those **original** tests against the
agent's code, and the verdict is that second run's exit code. Pure program, no model, no network.

The two are complementary, not competing, and the comparison exposes a genuine hole here:

> This proves the **new** evidence was ever real. `greenproof` proves the **old** evidence was not
> destroyed. A pre-existing test living inside a slice's declared files, stripped of three
> assertions out of four but keeping the one that fails without the implementation, passes every
> check in this harness and fits comfortably under any diff budget.

That is the single most valuable thing this survey produced.

---

## The table

Rows are mechanisms, not marketing. **no** means the tool's own documentation does not describe
it; where the docs are silent rather than negative, the cell says so.

| | this | NodeProof | proof-loop | axiom | greenproof | Goalkeeper | java-harness | spec-driven family |
|---|---|---|---|---|---|---|---|---|
| Program judges by exit code | **yes** | yes | reads a model's JSON | yes | yes | subagent verdict | yes, model-invoked | no |
| Judge is the sole committer | **yes** | no | does not commit | does not commit | does not commit | no | no: model holds `git commit` | no |
| Plan frozen against tampering | yes | protected paths, not hashed | prose rule only | snapshot, no hash | n/a | prose rule only | no | no |
| Declared-paths allowlist | **yes** | no | no | no | no | negative only | yes | no |
| Numeric diff ceiling | **yes** | no | no | no | no | no | no | no |
| Test must have been red | **yes** | no | no | no | opposite direction | no | instruction only | no |
| Old tests protected from weakening | **no** | no | no | no | **yes** | reviewer may notice | no | no |
| Fresh session per slice | **yes** | no | yes | n/a | n/a | yes | no | varies |
| Never reads issue/PR text | **yes** | not documented | n/a | n/a | n/a | not documented | **no**: ingests tickets | varies |
| Iteration / turn ceiling | **no** | not documented | no | no | n/a | checkpoint loop | no | n/a |
| Sandbox or runtime tool-gating | **no** | PreToolUse path block | no | observe mode | no | no | no | Kiro: yes |
| Exportable, third-party-checkable proof | **no** | receipts | `verdict.json` | custody chain | `--json` | no | no | no |

Bold marks the cells worth reading in the first column: the six **yes** rows nothing else
combines, and the four **no** rows where the field is genuinely ahead. All four are in the roadmap
below.

---

## Where the field wins

This is the section that produces work. Ordered by what it would cost to close.

1. **A fuse.** There is no iteration ceiling and no clock on the implementer session. Declared
   commands are bounded by a 900-second wall clock (`gate/bounded.ts`), but the session writing
   the code is not, so a session circling an impossible slice circles until the usage allowance
   runs out. `SwarmOps` caps everything numerically; `Rel(AI)Build` ships a hard three-iteration
   auto-fix cap; Anthropic's own `ralph-wiggum` plugin says to "always rely on a maximum iteration
   count as the primary safety mechanism". **Cheapest to fix, and the most overdue.**

2. **Weakened-test detection.** Named above. The failure mode has a stable four-signal taxonomy
   (assertions deleted, tolerances widened, tests marked skip, expected values and snapshots
   regenerated), and a formula worth keeping: *in an agent's pull request, the tests are part of
   the claim, not part of the proof.* `greenproof` is a working implementation of half of it, and
   it is ~200 lines of Python. **This protects the only differentiator nobody else has.**

3. **Forensics after a halt.** When a slice is refused, what exists is the tree as the implementer
   left it, and nothing else. And, worse, **a halted run writes no report at all**, because the
   audit pass runs only at the close, which a halted run never reaches. So the corpus of six run
   reports on disk is successful-runs-only by construction. `Roo` keeps restore points in a shadow
   repository; `HORKOS` writes a `HANDOFF.md` after three strikes.

4. **Freshness binding beyond plan time.** `Proof-or-Stop`'s `materialHash` over the live tracked
   tree, checked at every gate, is strictly stronger than hashing the plan once. Related measured
   result: using a stale verification trace against current code broke 34 of 135 otherwise-correct
   attempts, against 4 of 135 with a fresh one.[^looping]

5. **A machine critic of the plan, before it freezes.** Google's `Jules` added a critic that reads
   self-approved plans before any code, for a measured 9.5% reduction in failure rate. Keeping the
   human grill is a deliberate and well-supported choice; having *nothing* mechanical read a plan
   before it is frozen is not the same decision. A plan defect is also the most common thing the
   halt classifier has to handle.

6. **Exportable proof.** "Every claim is a command that ran" is currently a promise about how the
   code is written. `Bernstein` keeps a signed audit chain a third party can verify offline;
   `axiom` keeps a custody chain; `HORKOS` keeps a receipt ledger. No artefact here can be checked
   by anyone who did not run it.

7. **Observe mode.** `axiom` installs every rule recording-only ("it records what it *would* have
   blocked and blocks nothing"), and you enable enforcement per rule once its findings have earned
   it. This harness has no way to try a new refusal without it being able to stop a run.

8. **An entirely empty axis: the machine.** `OpenHands` ships risk analysers, security levels and
   confirmation policies; `Codex` runs network-isolated in a container; `claude-code-harness` runs
   a Go engine adjudicating every tool call at PreToolUse across five deny categories.
   **They protect the machine from the agent; this protects the repository from the agent.** That
   is an accepted debt, not a bug: this is pointed at a repository its owner trusts. The day it is
   pointed at somebody else's, the whole axis is missing.

9. **Reacting to red CI.** The largest open loop. Nothing learns that the pull request the run just
   opened went red. Closing it means reading CI and PR text (precisely what the write-only
   invariant forbids), so the safe shape is the constrained one already designed in
   [`steering-and-injection.md`](steering-and-injection.md), not a general reader.

---

## Two choices made blind that the literature has since scored

Worth knowing, because it is rare.

**A stale proof is worse than no proof.** The judge replays its commands against the tree it is
standing in, so its evidence is bound to state by construction and never carried over from a
previous turn. Measured: a stale verification trace broke 34 of 135 otherwise-correct
attempts, against 4 of 135 with a fresh one.[^looping]

**Forcing a second revision degrades the result.** The same work measures correctness falling from
82% after one revision to 67.3% after two. `/goal:supervise` relaunches once and then stops.

---

## What this is bad at

- **Small work.** Writing a plan with acceptance commands, declared paths and diff budgets costs a
  full session before the first line of code. This is genuinely worse than doing it yourself for a
  ten-minute fix, and it only pays on work large enough to amortise the plan.
- **Unfamiliar repositories.** The acceptance commands are the project's own. Pointed at a codebase
  whose commands you cannot name, there is nothing for the gate to run.
- **Anything needing a conversation mid-run.** By design the run cannot ask. If the plan is
  ambiguous, the ambiguity is resolved by guessing, which is exactly why Stages 1 and 2 are
  interactive.

---

[^judge]: *Are LLMs Reliable Code Reviewers? Systematic Overcorrection in Requirement Conformance Judgement*: <https://arxiv.org/html/2603.00539>, and *On the Effectiveness of LLM-as-a-judge for Code Generation and Summarization*: <https://arxiv.org/pdf/2507.16587>
[^looping]: *Looping Is Not Reliability*: <https://arxiv.org/abs/2607.24604>

**Sources read for this survey, August 2026.** greenproof <https://github.com/zxyasfas/greenproof> ·
proof-loop <https://github.com/LeoStehlik/proof-loop> · NodeProof <https://github.com/HomenShum/NodeProof> ·
axiom <https://github.com/ryangu00/axiom> · Goalkeeper <https://github.com/itsuzef/goalkeeper> ·
java-harness-agent <https://github.com/listener-He/java-harness-agent> ·
claude-code-harness <https://github.com/Chachamaru127/claude-code-harness> ·
planning-with-files <https://github.com/othmanadi/planning-with-files> ·
HORKOS <https://github.com/eragonlonelyboy-lab/horkos> · SWT-Bench <https://github.com/logic-star-ai/swt-bench> ·
*Proof-or-Stop* <https://arxiv.org/abs/2607.14890> · *Rel(AI)Build* <https://arxiv.org/html/2606.26924v1> ·
Traycer <https://docs.traycer.ai/llms.txt> · Tsumiki <https://github.com/classmethod/tsumiki> ·
Antithesis <https://antithesis.com/product/> · Goose recipes <https://goose-docs.ai/docs/guides/recipes/recipe-reference/>.
The commercial and academic panel (Cursor, Codex, aider, Cline, Roo, SWE-agent, spec-kit,
OpenHands, SwarmOps, Jules, Bernstein, Hermes) is sourced in [`prior-art.md`](prior-art.md).
