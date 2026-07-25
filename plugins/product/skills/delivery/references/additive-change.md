# Additive change — modifying what exists without breaking it

The single rule underneath everything here: **the deploy that introduces the replacement
must not remove what it replaces.** Add, migrate, then remove — in separate deploys, and
therefore separate slices.

This is not ceremony. During any rolling deploy, blue/green window, or cached client
session, **both versions run at the same time**. A change that is only correct after
every consumer updated is a change that is broken during the window it takes.

## 1. Purely additive — the free case

A new endpoint, a new screen, a new nullable column, a new optional field, a new event
type: nothing existing reads it, so nothing existing can break. Ship it unflagged, in its
own slice, as early as you like.

This is why `product:vertical-slice` prefers splits whose early slices *add*: they are
the ones that reach production with no strategy at all.

Two things still bite:
- a new **non-nullable** column with no default breaks inserts from the running version →
  nullable or defaulted first, tighten later.
- a new **required** field in a request contract is not additive → see §5.

## 2. Changing existing behaviour — flag it

The new behaviour ships beside the old one, off by default. Covered in
`feature-flags.md`. What matters for the slicing: the flag makes the slice's acceptance
criterion honest — *"with the flag off, the existing tests still pass"* is a command that
exits 0, which is what an autonomous run needs to advance.

## 3. Replacing an implementation — branch by abstraction

For legacy code with no seam, or any swap of a component the whole app depends on.

1. **Introduce the abstraction over the current implementation.** Pure refactor, no
   behaviour change, tests green. Shippable on its own.
2. **Move call sites onto the abstraction**, in slices if there are many. Still no
   behaviour change.
3. **Implement the new version behind the abstraction**, selected by a flag.
4. **Flip**, observe, keep the old one reachable.
5. **Delete the old implementation and the flag** — see `cleanup.md`.

Steps 1–2 are valuable on their own even if the replacement is cancelled, which is what
makes them a legitimate slice rather than a technical enabler.

**Strangler fig** is the same shape at application scale: route a slice of traffic to the
new system, grow the routed set feature by feature, retire the old one when nothing
routes to it. It only works if you deliver often — a strangler with quarterly releases is
a big-bang rewrite with a nicer name, because you learn nothing between the cuts.

## 4. Schema — expand / contract (parallel change)

For any change to a shared store: rename, retype, split, merge, extract a table.

1. **Expand** — add the new column/table, nullable. The old one is untouched.
2. **Dual write** — the application writes both. Deployable now, both versions coexist.
3. **Backfill** — migrate historical rows, in batches, idempotently, restartable.
4. **Read new** — flip reads to the new column, behind a flag. The old one is still
   written, so the rollback is one flip.
5. **Stop writing old** — a deploy on its own, once reads are proven.
6. **Contract** — drop the old column. Its own slice, with its own trigger condition.

Steps 1–3 are one slice; 4 is a slice; 5–6 are the cleanup slice. Never fewer.

Ordering constraints worth stating in the plan: a **destructive** migration (drop,
rename, narrow a type) can never be in the same slice as the code that stops using it,
and migrations that must run in order cannot be split into parallel tracks.

## 5. API and event contracts

**Additive is compatible; everything else needs a window.**

- Adding an **optional** request field, or a **new** response field, is safe — provided
  consumers are tolerant readers (§6).
- Adding a **required** request field is breaking. Ship it optional with a default,
  migrate the callers, then make it required.
- **Removing or renaming** a response field is breaking. Emit both, announce, remove the
  old one after the deprecation window — logging every read of the old one so you know
  when it hits zero.
- **Changing a type or a meaning** in place is the worst case: no consumer errors, they
  just compute the wrong thing. Use a new field name, always.
- **Events and messages** are worse than APIs: consumers you don't control, replayed
  history, messages in flight during the deploy. Add fields, never repurpose them, and
  version the event type when the shape really changes. Old consumers must keep working
  against new payloads and vice versa.

Where a real break is unavoidable, version the endpoint (`/v2/…`) or the event type, run
both, and make the retirement of `v1` an explicit slice with a usage-based trigger.

## 6. Tolerant reader

Consumers should ignore what they don't know, and depend only on what they need. A client
that deserializes strictly turns every additive producer change into an outage.

Concretely: don't fail on unknown fields, don't depend on field order, don't assume an
optional field is present, and prefer reading two or three fields over binding the whole
payload to a rigid structure.

This is the property that makes the producer's additive changes actually free. If the
project's clients are strict, making one tolerant is a legitimate first slice.

## 7. Validating the new path under real traffic

Before flipping anyone onto the new behaviour:

- **Dark launch** — the new path runs on production traffic with its result discarded.
  Proves it handles real load and real data shapes, with zero user impact.
- **Parallel run** — old and new both execute, the old one's result is served, both are
  compared and the differences logged. The strongest guarantee available for a
  replacement, and the standard tool for migrations where "same output" is the spec.
  Watch the cost: it doubles the work per request, so timebox it.
- **Canary** — a small share of real users on the new path, watching error rate and the
  business metric. What you graduate to once the parallel run is quiet.

Each of these is a slice with a measurable acceptance criterion, which is what lets an
autonomous run treat it like any other iteration.

## 8. The reversibility check

Before declaring a slice's strategy done, answer: **if this misbehaves in production at
3pm, what do I do?** Acceptable answers are "flip the flag", "route back", "it's additive
and nothing reads it". "Revert the commit and redeploy" means the slice is not safe yet —
usually because a removal snuck in beside an addition.
