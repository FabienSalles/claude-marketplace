---
description: Session 1 of the goal workflow — read any source (Jira US, GitHub issue, spec file, inline), lift ambiguities and fill functional gaps, build the missing Definition of Done, decompose into functional iterations, persist a validated plan on a feature branch, then echo the per-iteration /goal handoff for Session 2
argument-hint: A source — Jira key (CT-1234), GitHub issue number (42), a spec path (.claude/plans/x-spec.md), or 'inline'
---

# /run-issue — Source → Plan → Branch (Session 1 of the goal workflow)

You are helping the developer prepare an **autonomous `/goal` execution** that
delivers working code. THIS session is purely interactive — lift every
ambiguity and fabricate the missing Definition of Done NOW, because once
`/goal` starts in Session 2 it cannot ask the developer anything.

The source is **not necessarily a GitHub issue**. It is frequently a **Jira
US** that has functional holes, undocumented technical consequences, and **no
Definition of Done at all** — building that DoD here is the whole point.

> Companion docs: this plugin's `README.md` (full workflow), `templates/done-criteria.template` (acceptance-criteria baseline).
>
> **Permissiveness:** this command works standalone. It reads Jira via the
> Atlassian MCP, GitHub via `gh`, or a plain file — whatever the source is.
> GitHub is **never required**. Optional enhancers (`pocock` grill skills,
> `superpowers` verification/debugging, `common` spec-first-dev, `craft` TDD,
> language convention skills) sharpen the workflow but none are mandatory.

## Argument — resolve the source

Source: `$ARGUMENTS`

Resolve it to a **work item** and a stable **work-id**:

| `$ARGUMENTS` shape | How to read it | work-id |
|---|---|---|
| Jira key `^[A-Z][A-Z0-9]+-[0-9]+$` (e.g. `CT-1234`) | Atlassian MCP — see below | key lowercased → `ct-1234` |
| Bare integer `42` or `#42` | `gh issue view 42 --json number,title,body,labels,assignees,comments` (needs `gh auth`) | `issue-42` |
| A path ending in `.md` | Read the file | ≤40-char kebab slug of the title |
| `inline` or empty | Ask the developer to paste the source now | ≤40-char kebab slug of the title |
| Anything else that doesn't resolve | STOP and report | — |

**Reading a Jira source via MCP:** load the Atlassian tools first with
`ToolSearch` (`select:getAccessibleAtlassianResources,getJiraIssue`), get the
`cloudId` from `getAccessibleAtlassianResources`, then `getJiraIssue` with the
key. Extract: summary, description, acceptance criteria (if any), status, and
the comment thread (comments often hold the real requirements). If the MCP is
unreachable, STOP and tell the developer to paste the US with `inline`.

The **work-id** drives every artifact: spec at `.claude/plans/<work-id>-spec.md`,
branch `feature/<work-id>-<slug>`, log at `.claude/plans/<work-id>-execution-log.md`.

## Phase 0 — Preconditions

Verify in one round:
- `git rev-parse --show-toplevel` succeeds (we're in a repo)
- The current branch is clean; if dirty, ask the developer to stash/commit first
- **Only if the source is a GitHub issue:** `gh auth status` succeeds
- **Only if the source is Jira:** the Atlassian MCP resolves (`getAccessibleAtlassianResources` returns a resource)

Do **not** require `gh` for a Jira/file/inline source. If a needed check fails,
STOP and tell the developer what to fix.

Optional pointer (do not block on it): if the source is **not** a GitHub issue
and the developer might want one for tracking, mention once: _"No GitHub issue
backs this source — run `/draft-issue <source>` first if you want one mirrored.
Otherwise I continue local-only."_ Default: continue local-only.

## Phase 1 — Read the source

Summarize the source in 5–10 lines:
- What the developer appears to want (the business need)
- What's clearly stated vs implied vs **missing**
- Which files/modules you suspect are involved
- **Functional gaps** you already spot (unspecified rules, undefined edge cases)
- **Technical consequences** the source doesn't mention (migrations, cross-service
  couplings, contract changes)
