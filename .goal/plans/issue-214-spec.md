# Spec: A plan stops promising convention skills an unattended implementer never loads

Source: ticket 0f of the goal-multi-provider backlog
Source plan: /Users/fabiensalles/projects/github/claude-marketplace/.claude/plans/goal-multi-provider-backlog.md
Work-id: issue-214
Status: spec — functional contract settled; /goal:plan builds the executable plan.
Adversarial grill: skipped — small non-interactive policy/template change with no meaningful state matrix

## Business intent

**Problem.** `/goal:plan` currently includes “Project convention skills were loaded before coding (see handoff)” in the global Definition of Done for every plan. The unattended `goal-run-implementer` agent has no `Skill` tool, so the unattended execution path cannot make that claim true.

**Objective.** Plans must make only claims their selected execution path can fulfill: fully gateable `commit+pr` plans omit the convention-skills claim, while human-driven handoffs retain it.

**Success signal.** A developer can inspect plans produced for each execution route and see no impossible convention-skills promise in an unattended run, without losing the existing convention-skills guidance when a human is expected to drive the handoff.

**Affected.** `/goal:plan` authors and `goal-run.ts` unattended runs are protected from an unverifiable Definition of Done line. Developers using manual execution retain the convention-skills handoff.

The ticket closes a mismatch between the plan contract and the executor that consumes it. The autonomous route is verified by the gate and supervision workflow, not by a human loading skills during an iteration. The manual route still has a human who can follow the canonical handoff, so its convention-skills guidance remains useful and intentional.

## Reproduction

```text
rg -n --fixed-strings -- "Project convention skills were loaded before coding (see handoff)" plugins/goal/skills/plan/SKILL.md
778:- Project convention skills were loaded before coding (see handoff)

sed -n '1,7p' plugins/goal/agents/goal-run-implementer.md
---
name: goal-run-implementer
description: "Implements one iteration of a locked goal plan for goal-run.ts, test-first, inside the paths its gate block declares. Cannot commit, push, stage or tick a checkbox. Examples: <example>Context: goal-run.ts reached iteration 5 of a locked plan. assistant: 'I'll use the goal-run-implementer agent to implement that iteration inside its declared scope.' <commentary>The implementer writes; the gate judges and commits.</commentary></example>"
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
color: green
---

rg -n --fixed-strings -- "Skill" plugins/goal/agents/goal-run-implementer.md || true
<no output>
```

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

## Business rules (functional DoD — one observable criterion per rule)

- A fully gateable `commit+pr` plan has no convention-skills claim in its global Definition of Done → observed when its generated plan contains the test, typecheck, and lint/QA DoD entries but no “Project convention skills were loaded before coding” line, and its closing route is the `/goal:supervise` handoff.
- A `manual` plan retains the convention-skills handoff → observed when the generated manual handoff still names the resolved convention skills and tells the human executor to load them before coding.
- A `commit+pr` plan with at least one non-gateable iteration retains the convention-skills handoff → observed when the generated fallback handoff contains the same convention-skills guidance for the human-driven iteration.
- The unattended implementer is not made responsible for loading convention skills → observed when the unattended agent contract still exposes no `Skill` tool or equivalent preloading requirement.

## Deferred decisions

- none

## Files (as found in source)

- none named explicitly in the source

## Flags for /goal:plan

- The policy split spans the plan skill’s global DoD and its closing/handoff rules; the implementation must keep those two sources coherent.
- Existing plan-closing and instruction-contract tests may encode the unconditional line or the current output branches and need to be checked together.

## Notes / decisions from source

- Ticket 0f is issue #188 and follows 0b4 delivered by PR #213.
- The manual convention-skills handoff is deliberately retained.
- The unattended path must not gain a `Skill` tool or an unenforced loading order.
