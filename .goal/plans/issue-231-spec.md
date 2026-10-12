# Spec: Write each goal skill rule once, in shared topic files

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/231
Work-id: issue-231
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
PR base: feature/issue-128-copilot-hosts-the-goal-sessions
Status: plan locked by /goal:plan on 2026-10-12, stacked on PR #230; functional contract settled by /goal:spec the same day.
Adversarial grill: ran
---

## Business intent

**Problem.** The goal plugin's skills copy the same rule blocks into every file. A
paragraph-exact scan of `plugins/goal/skills/*/SKILL.md` and `plugins/goal/agents/*.md` finds
7 duplicated paragraphs (3 lines or more): the `## Host` block in 6 skills, the
`## Project artifact root` block in 5 skills (34 lines, 41 in `spec`), the duration table in
`agents/goal-run-auditor.md` and `skills/supervise/SKILL.md`, and the `manual` clipboard rule in
`plan` and `next`. `tests/skill-host.test.ts` asserts the six `## Host` copies are identical:
it stops drift, and it also locks the duplication in place. Every rule change has to be made
five or six times.

**Objective.** Each rule shared by several goal skills is written once. A skill keeps inline
only what it needs to find the plugin root, plus what is genuinely its own.

**Success signal.** The next change to a shared rule (the artifact root, the Host rules) is a
one-file edit, and a new copy-paste of a rule block into a second goal file fails the suite
before it is merged.

**Affected.** The developer maintaining the goal plugin: one place to edit instead of six. Users
of the skills under Claude Code and Copilot: nothing changes in behaviour.

The constraint shaping the solution: each skill loads on its own, and Copilot does not
substitute `${CLAUDE_PLUGIN_ROOT}`. A skill must find the plugin root before it can read any
shared file, so the root bootstrap and the "cannot locate the goal plugin scripts" stop stay
copied. Everything else that depends only on the root can move.

## Reproduction

- `python3` paragraph scan (paragraphs of 3+ lines, fenced code excluded) over
  `plugins/*/skills/*/SKILL.md`, `plugins/*/agents/*.md`, `plugins/*/commands/*.md`
  → `131 files; 10 duplicated paragraphs (>=3 lines)`: `7 goal`, `1 nest,tooling`,
  `1 marketing-analytics`, `1 security-runtime,statusline`.
- Same scan over `plugins/goal/skills/*/SKILL.md` + `plugins/goal/agents/*.md`:
  - `Git ignore rules determine planning-document versioning…` ×5
  - `Discover identifiers only in <plans>…` ×5
  - `Use the returned absolute root, plans and runs…` ×5
  - `Claude Code substitutes ${CLAUDE_PLUGIN_ROOT} and $ARGUMENTS…` ×6
  - `When <root>/src/artifacts.ts is missing…` ×6
  - `| Step | Implementer | Gate | Push |` ×2 (`agents/goal-run-auditor.md`, `skills/supervise/SKILL.md`)
  - `Under manual, offer the clipboard before printing…` ×2 (`skills/next`, `skills/plan`)
- `## Project artifact root` body length per skill: 34 lines in `next`, `plan`, `supervise`,
  `tickets`; 41 in `spec`; absent in `grill-adversarial`.

## Scope IN

- Every duplicated rule block across `plugins/goal/skills/*/SKILL.md`, exact and near-duplicate.
- An audit of those blocks with each one's fate, published in the pull request body.
- One shared file per topic inside the goal plugin.
- A guard that fails the suite on a new duplicated block.

## Scope OUT

- Duplicates shared across plugins (`nest`/`tooling`, `security-runtime`/`statusline`): each
  plugin installs alone and cannot read another's files.
- Duplicates inside other plugins (`marketing-analytics`).
- Agent ↔ skill duplicates (the duration table): the copy stays, guarded by the identity
  assertion that already exists in `tests/report-format.test.ts`.
- Rewording a rule's meaning. Only where it lives changes.

## Business rules (each must map to a command in the DoD)

- **R1 — Audit.** Every rule block found in 2 or more goal skills is listed with its fate →
  verified by `tests/prose-duplicates.test.ts` (iteration 3: no unlisted exact duplicate
  remains) + the `## Duplication audit` table below, folded into the PR body at close (not
  machine-verifiable).
