---
description: Spec-first feature development — 5-phase workflow that produces a validated specification before code, then implements against it with iterative checkpoints. Use when the requirement is fuzzy or the business domain is unfamiliar.
argument-hint: Optional feature name or initial context
---

# Spec-First Feature Development

Spec-driven development harness. Inspired by Harness Engineering (Fowler), Context Engineering (Karpathy), and Spec-Driven Development (OpenSpec, Spec Kit).

**Principle**: Lock a validated specification BEFORE touching the code. The spec — built from explicit business intent, scope, and command-line verifiable acceptance criteria — becomes the contract the implementation must satisfy.

**When to use this workflow**:
- The requirement is fuzzy or incomplete
- You do not know the business domain
- Edge cases are not identified
- Implementation iterations are not known up front
- The project does not follow a strict TDD workflow

**When to use /feature-tdd-dev instead**:
- The user story is well-specified with clear acceptance criteria
- The TDD workflow is established (red-green-refactor)
- Iterations are known

**When to use `goal` instead**:
- You want to iterate across fresh sessions, hand off, and keep an audit log
- The source is a tracked issue (Jira / GitHub) and you may commit / open a PR
- `goal:run-issue` runs this same spec-building grill, then executes autonomously slice by slice

This workflow is the **single-session, no-branch** path; `goal` is the iterated pipeline. See [`docs/workflows-decision-guide.md`](../../../docs/workflows-decision-guide.md) for the full map.

---

## Phase 1: Understand

**Goal**: Extract the business knowledge you don't have. NO code exploration here.

**Round 1 — The Need** (always asked, adapted to the provided context):

Ask the following questions conversationally in free text. Adapt based on what the user has already given — don't re-ask anything already clear.

1. Who uses this feature? (persona: advisor, customer, admin, batch process...)
2. What is the full flow? (step by step, what the user sees and does)
3. Which business rules apply? (validations, computations, conditions, limits)
4. Business vocabulary? (FR/EN terms to align with the wiki UL)
5. Known business edge cases? (not technical — actual business cases: customer without contract, zero amount, multi-beneficiaries...)
6. What is explicitly out of scope?

**WAIT for the answers before continuing.**

**Round 2 — The System** (after Round 1, questions adapted to the answers):

**Principle**: Only ask questions you can NOT answer by exploring the code. Technical questions (which pattern? which FormType? which route?) will be resolved in Phase 2 by code exploration. Here we only look for information external to the code.

1. Existing mockup or Figma design?
2. **Cross-project couplings**: is the feature 100% self-contained in this repo, or does it depend on other projects? (e.g., API client here, endpoint/service in another repo). If so, which repos should we scan to gather context? (contracts, DTOs, endpoints)
3. Where does the data come from? (new API to create, hard-coded data, external source)
4. Constraints not derivable from the code? (deadlines, legal constraints, team decisions)
5. Anything you know that I cannot find in the code?

**WAIT for the answers before continuing.**

**Synthesis**: Present a structured summary:

```
## Requirement understanding

### Ubiquitous Language (FR -> EN)
| FR term | EN term | Definition |
|---------|---------|------------|

### User flow
1. The user does X
2. The system does Y
3. ...

### Business rules
- BR1: If [condition] then [result]
- BR2: ...

### Data sources
- [System] -> [endpoint/table] -> [data]

### Scope
- IN: ...
- OUT: ...
```

**GATE**: Ask "Is this understanding correct? What is missing?"

Iterate on the synthesis until explicit confirmation. **DO NOT move to Phase 2 without validation.**

---

## Phase 2: Explore

**Goal**: Explore the code GUIDED by the validated business understanding.

**Principle**: Explorer agents receive the Phase 1 business synthesis as input. They look for "how the code handles [business concept X]", not "what patterns exist in general".

**Actions**:

1. Launch 1-2 explorer agents (subagent_type: Explore) with prompts derived from Phase 1:
   - "How is [business concept A] implemented? Trace controller -> domain -> SPI -> YAML config."
   - "What is the HTTP client pattern for [system B]? Trace Guzzle client, repository interface, serializer."
2. Read the files identified by the agents.
3. Present the results MAPPED to business concepts:
   - "For [concept X], the existing pattern is: [controller] -> [domain interface] -> [SPI implementation]"
   - "For [concept Y], nothing exists yet — to be created following the pattern of [concept Z]"

**GATE**: Quick checkpoint — "Do these patterns match what you expect?"

---

## Phase 3: Specify

**Goal**: Produce ONE concrete, validated implementation specification, persisted to a file.

**Principle**: No multiple architects. The architecture is dictated by the project's DDD/hexagonal conventions and the loaded skills. Produce an actionable document.

**Persist** the document at `.claude/plans/<feature>-spec.md`:

