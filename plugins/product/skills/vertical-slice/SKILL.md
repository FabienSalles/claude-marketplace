---
name: vertical-slice
description: "ACTIVATE whenever a functional spec, user story, Jira US, GitHub issue or feature request has to be broken into iterations, slices, tickets or steps — including inside /goal:run-issue Phase 3, /spec-first-dev, and any planning where you are about to write a list of iterations. ACTIVATE for 'découper', 'split this story', 'too big', 'vertical slicing', 'horizontal slicing', 'INVEST', 'SPIDR', 'iterations', 'MVP first', 'what do we build first', 'this story cannot be split'. Provides 17 splitting techniques, a selection procedure that picks and combines them from the feature's real axis of complexity, the technical constraints and the execution mode (human review vs autonomous agent), plus the anti-patterns that produce fake slices. DO NOT use for: sequencing work inside one already-thin slice (that is TDD — see craft:tdd-workflow-principles), or for how to ship a slice safely (see product:delivery)."
version: "1.0"
---

# Vertical Slicing — split any spec into shippable iterations

> Companion skill: **`product:delivery`** — once the slices exist, that skill decides
> how each one reaches production without blocking (flags, additive change, cleanup).
> Slicing and delivery are two halves of the same decision: a slice you cannot ship
> is not a slice.

## The premise

> No story is so intrinsically complicated that it cannot be split — the position Allen
> Holub argues in his story-slicing and #NoEstimates work.

When someone says a story cannot be split, the real statement is *we haven't found the
axis yet*. This skill is the search procedure for that axis.

A **vertical slice** cuts through every layer (UI → domain → persistence → integration)
and leaves the application **working and observably different** for someone. A
**horizontal slice** (the back-end ticket, the front-end ticket, the migration ticket)
moves the board without moving the product, and its parts only work once the last one
lands — which is the tunnel you were trying to avoid.

The test is not "is it small?" but: **if we stopped right after this slice, would we have
shipped something real?** If the honest answer is no, it is a task, not a slice.

## Procedure

Work these five steps in order. Steps 1–2 are the ones people skip, and they are the
ones that decide whether the split is real.

### 1. Name the core complexity

Ask: **what actually makes this big?** Not "it touches many files" — that is a
consequence. The answer is almost always one of:

- many **user paths** through the same feature (nominal, alternate, error)
- many **business rules**, or one rule with many exceptions
- many **data variations** (formats, types, sources, volumes, locales)
- many **steps** in a workflow
- many **entry points** (web, mobile, API, batch, admin)
- many **actors / permissions**
- an **unknown** (nobody knows if the approach works)
- a **quality attribute** bolted on (performance, security, accessibility, i18n)

Everything below is a way to isolate one of these and defer the rest. The meta-pattern
behind all 17 techniques is the same: **find the core complexity, then reduce the
variations to one path through it.**

### 2. Pick the techniques from that complexity

| The core complexity is… | Reach for | Reference |
|---|---|---|
| user paths | Paths · Simple/Complex | `references/techniques.md` §1, §7 |
| business rules | Rules · Conjunctions · Acceptance criteria | §3, §11, §12 |
| data | Data variations · Zero/One/Many | §4, §17 |
| the UI, not the logic underneath | Interfaces — crudest that works first | §5 |
| workflow length | Workflow steps · Operations (CRUD) | §6, §2 |
| entry points / actors | Entry methods · Roles & permissions | §13, §14 |
| an unknown | Spike **then** re-split — never ship a spike | §10 |
| a quality attribute | Defer performance/security/i18n | §9 |
| foundation everything needs | Major effort · Branch by abstraction | §8, §15 |
| "everything at once" | Hamburger · Elephant carpaccio | §16, §17 |

Read `references/techniques.md` for the full catalogue: each technique with when it
applies, a worked example, and its failure mode. Read it whenever the feature is not an
obvious match for one row above — combining two techniques usually beats forcing one.

