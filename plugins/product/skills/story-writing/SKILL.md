---
name: story-writing
description: "ACTIVATE whenever a user story, epic, Jira ticket, backlog item or analysis has to be written or rewritten so a PO, a business owner and a developer all understand it fast. ACTIVATE for 'rédige l'US', 'write the story', 'reformule pour le PO', 'compréhensible fonctionnellement', 'problème / solution / critères', 'epic', 'grosse maille', 'fiche de cadrage', 'séparer fonctionnel et technique', 'acceptance criteria'. Gives the reading order (problem, functional solution, criteria, scope), the plain-language rules for the business part, and a technical annex that keeps every finding so nobody redoes the analysis. DO NOT use for: cutting a story into iterations (see product:vertical-slice), how to ship it safely (see product:delivery)."
---

# Story writing — one page a PO reads in two minutes, an annex a developer reuses

> Companion skills: **`product:vertical-slice`** decides *how many* stories there are;
> **`product:delivery`** decides *how each one ships*. This skill decides *how each one
> reads*. A well-cut story that nobody understands still gets re-explained in every
> refinement session.

## The premise

A story has two readers who need opposite things:

- the **PO / business owner** decides whether it is worth doing and checks it is done —
  they need the problem, the outcome and the proof, in their words, and nothing else;
- the **developer** builds it, months later sometimes — they need every finding of the
  analysis (files, queries, measures, who writes what) so they never redo it.

Mixing both in one text fails both: the PO drowns in column names, the developer loses the
evidence when the text is "simplified". So the document has **two parts that never mix**:
a business part on top, a technical annex below, linked by references.

## Reading order of the business part

Always this order — each block answers the question the reader has at that moment.

| # | Block | Answers | Length |
|---|---|---|---|
| 0 | **Status line** | Can we work on it now? If not, what unblocks it? | 1–2 lines |
| 1 | **Problem** | What goes wrong today, for whom, how much? | 3–6 lines + 1 table of figures max |
| 2 | **Expected outcome** | What is true once it is done? | 1–3 sentences |
| 3 | **Functional solution** | Which rules the product follows from now on | a short numbered list of rules |
| 4 | **Acceptance criteria** | How the PO checks it is done, without reading code | one observable check per rule |
| 5 | **Out of scope** | What it deliberately does not do | bullets |
| 6 | **Dependencies & open questions** | What must happen first, what is still undecided | bullets, each with an owner |

Then a separator and the **technical annex** (see below). Template:
`references/template.md`.

## Writing rules — business part

1. **Problem before solution.** State what fails and the evidence a business reader trusts:
   a count, an amount, an incident, an example. Never "it would be better if".
2. **The outcome is a state, not a task.** "Every fee in the catalogue has a known unit",
   not "add a constraint" or "refactor the object".
3. **Rules, not implementation.** Each solution item is a rule the product obeys, in domain
   vocabulary ("a fee always has its unit"). No table, column, class, endpoint, cron,
   framework or SQL name. If a sentence needs one, it belongs to the annex.
4. **One rule, one line.** Apply the conjunction test (`product:vertical-slice` §11): an
   *and* / *or* / *except* inside a rule is usually two rules. At coarse grain you keep them
   in the same story — but as two numbered rules, never one fused sentence.
5. **Criteria prove rules, one per rule.** Group criteria by the rule they express
   (`product:vertical-slice` §12), number them after it (R1 → C1). A criterion is something
   the PO can observe — a screen, a report, a count, a refused input with its message —
   not "the code is clean" nor "the test passes". Given/When/Then is optional; an observable
   sentence is enough.
6. **Name the actors by role.** "The pricing team", "the back office", "the Disney price
   update" — not people, not class names.
7. **Figures carry their meaning.** Every number says what it counts and why it matters
   ("4 tariffs carry a fee with no unit — they would be misread"). A bare table of counts is
   not read.
8. **Decisions are stated as decisions.** "Decided on 2026-11-23: an unknown unit is an
   error" — date, what, never the debate. The debate goes to the annex if it is worth keeping.
9. **Out of scope is explicit.** Anything a reader could reasonably expect and will not get
   is listed, so nobody files it as a bug.

## Grain: coarse (epic) vs fine (story)

| Grain | Business part says | Criteria describe |
|---|---|---|
| **Coarse** (epic, "grosse maille", deferred subject) | the end state and the rules | the end state, observable once everything is done |
| **Fine** (story ready for a sprint) | one outcome, one shippable change | the behaviour of that one change |

At coarse grain, **do not split** — writing is not slicing. If the content obviously holds
several deliverables, say so in one line under Dependencies ("will be cut into stories with
`product:vertical-slice` when resumed") and keep the rules whole.

## The technical annex

Everything the analysis found, so the developer resumes without re-investigating:

- **where it lives** — files, classes, methods with their role; tables and columns;
- **who does what, and when** — each writer/reader with its trigger (cron schedule, event,
  user action) and what it reads or writes;
- **the evidence** — the queries run, their date, their results, verbatim;
- **how it maps to the business part** — each finding tagged with the rule (R1…) or the
  problem line it supports;
- **the technical options**, if any were sketched, clearly marked as options, not decisions;
- **sources** — branch, commit or MR, environment, date.

The annex may be long. It is never summarised away: its value is that it is complete.

## Self-check before handing it over

- [ ] A PO who reads only the business part can say what is wrong, what will be true, and
      how they will check it.
- [ ] No technical name appears above the annex separator.
- [ ] Every rule has at least one criterion, every criterion points to a rule.
- [ ] Every figure in the business part says what it counts.
- [ ] Every finding of the analysis is in the annex, with its source and date.
- [ ] Status line says whether work can start, and what unblocks it if not.

## Anti-patterns

- **The analysis dump** — the investigation pasted as the story. Split it: business on
  top, evidence in the annex.
- **The solution-shaped problem** — "we lack a constraint on the table". That is a
  solution; the problem is what the missing constraint lets happen.
- **The technical criterion** — "the migration has run", "the CHECK exists". The PO cannot
  observe it; state the business effect it guarantees.
- **The fused rule** — one sentence carrying three rules joined by *and*. Number them.
- **The orphan figure** — a count with no sentence telling why it matters.
- **The silent simplification** — removing a finding to make the text shorter. Move it to
  the annex instead.