```markdown
# Spec: [Feature name]

## Business context
[Validated summary from Phase 1]

## Existing patterns
[Mapped results from Phase 2]

## Implementation

### Files to create
- `src/Domain/[BoundedContext]/...`: [description, method signatures]
- `src/Infrastructure/[BoundedContext]/...`: [description]
- `src/Api/[BoundedContext]/...`: [description]

### Files to modify
- `config/services.yaml`: [exact wiring of services]
- `config/routes/...`: [routes if needed]

### Templates/JS (if applicable)
- `templates/...`: [description]
- `assets/...`: [description]

### Translations
- `translations/...`: [keys to add]

### Tests
- Unit: [what to test, which cases]
- Integration: [what to test]
- Acceptance: [what to test, optional]

## Ubiquitous Language
[UL table from Phase 1]
```

**Simplicity check** (run before the gate) — every layer earns its place:
- [ ] No future-proofing — solve today's requirement, not a hypothetical one.
- [ ] Framework used directly — no gratuitous wrapper around what it already provides.
- [ ] Single model representation — no parallel DTO/entity duplication without a real need.
- [ ] Any added abstraction layer is justified (name the concrete need it serves).

If a box can't be checked, either simplify or record the justification in the spec.

**GATE**: "Do you validate this specification? What would you change?"

The validated spec becomes the **implementation contract**. Any deviation must come back to the spec. If a change is needed during implementation, update the spec FIRST.

---

## Phase 4: Implement

**Goal**: Build the feature following the spec, **test-first**.

**TDD is the implementation mode.** No production code is written in Phase 4 before a
failing test demands it — including "structural" files (enum case, empty interface, DTO,
config wiring). Each behavior goes through RED → GREEN → REFACTOR, and you run the test at
each step so the user SEES it go red, then green.

**Actions**:

1. **Propose the breakdown** into iterations based on the spec. Load
   `product:vertical-slice` and run its procedure: name the core complexity, pick the
   techniques that isolate it, apply the technical constraints, then verify against
   INVEST. The number of iterations is an output of that, not an input — sizing by
   "small feature, 2 iterations" is estimating, and it is how horizontal slices get
   written down as iterations. Not installed? Say so once and split by hand.

2. **For each iteration**, drive every behavior through the micro-loop:
   a. Announce the behavior.
   b. **RED** — write the test, run it, confirm it fails for the expected reason.
   c. **GREEN** — write the minimal code to pass, run it, confirm green.
   d. **REFACTOR** — clean up (names, duplication, conventions) with the test still green.

   Batching a few related tests in one RED/GREEN cycle is fine; skipping RED is not.

3. **Checkpoint (end of iteration)** — stop and report: "Iteration N done. Result:
   [summary]. Tests: [RED→GREEN]. CI: [status]. Want to review before continuing?"
   This is the human-in-the-loop control point: it lets the user correct course between
   iterations and catch a deviation early instead of at the end.

4. **If correction needed**: update the spec first, then apply the correction test-first.

**Test typology** — adapt to the project; the test-first rule is fixed, the *kind* of test adapts:
- Established tests -> follow existing patterns and types (unit, integration, functional).
- New project -> ask "What level of tests do you want for this feature?"
- Do not force a particular test type.
- **Avoid implementation tests** (e.g., counting form options). Test behavior: valid submission, invalid submission, business rules.

---

## Phase 5: Verify and Summarize

**Goal**: Ensure the implementation matches the spec.

**Actions**:

1. Run the full CI.
2. Verification checklist:
   - [ ] Business rules implemented vs spec
   - [ ] UL naming respected
   - [ ] YAML services wired
   - [ ] Tests cover the business rules
3. Summary: files created/modified, business rules covered, next steps.

---

## Optional next step — materialize the spec as a GitHub issue

If the `goal` plugin is installed and you want to drive the implementation
autonomously via `/goal` instead of implementing in this session, the spec
from Phase 3 (`.claude/plans/<feature>-spec.md`) is already in the shape
`goal:/draft-issue` expects.

```text
> /draft-issue .claude/plans/<feature>-spec.md
# → creates the GitHub issue
> /run-issue <N>
# → Session 1 of the autonomous workflow
```

See [`plugins/goal/README.md`](../../goal/README.md) for the full chain.
This is purely opt-in — if you prefer to implement directly via Phase 4
in this session, ignore it.

---

## Rules

- **Never write code before Phase 2.** Phase 1 is purely conversational.
- **Never move to Phase 2 without Phase 1 validation.** The user must confirm the understanding.
- **Never write production code in Phase 4 before a failing test.** TDD (RED → GREEN → REFACTOR) is the only implementation mode: write the test, run it, see it fail, *then* implement. Run the tests on each cycle so RED→GREEN is visible. No "tests after", no "just scaffolding".
- **Only one architectural approach.** Not three alternatives — the architecture is dictated by the project.
- **The spec is the contract.** Any deviation = update the spec first.
- **Checkpoints are mandatory.** The user can always correct between iterations.
- **Adapt, don't impose.** The workflow adapts to the project (tests, iterations, conventions).