**Combining is the norm, not the exception.** Real features get sliced on two axes:
*workflow step × business rule*, or *path × data variation*. Slice on the dominant axis
first, then re-apply the procedure to any slice still too big. Recursion beats trying to
find one perfect cut.

### 3. Apply the technical constraints

A split that ignores the system produces slices that cannot ship. Check these before
freezing anything, and let them **reorder or merge** slices:

- **Shared schema / migrations** — a slice must never leave the DB in a state the
  previous version cannot read. Split the migration expand-first, contract last (see
  `product:delivery`). Migrations that must run in order cannot be parallel tracks.
- **Contracts with other systems** (API, events, messages) — additive changes slice
  freely; breaking ones need a version or a compat window as its **own** slice.
- **Legacy code with no seam** — the first slice introduces the abstraction (branch by
  abstraction), later slices move behaviour behind it.
- **A dependency that is not ready** (an endpoint another team owns, a design not
  finalized) — slice so the unavailable part is *last*, with a stub or a flag holding the
  place. Do not let it gate the slices that are ready.
- **Deployment coupling** — two repos that must ship together are one slice, however
  much you would like them to be two.

### 4. Adapt the granularity to the execution mode

Same feature, same techniques, different slice **size and ordering** depending on who
executes. This is the step that makes a plan actually run.

**Manual mode — you review each iteration** (`/goal` + `/goal:next`, or plain dev):

- Size a slice to **one reviewable diff in one sitting**: roughly one coherent commit,
  the amount you can hold in your head while reading it.
- Put the **risky or uncertain** slice early. Human review is your correction loop, so
  spend it where drift is most likely.
- A slice may end on a judgement call ("does this feel right in the UI?") — you are there
  to make it.

**Auto mode — an agent runs the whole plan unattended** (`/goal:auto`):

- Every slice must be **machine-verifiable**: its acceptance criteria are commands that
  exit 0/1. A slice whose proof is "looks right" cannot gate an autonomous loop — either
  give it an assertable test, or keep it out of the auto run.
- Prefer slices with **disjoint file sets**. Disjoint groups become parallel tracks with
  their own PRs; overlapping ones silently conflict at merge.
- **Front-load the contract-defining slices** (interfaces, schemas, types). An agent that
  discovers the shape in slice 5 rewrites slices 1–4, and each rewrite is a full run.
- **No slice depends on production feedback** — an unattended run cannot wait for a beta
  panel's opinion. Park those slices in a follow-up plan.
- Keep the **cleanup slice separate and last** (flag removal, dropping the old column).
  Additive-then-remove in one slice gives an agent no safe stopping point.
- Slightly **smaller** than you would size for yourself: a failed gate halts the run, and
  a small halted slice is cheap to diagnose.

### 5. Choose between candidate splits, then verify

You will usually find two or three valid splits. Pick with these, in order:

1. **The 80/20 test** — prefer the split that lets you **deprioritize or throw a slice
   away**. If no slice is droppable, you split by task, not by value.
