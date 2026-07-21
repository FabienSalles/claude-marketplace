# Usage guide — cherry-picked `superpowers` + `pocock` skills

How and when to use the skills added by the `superpowers@fabien-claude-marketplace` plugin (cherry-picked from `obra/superpowers`) and `pocock@fabien-claude-marketplace` (cherry-picked from `mattpocock/skills`).

## Overview — triggering

| Skill | Plugin | Trigger | When Claude loads it |
|---|---|---|---|
| `verification-before-completion` | superpowers | Auto | Claude is about to say "done / passes / fixed" |
| `systematic-debugging` | superpowers | Auto | You report a bug, a failing test, or unexpected behavior |
| `grill-me` | pocock | Auto | You ask to be "grilled" / "stress-test my plan" |
| `grill-with-docs` | pocock | Auto | Same as `grill-me`, when a `CONTEXT.md` / `docs/adr/` is present |
| `zoom-out` | pocock | **Manual only** (`disable-model-invocation: true`) | You invoke `/zoom-out` or name the skill |

> `writing-plans` (obra) was cherry-picked at first, then **dropped in 5.1.1** — real overlap with `/spec-first-dev`. See [`plugins/superpowers/README.md`](../plugins/superpowers/README.md) for the skip rationale.

---

## 1. `zoom-out` (pocock) — user-trigger only

**What it does.** Forces Claude to go **up a level of abstraction** instead of diving into files. It replies with a map of the relevant modules and callers, using the project's domain glossary (`CONTEXT.md` if present).

**When to use**

- ✅ You inherit a codebase you don't know and want the architecture before touching anything.
- ✅ You get a ticket on an opaque module (`Refund`, `Beneficiary`, `ContractStatus`…) and want to know where it lives in the system.
- ✅ You come back to a project after months and have forgotten the boundaries.

**When NOT to use**