- **R2 — Written once.** Each common rule block lives in exactly one shared file → verified by
  the gate1 of the iteration that extracts it (its marker text appears once across skills +
  `shared/`), carried forward by every later regression wall.
- **R3 — Near-duplicates converge.** → verified by iterations 3 and 4's gate1 (each family's
  marker appears only in its shared file).
- **R4 — Local variant stays local.** → verified by `tests/artifact-skills.test.ts`
  (iteration 2: `spec` still asks for a location when none is supplied; the others still use
  the default).
- **R5 — No contradiction.** → verified by iteration 2's gate1 (the shared artifact-root file
  carries neither the "ask" nor the "use the default" branch).
- **R6 — Bootstrap inline.** → verified by `tests/skill-host.test.ts` (iteration 1: every skill
  carries the identical bootstrap with the stop and install commands).
- **R7 — Shared files name `<root>`.** → verified by `tests/skill-host.test.ts` (no
  `${CLAUDE_PLUGIN_ROOT}` in any `shared/*.md`; the bootstrap defines `<root>` for both hosts).
- **R8 — Skipped read is visible.** → verified by `tests/skill-host.test.ts` (the version line
  appears in `shared/host.md` and in no `SKILL.md`).
- **R9 — Missing shared file stops.** → verified by `tests/skill-host.test.ts` (the bootstrap's
  stop names a missing shared file as well as missing scripts).
- **R10 — Read only what applies.** → verified by every extracting iteration's gate1 (each skill
  that carried a block names its shared file; `grill-adversarial` names no artifact-root file).
- **R11 — Behaviour unchanged.** → verified by the 9 prose suites in every gate1 and `dod1`, with
  assertions retargeted to skill + named shared files, none removed.
- **R12 — Anti-duplicate guard.** → verified by `tests/prose-duplicates.test.ts` (iteration 3).

## States, invariants & transitions

- **States:**
  - S1 root found, shared files read: full rules.
  - S2 root found, shared read skipped: rules lost.
  - S3 root wrong or scripts missing.
  - S4 root found, a named shared file missing (partial install, renamed file).
  - S5 skill loaded nested inside another skill (e.g. `grill-adversarial` from `spec`).
- **Invariants:**
  - I1 each rule is stated once, except allowlisted copies (owner: R2, R12, transverse).
  - I2 no command runs on an empty or literal plugin path (owner: R6, R7, iteration 1).
  - I3 each skill's behaviour is unchanged (owner: R4, R11, transverse: the 9 prose suites in
    every gate1).
  - I4 a lost shared read is visible to the developer (owner: R8, R9, iteration 1).
  - I5 shared and inline text never contradict (owner: R5, iteration 2).
- **Transition matrix:**
  - S1 × run skill → behaves as today (I3).
  - S2 × run skill → no version line printed: visible (I4). Accepted risk; no automatic stop.
  - S3 × run skill → bootstrap stop, nothing written (I2).
  - S4 × run skill → same stop as S3, nothing written (R9).
  - S5 × run nested skill → nested skill reads its own topics; its version line is not the
    session's first line, as today.
  - Agent spawned by `goal-run.ts` × read shared file → blocked: agents keep their copies.
  - Developer edits a shared rule → one edit applies to every reader (I1).
  - Developer copies a block into a second goal file → suite fails (R12).
- Each invariant is carried by the sequence of checks above: I2 and I4 by iteration 1's gate1,
  I5 by iteration 2's, I1 by iteration 3's guard, I3 transverse in every gate1.

## Delivery strategy

Pure refactor: behaviour identical, so no flag and no cleanup. The proof is the 9 existing
prose suites, retargeted rather than removed, staying green in every slice. Blast radius is
empty: outside the skills, only `tests/artifact-skills.test.ts` and `tests/skill-host.test.ts`
read these blocks, both owned by this plugin. New files under `plugins/goal/shared/` are
additive; Claude Code does not load `.md` files there as skills. The plugin version is bumped
in iteration 4 so installed copies pick up `shared/`.

## Files NOT to touch

- `plugins/goal/agents/*.md` — agent copies stay (Scope OUT).
- `plugins/goal/src/**`, `plugins/goal/scripts/**` — no runtime code changes.
- Any other plugin.
- `plugins/goal/templates/**` — not part of the duplication found.

## Definition of Done (global, command-line verifiable)

