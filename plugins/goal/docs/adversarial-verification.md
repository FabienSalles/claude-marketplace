# Adversarial verification — design note

One lens is implemented, asked once at the close of a run (`run/close.ts:107`). The rest of
this note is the reasoning behind it, kept so it is not re-derived from scratch — and, below,
the record of which questions stopped being asked, which of them a mechanism took over, and
which the port to a node runner simply dropped.

## The hole this addresses

`goal-gate.ts` proves that a command exited 0. It cannot prove that the command
*means* anything. A test that asserts nothing exits 0. A test whose mock makes the truth
unreachable exits 0. A business rule "covered" by a test that exercises something else
exits 0.

That is the structural failure mode of any gate built on exit codes: everything that
produces the measured signal is rewarded, including what nobody wanted. The name for it is
**specification gaming** — the executor optimises the proxy instead of the intent.

No exit code will ever close this. It needs a different kind of check.

## The mechanism

**Adversarial verification**: after the gate has passed, one or more verifiers are asked to
*refute* what was delivered, each through a distinct **lens**.

Five properties make it work, and dropping any one of them turns it into theatre:

- **Refute, never confirm.** A verifier asked "is this correct?" rubber-stamps. It must be
  asked to demolish, and told to default to "refuted" when uncertain.
- **One lens per verifier.** Diversity comes from asking different *questions*, not from
  asking the same question three times. Three identical verifiers agree with each other far
  more than they agree with reality.
- **The verifier reads the plan's own declarations.** A lens that invents its own standard
  produces noise. A lens that checks the invariant the plan already wrote produces a finding.
- **One question, no essay.** Counter-intuitively, asking a judge to explain its reasoning
  and propose a correction *increases* misjudgement rather than reducing it.[^complexity]
  Each lens asks one closed question and returns a verdict plus a citation. It does not
  write a review.
- **A finding must cite `file:line`.** Hallucination accounts for roughly a third of judge
  false negatives — verdicts about statements that do not appear in the code at all.[^halluc]
  Requiring a concrete anchor is the cheapest available filter, and a finding that cannot
  produce one is dropped before it reaches the developer.

Majority voting is deliberately **not** used here. Its purpose is to suppress false
positives before an expensive decision, and no decision downstream of these verifiers is
expensive — see the next section. One verifier per lens.

All five are still the design. Only the last one lost its enforcement. The abandoned Workflow
constrained the answer with a JSON schema — `refuted`, `verdict` and `anchor`, all three
required — so a verdict without an anchor could not be returned at
all. `run/close.ts:107` spawns a plain `claude -p` and records whatever text comes back, and
the anchor rule now lives only in the lens's own brief (`agents/goal-run-lens.md`). Nothing
rejects an unanchored finding any more. That is a prompt where there used to be a schema, and
it should be read as a regression rather than as a simplification.

## Calibration: how much to trust this layer

Not much, and by design. Measured against human ground truth, LLM code judgement reaches
Kappa ≈ 0.21 on Java and ≈ 0.10 on Python; in one systematic study half the wrong Java
implementations were judged correct.[^judge] Requirement-conformance judgement specifically
suffers **systematic overcorrection** — the judge flags conformant code as non-conformant.

That is not a reason to skip the layer. It is the reason the layer is advisory, and the
reason the **specification conformance** lens is the one to read most sceptically: it is
precisely the task the literature measures as over-flagging. Expect false positives from it and
read them as prompts to look, never as defects.

## Hard rule: a finding never halts the run

The gate halts, because an exit code cannot be wrong. A verifier is a model: it produces
false positives. A false positive that kills a provably-green run at 3am costs more than
the finding is worth.

Findings are **advisory**, and the code is built so they cannot be anything else: by the time
the lens is asked, every slice is committed and — under `commit+pr` — already pushed and
carried by an open pull request. Nothing about its answer changes what the run does next.