2. **Comparable sizes** — four similar slices beat one big and three tiny. Equal sizes
   are what make counting slices more honest than estimating them (#NoEstimates).
3. **Earliest feedback** — prefer the split whose first slice teaches you the most about
   the risky part.

### The counterweight: stop splitting

Every heuristic above pushes toward *more* slices, so it needs a brake or it produces
fragmentation dressed as rigour. Consolidate back into one slice with ordered sub-steps
when any of these is true:

- **Several candidate slices keep reworking the same core files** with no feedback loop
  between them. Splitting there buys nothing: you pay N reviews, N gates and N merges to
  reach a state only the last one makes coherent, and each one re-opens the file the
  previous one just settled.
- **A slice exists only to make the next one possible** and ships nothing observable.
  That is a sub-step, and its natural home is inside the slice that needs it.
- **The proof is the same command for all of them.** If three slices are green on exactly
  the same test run, the test does not distinguish them and neither will a reviewer.

The signal to watch is the file list, and it is mechanical: candidate slices whose
"Files to touch" overlap heavily are one slice. The same overlap that makes tracks
un-parallelisable makes slices un-splittable, for the same reason.

Then verify each slice against **INVEST**, which is a splitting *signal*, not paperwork:

- **I**ndependent — shippable on its own, in this order
- **N**egotiable — the detail is still discussable
- **V**aluable — someone (user, ops, support, beta panel) sees the difference
- **E**stimable — the team can size it
- **S**mall — 1–2 days of work
- **T**estable — its acceptance is a command or an observable behaviour

A slice failing one letter is a slice asking to be split again — except **Small** while
you are still deciding *whether* to split.

## Anti-patterns

These are the failure modes that make a split look done while the tunnel is intact:

- **Horizontal slicing** — back / front / DB tickets. Nothing is shippable until the
  last one. The single most common one, and the one that contaminates the whole
  organization: a technical split forces synchronized releases and blurs ownership.
- **The integration slice** — slices 1–4 build parts, slice 5 "wires it all together".
  That is horizontal slicing with vertical labels; the risk still lands at the end.
- **The spike that ships** — a spike is timeboxed learning, thrown away, and followed by
  a real split. Shipping the spike ships a prototype.
- **The technical enabler story** — "refactor X so we can do Y". Fold it into the first
  slice that needs it (see Major Effort, §8), or it becomes work nobody can prioritize.
- **Slices too thin to matter** — three slices that each need the next to be usable are
  one slice with extra ceremony. Thin is a means, not the goal.
- **Splitting by acceptance criterion mechanically** — some criteria are one behaviour
  described twice. Group them by the rule they express.
- **Deferring the risky part** — comfortable, and it puts the discovery at the end where
  it costs the most.

## Objections you will hear, and what they actually mean

From real refinement sessions — none is a genuine business constraint:

- *"We can't expose anything until it's finished."* → expose to a **reduced panel**
  (beta testers, internal teams). They test the nominal case in real conditions, and
  their feedback prioritizes the edge cases you were about to build blind.
- *"Half the feature isn't a real need."* → users don't use most of what we ship. That is
  the argument **for** slicing: you find out after slice 1 instead of after slice 6.
- *"We can't activate it until everything is ready."* → **feature flag**: the code ships
  inactive, only activation waits. Each delivery proves the existing behaviour still
  holds. See `product:delivery`.
- *"It's one atomic business action."* → the *action* may be atomic; the **rules,
  variations and channels** around it are not. Re-run step 1.

And sometimes the split is right and the room still says no. That is fine — pushing past
that point costs more than it wins. Slice what you control.

## Output — writing the slices down

When the caller is a planning workflow (`/goal:run-issue`, `/goal:draft-issue`,
spec-first-dev), emit the slices in **that workflow's format** — do not invent one.
Whatever the format, each slice carries:

- **Goal** — the user-visible or behavioural outcome, in domain vocabulary
- **Files to touch** — the real list (this is what makes parallel tracks provable)
- **Business rules covered** — the subset of rules this slice makes true
- **Acceptance criteria** — commands that exit 0, one per rule wherever possible
- **Delivery strategy** — flag / additive / expand-contract, from `product:delivery`

Then state, in one line per slice, **what is shippable after it**. If you cannot write
that line for a slice, it is not a vertical slice — go back to step 2.

## References

- `references/techniques.md` — the 17 techniques, with examples and failure modes.
  Read it during step 2, and any time a feature resists an obvious cut.
- Sources: Mike Cohn (SPIDR), Humanizing Work splitting guide, Gojko Adzic (hamburger),
  Alistair Cockburn (elephant carpaccio), Bill Wake (INVEST), Allen Holub (story slicing,
  #NoEstimates advocacy — the movement itself is Woody Zuill's).