```gate
dod1=bash plugins/goal/tests/run.sh
dod2=node node_modules/typescript/bin/tsc --noEmit
dod3=node scripts/verify.ts structure
dod4=bash plugins/goal/tests/support/mutate.sh
```

Also true, and not expressible as a command of its own:
- Every business rule above has a passing covering test (proven by `dod1`)
- The `## Duplication audit` table is folded into the PR body at close

## Duplication audit

Fixed at plan time; folded into the PR body as `### Duplication audit` once the run closes.

| Block | Copies | Fate |
|---|---|---|
| Root rule (`Claude Code substitutes…` / two levels above base dir) | 6 skills | bootstrap, stays inline (allowlisted) |
| `cannot locate the goal plugin scripts` stop | 6 skills | bootstrap, stays inline (allowlisted) |
| Version line, non-interactive stop | 6 skills | extracted to `shared/host.md` (iteration 1) |
| `## Project artifact root` common trunk | 5 skills | extracted to `shared/artifact-root.md` (iteration 2) |
| Artifact-root location branch (`spec` asks; others use the default) | 5 skills | local variant, stays inline |
| Handoff routing (Phase 5 table, all-gateable rule, fill rule, clipboard offer) | `plan`, `next` | extracted to `shared/handoff.md` (iteration 3) |
| `## Portability` bullets | `plan`, `spec`, `tickets` | extracted to `shared/portability.md` (iteration 4) |
| Grill approach list (`pocock:grill-with-docs` → … → baseline) | `plan`, `spec` | extracted to `shared/grill-approach.md` (iteration 4) |
| Jira read via Atlassian MCP | `plan`, `spec` | extracted to `shared/jira-source.md` (iteration 4) |
| Plan-argument resolution (full path / identifier / empty) | `next`, `supervise` | extracted to `shared/plan-argument.md` (iteration 4) |
| Source table, grill stop condition | `plan`, `spec`, `tickets` | local: same shape, different rules |
| Duration table | `agents/goal-run-auditor.md`, `skills/supervise` | guarded copy (allowlisted; `tests/report-format.test.ts`) |

## Functional iterations

### Iteration 1 — The Host rules live in one shared file
- [x] Not done yet
- **Goal:** Each goal skill keeps only the root bootstrap inline and reads the rest of its Host rules from `shared/host.md`.
- **Shippable after it:** a Host rule change is a one-file edit; every skill behaves as before under both hosts.
- **Files to touch:** `plugins/goal/shared/host.md` (new), the 6 `plugins/goal/skills/*/SKILL.md` (+ `plugins/goal/tests/skill-host.test.ts` (test))
- **Business rules covered:** R2 (Host), R6, R7, R8, R9, R10 (Host)
- **Delivery:** additive shared file + in-place prose move; behaviour identical.
- **Not machine-verifiable:** a real Copilot session printing the version line after reading `shared/host.md`.

The bootstrap that stays inline in every skill, identical across the six: `<root>` is Claude
Code's substituted `${CLAUDE_PLUGIN_ROOT}`, or, when a host leaves it literal, two levels above
`Base directory for this skill:`; `$ARGUMENTS` left literal is the text typed after the command;
when `<root>/src/artifacts.ts` or a shared file the skill names is missing, print
`cannot locate the goal plugin scripts`, the host and the install commands, and write nothing;
then read `<root>/shared/host.md`. `shared/host.md` holds the version line and the
non-interactive stop, and names `<root>`, never `${CLAUDE_PLUGIN_ROOT}`.