Which makes the whole layer dependent on a place to deposit a non-blocking signal, and that is
the weakest part of it. The findings go to `<plan>.run.log`, through `reporter.record()`
(`run/report.ts`), in a directory the preflight *requires* to be gitignored
(`run/preflight.ts:93`). Not the pull request body — that is built from iteration headings
alone (`run/publish.ts:47-55`). Not an issue comment — nothing in the runner writes one. A
signal produced at 3am and deposited in an ignored file beside the plan is a signal whose only
reader is whoever thinks to open it.

Worth recording how that came about, because it is the failure mode of a port rather than a
design decision: the earlier bash runner appended an advisory agent's own words to the log, the
port to node dropped the append outright, and a lens finding existed only for as long as the
process that asked for it. `record()` exists because that was noticed and put back — its own comment
says so. The layer was silently worthless for the length of one generation.

## Promotion principle

**Every lens that can become a command must become a command.** Model judgment is the last
resort, not the first. This is also what the evaluation literature converges on: the
mitigation that actually moves judge accuracy is a *fix-guided verification filter* that
**executes** the original and the corrected implementation against tests, rather than any
refinement of the prompt.[^complexity]

The sensitivity lens is the worked example, and it has since been carried out. As a question
it was "would this test fail if the rule broke?" As a command it is: set the implementation
aside, run the slice's test, require RED, restore. That is an exit code, not an opinion, and
`goal-gate.ts` runs it on every iteration that declares a `test_files` / `impl_files` split.
The finer industrial form is mutation testing (Infection, Stryker) scoped to the touched
files — listed as an opt-in criterion in `templates/done-criteria.template`, not wired in.

A lens promoted to a command moves out of this document and into the iteration's `gate`
block, where it halts like everything else.

The principle has a blind spot it did not have when it was written, and it is about *where* a
promoted command ends up running. `run/sweep.ts` replays every `gate2..N` and `dodN` command a
plan declares against the untouched tree, before the first iteration starts. Promoting a lens
to a command therefore also promotes it to something that runs at preflight, on a tree it was
never written to judge. `gate1` is carved out of the sweep because on an untouched tree it is
*supposed* to be red; a promoted lens landing anywhere else gets no such carve-out, and a
question that only makes sense about a delivered slice will be asked about an empty one.

## The lens

One, asked once, at the close of a run.

| Lens | The question | What it catches | When |
|---|---|---|---|
| **Specification conformance** | Does the delivery match each iteration's *Goal*, or a comfortable reading of it? | scope quietly narrowed to what was easy to make green | once, after the global Definition of Done passes |

It compares code to **intent**, which is the one comparison no exit code performs. That is the
whole selection rule, and it is why this is the one still being asked.

Two things about its scope are deliberate and worth stating, because neither is what the
earlier design assumed.

**It is briefed from the plan's ticked boxes, not from what this run landed.** `run/close.ts:53`
re-reads the plan from disk and takes every box that carries an `[x]`, this run's own or an
earlier run's. The reason is that a plan delivered across several runs would otherwise be
judged in whatever fragment the last run happened to land — three iterations refuted against
each other's absence. The cost is that a resumed run re-judges work an earlier lens already
looked at.

**It never runs on the runs that would need it most.** The call sits inside the branch taken
when the global DoD passes (`run/close.ts:55-110`), and a gate refusal exits inside the
iteration loop without reaching `close()` at all (`run/iteration.ts:191-193`). So a halted run
gets no lens, no reviewer and no audit report, and a halt is the outcome whose reading is worth
the most.

## The reviewer asks a different question

`agents/goal-run-reviewer.md` is a second advisory model in the same closing slot
(`run/close.ts:80`), and the boundary between the two is the point of having both.

The lens asks one closed question about **intent**: does what landed implement what the plan
declared. It is explicitly told not to mention style, naming, coverage or architecture, and it
returns one anchored sentence per iteration.

The reviewer asks about the **code**: design, error handling, security posture, and whether it
matches this project's own conventions — its brief names that as "the reading a gate is not
built to give". It posts one GitHub review with inline comments and may never request changes,
since the branch it is reading has already shipped.

They are the two halves of what an exit code cannot see, and keeping them apart is the same
rule as "one lens per verifier": a single agent asked both questions answers the easy one.
Neither blocks. The reviewer is also what fills the *Quality — advisory* row of
`target-harness.md`, which had no named mechanism until it was wired.

