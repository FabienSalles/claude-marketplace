---
name: tickets
description: Chantier level of the goal workflow — split an initiative too big for one spec into an ordered backlog of outcome-sized tickets, elaborated just-in-time — ticket 1 gets a handoff, the rest deliberately stay one-liners. Re-run on an existing backlog to reconcile it after a ticket ships and arm the next one. Routes are executor-agnostic (a ticket may go to /goal:spec, another skill, or manual work). GitHub mirroring (milestone + issues) is opt-in, never forced.
---

## Portability

This skill degrades gracefully outside Claude Code:

- No `AskUserQuestion` tool → ask the question in plain text and wait for the reply.
- No Atlassian MCP → route through the inline paste path, same as `/goal:spec`.
- No `pbcopy` → print the content instead of copying it to the clipboard.

# /goal:tickets — Chantier → ordered backlog, elaborated just-in-time

You are cutting an initiative that is **too big for one spec** into an ordered
backlog of **outcome-sized tickets**, so that only the next ticket is ever
elaborated. A chantier is too big when it carries several independent outcomes,
no single success signal, or a functional space no one session can grill. One
spec for it would freeze guesses about parts nobody has learned anything about
yet — this command cuts BEFORE any deep grill, precisely so most of the chantier
stays ungrilled until its turn.

This is not `/goal:plan`'s multi-plan split. That split happens AFTER a full
grill, on provable file disjointness, for work that is one outcome delivered in
parallel parts. This one happens FIRST, on outcomes, for work that is several
deliveries.

```
(chantier: vision doc / brain dump / initiative brief)
   └─ /goal:tickets ← YOU ARE HERE
        ├─ ordered backlog written to .claude/plans/<chantier-id>-backlog.md   (always)
        └─ GitHub milestone + one issue per ticket                             (only if the developer says yes)
             └─ per ticket, at its turn: /goal:spec → /goal:plan → /goal + /goal:next, or /goal:supervise
                  └─ /goal:tickets <backlog>  (reconcile, then arm the next ticket)
```

## Argument — resolve the chantier

Source: `$ARGUMENTS`

| `$ARGUMENTS` shape | How to read it | chantier-id |
|---|---|---|
| A path to an existing backlog (file starts `# Backlog:`) | **Reconcile mode** — see the last section | already in the file |
| Any other path ending in `.md` | Read the file | ≤40-char kebab slug of the title |
| `inline` or empty | Ask the developer to paste the chantier now | ≤40-char kebab slug of the title |
| A path that doesn't exist | STOP and tell the developer | — |

## Phase 0 — Preconditions

