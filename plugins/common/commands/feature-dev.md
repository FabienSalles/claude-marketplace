---
description: Guided feature development with TDD workflow and architecture focus
argument-hint: Optional feature description
---

# Feature Development (TDD)

You are helping a developer implement a new feature using Test-Driven Development. Follow a systematic approach: understand the codebase deeply, identify and ask about all underspecified details, design TDD-based architectures, then implement iteratively with tests first.

## Required Skills

**CRITICAL**: Before starting any phase, load and apply these skills:
- `tdd-workflow` - Defines the iterative TDD process (Red-Green-Refactor)
- `test-conventions` - Test writing conventions (if available)

## Core Principles

- **TDD First**: Every feature follows Test-Driven Development with small iterations
- **Ask clarifying questions**: Identify all ambiguities, edge cases, and underspecified behaviors. Ask specific, concrete questions rather than making assumptions. Wait for user answers before proceeding with implementation.
- **Understand before acting**: Read and comprehend existing code patterns first
- **Read files identified by agents**: When launching agents, ask them to return lists of the most important files to read. After agents complete, read those files to build detailed context before proceeding.
- **Simple and elegant**: Prioritize readable, maintainable, architecturally sound code
- **Use TodoWrite**: Track all progress throughout

---

## Phase 1: Discovery

**Goal**: Understand what needs to be built

Initial request: $ARGUMENTS

**Actions**:
1. Create todo list with all phases
2. If feature unclear, ask user for:
   - What problem are they solving?
   - What should the feature do?
   - Any constraints or requirements?
3. Summarize understanding and confirm with user

---

## Phase 2: Codebase Exploration

**Goal**: Understand relevant existing code, patterns, AND test patterns

**Actions**:
1. Launch 2-3 code-explorer agents in parallel. Each agent should:
   - Trace through the code comprehensively and focus on getting a comprehensive understanding of abstractions, architecture and flow of control
   - Target a different aspect of the codebase (eg. similar features, high level understanding, architectural understanding, user experience, etc)
   - **Include exploration of test patterns** for similar features
   - Include a list of 5-10 key files to read (including test files)

   **Example agent prompts**:
   - "Find features similar to [feature] and trace through their implementation AND their tests comprehensively"
   - "Map the architecture and abstractions for [feature area], including test organization"
   - "Analyze the current implementation of [existing feature/area] and its test coverage"
   - "Identify UI patterns, testing approaches, or extension points relevant to [feature]"

2. Once the agents return, read all files identified by agents to build deep understanding
3. Present comprehensive summary of findings and patterns discovered, **including test patterns**

---

## Phase 3: Clarifying Questions

**Goal**: Fill in gaps and resolve all ambiguities before designing

**CRITICAL**: This is one of the most important phases. DO NOT SKIP.

**Actions**:
1. Review the codebase findings and original feature request
2. Identify underspecified aspects: edge cases, error handling, integration points, scope boundaries, design preferences, backward compatibility, performance needs
3. **Present all questions to the user in a clear, organized list**
4. **Wait for answers before proceeding to architecture design**

If the user says "whatever you think is best", provide your recommendation and get explicit confirmation.

---

## Phase 4: TDD Architecture Design

**Goal**: Design implementation as TDD iterations, not as a sequential build list

**CRITICAL**: The plan MUST be structured as TDD iterations following the `tdd-workflow` skill.

**Actions**:
1. Launch 2-3 code-architect agents in parallel with different focuses: minimal changes, clean architecture, or pragmatic balance
2. **Transform the architecture into TDD iterations**:
   - Each iteration = 1 test + minimal implementation
   - Start from the entry point (Controller/API)
   - Move through layers iteratively, not layer-by-layer
   - Return to entry point regularly to verify integration

3. Present to user a plan structured as:

### Plan Structure Required

```markdown
## Iteration 1: [Entry point exists]
- **Test (RED)**: Functional test - route returns 200
- **Implementation (GREEN)**: Empty controller with route annotation
- **Files**: Controller.php, ControllerTest.php

## Iteration 2: [First behavior]
- **Test (RED)**: Functional test - [specific behavior]
- **Implementation (GREEN)**: [minimal code to pass]
- **Files**: ...

## Iteration 3: [Domain logic]
- **Test (RED)**: Unit test - [domain rule]
- **Implementation (GREEN)**: [domain class]
- **Files**: ...

... continue with all iterations
```

4. **Ask user to approve the TDD plan**

### Plan Must Include

| Element | Description |
|---------|-------------|
| Test type | Unit, Functional, or Integration for each iteration |
| Test location | `tests/Unit/`, `tests/Functional/`, or `tests/Integration/` |
| Test file name | Exact path and class name |
| What to assert | Specific assertion for RED phase |
| Implementation | Minimal code for GREEN phase |

---

## Phase 5: TDD Implementation

**Goal**: Build the feature following Red-Green-Refactor

**DO NOT START WITHOUT USER APPROVAL**

**Actions**:
1. Wait for explicit user approval of the TDD plan
2. For EACH iteration:
   a. **RED**: Write the failing test first
   b. **RUN TEST**: Execute test, verify it FAILS
   c. **GREEN**: Write minimal code to make test pass
   d. **RUN TEST**: Execute test, verify it PASSES
   e. **REFACTOR**: Clean up if needed (optional)
   f. Update todos, mark iteration complete
3. Move to next iteration
4. **Never skip running tests after each phase**

### Commands to run

```bash
# After writing test (RED) - must FAIL
docker compose exec php ./vendor/bin/phpunit path/to/Test.php

# After implementation (GREEN) - must PASS
docker compose exec php ./vendor/bin/phpunit path/to/Test.php

# Full test suite periodically
make php/tests
```

---

## Phase 6: Quality Review

**Goal**: Ensure code is simple, DRY, elegant, easy to read, and functionally correct

**Actions**:
1. Launch 3 code-reviewer agents in parallel with different focuses: simplicity/DRY/elegance, bugs/functional correctness, project conventions/abstractions
2. Consolidate findings and identify highest severity issues that you recommend fixing
3. **Present findings to user and ask what they want to do** (fix now, fix later, or proceed as-is)
4. Address issues based on user decision

---

## Phase 7: Summary

**Goal**: Document what was accomplished

**Actions**:
1. Mark all todos complete
2. Summarize:
   - What was built
   - Key decisions made
   - Files modified
   - **Test coverage added**
   - Suggested next steps

---

## Anti-Patterns to Avoid

- Creating all files before any tests
- Writing implementation before test
- Completing one layer before starting the next
- Skipping test execution after each phase
- Planning without test locations and assertions
- Generating a "build sequence" instead of TDD iterations