It has never fired. `run/close.ts` only reaches it when the pull request was successfully
marked ready, and no run has taken that path since it was added.

## What is no longer asked, and what answers it instead

A lens whose question a mechanism already answers is not a second opinion, it is a second
bill. Four were removed for that reason. One had never existed outside this document. And two
that survived that cut were lost to the port instead, which is a different and worse reason.

| Lens | Answered instead by |
|---|---|
| **Sensitivity** | the gate's bite check — `impl_files` set aside, `gate1` required to fail — on every iteration that declares `test_files`, not just the ones a lens was dispatched for |
| **Invariant** | the sequence test `grill-adversarial` assigns to an owning iteration, which lands in that iteration's `gate1` |
| **Accumulation** | the regression wall, which replays the gate commands of every ticked iteration |
| **Reversibility** | the existing suite staying green, as `dod1` — but see below |
| **Blast radius** | nothing: it was specified here and never implemented. The blast radius is established at planning time by `/goal:run-issue`, with a human reading the consumer list |
| **Ripple** | nothing, and by accident. It asked whether iteration N left N+1 doable exactly as written, and the runner has no per-iteration advisory stage left to carry it |
| **Completeness** | nothing, and by accident. It asked what the plan's Business intent implied that no iteration covered — a question the surviving conformance lens explicitly does not ask, since it judges against declarations rather than past them |

Two of those rows have shrunk since they were written, and both shrank the same way — the
answering mechanism turned out to run less often than the lens would have.

The bite check **skips** an iteration that declares no `test_files` (`gate/bite.ts:52-57`), and
`plan-guard.ts:18` hashes only `gateN=` and `dodN=` lines, so emptying `test_files` is an edit
a supervised repair may legally make and the guard will certify. The promotion from opinion to
exit code has an unguarded exit.

The Definition of Done runs **once, at close** (`run/close.ts:47`), after every iteration has
already been committed and, under `commit+pr`, pushed (`goal-run.ts:92-98`). So "the existing
suite is still green" is answered after publication rather than per slice, which is a weaker
answer than the retired lens gave.

Removing the retired lenses also removed the per-iteration fact extraction that only they
consumed — the `Delivery:`, invariant-count and `test_files` probe, and the tab-positional
parsing that read it back.

## When a lens runs at all

There is nothing left to decide at 3am, and nothing left to switch off either. The `args.lenses`
flag and the remote `skip-lenses` control belonged to the abandoned Workflow; the current
runner exposes no flag, no environment variable and no remote channel. The lens is asked
whenever the global DoD passes, and not otherwise.

That trades a decision for a default. The judgement that used to be the developer's before a
run — a mechanical slice, a documentation-only slice, or one whose goal is fully expressed by
its gates is not worth a verifier — no longer has anywhere to be expressed. It is a defensible
default only because the stage now costs one call instead of `2N`.

## Cost

At most one call for the lens and one for the reviewer, both at close, both conditional, plus
the auditor, which is not part of this layer. A run of N landed iterations costs the same as a
run of one.

That is the whole change from the design this note first described, where the cost was `2N`
verifiers plus a closing one. It is also why the all-or-nothing argument that used to justify
the flag no longer applies: there is no partial pass to mistake for a verdict, because there is
only one pass.

## Honest limit

These are models judging models. They reduce a failure class, they do not eliminate it, and
they cannot be the reason the pipeline is trusted. The gate is why the pipeline is trusted.
This layer is why the gate's blind spot is visible.

The measured numbers in *Calibration* above are the honest expectation: this layer will
miss real defects and invent unreal ones. It earns its place only because it is free to be
wrong — nothing downstream of it is automatic.

---

[^judge]: *Are LLMs Reliable Code Reviewers? Systematic Overcorrection in Requirement Conformance Judgement* — <https://arxiv.org/html/2603.00539>
[^complexity]: *On the Effectiveness of LLM-as-a-judge for Code Generation and Summarization* — <https://arxiv.org/pdf/2507.16587>
[^halluc]: same source; hallucinated findings are the largest single category of false negatives.