- Whether a Definition of Done exists (for a Jira US: almost always **no** → you'll build it)

Ask: **"Is my reading correct? Anything to add before I start grilling?"** WAIT.

## Phase 2 — Grill (one question at a time)

Goal of the grill: **close every functional gap and surface every technical
consequence** so the plan is executable without further human input. Pick the
best available interview approach, in order:

1. **`pocock:grill-with-docs`** if installed AND `CONTEXT.md`/`docs/adr/` exist.
2. **`pocock:grill-me`** if installed.
3. **`common:spec-first-dev` Phase 1 questions** if `common` is installed.
4. **Inlined baseline** (below) — always works.

### Inlined baseline questions (fallback)

Ask one at a time, each with your recommended answer. Skip anything the source
already answers.

**Round 1 — the need (fill functional gaps):**
- Who triggers this? (end user / admin / batch / external system)
- Precise end-to-end happy path, step by step?
- Which **business rules** apply? (validations, computations, conditions, limits)
- Vocabulary: project-specific terms to align with? Where do they live?
- Business edge cases (not technical — real domain cases)?
- What is explicitly **out of scope** for this delivery?

**Round 2 — the system (surface technical consequences):**
- Mockups / Figma / design docs referenced?
- Cross-project couplings? (API client here, endpoint elsewhere — scan another repo?)
- Where does data come from? (new API, existing DB, hard-coded, external)
- Migrations, schema changes, or contract changes implied?
- Constraints not derivable from the code? (deadlines, legal, team decisions)
- Anything else invisible in the code I should know?

**Round 3 — verifiability + Definition of Done (always ask):**
- For **each business rule** from Round 1: what command-line check proves it holds?
  (a named test, a lint rule, a build output) — this is how the DoD gets teeth.
- What is the smallest command that proves the whole thing works end to end?
- What must **not** change as a side-effect? (files / behaviors to protect)
- What are the project's actual test and lint/QA commands? (dockerized where
  applicable — do not assume host-level runners)

### Stop condition

Stop grilling when: every functional gap is closed, every business rule maps to
a command-line check, and no "it depends" remains. Typical: 5–15 questions for a
small US, more for a feature. **One question per message** — batch questionnaires
reduce signal.

## Phase 3 — Decompose into functional iterations, then write the plan

Break the work into **functional iterations** — each a thin vertical slice that
leaves the app working and is independently reviewable and committable. Prefer
small slices: fewer surprises at review, less rework. Each iteration carries its
own files-to-touch and its own command-line acceptance criteria.

Persist at `.claude/plans/<work-id>-spec.md`:

```markdown
# Spec: <title>

Source: <Jira CT-1234 | gh issue #42 URL | spec file path | inline>
Work-id: <work-id>

## Business intent
<1–3 paragraphs: what + why, in the developer's domain vocabulary>

## Scope IN
- <what's in>

## Scope OUT
- <what's explicitly NOT in this delivery>

## Business rules (each must map to a test in the DoD)
- <rule> → verified by <named test / command>
- <rule> → verified by <named test / command>

## Files NOT to touch
- <tempting-but-out-of-scope files>

## Definition of Done (global, command-line verifiable)
Built here because the source had none. Use the project's real commands
(dockerized where applicable — e.g. `make …` / `docker compose run --rm …`,
not host `php`/`composer`/`npm`).
1. <whole-scope test command> exits 0
2. <project lint/QA command> exits 0
3. Every business rule above has a passing covering test
4. `git status` clean (no untracked artifacts)
5. Project convention skills were loaded before coding (see handoff)

## Functional iterations

### Iteration 1 — <name>
- [ ] Not done yet
- **Goal:** <the slice's user-visible/behavioral outcome>
- **Files to touch:** `<path>` (+ `<path>` (test))
- **Business rules covered:** <subset of the rules above>
- **Acceptance criteria (command-line):**
  - <test command scoped to this slice> exits 0
  - `git diff --stat` shows only this iteration's files
  - <project lint/QA> exits 0

### Iteration 2 — <name>
- [ ] Not done yet
- ...

## Out-of-band decisions captured during grill
- Q: <question>
  A: <answer>
```

Show the plan. Ask: **"Does this plan match our conversation? The iterations
are the review checkpoints — edit the split or any criterion before I lock it?"**
WAIT for explicit confirmation.

## Phase 4 — Choose the commit / PR policy

Ask the developer (this controls what `/goal` is allowed to do in Session 2):