```gate
test_files=plugins/goal/tests/skill-host.test.ts
impl_files=plugins/goal/shared/host.md plugins/goal/skills/spec/SKILL.md plugins/goal/skills/plan/SKILL.md plugins/goal/skills/next/SKILL.md plugins/goal/skills/tickets/SKILL.md plugins/goal/skills/supervise/SKILL.md plugins/goal/skills/grill-adversarial/SKILL.md
max_diff=350
commit_msg=refactor(goal): read the Host rules from one shared file
# rule: R6 R7 R8 R9 R10 the bootstrap stays inline, the rest of Host lives once in shared/host.md; R11 every prose suite still holds
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/skill-host.test.ts plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/plan-premise.test.ts plugins/goal/tests/plan-closing.test.ts plugins/goal/tests/gate-locks.test.ts plugins/goal/tests/spec-reproduction.test.ts plugins/goal/tests/tickets-premise.test.ts plugins/goal/tests/report-format.test.ts plugins/goal/tests/supervise-host.test.ts
# rule: the project still typechecks and lints
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/tests/skill-host.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 2 — The artifact-root rules live in one shared file
- [x] Not done yet
- **Goal:** The common artifact-root rules move to `shared/artifact-root.md`; each of the five skills keeps only its own location branch inline.
- **Shippable after it:** an artifact-root rule change is a one-file edit; `spec` still asks for a location, the others still use the default.
- **Files to touch:** `plugins/goal/shared/artifact-root.md` (new), `plugins/goal/skills/{spec,plan,next,tickets,supervise}/SKILL.md` (+ `plugins/goal/tests/artifact-skills.test.ts` (test))
- **Business rules covered:** R2 (artifact root), R4, R5, R10 (artifact root)
- **Delivery:** additive shared file + in-place prose move; behaviour identical.
- **Not machine-verifiable:** none

```gate
test_files=plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/skill-host.test.ts
impl_files=plugins/goal/shared/artifact-root.md plugins/goal/skills/spec/SKILL.md plugins/goal/skills/plan/SKILL.md plugins/goal/skills/next/SKILL.md plugins/goal/skills/tickets/SKILL.md plugins/goal/skills/supervise/SKILL.md
max_diff=400
commit_msg=refactor(goal): read the artifact-root rules from one shared file
# rule: R2 R4 R5 R10 the common trunk lives once, each local branch stays in its skill, grill-adversarial reads none; R11 every prose suite still holds
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/skill-host.test.ts plugins/goal/tests/plan-premise.test.ts plugins/goal/tests/plan-closing.test.ts plugins/goal/tests/gate-locks.test.ts plugins/goal/tests/spec-reproduction.test.ts plugins/goal/tests/tickets-premise.test.ts plugins/goal/tests/report-format.test.ts plugins/goal/tests/supervise-host.test.ts
# rule: the project still typechecks and lints
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/tests/artifact-skills.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 3 — Handoff routing lives once, and a new copy fails the suite
- [ ] Not done yet
- **Goal:** The handoff routing shared by plan and next moves to `shared/handoff.md`, and a new copied block in two goal files fails the suite.
- **Shippable after it:** no exact duplicate remains in goal skills outside the allowlist, and the next copy-paste is caught before merge.
- **Files to touch:** `plugins/goal/shared/handoff.md` (new), `plugins/goal/skills/plan/SKILL.md`, `plugins/goal/skills/next/SKILL.md` (+ `plugins/goal/tests/prose-duplicates.test.ts` (new test), `plugins/goal/tests/plan-closing.test.ts` (test))
- **Business rules covered:** R1 (machine part), R2 (handoff), R3 (handoff), R12
- **Delivery:** additive shared file + guard test; behaviour identical.
- **Not machine-verifiable:** none

The guard scans `plugins/goal/skills/*/SKILL.md`, `plugins/goal/agents/*.md` and
`plugins/goal/shared/*.md` for paragraphs of 3 lines or more (fenced code excluded) appearing in
2 or more files, and fails on any not in its allowlist. The allowlist holds the two bootstrap
paragraphs and the duration table, each with its reason. Without this iteration's skill edits,
the clipboard paragraph still sits in `plan` and `next`, so the guard fails: that is the bite.

```gate
test_files=plugins/goal/tests/prose-duplicates.test.ts plugins/goal/tests/plan-closing.test.ts plugins/goal/tests/plan-premise.test.ts plugins/goal/tests/gate-locks.test.ts
impl_files=plugins/goal/shared/handoff.md plugins/goal/skills/plan/SKILL.md plugins/goal/skills/next/SKILL.md
max_diff=350
commit_msg=refactor(goal): read the handoff routing from one shared file and refuse new copies
# rule: R1 R2 R3 R12 no unlisted duplicate remains and a new one fails; R11 every prose suite still holds
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/prose-duplicates.test.ts plugins/goal/tests/plan-closing.test.ts plugins/goal/tests/skill-host.test.ts plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/plan-premise.test.ts plugins/goal/tests/gate-locks.test.ts plugins/goal/tests/spec-reproduction.test.ts plugins/goal/tests/tickets-premise.test.ts plugins/goal/tests/report-format.test.ts plugins/goal/tests/supervise-host.test.ts
# rule: the project still typechecks and lints
gate2=printf '%b\n' '.PHONY: all types lint' 'all: types lint' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/tests/prose-duplicates.test.ts plugins/goal/tests/plan-closing.test.ts' | gmake -f - -j2 --output-sync=target
```

