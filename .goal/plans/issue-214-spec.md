# Spec: Make convention-skills claims match the execution policy

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/214
Source plan: /Users/fabiensalles/projects/github/claude-marketplace/.claude/plans/goal-multi-provider-backlog.md
Work-id: issue-214
Policy: manual
Delivery mode: no-bc-break
Cleanup: none
---

## Business intent

**Problem.** `/goal:plan` currently includes “Project convention skills were loaded before coding (see handoff)” in the global Definition of Done for every plan. The unattended `goal-run-implementer` agent has no `Skill` tool, so the unattended execution path cannot make that claim true.

**Objective.** Plans must make only claims their selected execution path can fulfill: fully gateable `commit+pr` plans omit the convention-skills claim, while human-driven handoffs retain it.

**Success signal.** A developer can inspect plans produced for each execution route and see no impossible convention-skills promise in an unattended run, without losing the existing convention-skills guidance when a human is expected to drive the handoff.

**Affected.** `/goal:plan` authors and `goal-run.ts` unattended runs are protected from an unverifiable Definition of Done line. Developers using manual execution retain the convention-skills handoff.

The ticket closes a mismatch between the plan contract and the executor that consumes it. The autonomous route is verified by the gate and supervision workflow, not by a human loading skills during an iteration. The manual route still has a human who can follow the canonical handoff, so its convention-skills guidance remains useful and intentional.

## Scope IN

- Make the convention-skills Definition of Done policy-dependent on the execution route.
- Remove that line from fully gateable `commit+pr` plans whose execution is handed to `/goal:supervise`.
- Retain the convention-skills handoff for `manual` plans and for `commit+pr` plans with a non-gateable iteration.
- Preserve the existing artifact resolver, destinations, and tracked-plan flow.

## Scope OUT

- Adding a `Skill` tool or any skill-preloading mechanism to unattended agents.
- Removing or changing the convention-skills handoff for manual execution.
- Changing the global loop, gate, commit authority, provider behavior, or the definition of gateability.
- Writing production code or an executable iteration plan in this contract.

## Business rules (each must map to a command in the DoD)

- A fully gateable `commit+pr` plan has no convention-skills claim in its global Definition of Done → verified by `node --test plugins/goal/tests/plan-closing.test.ts`.
- A `manual` plan retains the convention-skills handoff → verified by `node --test plugins/goal/tests/plan-closing.test.ts`.
- A `commit+pr` plan with at least one non-gateable iteration retains the convention-skills handoff → verified by `node --test plugins/goal/tests/plan-closing.test.ts`.
- The unattended implementer is not made responsible for loading convention skills → verified by `node scripts/verify.ts goal-gate`.

## Delivery strategy

Pure documentation and test change. The manual handoff remains available, while fully gateable autonomous plans stop carrying an unverifiable claim. No feature flag, migration, compatibility path, or cleanup slice is needed.

## Files NOT to touch

- `plugins/goal/templates/goal-handoff.template`
- `plugins/goal/agents/goal-run-implementer.md`
- `plugins/goal/skills/next/SKILL.md`
- `plugins/goal/src/`
- `plugins/goal/scripts/`

## Definition of Done (global, command-line verifiable)

```gate
# rule: every business rule has a passing covering test
dod1=node scripts/verify.ts goal-gate
# rule: the goal plugin remains type-safe
dod2=node node_modules/typescript/bin/tsc --noEmit
# rule: the project lint and QA checks remain green
dod3=node node_modules/eslint/bin/eslint.js --config eslint.config.js plugins scripts
```

Also true, and not expressible as a command of its own:
- Every business rule above has a passing covering test (proven by `dod1`)
- Project convention skills were loaded before coding (see handoff)

## Functional iterations

### Iteration 1 — Make convention-skills claims policy-aware

- [x] Done
- **Goal:** Future plans make convention-skills claims only when their execution policy can fulfill them.
- **Shippable after it:** `/goal:plan` produces an honest autonomous closing while preserving the manual handoff.
- **Files to touch:** `plugins/goal/skills/plan/SKILL.md`, `plugins/goal/tests/plan-closing.test.ts`
- **Business rules covered:** all four business rules above
- **Delivery:** additive documentation contract and regression coverage; manual behavior remains unchanged
- **Not machine-verifiable:** none

```gate
test_files=plugins/goal/tests/plan-closing.test.ts plugins/goal/tests/implementer-report.test.ts
impl_files=plugins/goal/skills/plan/SKILL.md plugins/goal/tests/plan-closing.test.ts
max_diff=120
commit_msg=fix(goal): make convention skills claim policy-aware
# rule: policy-aware plan closing keeps autonomous claims honest and manual guidance available
gate1=node --test plugins/goal/tests/plan-closing.test.ts plugins/goal/tests/implementer-report.test.ts
# rule: the goal plugin remains type-safe
gate2=node node_modules/typescript/bin/tsc --noEmit
# rule: the project lint and QA checks remain green
gate3=node node_modules/eslint/bin/eslint.js --config eslint.config.js plugins scripts
```

## Out-of-band decisions captured during grill

- Q: How should the execution sessions handle commits and the PR?
  A: `manual`; the developer reviews and commits each iteration.
- Q: Which delivery mode applies?
  A: `no-bc-break`; the manual handoff remains compatible and no existing consumer contract is broken.
- Q: Was the adversarial grill run?
  A: No. The change is a small non-interactive policy/template correction with no meaningful state matrix.

## Notes / decisions from source

- Ticket 0f follows 0b4 delivered by PR #213.
- The manual convention-skills handoff is deliberately retained.
- The unattended path must not gain a `Skill` tool or an unenforced loading order.
