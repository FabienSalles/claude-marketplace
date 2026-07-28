# Adversarial verification — design note

Three lenses are implemented in `workflows/goal-auto.js`, off unless `args.lenses` is true.
The rest of this note is the reasoning behind them, kept so it is not re-derived from scratch —
and, below, the record of which lenses were retired and to what.

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

The sensitivity lens is the worked example, and it has since been carried out. As a question
it was "would this test fail if the rule broke?" As a command it is: set the implementation
aside, run the slice's test, require RED, restore. That is an exit code, not an opinion, and
`goal-gate.ts` runs it on every iteration from the `test_files` / `impl_files` split. The finer
industrial form is mutation testing (Infection, Stryker) scoped to the touched files — listed as
an opt-in criterion in `templates/done-criteria.template`, not wired in.

A lens promoted to a command moves out of this document and into the iteration's `gate`
block, where it halts like everything else.

## The lenses

Three, and the set is fixed rather than derived: what survives is what no mechanism already
asks.

| Lens | The question | What it catches | When |
|---|---|---|---|
| **Specification conformance** | Does the delivery match the iteration's *Goal*, or a comfortable reading of it? | scope quietly narrowed to what was easy to make green | every landed iteration |
| **Ripple** | Does this iteration leave iteration N+1 doable exactly as written? | plan drift, discovered at iteration N+3 instead of N | every landed iteration but the last |
| **Completeness** | What did the plan not cover that its Business intent implies? | the gap nobody wrote down | once, over the whole branch |

Both surviving per-iteration lenses compare code to **intent**, which is the one comparison
no exit code performs. That is the whole selection rule.

## What was retired, and to what

A lens whose question a mechanism already answers is not a second opinion, it is a second
bill. Four were removed for that reason, and one had never existed outside this document.

| Retired lens | Answered instead by |
|---|---|
| **Sensitivity** | the gate's bite check — `impl_files` set aside, `gate1` required to fail — on every iteration, not just the ones a lens was dispatched for |
| **Invariant** | the sequence test `grill-adversarial` assigns to an owning iteration, which lands in that iteration's `gate1` |
| **Accumulation** | the regression wall, which replays the gate commands of every ticked iteration |
| **Reversibility** | the existing suite staying green, already `dod1`, and the lens was already skipped whenever `Delivery:` was additive |
| **Blast radius** | nothing: it was specified here and never implemented. The blast radius is established at planning time by `/goal:run-issue`, with a human reading the consumer list. |

Removing them also removed the per-iteration fact extraction that only they consumed — the
`Delivery:`, invariant-count and `test_files` probe, and the tab-positional parsing that read
it back.

## When a lens runs at all

The set no longer depends on the plan, so there is nothing to derive and nothing to compose
at 3am. `conformance` runs on every landed iteration, `ripple` on all but the last,
`completeness` once at the end. The whole stage is off unless `args.lenses` is true, and the
`skip-lenses` control drops it remotely.

Judgement about *whether* a lens is worth running moved where judgement belongs: a mechanical
slice, a documentation-only slice, or one whose goal is fully expressed by its gates simply is
not worth `args.lenses`, and that is the developer's call before the run, not the loop's during
it.

## Cost

One verifier per lens. A run of N landed iterations costs `2N` verifiers, minus one for the
last iteration, plus one closing verifier. Under a token budget, leave `args.lenses` off: the
stage is all-or-nothing on purpose, because a partial advisory pass invites reading its silence
as a verdict.

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