### Iteration 4 — The remaining near-duplicate rules converge into shared files
- [ ] Not done yet
- **Goal:** Portability, grill approach, Jira reading and plan-argument rules are each worded once in a shared file, and the goal plugin version is bumped so installs pick them up.
- **Shippable after it:** every rule family in the audit has one home; installed copies of the plugin read the shared files.
- **Files to touch:** `plugins/goal/shared/{portability,grill-approach,jira-source,plan-argument}.md` (new), `plugins/goal/skills/{plan,spec,tickets,next,supervise}/SKILL.md`, `plugins/goal/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (+ `plugins/goal/tests/prose-duplicates.test.ts` (test))
- **Business rules covered:** R2, R3, R10 (remaining families)
- **Delivery:** additive shared files + in-place prose move; behaviour identical; minor version bump.
- **Not machine-verifiable:** none

`tests/prose-duplicates.test.ts` gains one assertion per family: its marker (`pocock:grill-with-docs`,
`getAccessibleAtlassianResources`, `No \`AskUserQuestion\` tool`, the plan-argument full-path
rule) appears in its shared file and in no `SKILL.md`, and each skill that carried it names the
shared file. Without this iteration's skill edits, the markers still sit in the skills: that is
the bite.

```gate
test_files=plugins/goal/tests/prose-duplicates.test.ts plugins/goal/tests/skill-host.test.ts plugins/goal/tests/supervise-host.test.ts plugins/goal/tests/plan-premise.test.ts plugins/goal/tests/spec-reproduction.test.ts plugins/goal/tests/tickets-premise.test.ts
impl_files=plugins/goal/shared/portability.md plugins/goal/shared/grill-approach.md plugins/goal/shared/jira-source.md plugins/goal/shared/plan-argument.md plugins/goal/skills/plan/SKILL.md plugins/goal/skills/spec/SKILL.md plugins/goal/skills/tickets/SKILL.md plugins/goal/skills/next/SKILL.md plugins/goal/skills/supervise/SKILL.md plugins/goal/.claude-plugin/plugin.json .claude-plugin/marketplace.json
max_diff=400
commit_msg=refactor(goal): word the remaining shared rules once
# rule: R2 R3 R10 each near-duplicate family lives once and its readers name it; R11 every prose suite still holds
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/prose-duplicates.test.ts plugins/goal/tests/skill-host.test.ts plugins/goal/tests/artifact-skills.test.ts plugins/goal/tests/plan-premise.test.ts plugins/goal/tests/plan-closing.test.ts plugins/goal/tests/gate-locks.test.ts plugins/goal/tests/spec-reproduction.test.ts plugins/goal/tests/tickets-premise.test.ts plugins/goal/tests/report-format.test.ts plugins/goal/tests/supervise-host.test.ts
# rule: the project still typechecks, lints, and the marketplace structure holds after the bump
gate2=printf '%b\n' '.PHONY: all types lint structure' 'all: types lint structure' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/tests/prose-duplicates.test.ts' 'structure:\n\tnode scripts/verify.ts structure' | gmake -f - -j2 --output-sync=target
```

## Out-of-band decisions captured during grill

- Q: Base for the branch while PR #230 is open?
  A: Stack on `feature/issue-128-copilot-hosts-the-goal-sessions` (`PR base:`); GitHub retargets to `main` once #230 merges and its branch is deleted.
- Q: Who writes the audit table into the PR body, since the run rewrites it every slice?
  A: The table is fixed in this plan; `/goal:supervise` folds it as `### Duplication audit` at close, next to the session audit.
- Q: Policy, delivery mode, remote?
  A: `commit+pr`; `no-bc-break` recorded unasked (empty blast radius: only this plugin's own tests read the blocks); `origin`.
- Scope limited to `plugins/goal`; one file per topic; the version line is the skip signal; divergent copies keep their local variant inline; agents keep their copies.
- `GOAL_ROOT_PATH=".goal"` chosen for `.env.local`; the developer adds that line (the `security-runtime` guard blocks the session from touching the file).
