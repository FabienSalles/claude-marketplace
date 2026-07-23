# État des lieux — marketplace Fabien vs `ruvnet/claude-flow`

**Verdict (answer-first).** **Skip intégral, hors-catégorie : 0 keep, 0 port, 10/10 skip.**
claude-flow n'est **pas un pack de skills-discipline** — c'est une **plateforme d'orchestration**
(118 MB, ~1336 unités, crates Rust, serveurs MCP propriétaires `ruflo-*`, swarms d'agents). Ses
« skills » du cœur SDLC sont des **wrappers générés/liés au vendor** (`npx ruv-swarm`, `@claude-flow/cli`,
`mcp__plugin_ruflo-core_*`) : **aucune technique de prompt portable** à greffer. Pire, plusieurs
**entrent en conflit direct** avec tes règles (branches + PR créées par phase, sans consentement =
friction #2) ou trahissent une **qualité d'authoring faible** (glyphes corrompus `email$password`,
double frontmatter, conversion `/`→`$` cassée). C'est le skip le plus net de la salve : ce n'est même
pas le même objet que ton marketplace — c'est un concurrent de **l'outil Workflow** que tu utilises déjà.

> **Confiance :** ✅ = re-greppé fichier-en-main pendant CET audit · Fan-out : **58 agents, 0 erreur, ~2,8 M tokens** ; 12 forces cibles ✅ CONFIRMED, **aucune** ne ferme de friction.

---

## Méthode & sources

- **Tier `deep`** (Workflow 2 passes) sur **10 unités de la tranche SDLC** (sur ~1336) : `agent-specification`, `sparc-coder`, `sparc-coordinator`, `github-code-review`, `agent-goal-planner`, `agent-planner`, `v3-ddd-architecture`, `testgen-tdd-workflow`, `testgen-test-gaps`, `autopilot-loop`.
- **Hors périmètre par nature** : le reste (~1326 unités) = infra d'orchestration `ruflo-*` (swarm, agentdb, RAG memory, aidefence, browser, jujutsu, ruvllm, daa…), plateforme MCP/Rust sans rapport avec un pack de prompts.
- **Couverture :** `full=6`, `partial=2`, `none=2`.
- **Phase 2b** (✅) : `sparc-coordinator.md:125-126` branches/PR par phase ; `github-code-review.md:47` lens a11y ; glyphes corrompus `agent-specification.md:164,228` ; 2/3 fichiers testés lient un CLI/MCP propriétaire.

---

## 1. Points forts validés — à PRÉSERVER

| # | Force marketplace | Où | Face à claude-flow |
|---|---|---|---|
| 1 | Spec **gatée-humain** + TDD rouge-avant-code | `spec-first-dev.md` L88, L176 | `agent-specification` = dump de templates (Gherkin/OpenAPI/NFR) sans gate ni implémentation. ✅ |
| 2 | Simplicity gate anti-artefacts-upfront | `spec-first-dev.md` L158 | `agent-specification` pousse des artefacts exhaustifs upfront, sans frein. ✅ |
| 3 | Review bornée + scope-creep + severity call-site | `common/commands/deep-review.md` | `github-code-review` = swarm sur CLIs vendor, plus large mais non borné, non portable. ✅ |
| 4 | Git **manuel, consenti** (hooks enforced) | CLAUDE.md + `common/hooks/` | `sparc-coordinator` L125-126 « Creates branches for each phase / Manages PRs at phase boundaries » — sans gate. ✅ |

---

## 2. Manquements réels — BACKLOG

**Aucun.** 10/10 skip, 12 forces cibles toutes `friction=NONE`. Les 3-4 idées qui dépassent le
marketplace sont **soit vendor-bound (non portables), soit déjà captées** :

- **Détection de trous de couverture** (`testgen-test-gaps` : « what should I test next? ») : vrai axe absent (`testing-principles` couvre le *design* de test, pas la *détection de gaps*). **Mais** livré **entièrement** via `@claude-flow/cli` + worker MCP `mcp__plugin_ruflo-core_ruflo__hooks_worker-dispatch` — **zéro technique dans le SKILL.md**, seulement des commandes vendor. Non portable.
- **Lens Accessibilité + i18n en review** (`github-code-review.md:47`) : `deep-review` n'a pas ces lentilles dédiées. Nugget minuscule, mais marginal pour ton travail back PHP/TS, et `deep-review` couvre déjà mieux le reste (scope-creep, severity call-site, cap 2-5). Non retenu.
- **Branchement par type de tâche** (`sparc-coordinator` : bug fix → light-spec + test de régression) : **déjà couvert** par `systematic-debugging` (bug-fix-first-test) + le port `expand-task` déjà écarté. Doublon.
- **Auto-scheduling cache-aware** (`autopilot-loop` : régler le délai de réveil sous le TTL du prompt-cache) : astuce op réellement maligne, **mais** liée au serveur MCP `autopilot_*` propriétaire + `/loop` natif — et ton `/loop` + `ScheduleWakeup` existent déjà nativement. Non portable / déjà là.

---

## 3. Motifs README / doc à corriger

**Aucun côté marketplace.** claude-flow n'est ni vendored ni référencé dans `plugins/`. **Structure (Phase 4) — RAS.**

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

- **Modèle swarm multi-agents** (SPARC coordinator, GOAP planner en A* pathfinding, spawn parallèle par composant) : orchestration lourde que tu piles déjà, plus sobrement, via l'**outil Workflow**. Choix, pas trou.
- **Git par phase automatique** (branches + PR sans consentement) : opposé frontal à ta discipline git manuelle. Ne jamais aligner.
- **Dépendance MCP/CLI propriétaire** (`ruflo-*`, `@claude-flow/cli`, agentdb, RVF) : ta philosophie = skills-prompt autonomes, source-agnostiques. Choix.
- **Persistance mémoire vectorielle / RAG / neural** (RuVector, HNSW, SONA) : plateforme, hors axe pack-de-prompts.

---

## 5. Verdict cherry-pick

- **0 keep, 0 port, 10 skip.** Rien de portable : l'intelligence vit dans les crates Rust + serveurs MCP, pas dans les prompts ; les rares idées neuves sont vendor-bound ou déjà couvertes ; plusieurs skills sont de qualité d'authoring dégradée (glyphes corrompus, double frontmatter).

---

## 6. Sous-axes où la cible garde l'avantage (honnêteté)

- **Détection de trous de couverture de test** (`testgen-test-gaps`) : axe « qu'est-ce qu'il reste à tester ? » réellement absent de `testing-principles`. Valeur réelle **si** un jour tu veux un déclencheur post-feature — mais la brique propre serait un prompt maison, pas le CLI ruflo.
- **Orchestration à l'échelle** (swarm, agentdb, RAG memory, worktree isolation, monitoring) : industrialisation d'orchestration très au-delà de ce qu'un pack de prompts fait. Concurrent de l'**outil Workflow**, pas de tes skills — et tu as déjà Workflow.
- **Lens a11y/i18n en review** : dimensions que `deep-review` n'énumère pas. Marginal pour ton stack.
- **Astuce cache-aware self-scheduling** : réelle finesse op, mais déjà réalisable avec `/loop` + `ScheduleWakeup` natifs.

---

## 7. Backlog exécutable (checklist)

```
(vide — rien à porter)
[ ] Aucune action marketplace. Verdict : ne pas intégrer claude-flow (hors-catégorie : plateforme
    d'orchestration, pas un pack de skills — concurrent de l'outil Workflow que tu utilises déjà).
[ ] Si un jour tu veux un déclencheur « détection de gaps de test » : l'écrire en prompt maison
    dans craft/testing, PAS via le CLI/MCP ruflo.
```

**Rappel garde-fou :** 3ᵉ « skip légitime » de la salve, et le plus tranché — la cible n'est même pas
comparable (plateforme vs pack de prompts). Sous anti-sur-ingénierie, ne pas se laisser impressionner
par la taille (1336 unités, 118 MB) : la surface énorme est de l'infra d'orchestration vendor-bound,
et l'unique axe réellement absent (détection de gaps de test) ne se cherry-pick pas — il se réécrit.
