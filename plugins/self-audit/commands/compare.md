---
description: Deep comparative audit of an external Claude skill pack against this marketplace, weighted by my real Claude usage profile, plus a repo structure + documentation health pass. Produces a versioned gap-analysis backlog. Read-only, never touches git.
argument-hint: A target skill pack (github owner/name or URL, or a local path) + optional tier — quick | standard | deep
---

# /self-audit:compare — Deep audit of a skill pack vs my marketplace

You run a rigorous, evidence-based audit comparing an external Claude skill pack to this
marketplace, then turn the findings into a prioritized, versioned backlog. This is the
industrialized form of the manual `obra/superpowers` audit — its report is the canonical
output template: `${CLAUDE_PLUGIN_ROOT}/audits/superpowers-gap-analysis.md`.

## Phase 0 — Guard-rails (read first, every run)

- **Read-only.** NEVER stage, commit, push, open a PR, or rename repo files. This command
  produces exactly ONE report under `${CLAUDE_PLUGIN_ROOT}/audits/` and updates the register
  below. Nothing else. Versioning the report is the developer's job, done separately.
- **Output in French.** Answer-first: lead with the verdict, then the detail.
- **Anti-over-engineering.** Every recommendation MUST trace to a real gap AND, ideally, a
  real usage-friction. Default to "leave it". Never recommend adding surface for its own sake.
- **Load the usage lens.** Read `${CLAUDE_PLUGIN_ROOT}/usage-profile.md` before Phase 3 — it
  is the prioritization filter. Read the register below to skip already-audited packs.

## Input

`$ARGUMENTS` = the target skill pack: a GitHub repo (`owner/name` or URL) or a local path,
optionally followed by a tier (`quick` | `standard` | `deep`; default `standard`), and the
literal `no-repo-audit` to skip Phase 4.

## Phase 1 — Acquire the target

- If a repo: `git clone --depth 1 <repo>` into the scratchpad. If a local path: read in place.
- Enumerate the target's skills / commands / hooks with line counts.
- Map this marketplace's equivalent surface: `grep` / `glob` `plugins/` for candidate
  equivalents per target skill. Build the mapping `target-skill → my candidate equivalents`
  (a skill may map to a command, a global CLAUDE.md rule, or nothing).

## Phase 2 — Deep comparison (adversarial fan-out)

Each unit of work reads one target skill IN FULL (SKILL.md + supporting files) AND my candidate
equivalents, then returns: core method (1-2 sentences), coverage (`full` / `partial` / `none`),
where I'm genuinely BETTER (each point backed by a VERBATIM quote + line ref), where the target
is better / a real gap, cherry-pick verdict (`keep` / `skip` / `port technique X`),
recommendation. Posture: **adversarial, anti home-team bias.** Do not rubber-stamp my README.
"none / deliberately out of scope" is a valid, common verdict. Every "better" claim needs a
concrete quoted detail or it is dropped.

**How to run it, by tier:**
- `quick` / `standard` — **Agent tool** fan-out: launch the subagents in parallel (like
  `common:deep-review`). Model-driven orchestration, no ceremony.
- `deep` — **Workflow tool**: author and run a Workflow that replicates the two-pass
  `obra/superpowers` audit. A slash command whose instructions tell you to call Workflow is an
  explicitly-sanctioned opt-in, so calling it here is legitimate — do not hesitate. Shape:
  - **Pass 1 (Compare)** — `parallel()` one agent per target skill, each returning the
    structured object above via a JSON `schema` (validated, not parsed).
  - **Pass 2 (Deep-dive)** — for the surfaced strengths, `parallel()` one agent per point to
    extract the exact differing passages VERBATIM with line refs (the second superpowers pass).
  - Return `{ comparisons, deepdive }`, then run Phase 2b yourself on the load-bearing quotes.

## Phase 2b — Verbatim verification (you, main loop)

Before trusting the fan-out: re-grep the load-bearing verbatim quotes against the real files.
Line numbers drift ±1-2 (cat -n offset); the TEXT must match exactly. Tag each surviving claim
**✅ vérifié** or **🔎 à reconfirmer**. Drop any claim whose quote you cannot find.

## Phase 3 — Usage lens (prioritize by how I actually work)

