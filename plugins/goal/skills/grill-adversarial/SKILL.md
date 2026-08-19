---
name: grill-adversarial
description: Opt-in adversarial plan-challenging pass for the goal workflow (invoked by /goal:spec when functional gaps are suspected, or on explicit request). Composes the Pocock grill skills (grill-me, grill-with-docs) and goes much further, hunting the functional and technical holes that survive a normal grill — broken invariants and broken execution schemas — BEFORE the iterations are frozen, so the plan is coherent and executable exactly as specified. Highest value on FRONT / interactive features where every user action is a state transition; lighter on pure back/transactional work. ACTIVATE for 'grill adversarial', 'grille adversariale', 'challenge the plan', 'trous fonctionnels', 'invariants', 'state machine', 'interaction coherence', 'front interactions', 'edge transitions'.
---

# Adversarial grill — challenge the plan until no functional hole is left

A normal grill resolves the branches that are **raised**. This pass **generates**
the branches nobody raised. It exists because interface incoherence and usage
incoherence come from **unmodelled invariants and unenumerated transitions**, not
from missing business rules — and those are invisible to a Socratic grill.

Take the **whole plan** and the domain docs. Nothing is out of bounds — including
what was never defined, never discussed, and never questioned.

## When to run / when to skip

- **Run** when: the feature is **interactive / front**; state lives client-side;
  you sense unspoken scenarios; a thin-AC Jira US; anything where "a control
  exists" ≠ "the interaction stays coherent after any sequence of actions".
- **Skip** when: a small US whose scenarios you fully enumerate and are confident
  about; you can already name every state and every transition.
- **Front vs back:** on **back**, actions are defined at a higher level (endpoints
  / commands, usually transactional) → the state space is small and server-owned,
  so this pass is light. On **front**, the state *is* the DOM and **every click is
  a transition** → exhaustive coverage is essential. Lean hard into front.

## Method

### 0. Compose the base grills
If installed, load and run these first — they cover what is *raised*:
- **`pocock:grill-with-docs`** — challenge the plan against the domain model,
  sharpen terminology, update `CONTEXT.md` / ADRs inline.
- **`pocock:grill-me`** — resolve every raised decision branch to shared
  understanding.
Then apply the steps below, which *generate* what was never raised.

### 1. Enumerate the state space
List the **finite states** the feature can be in (front: list view, one item
editing, one item adding, N items, empty, loading, error…). Name each one. A state
you cannot name is a state you cannot reason about — and where incoherence hides.

### 2. Extract the invariants — what must hold in EVERY state
Write them explicitly as `I1…In`. On front, systematically check for:
- **exactly one valid selection at all times** — never zero, never on an
  incomplete/empty entity;
- **no incomplete / unsaved entity** occupying a selectable or committed slot;
- **at most one editor open**;
- **mutual exclusion** (single default, single selected…);
- **no orphan / empty persisted item**;
- **reset / reload returns to a coherent state**.
For each invariant, name its **OWNER**. **Front-only rule:** if state is 100% front
with no backend, the **front owns every invariant** a backend would normally guard —
you may **not** defer them to a non-existent server ("validation delegated to
backend" is a contradiction for a front-only feature).

### 3. Build the transition matrix (adversarial)
For every **(state × action)**, in **every order**, ask: what is the resulting
state, and which invariant could this transition break? Play the **hostile user**:
out-of-order clicks, double actions, act-then-switch, cancel-an-add,
delete-the-selected, submit-incomplete, reload-mid-edit. Every cell must resolve to
**allowed (and preserves all invariants)** or **explicitly blocked**. An unresolved
cell is a functional hole.

### 4. Hunt execution-schema breaks
Beyond single transitions, chase **sequences** that break the intended flow
end-to-end: add A then edit B; validate with required fields empty; reset an add;
delete while editing; two adds in parallel; selection landing on a pending item.
Each break is a new rule.

### 5. Turn every hole into a testable rule
Each surfaced hole becomes a business rule / invariant with:
- an **owner iteration** (or marked **transverse** — re-verified at each
  iteration's DoD), and
- a **sequence test**: drive the series of actions, assert the invariant holds
  **throughout** — never a mere presence assertion ("a button exists").

### 6. Update the plan in place
Add / refresh in the spec:
```markdown
## States, invariants & transitions
- **States:** S1…Sk
- **Invariants:** I1…In  (each with its owner; front-only ⇒ front owns it)
- **Transition matrix:** (state × action) → resulting state / blocked / invariant preserved
```
Fold the new rules into **Business rules** (each → a sequence test in the DoD) and
assign them to iterations or mark them **transverse**. **Nothing is frozen** until
every cell is resolved and every invariant has an owner + a test.

## Termination
Stop when every state is named, every invariant is written and owned, and a full pass over
the `(state, action)` matrix surfaces no new hole. Completeness is the target, not a fixed
cell count: once two consecutive passes add nothing, the matrix has converged and the
remaining cells are exercised at the DoD instead of hand-enumerated here. If a cell needs a
human decision, **ASK** — never guess an invariant into place.

## Output
A challenged, updated plan the developer confirms — coherent and executable exactly
as specified, ready for `/goal:plan` to decompose (or refined in place if already
decomposed). Summarize: states found, invariants added, holes surfaced, and which
plan cells changed.
