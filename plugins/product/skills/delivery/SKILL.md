---
name: delivery
description: "ACTIVATE whenever an iteration or slice has to reach production without blocking on the rest of the work, or when a change touches behaviour that already exists and users depend on. ACTIVATE for 'feature flag', 'can we ship this half-done', 'breaking change', 'BC break', 'backward compatible', 'schema migration', 'zero-downtime migration', 'expand contract', 'dark launch', 'canary', 'progressive rollout', 'strangler', 'branch by abstraction', 'kill switch', 'remove the flag', 'deploy vs release'. Picks the cheapest flag mechanism that fits THIS project (env var → config → DB → SaaS), designs the change as additive so nothing existing breaks, and plans the cleanup slice that deletes the flag and the old path once it is live. DO NOT use for: deciding how to cut the work into slices (see product:vertical-slice), Git branching workflow, or CI/CD pipeline configuration."
version: "1.0"
---

# Delivery — ship each slice without blocking

> Companion skill: **`product:vertical-slice`** — it decides *what* each slice contains.
> This one decides *how* that slice reaches production while the rest is unfinished, and
> what gets deleted afterwards. A slice with no delivery strategy is a slice that waits
> for the others, which defeats the split.

## The core move: separate deploy from release

**Deploying** puts code in production. **Releasing** exposes behaviour to users. Merging
those two is what forces long branches, big-bang integration and "we'll ship it all at
the end".

Once they are separate, an unfinished feature can be in production **inactive**, every
slice proves the existing behaviour still holds, and activation becomes a product
decision instead of an engineering event.

The objection is always the same — *"a feature flag is extra work"*. It is. So are long
branches: re-reviews of a PR that keeps moving, context switching, CI replayed at every
update, conflicts cascading across branches, the stabilization when two weeks of work
integrate at once, the refactor nobody does because whoever merges second pays for the
first. That cost is real but invisible, and it appears in no estimate. The flag's cost is
30 minutes, visible and bounded.

## Procedure

### 1. Classify the change

The strategy follows from what the change does to **existing** behaviour:

| The slice… | Strategy | Detail |
|---|---|---|
| adds something nobody uses yet (new endpoint, new screen, new column) | **ship it additive, unflagged** | `references/additive-change.md` §1 |
| changes behaviour users already rely on | **flag it** — old path stays default | §2 + `references/feature-flags.md` |
| replaces an existing implementation | **branch by abstraction + flag** | §3 |
| changes a schema or a contract others read | **expand / contract** | §4, §5 |
| removes something | **only after** usage is provably zero | `references/cleanup.md` |
| is a pure refactor, behaviour identical | ship it, no flag — tests are the proof | — |

When two apply, the stricter one wins. A schema change **and** a behaviour change is
expand/contract *plus* a flag, sequenced in that order.

**When the caller has explicitly allowed breaking changes** (in the `goal` workflow, a
spec whose `Delivery mode:` is `allow-bc-break`), do not re-impose the additive path: the
developer was shown the list of consumers that break and chose this. Apply the table to
everything **outside** that list, and for the items inside it, still name what breaks so
the PR states the contract change. An informed break is a decision; a silent one is a bug.

### 2. Choose the flag mechanism that fits THIS project

There is no default answer, and a SaaS flag platform for a solo project is as wrong as a
hardcoded constant for a multi-tenant product. **Look at the project before deciding** —
does it already have a flag mechanism? A config layer? A settings table? Reuse it.

Then match the mechanism to what the flag must actually do:

| Need | Cheapest mechanism that works |
|---|---|
| off in prod, on in dev, flipped at the next deploy | **env var / build-time config** |
| flipped without a deploy, same for everyone | **runtime config** (DB row, config service, cached) |
| on for a beta panel, internal team, or one tenant | **per-user / per-tenant setting** (DB) |
| percentage rollout, A/B measurement, targeting rules | **a flag platform** (Unleash, Flagsmith, LaunchDarkly…) |
| emergency shutdown of an integration | **ops kill switch** — runtime, no deploy, documented |

Prefer the top of the table. Moving up costs a refactor you may never need; moving down
costs nothing. And a flag that needs a deploy to flip is not a rollback plan — if the
slice carries real production risk, it needs a runtime mechanism.

`references/feature-flags.md` covers the four flag types (release, experiment, ops,
permissioning), where to put a flag in the code, how to test both branches, and the
mistakes that create flag debt.

### 3. Design the change as additive

The rule that makes everything else work: **never break an existing consumer in the same
deploy that introduces its replacement.** Add the new thing beside the old one, move
traffic, then remove — three steps, three slices, never one.

That applies to database columns, API fields, event payloads, config keys, public
functions and template blocks alike. `references/additive-change.md` gives the concrete
sequences: expand/contract for schema, additive-only contracts, tolerant reader, branch
by abstraction, strangler fig, and dark launch / parallel run / canary for validating the
new path against the old one under real traffic.

### 4. Make cleanup an explicit slice

A flag that is never removed is the debt everyone predicted. But cleanup cannot be a
vague intention either: it needs a **trigger condition** (what must be true in production
before it may merge), a **written diff**, and a **plan of its own**.