For each gap and each strength, consult `usage-profile.md`:
- Closes a known **friction** (over-engineering, unsanctioned git, detours) → **P1**.
- Amplifies a known **strength** (TDD gated-green, root-cause + regression test, meta-tooling) → **P1/P2**.
- Orthogonal to how I work → **P3** or skip. Under anti-over-engineering, bias to skip.

## Phase 4 — Repo structure + documentation audit (default ON; skip with `no-repo-audit`)

Independent of the target. Audit marketplace health:
- Plugin layout consistency, orphan files, `plugin.json` / `marketplace.json` coherence
  (every plugin dir registered, no dead entries).
- `EXTERNAL_PLUGINS.md` accuracy; orphan docs and stale cross-references.
- Per-plugin README accuracy (claims that no longer match the code).

## Phase 5 — Synthesize the backlog

Write `${CLAUDE_PLUGIN_ROOT}/audits/<target-slug>-gap-analysis.md`, mirroring the format of
`audits/superpowers-gap-analysis.md` (canonical template):
1. Points forts validés — à préserver (avec réfs de ligne).
2. Manquements réels — backlog P1/P2/P3 (fichier cible + critère d'acceptation + confiance ✅/🔎).
3. Motifs README / doc à corriger.
4. Divergences ASSUMÉES — à NE PAS « corriger ».
5. Verdict cherry-pick.
6. Sous-axes où la cible garde l'avantage (honnêteté).
7. Audit structure + doc (Phase 4).
8. Checklist exécutable, ordre recommandé.

Then append a row to the register below, and print an answer-first chat summary: verdict +
top-3 P1 + path to the report.

## Tiers

| Tier | Fan-out | Coût | Quand |
|---|---|---|---|
| `quick` | 1 agent de synthèse (outil Agent), pas de fan-out par skill | faible | tri rapide d'un pack inconnu |
| `standard` (défaut) | 1 agent par skill (outil Agent) + vérif verbatim (Phase 2b) des claims porteurs | moyen | audit sérieux |
| `deep` | **outil Workflow** : fan-out schématisé + passe deep-dive verbatim (2 passes superpowers) | élevé (~1M+ tokens) | pack qu'on veut vraiment intégrer |

## Audits register (versioned)

| Cible | Rapport | Date | Tier | Statut |
|---|---|---|---|---|
| obra/superpowers | `audits/superpowers-gap-analysis.md` | 2026-07-20 | deep (2 passes) | ✅ backlog à traiter |
| mattpocock/skills | `audits/mattpocock-skills-gap-analysis.md` | 2026-07-20 | deep (2 passes, 116 agents) | ✅ backlog à traiter |
| ai-driven-dev/framework | `audits/aidd-framework-gap-analysis.md` | 2026-07-20 | standard (10 agents) | ✅ backlog à traiter |
| bmad-code-org/BMAD-METHOD | `audits/bmad-method-gap-analysis.md` | 2026-07-20 | deep (81 agents) | ✅ backlog à traiter |
| github/spec-kit | `audits/spec-kit-gap-analysis.md` | 2026-07-20 | deep (57 agents) | ✅ backlog à traiter |
| SuperClaude-Org/SuperClaude_Framework | `audits/superclaude-gap-analysis.md` | 2026-07-20 | deep (62 agents) | ✅ skip intégral (0 port) |
| eyaltoledano/claude-task-master | `audits/claude-task-master-gap-analysis.md` | 2026-07-21 | deep (42 agents) | ✅ skip intégral (0 port) |
| buildermethods/agent-os | `audits/agent-os-gap-analysis.md` | 2026-07-21 | deep (26 agents) | ✅ quasi-skip (1 P3 optionnel) |
| ruvnet/claude-flow | `audits/claude-flow-gap-analysis.md` | 2026-07-21 | deep (58 agents) | ✅ skip intégral (hors-catégorie) |
| FlorianBruniaux/claude-code-plugins | `audits/bruniaux-claude-code-plugins-gap-analysis.md` | 2026-07-22 | deep (101 agents) | ✅ backlog à traiter (4 ports) |
| 20 predefined workflows publics (corpus) | `audits/workflow-corpus-gap-analysis.md` | 2026-07-28 | deep (22 agents) | ↻ remplacé par la v2 |
| idem, v2 après le refactor `goal-single-run` | `audits/workflow-corpus-gap-analysis.md` | 2026-07-28 | deep (3 agents, corpus réutilisé) | ✅ backlog à traiter (2 P1 nouveaux + 8 survivants) |