- `git rev-parse --show-toplevel` succeeds (we're in a repo)

Nothing else. GitHub is only touched in Phase 5, and only if the developer opts in.

## Phase 1 — Interview at outcome level (one question at a time)

Settle the chantier's frame — and nothing finer. Skip anything the brief
already answers.

- What is true in the world when this chantier is **done**? (the chantier-level
  success signal — one sentence, observable from outside)
- What is explicitly **not** part of it?
- Constraints that shape the cut? (a deadline, a dependency on the world, a
  budget, an order imposed from outside)
- **Appetite**: how much is this worth before it must start paying? A chantier
  with no appetite is a chantier that eats quarters.
- Which outcome, delivered first, **de-risks or unlocks** the others?

**Do NOT grill business rules, edge cases or interactions here.** That is
`/goal:spec`'s job, per ticket, when the ticket's turn comes. Asking them now is
how a chantier eats a week before its first delivery.

## Phase 2 — Cut into tickets

**Load `product:vertical-slice`** and run its selection procedure with the slice
unit set to a **ticket, not an iteration**: name the chantier's real axis of
complexity, pick the techniques that isolate it, verify against INVEST — with
**Independent** doing the heavy lifting at this level.

A ticket is right-sized when **one `/goal:spec` + `/goal:plan` pass can carry it
to a locked plan**. Test the cut in both directions:

- A ticket that needs several unrelated success signals is still a chantier —
  cut again.
- Tickets that can only be demoed together are one ticket — merge them.

Order the list: the **walking skeleton** first (the thinnest end-to-end outcome
that proves the chantier's spine), then by risk and learning, then by value.
Dependencies get one line on the ticket that waits (`After: <ticket>`), and no
more machinery than that — the backlog is an ordered list, and the order is
re-decided at every reconciliation, which is cheap precisely because nothing
below the line is elaborated.

**Load `product:delivery` for the order — and only the order.** A chantier that
replaces something live is a strangler: the old path stands until the new one has
proven itself, and that alone orders several tickets. A removal ticket (drop the
old path, kill the flag) waits on **production evidence** — its line reads
`After: <ticket> live`, live and not merely merged. And every ticket must be
independently releasable: one that can only activate when a later ticket lands is
a cut to redo. Per-ticket delivery mechanics — the flag's name, the
expand/contract steps — are elaboration, and belong to the ticket's own
`/goal:plan`.

**A ticket is not a slice.** `/goal:plan` will slice it. When a cut here starts
naming files to touch, you are planning — stop, that detail belongs to the
ticket's own sessions.

## Phase 3 — Elaborate NOTHING but ticket 1

The just-in-time rule, and it is hard: every ticket is a **title + an outcome
one-liner + why-this-rank + a route**. Ticket 1 alone may carry 3–5 lines of
detail. Anything more written today about ticket N>1 is a guess that ticket 1's
delivery will invalidate for free — the whole point of cutting early is to NOT
pay for elaboration that learning will redo.

**Route, per ticket.** Most tickets route to `/goal:spec`. A ticket whose
deliverable is not code — content production, a manual migration, a piece of
research — names its own route (a skill, a command, `manual`). The backlog is
executor-agnostic; the goal pipeline only claims the code-shaped tickets.

## Phase 4 — Persist the backlog

Always write `.claude/plans/<chantier-id>-backlog.md`:

````markdown
# Backlog: <chantier title>

Chantier-id: <chantier-id>
Source: <path | inline>
Status: open — re-run /goal:tickets on this file after each shipped ticket.

## Outcome
<what is true in the world when this chantier is done — one sentence>

## Constraints & appetite
- <constraint>
- Appetite: <how much this is worth before it must start paying>

## Out of the chantier
- <items>

## Tickets (ordered — elaborated just-in-time)

### 1. <title>   ← next
- Outcome: <one line>
- Why first: <one line>
- Route: /goal:spec
- <the 3–5 lines ticket 1 earned>

### 2. <title>
- Outcome: <one line>
- Why this rank: <one line — "After: <ticket>" when it genuinely waits on one>
- Route: </goal:spec | another skill or command | manual>

## Shipped
- <moved here at reconciliation: ticket title, the PR or artifact link, and ONE line of what it taught>

## Decisions
- <Q/A worth keeping at chantier level>
````

Show it and read the **Outcome** line and the ticket order back to the
developer. WAIT for their confirmation.

## Phase 5 — Ask: mirror it on GitHub? (opt-in)

Ask explicitly:

> **Do you also want this backlog mirrored on GitHub?**
> - **no** (default) — keep it local.
> - **yes** — I'll create a milestone named after the chantier and one issue per
>   ticket, each carrying ONLY the title and the outcome one-liner. (Optional:
>   labels — I create nothing you didn't name.)

WAIT. If yes, verify `gh auth status` and `gh repo view` first; on failure STOP,
report, and fall back to local-only.

The issues carry the projection that stays true — title and outcome — and
nothing else. Elaboration never mirrors: a ticket's spec, plan and iterations
live in their own artifacts, and an issue holding a copy of them is stale by the
second commit. Same doctrine as everywhere in this plugin: the issue is the log,
the PR is the deliverable.

## Phase 6 — Handoff

Print exactly this shape, the command last, nothing after it:

```
✓ Backlog written — .claude/plans/<chantier-id>-backlog.md
✓ GitHub milestone + <T> issues created — <URL>       (omit this line when local-only)

This backlog has
  · the chantier's outcome, constraints and appetite
  · <T> tickets, ordered — walking skeleton first
  · ticket 1 armed (← next), with its route

It deliberately does NOT have yet
  · no spec and no plan for any ticket — ticket 1 gets them at its turn, the
    rest when their turn comes
  · no branch, no code, nothing committed, nothing pushed

Next
    /goal:spec .claude/plans/<chantier-id>-backlog.md
```

When ticket 1's route is not `/goal:spec`, print that route's own next step
instead — the backlog names it.

## Reconcile mode (the argument is an existing backlog)

The backlog-level counterpart of `/goal:next`, run after a ticket ships:

1. **Tick what shipped.** Move the ticket to `## Shipped` with its PR or
   artifact link and ONE line of what it taught. If a GitHub mirror exists,
   close the ticket's issue.
2. **Re-cut with what it taught.** Ask only: does the order still hold? Does a
   ticket merge, split, or die, given what shipped? Re-cutting is cheap by
   construction — everything below the line is one-liners.
3. **Arm the next ticket.** Move `← next`, give it its 3–5 lines (and no more),
   confirm its route.
4. **Close the chantier when it is done** — the `## Outcome` line holds, not
   merely "no tickets left": set `Status: done`, say what proved it, and stop.
   A chantier whose tickets are all shipped but whose outcome does not hold gets
   new tickets, not a quiet archive.
5. Re-print the Phase 6 handoff for the new `← next`.

Wanting to take a ticket out of order is a reconciliation: move the arrow here,
with the order question asked, never by silently specing ticket 4.

## Rules

- **Just-in-time is the point.** At any moment exactly one ticket is elaborated.
  A backlog whose ticket 3 has acceptance criteria is a backlog written by
  someone planning instead of cutting.
- **No business-rule grilling at this level.** One functional question about a
  ticket's inside means you are in `/goal:spec` territory — stop, or route there.
- **Routes are executor-agnostic.** Not everything a chantier needs is code, and
  the backlog says so per ticket rather than forcing everything into the pipeline.
- **GitHub is opt-in.** Never call `gh` unless the developer said yes in Phase 5.
- **Nothing is committed, nothing is pushed.** The backlog is durable on disk
  (`.claude/plans/` is gitignored); the GitHub mirror is the shared view when
  one is wanted.
- **The handoff command is the last line you print.**
