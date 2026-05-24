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

**GATE**: "Do you validate this specification? What would you change?"

The validated spec becomes the **implementation contract**. Any deviation must come back to the spec. If a change is needed during implementation, update the spec FIRST.

---

## Phase 4: Implement

**Goal**: Build the feature following the spec, with regular checkpoints.

**Actions**:

1. **Propose the breakdown** into iterations based on the spec. The count depends on the scope:
   - Small feature: 1-2 iterations
   - Medium feature: 3-4 iterations
   - Large feature: 5+ iterations (consider splitting into multiple PRs)

2. **For each iteration**:
   a. Announce what will be built.
   b. Implement according to the specification.
   c. Run the CI (`make php/qa`, `make php/tests`, or the project equivalent).
   d. **Checkpoint**: "Iteration N done. Result: [summary]. CI: [status]. Want to review before continuing?"

3. **If correction needed**: update the spec, then apply the correction.

**Testing strategy** — TDD by default, permissive on the typology:
- **Always TDD (test-first).** Write the test BEFORE the production code, in the same iteration. Activate the `phpunit:php-tdd-workflow` or `vitest:vitest-tdd-workflow` skill depending on the project.
- Adapt the **test typology** to the project:
  - Project with established tests -> follow existing patterns and test types (unit, integration, functional)
  - New project -> ask "What level of tests do you want for this feature?"
- Do not force a particular test type. If the project only tests FormTypes in integration, do not invent unrequested unit or functional tests.
- **Avoid implementation tests** (e.g., counting the number of options in a form). Test behavior: valid submission, invalid submission, business rules.

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
- **Only one architectural approach.** Not three alternatives — the architecture is dictated by the project.
- **The spec is the contract.** Any deviation = update the spec first.
- **Checkpoints are mandatory.** The user can always correct between iterations.
- **Adapt, don't impose.** The workflow adapts to the project (tests, iterations, conventions).
