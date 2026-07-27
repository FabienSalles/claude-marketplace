# Adversarial verification — design note

Not implemented. Parked here so the reasoning is not re-derived from scratch.

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

**Adversarial verification**: after an iteration's gate has passed, one or more verifiers
are asked to *refute* what was delivered, each through a distinct **lens**.

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

## Calibration: how much to trust this layer

Not much, and by design. Measured against human ground truth, LLM code judgement reaches
Kappa ≈ 0.21 on Java and ≈ 0.10 on Python; in one systematic study half the wrong Java
implementations were judged correct.[^judge] Requirement-conformance judgement specifically
suffers **systematic overcorrection** — the judge flags conformant code as non-conformant.

That is not a reason to skip the layer. It is the reason the layer is advisory, and the
reason the **specification conformance** lens below is the one to read most sceptically:
it is precisely the task the literature measures as over-flagging. Expect false positives
from it and read them as prompts to look, never as defects.

## Hard rule: a finding never halts the run

The gate halts, because an exit code cannot be wrong. A verifier is a model: it produces
false positives. A false positive that kills a provably-green run at 3am costs more than
the finding is worth.

Findings are **advisory**. They go into the PR body and the issue comment, and the
developer adjudicates them at their desk with the code in front of them.

This makes the whole layer dependent on a place to deposit a non-blocking signal. Without
the remote channel (push on halt, `gh issue comment`, notification), an advisory signal
produced at 3am is a signal nobody reads.

## Promotion principle

**Every lens that can become a command must become a command.** Model judgment is the last
resort, not the first. This is also what the evaluation literature converges on: the
mitigation that actually moves judge accuracy is a *fix-guided verification filter* that
**executes** the original and the corrected implementation against tests, rather than any
refinement of the prompt.[^complexity]

The sensitivity lens is the worked example. As a question it is "would this test fail if the
rule broke?" As a command it is: revert the implementation hunk, run the slice's test,
require RED, restore. That is an exit code, not an opinion. The industrial form is mutation
testing (Infection, Stryker) scoped to the touched files — already listed as an opt-in
criterion in `templates/done-criteria.template`.

A lens promoted to a command moves out of this document and into the iteration's `gate`
block, where it halts like everything else.

## The lenses

| Lens | The question | What it catches |
|---|---|---|
| **Sensitivity** | Would this test fail if the rule it claims to cover broke? | the test that asserts nothing, the mock that hides the truth |
| **Reversibility** | Is the previous behaviour still reachable? | the executor that "tidied up" the fallback in the PR that introduces what falls back to it |
| **Specification conformance** | Does the delivery match the iteration's *Goal*, or a comfortable reading of it? | scope quietly narrowed to what was easy to make green |
| **Invariant** | Construct a sequence that violates `<I_n>` after this iteration. | broken state machines on interactive/front slices |
| **Blast radius** | Name a caller of something in `## Blast radius` whose behaviour changed. | an undeclared contract break under `no-bc-break` |
| **Ripple** | Does this iteration leave iteration N+1 doable exactly as written? | plan drift, discovered at iteration N+3 instead of N |
| **Accumulation** | Run against the whole branch, not the slice. | regressions that live between iterations, not inside one |
| **Completeness** | What did the plan not cover that its Business intent implies? | the gap nobody wrote down |

The invariant, blast-radius and ripple lenses read sections `/goal:run-issue` already
produces (`## States, invariants & transitions`, `## Blast radius`, the next iteration).
They cost nothing to declare and are the return on investment of the adversarial grill.

## When a lens is required, and when it is not

Derived from what the iteration already declares. No new judgment at run time.

**Required:**

| Condition, read from the plan | Lens |
|---|---|
| The iteration touches an invariant listed in `## States, invariants & transitions` | **Invariant**, one verifier per invariant touched |
| Its `Delivery:` is anything other than `additive` (flag, expand step, compat path) | **Reversibility** |
| Plan is `no-bc-break` **and** the iteration touches a `## Blast radius` entry | **Blast radius** |
| It adds or changes a test covering a business rule | **Sensitivity** — and prefer the command form |
| It is not the last iteration | **Ripple** |
| Once, at the end of the run | **Accumulation** + **Completeness** |

**Optional, and usually skipped:**

- A purely mechanical iteration: rename, move, path rewrite. The diff is verifiable by
  `grep`, and `gate1` already does it. No lens.
- A documentation-only iteration. No lens.
- An iteration whose *Goal* is fully expressed by its gates, so that passing them leaves
  nothing to interpret. Rare, but real: "`grep -r <flag>` returns nothing" is the whole
  goal.

**Specification conformance** is the odd one: it applies to every iteration that is not
mechanical, because it is the lens for the failure mode the gate structurally cannot see.
Treat it as the default lens and the others as additions.

**The lens set is derived, not declared.** The rules above read sections `/goal:run-issue`
already produces, so no new plan syntax is needed and the derivation is reproducible: the
same plan always yields the same lenses. `workflows/goal-auto.js` applies them in its survey
stage. Nothing here is composed at 3am by whatever is running the loop — the inputs were all
frozen when the plan was locked.

## Cost

One verifier per lens, per iteration. A mechanical slice costs nothing extra; a slice
touching two invariants under a flag costs four verifiers. Under a token budget, drop the
lenses in this order: Completeness, Ripple, Accumulation, Blast radius, Reversibility,
Invariant, Specification conformance. Never drop the last one.

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