> **How should Session 2 handle commits and the PR?**
> - **manual** (default) — I never commit, push, or open a PR. After each
>   iteration I stop with a synthesis; you review and commit yourself.
> - **commit** — I commit each iteration myself (conventional message, no
>   `Co-Authored-By` trailer), but never push or open a PR.
> - **commit+pr** — like commit, plus after the LAST iteration I push and open
>   the PR (requires a GitHub remote).

WAIT for the answer. Record it as `<policy>` — it goes into the handoff verbatim.

## Phase 5 — Lock: branch + persist the plan

```bash
slug="<≤40-char kebab slug of the title>"
git checkout -b "feature/<work-id>-$slug"
mkdir -p .claude/plans
# the plan file is already written at .claude/plans/<work-id>-spec.md
```

Then, honoring the policy:
- **manual** — do **not** commit the plan. Tell the developer: _"Plan written
  and branch created; commit the plan yourself when you commit iteration 1."_
- **commit / commit+pr** — commit the plan as the contract lock:
  ```bash
  git add .claude/plans/<work-id>-spec.md
  git commit -m "spec: lock <work-id> contract for autonomous /goal"
  ```

Read the branch name back to the developer.

## Phase 6 — Hand off to Session 2 (one /goal per iteration)

Echo this **exact text**, filled with the work-id, the policy, and the spec's
real test/lint commands. The developer pastes it once per iteration — it always
picks the **next unchecked** iteration, so the same text works every round.

```text
/goal Implémente la PROCHAINE itération non cochée de .claude/plans/<work-id>-spec.md, puis STOP.

Avant de coder : charge les skills de conventions du projet applicables au périmètre
(backend, templates, tests, TDD, langage) et lis le sibling le plus proche de la feature
pour capter les conventions locales.

Implémente en TDD : test qui échoue d'abord (montre le RED), puis le code, puis refactor.
Chaque règle métier listée dans l'itération DOIT être couverte par un test.

« Done » pour CETTE itération — exécute les commandes et montre la sortie, n'affirme rien de mémoire :
1. <commande de test du périmètre de l'itération> exit 0
2. <commande de lint/QA du projet> exit 0
3. git diff --stat montre UNIQUEMENT les fichiers listés dans l'itération
4. git status propre (aucun artefact non suivi)
5. Chaque critère d'acceptation de l'itération est vérifié par une commande
6. Coche [x] cette itération dans le spec (dernier geste)

Politique commit/PR : <policy>
- manual      → NE COMMITE PAS, NE PUSH PAS, N'OUVRE PAS DE PR.
- commit      → commite CETTE itération avec le message conventionnel suggéré (SANS trailer Co-Authored-By), sans push ni PR.
- commit+pr   → commite CETTE itération ; si c'est la DERNIÈRE itération non cochée, push puis gh pr create --body-file .claude/plans/<work-id>-spec.md.

Termine TOUJOURS par une SYNTHÈSE structurée dans le prompt :
- **Fait** : ce qui a été implémenté
- **Pourquoi** : le besoin métier couvert
- **Règles métier couvertes** : liste + test correspondant
- **À reviewer** : points d'attention, décisions, risques de régression
- **Commit suggéré** : message conventionnel (SANS trailer Co-Authored-By)
- **Reste** : itérations non cochées restantes dans le spec

STOP après cette itération, quoi qu'il arrive. Max 15 tours.
Le spec est le contrat — si une déviation est nécessaire, mets à jour le spec d'abord.
```

Then tell the developer:

> Run `/goal` above. When it stops, read the synthesis, review the diff, and
> (in **manual** mode) commit the iteration yourself. Then paste the **same
> `/goal` text again** — it picks the next unchecked iteration. Repeat until the
> spec has no unchecked iterations left.
>
> For a hands-off run you can use `tmux new -s <work-id>` + `claude`, but for the
> per-iteration review loop staying in one interactive terminal is simpler.

## Rules for THIS session

- **Do not write production code.** Phases 1–6 are clarification + contract only.
- **GitHub is optional.** Never call `gh` unless the source is a GitHub issue or
  the developer opted into a PR (commit+pr policy).
- **Lift, don't assume.** If tempted to "infer" an answer the executor will need,
  ASK instead. A Jira US's silence is a question, not a default.
- **Build the DoD.** The source rarely ships one — every business rule must land
  as a command-line check.
- **Small iterations beat one big slice** — they are the review + commit
  checkpoints and the main defense against rework.
- **One question at a time.**
- **The spec is the contract.** Any Session-2 deviation updates the spec first.
