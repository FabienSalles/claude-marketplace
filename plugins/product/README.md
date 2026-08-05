# product

**Product delivery discipline** — how a functional spec becomes a sequence of thin
slices, and how each slice reaches production without waiting for the others.

Two skills, one decision split in half:

| Skill | Answers | Read it when |
|---|---|---|
| [`vertical-slice`](skills/vertical-slice/SKILL.md) | *What goes in each iteration?* | you are about to write a list of iterations |
| [`delivery`](skills/delivery/SKILL.md) | *How does this iteration ship while the rest is unfinished?* | an iteration touches behaviour that already exists |

They are deliberately separate and mutually referential: a slice you cannot ship is not a
slice, and a delivery strategy with nothing to deliver is theatre.

## vertical-slice

17 splitting techniques (SPIDR, the Humanizing Work catalogue, hamburger, elephant
carpaccio, conjunctions, roles, entry methods, branch by abstraction…) plus — the actual
point — a **selection procedure**:

1. name the **core complexity** (paths? rules? data? workflow? an unknown?)
2. pick the techniques that isolate it, and **combine** them (real features slice on two
   axes)
3. apply the **technical constraints** (migrations, contracts, legacy seams, deploy
   coupling) — they reorder and merge slices
4. adapt granularity to the **execution mode** — reviewing each diff yourself vs
   a gated agent running unattended are not the same slice size, ordering or acceptance
5. choose between candidate splits (80/20 test, comparable sizes, earliest feedback) and
   verify against INVEST

Plus the anti-patterns that produce fake slices (horizontal splits, the integration
slice, the technical enabler, the spike that ships) and the three objections that always
come up in refinement, with what they actually mean.

Full catalogue: [`references/techniques.md`](skills/vertical-slice/references/techniques.md).

## delivery

Separating **deploy** from **release**, then the four moves that make it real:

- **Flag it** — the four toggle types, and the cheapest mechanism that fits *this*
  project (env var → runtime config → per-user setting → flag platform). No default
  answer, and a SaaS platform for a solo project is as wrong as a constant for a
  multi-tenant one. [`references/feature-flags.md`](skills/delivery/references/feature-flags.md)
- **Make it additive** — never break an existing consumer in the deploy that introduces
  its replacement. Expand/contract, additive contracts, tolerant reader, branch by
  abstraction, strangler fig, dark launch / parallel run / canary.
  [`references/additive-change.md`](skills/delivery/references/additive-change.md)
- **Clean up** — the removal slice, with a **trigger condition** and evidence that the
  old path is dead. Cleanup that lives as an intention never happens.
  [`references/cleanup.md`](skills/delivery/references/cleanup.md)
- **Adapt to the mode** — in an autonomous run the flag defaults to off and the agent
  never flips it, additive and removal never share a slice, and cleanup moves to a
  follow-up plan because its trigger depends on production evidence no agent can observe.

## Typical uses

- refining a Jira US in a grooming session
- deciding whether a change needs a flag before opening the PR
- planning a legacy migration you intend to ship weekly rather than at the end
- arguing, with something better than instinct, that a story *is* splittable