- ❌ You already know the area well — you'll just waste a round-trip.
- ❌ You want a precise answer (a method signature, a constant's value) — use `Grep` / `Read` directly.

**How to invoke.** `zoom-out` has `disable-model-invocation: true`, so Claude never triggers it on its own. Be explicit:

```
/zoom-out src/Subscription/Individual
```

Or in natural language: *"Use the zoom-out skill on src/Subscription/Individual"*.

**Example.** Instead of *"read src/Subscription/Individual and explain it"* (which makes Claude read files one by one and summarize), `zoom-out` first looks for `CONTEXT.md` / `docs/adr/` and the callers from other bounded contexts, then answers with a system-level map: who calls this module, which events it publishes and who consumes them, and the glossary terms that disambiguate it from neighbors.

---

## 2. `grill-me` (pocock) — lightweight Socratic interview

**What it does.** Inverts the usual "Claude proposes verbosely / you push back" loop. Instead, **Claude grills you** — one question at a time, walking the decision tree, with a recommendation at each branch.

**When to use**

- ✅ A one-off decision outside feature-dev: choosing between two libraries, scoping a refactor, designing a hook, structuring a test fixture.
- ✅ You have a fuzzy idea and want Claude to force clarification before it writes any code.
- ✅ You want to stress-test a plan you already wrote.

**When NOT to use**

- ❌ You're starting a full feature — use `/spec-first-dev`, which is more structured (business round + system round + ubiquitous language + a validation gate).
- ❌ Everything is already clear in your head — you'll just waste back-and-forth.

**vs `/spec-first-dev` Phase 1**

| | `/spec-first-dev` | `grill-me` |
|---|---|---|
| Structure | Fixed checklist (business + system questions) | Emergent, depends on the topic |
| Output | Formal markdown synthesis (UL / user flow / rules / scope) | No persisted output |
| Scope | Full feature development | Any single decision |

**How to invoke.** Auto-triggers on phrases like *"grill me on this hook before I write it"* or *"stress-test my architecture plan"*.

**Example — a BSD/GNU lint hook**

```
You:    "grill me on the BSD/GNU lint hook"

Claude: Q1: Should the hook warn or block?
        Rec: warn (least disruptive for a portability lint).
You:    warn

Claude: Q2: Detect by string match on the command, or parse the bash AST?
        Rec: string match (zero deps, ~50 lines of portable bash).
You:    string match

Claude: Q3: Target only the Bash tool, or also Edit/Write on .sh files?
        Rec: both — a freshly-written .sh can contain `grep -P` that ships as-is.
You:    Bash only for v1
```

By the end you've aligned on the key decisions before a single line of code.

---

## 3. `grill-with-docs` (pocock) — Socratic interview + domain-doc maintenance

**What it does.** Like `grill-me`, **plus** live updates to `CONTEXT.md` (the bounded context's glossary) and sparing creation of ADRs (Architecture Decision Records) as decisions crystallize.

**When to use**

- ✅ You work on a DDD project that already has a `CONTEXT.md` or `docs/adr/`.
- ✅ You want ubiquitous-language rigor beyond "it compiles" — an imprecise term should be challenged immediately.
- ✅ You're preparing a structural architecture decision (event sourcing for orders, read/write separation…) that deserves an ADR.

**When NOT to use**

- ❌ A project with no glossary and no DDD culture — `grill-me` is enough; don't bootstrap a `CONTEXT.md` nobody will maintain.
- ❌ A purely technical decision with no impact on the domain language (e.g. picking an HTTP transport) — use `grill-me`.

**vs `grill-me`.** `grill-me` is a pure interview. `grill-with-docs` also updates `CONTEXT.md` the moment a term is resolved, and proposes an ADR only when all three criteria hold:

1. **Hard to reverse** — changing your mind later would be costly.
2. **Surprising without context** — a future reader would wonder why.
3. **Real trade-off** — there genuinely were several options.

**How to invoke.** Same phrases as `grill-me`. Claude detects a `CONTEXT.md` / `docs/adr/` and switches to `grill-with-docs`.

**Example.** Grilling the redesign of a `Beneficiary` module: Claude reads `CONTEXT.md`, sees `Beneficiary` is already defined, and opens by pinning the boundary — is the redesign about `Beneficiary` only, or also `Insured` (direct insured parties)? Once you answer, it updates `CONTEXT.md` inline to record the boundary, then continues the interview. If a decision turns out to be structural (e.g. keep a 1:N relation but add a uniqueness constraint), it proposes an ADR.

---

## 4. `verification-before-completion` (obra) — "evidence before claims"

**What it does.** A self-verification discipline. Before Claude says "done", "passes", "fixed", or "looks good", it **must** have run the verification command in the current message and read the output. *Confidence is not evidence.*

**Why it matters.** A recurring failure mode is claiming success too early — announcing "done" without having run the tests. This skill addresses that directly by gating the claim on real, pasted output.

**When to use**

- ✅ Nothing to do — it auto-triggers whenever Claude is about to claim success.

**How to force it if Claude forgets**

- *"verify before concluding"*
- *"show me the proof it passes"*
- *"run the tests and show me the output before saying done"*

**Effect.** Before: *"I fixed the bug, tests pass now."* After: *"I just ran `make php/qa`: 12/12 tests pass (exit 0). The bug is fixed."* — with the command output included in the message.

---

## 5. `systematic-debugging` (obra) — 4-phase debugging method

**What it does.** Forces a **systematic** method before any fix:

1. **Root-cause investigation** — read the errors, reproduce, check recent changes, instrument the boundaries in multi-component systems.
2. **Pattern analysis** — understand *why*, not just *where*.
3. **Fix design** — target the root cause, not the symptom.
4. **Verification** — a red-green cycle proving the fix holds.

**When to use**

- ✅ Nothing to do — auto-triggers on "bug", "test fails", "it crashes", "unexpected behavior", "build error", "perf problem".
- ✅ Bugs that span several services (API + worker + DB) — Phase 1 boundary instrumentation is where it earns its keep.

**How to force it**

- *"apply systematic-debugging"*
- *"don't propose a fix before finding the root cause"*

**Example.** Reported: *"subscriptions have been failing silently since yesterday."* The skill drives Phase 1 — look at the API logs, ask for a failing user id to reproduce, run `git log --since=yesterday` (three commits, one on the validation service), and instrument API → Domain → Repository to see where it breaks — before proposing any fix, instead of guessing "it's probably the validator".

---

## Quick decision table

| Situation | Skill |
|---|---|
| Start a full feature | `/spec-first-dev` *(house workflow, not a cherry-picked skill)* |
| One-off decision outside feature-dev (lib, hook, isolated refactor) | `grill-me` |
| Same, but a DDD project with `CONTEXT.md` / ADRs | `grill-with-docs` |
| Enter an unfamiliar codebase | `/zoom-out` |
| Bug, failing test, unexpected behavior | `systematic-debugging` *(auto)* |
| Claude just said "done" with no proof | `verification-before-completion` *(auto)* |
| Implementation plan for a feature | `/spec-first-dev` *(house workflow, more structured than writing-plans)* |

---

## References

- Upstream `obra/superpowers`: https://github.com/obra/superpowers (MIT)
- Upstream `mattpocock/skills`: https://github.com/mattpocock/skills (MIT)
- Plugin READMEs: [`plugins/superpowers/README.md`](../plugins/superpowers/README.md), [`plugins/pocock/README.md`](../plugins/pocock/README.md)
- House workflow to compare against: `/spec-first-dev` ([`plugins/common/commands/spec-first-dev.md`](../plugins/common/commands/spec-first-dev.md))