Its own plan, not the last slice of the feature's. The trigger only becomes true once the
feature is live, so a cleanup slice inside the feature plan would delete the fallback in
the very PR that introduces what falls back to it. It stacks as a separate PR instead, and
§5 covers what that changes for an unattended run.

Cleanup is a real slice with a real diff, not a checkbox. `references/cleanup.md` has the
slice template, how to prove the old path is dead before deleting it, and the deletion
order.

**Whose cleanup, and when.** Two things decide it, and they are worth asking explicitly
rather than defaulting:

- A change made **in place**, breaking its consumers knowingly, leaves nothing behind:
  no flag, no compat path, so no cleanup. The cost was paid at the break.
- A change made **additively behind a flag** always creates one. The real question is when
  the cleanup is *written*, not when it merges: writing it later means a future session
  rebuilding the context, and a cleanup nobody schedules is how flag debt accumulates.
  Writing it immediately keeps it cheap, at the cost of a PR that can drift if the feature
  changes during review.

**Writing the cleanup early does not shorten the soak.** Its own PR stacks on the feature
PR and stays a **draft**: the feature merges and runs in production with the flag on, the
old path still there, and the cleanup waits. The trigger stops gating when the code is
written and starts gating when the PR is marked ready. That is the whole point of a second
PR, and it is why deleting the old path before the new one is live is the one ordering
that cannot work.

### 5. Adapt to the execution mode

**Manual mode** (you review each iteration): flip the flag yourself when the diff and
the metrics convince you. Cleanup can be a quick follow-up you do by hand.

**Auto mode** (`/goal:auto` — an agent runs the plan unattended): three rules keep an
autonomous run from causing production damage.

- **The flag defaults to off, and the agent never flips it.** Activation is a product
  decision that needs eyes on production. An agent that ships code cannot judge that.
- **Adding and removing never share a slice, and cleanup never shares a plan** (§4). The
  agent must be able to halt after the additive slice and leave a coherent system. In the
  `goal` workflow that carve-out is automatic, and `/goal:auto` refuses to start on a
  feature plan that still contains a cleanup iteration.
- **Every slice keeps the existing test suite green.** That is what proves the additive
  change did not disturb what already works, and it is the only regression signal an
  unattended run has.

## What "no regression" actually requires

The reason additive delivery holds is that each slice can be **proven** not to have
broken anything. Three things make that true, and their absence is why teams end up
batching releases:

- **Tests that cover the existing behaviour** — the ones you didn't write are the ones
  that make you afraid to deploy. When a slice touches an untested existing path, adding
  its characterization test *is* part of that slice.
- **Observability** — logs, metrics and errors on both the old and the new path. Without
  it you cannot know the flag rollout is safe, and you cannot know the old path is dead.
- **Small and frequent deploys** — a deploy containing one slice is diagnosable; one
  containing three weeks of work is a stabilization phase. The frequency builds the
  confidence, not the other way around.

If a project lacks these, say so when proposing the strategy: the answer is usually to
add the missing test or the missing log *in the same slice*, not to fall back on a long
branch.

## Anti-patterns

- **The flag that became configuration** — a release toggle nobody removed, now
  load-bearing. Fix the type at creation: release toggles are temporary by definition
  (`references/feature-flags.md` §1).
- **Flags read deep in the domain** — the domain should not know a flag exists. Decide at
  the edge, inject the behaviour. Otherwise every flag permanently complicates the core.
- **Nested or coupled flags** — two flags whose combinations were never all tested. `2^n`
  states, `n` of them exercised.
- **Breaking change plus its migration in one deploy** — works on your machine, fails in
  the rolling window where both versions run at once.
- **Deleting the old path "while we're in there"** — the removal is a separate slice with
  its own trigger, or the rollback becomes a revert of everything.
- **Rollback by reverting a big commit** — that is not a rollback plan, it's a hope. The
  flag is the rollback.
- **Deferring the flag "because the feature is nearly done"** — it is the last 20% that
  turns a two-day slice into a two-week branch.

## References

Read the one that matches the slice at hand:

- `references/feature-flags.md` — flag types, mechanism choice, code placement, testing
  both branches, naming, flag debt.
- `references/additive-change.md` — expand/contract, additive contracts, tolerant reader,
  branch by abstraction, strangler fig, dark launch / parallel run / canary.
- `references/cleanup.md` — proving the old path is dead, deletion order, the cleanup
  slice template.

Sources: [Martin Fowler — Feature Toggles](https://martinfowler.com/articles/feature-toggles.html) ·
[Dark Launching](https://martinfowler.com/bliki/DarkLaunching.html) ·
[Parallel Change](https://martinfowler.com/bliki/ParallelChange.html) ·
[Branch By Abstraction](https://martinfowler.com/bliki/BranchByAbstraction.html) ·
[Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html) ·
[Thierry de Pauw — On the Evilness of Feature Branching](https://thinkinglabs.io/articles/2021/04/26/on-the-evilness-of-feature-branching.html) ·
[DORA — Trunk-Based Development](https://dora.dev/capabilities/trunk-based-development/)
