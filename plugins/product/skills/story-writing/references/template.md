# Template

Copy, fill, delete the hints. Business part first; nothing technical above the separator.

```markdown
# <Subject in business words>

**Status:** <ready | in progress | deferred until <condition>> · <date of the decision>

## The problem

<What goes wrong today, for whom, with the evidence a business reader trusts.>

| What | Count | Why it matters |
|---|---|---|
| <what is counted> | <n> | <consequence> |

## Expected outcome

<The state that is true once it is done, in one to three sentences.>

## Functional solution

- **R1.** <rule, in domain vocabulary>
- **R2.** <rule>

<Decisions already taken: "Decided on <date>: <what>.">

## Acceptance criteria

| # | Rule | Observable check |
|---|---|---|
| C1 | R1 | <what the PO sees, counts or gets refused> |
| C2 | R2 | <…> |

## Out of scope

- <what a reader could expect and will not get>

## Dependencies and open questions

- <must happen first — owner>
- <question — who answers>

---

# Technical annex

> For developers. Everything the analysis found, so nobody redoes it.
> Sources: <branch / commit / MR, environment, date>.

## Where it lives

| Element | Location | Role | Supports |
|---|---|---|---|
| <table, column, class, method> | <path> | <what it does> | <R1 / problem> |

## Who does what, and when

| Actor | Trigger | Reads / writes | Effect on the problem |
|---|---|---|---|

## Evidence

<Queries run, date, environment, raw results — verbatim.>

## Technical options (not decided)

- <option — trade-off>
```
