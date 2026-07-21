# État des lieux — marketplace Fabien vs `eyaltoledano/claude-task-master`

**Verdict (answer-first).** **Skip intégral : 0 keep, 0 port, 9/9 skip.** claude-task-master n'est
pas un pack de skills-prompt — c'est un **outil CLI + serveur MCP** ; ses commandes Claude sont des
**wrappers minces** qui shellent `task-master <cmd>` (`parse-prd.md:12` : `task-master parse-prd
--input=$ARGUMENTS`), **34 des 46** commandes référencent le binaire externe. L'intelligence vit
dans le CLI/MCP, pas dans le markdown — **il n'y a donc aucune technique de prompt à greffer.** Pire :
son comportement par défaut (auto-générer 10-15 tâches, **ajouter** des tâches de test + de doc sans
gate humain) **amplifie** tes frictions #1 (scope creep) et #3 (détour au lieu de réponse), au lieu
d'en fermer une. La chaîne d'intake→décomposition est déjà couverte, **avec gates humains**, par
`goal:draft-issue` + `goal:run-issue` + `spec-first-dev`.

> **Confiance :** ✅ = re-greppé fichier-en-main pendant CET audit · Fan-out : **42 agents, 0 erreur, ~2,0 M tokens** ; forces cibles ✅ CONFIRMED (pass 2), aucune ne ferme de friction.

---

## Méthode & sources

- **Tier `deep`** (Workflow 2 passes) sur les **9 commandes du plugin Claude Code** : `parse-prd`, `parse-prd-with-research`, `analyze-complexity`, `expand-task`, `expand-all-tasks`, `next-task`, `add-task`, `complexity-report`, `analyze-project`.
- **Couverture :** `full=2` (parse-prd, expand-task), `partial=5`, `none=2`.
- **Phase 2b** (✅) : `parse-prd.md:12` wrapper CLI ; `:24-27` auto 10-15 tâches + padding test/doc ; 34/46 commandes = wrappers `task-master`.

---

## 1. Points forts validés — à PRÉSERVER

| # | Force marketplace | Où | Face à task-master |
|---|---|---|---|
| 1 | Intake PRD/BMAD **first-class**, sans dépendance CLI | `goal/commands/draft-issue.md` L15 « (idea / Jira US / PRD / BMAD story / brainstorm) » | `parse-prd` fait le même intake mais **délègue au binaire** `task-master`. ✅ |
| 2 | Décomposition **gatée-humain** avant gel | `goal/commands/run-issue.md` L218 « Show the plan. Ask … before I lock it? » ; `spec-first-dev.md` L81 « **GATE**: Ask "Is this understanding correct?" » | `parse-prd` = fire-and-forget CLI, zéro checkpoint. ✅ |
| 3 | **Simplicity check** anti-padding spéculatif | `spec-first-dev.md` L152 « No future-proofing — solve today's requirement, not a hypothetical one. » | `parse-prd` **ajoute** par défaut des tâches test + doc (`:26-27`) — scope creep by design. ✅ |
| 4 | Recherche **découplée** de l'implémentation (anti-biais) | `common/commands/research.md` L12 « The research agent should NOT know what you plan to build — this prevents confirmation bias. » | `parse-prd-with-research` injecte Perplexity **dans** la génération de tâches, sans garde de biais. ✅ |

---

## 2. Manquements réels — BACKLOG

**Aucun.** Les 9 commandes sont `skip`, toutes les forces cibles sont `friction=NONE`. Les 3 idées
qui « dépassent » un peu le marketplace sont soit déjà captées ailleurs, soit non portables :

- **Recherche live injectée dans la planification** (`parse-prd-with-research.md:7`, Perplexity) : seul axe réellement absent (ton `research.md` s'arrête aux findings ; `spec-first` ne fait pas de web). Mais **tool-bound** (Perplexity) + injecté **sans gate** dans une auto-décomposition → non portable proprement. Non retenu.
- **Matrice Risque × Complexité** (`complexity-report.md:51`) : cadrage de priorisation sympathique, mais adossé au JSON du CLId et redondant avec le **tier d'impact** déjà porté depuis l'audit AIDD (P2-b) et le **consolidation brake** de BMAD. Redondant.
- **« Avoid over-decomposition »** (`expand-all-tasks.md:36`) : exactement le **frein anti-sur-découpage déjà porté depuis BMAD** (P2). Doublon.
- **Inférence de dépendances entre tâches** (`add-task.md:33`, DAG) : `goal` est **linéaire par choix** (divergence assumée, identique au verdict `to-tickets` de l'audit mattpocock). Ne pas porter.

---

## 3. Motifs README / doc à corriger

**Aucun côté marketplace.** task-master n'est ni vendored ni référencé dans `plugins/`. **Structure (Phase 4) — RAS.**

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

- **Modèle DAG de tâches** (dépendances inférées, `add-task`, `expand`) : `goal` est linéaire séquentiel par conviction. Choix, pas trou.
- **Auto-génération non gatée** (10-15 tâches, padding test/doc) : opposé à tes gates humains + simplicity check. Ne jamais aligner.
- **Dépendance à un CLI/MCP externe** : ta philosophie est skills-prompt autonomes, source-agnostiques. Choix.
- **Features « interactives » aspirationnelles** (`complexity-report.md:75` : « Press 'e'/'d'/'r' ») qu'un markdown statique ne peut pas livrer — sur-promesse à ne pas imiter.

---

## 5. Verdict cherry-pick

- **0 keep, 0 port, 9 skip.** Rien à greffer : l'intelligence est dans le binaire externe, pas dans les prompts ; les défauts amplifient tes frictions ; les rares idées neuves sont tool-bound ou déjà captées (impact tier AIDD, consolidation brake BMAD).

---

## 6. Sous-axes où la cible garde l'avantage (honnêteté)

- **Recherche live → planification** : injecter les best-practices courantes dans la génération de tâches est un axe que tu n'as pas (ton `research.md` s'arrête aux findings). Mais l'implémentation cible est tool-bound + gate-less. Si un jour tu veux ce pont, la brique propre serait « un findings de `research.md` → nourrit un `spec-first` **gaté** », pas le wrapper Perplexity.
- **Persistance d'un graphe de tâches** avec état/dépendances/complexité : vrai système de suivi (fichiers `tasks.json` + MCP). `goal` persiste un plan sur branche, pas un graphe requêtable. Divergence de topologie assumée, pas un manque.
- **Industrialisation produit** (CLI installable, MCP, providers multiples) : réelle, mais orthogonale à un usage skills-prompt mono-Claude.

---

## 7. Backlog exécutable (checklist)

```
(vide — rien à porter)
[ ] Aucune action marketplace. Verdict : ne pas intégrer claude-task-master.
[ ] Les 2 idées adjacentes (frein anti-sur-découpage, tier d'impact/priorisation) sont DÉJÀ
    dans le backlog via les audits BMAD (P2) et AIDD (P2-b) — ne pas re-porter.
```

**Rappel garde-fou :** 2ᵉ « skip légitime » de la salve après SuperClaude, pour une raison différente —
ici la cible est un **outil CLI/MCP**, pas un pack de prompts : sa valeur ne vit pas dans des fichiers
que tu pourrais cherry-picker. Sous anti-sur-ingénierie, « laisser » est la seule réponse ; et si le
besoin « suivi de tâches » émergeait vraiment, ce serait un **choix produit** (installer l'outil), pas
une greffe de skill.
