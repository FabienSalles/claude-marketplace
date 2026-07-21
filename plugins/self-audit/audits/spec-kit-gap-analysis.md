# État des lieux — marketplace Fabien vs `github/spec-kit` (Specify)

**Verdict (answer-first).** spec-kit est le **Spec-Driven Development « officiel » GitHub/Microsoft** :
un spine `specify → plan → tasks → implement` piloté par templates + gates, très soudé à sa
propre machinerie (`.specify/extensions.yml`, tokens `__SPECKIT_*__`, hooks de création de branche).
**0 keep, 4 port-technique, 5 skip.** Le spine lui-même est couvert (souvent mieux, car gaté-humain
et TDD-first chez toi) ou en conflit (hooks git non sanctionnés). **Mais c'est l'audit au plus fort
rendement jusqu'ici sur tes DEUX frictions prioritaires** : spec-kit apporte un **cluster de gardes
anti-sur-ingénierie bon marché** (friction #1) + une **discipline answer-first** (friction #3) que
ta phase de spec/plan n'a pas verbalisées.

> **Confiance :** ✅ = re-greppé fichier-en-main pendant CET audit · 🔎 = fan-out non re-greppé.
> Fan-out : **57 agents, 0 erreur, ~2,8 M tokens** ; forces cibles retenues toutes ✅ CONFIRMED (pass 2) ET re-greppées main-loop.

---

## Méthode & sources

- **Tier `deep`** (Workflow 2 passes) sur les **9 unités du spine** : `specify`, `plan`, `tasks`, `implement`, `analyze`, `clarify`, `constitution`, `taskstoissues`, + le manifeste `spec-driven.md`.
- **Phase 2b** : re-grep des 5 citations porteuses + absence marketplace (cap de clarification=0, Complexity-Tracking=0, orphan-task=0, simplicity-gate=0). ✅
- **Contradiction interne relevée** (honnêteté cible) : `specify.md:123` « Make informed guesses » vs `spec-driven.md:187` « **Don't guess**: If the prompt doesn't specify something, mark it ». La commande opérationnelle penche pour le guess borné ; le manifeste dit l'inverse. **Ça compte pour toi** (cf. P1 ci-dessous et ta règle « ask rather than guess »).

---

## 1. Points forts validés — à PRÉSERVER

| # | Force marketplace | Où | Face à spec-kit |
|---|---|---|---|
| 1 | Git intouché en phase spec (jamais de branche/push) | `goal/commands/draft-issue.md` L188 « **Do not push code or create branches** » | `specify` mkdir des dossiers numérotés + crée des branches via hooks `before_specify` — franchit ta ligne friction #2. ✅ |
| 2 | Spec → implémentation **gatée-humain + TDD visible** | `common/commands/spec-first-dev.md` L236 « Never write production code in Phase 4 before a failing test », L164 « the user SEES it go red, then green » | `implement` s'arrête à une checklist **auto-notée**, n'implémente jamais avec RED→GREEN. ✅ |
| 3 | Gate de validation **humaine** avant d'avancer | `spec-first-dev.md` L83 « **DO NOT move to Phase 2 without validation.** » | `specify` s'auto-valide contre sa propre checklist, sans confirmation humaine. ✅ |

---

## 2. Manquements réels — BACKLOG

### P1-a — Table « Complexity Tracking » (donner les dents à « One approach, not three ») ✅
- **Manque :** `crispi-planning` dit L46 « Decide the approach. One approach, not three alternatives. » mais **rien ne force à justifier** une complexité acceptée en nommant l'alternative simple rejetée. C'est ta friction #1.
- **Preuve cible (✅) :** `templates/plan-template.md:110` « | Violation | Why Needed | Simpler Alternative Rejected Because | » (rempli **uniquement** quand une déviation doit être justifiée).
- **Preuve du trou :** grep `simpler alternative`/`complexity tracking` dans `crispi-planning` = **0**. ✅
- **Cible :** `common/skills/crispi-planning/SKILL.md` Phase 3 — ajouter la table (3 colonnes), remplie seulement si une complexité est retenue. Donne un mécanisme à la règle « une approche ».
- **Acceptance :** toute complexité/abstraction acceptée nomme l'alternative plus simple et pourquoi elle est rejetée.

### P1-b — Gate « Simplicité / Anti-Abstraction » dans `spec-first-dev` ✅
- **Manque :** la phase 3 de `spec-first-dev` n'a **pas de checklist de simplicité** (YAGNI, framework en direct, pas de couche d'abstraction gratuite). Friction #1.
- **Preuve cible (✅) :** `spec-driven.md:218-221` « #### Anti-Abstraction Gate … - [ ] Using framework directly? - [ ] Single model representation? ».
- **Preuve du trou :** grep `anti-abstraction`/`simplicity gate`/`future-proof` dans `spec-first-dev` = **0**. ✅
- **Cible :** `common/commands/spec-first-dev.md`, gate de Phase 3 — checklist légère : « pas de future-proofing, framework utilisé directement, représentation de modèle unique, justifier toute couche d'abstraction ajoutée ». **Ne PAS** porter les articles « library-first »/« CLI-mandate » de la constitution spec-kit (dogmatiques, hors ton contexte).
- **Acceptance :** un passage de gate liste explicitement les checks de simplicité ; une abstraction ajoutée doit être justifiée.

### P2-a — Flag de couverture bidirectionnelle requête↔tâche (orphelins = scope creep) ✅
- **Manque :** `goal:next` réconcilie le plan avec le code changé mais **ne flague pas** les tâches sans exigence rattachée (= travail non demandé, scope creep) ni les exigences sans tâche (= couverture manquante). Friction #1.
- **Preuve cible (✅) :** `templates/commands/analyze.md:143` « - Tasks with no mapped requirement/story » ; + L125 « Flag vague adjectives (fast, scalable, secure, intuitive, robust) lacking measurable criteria » ; + L202 « Ask the user … (Do NOT apply them automatically.) » (consentement, amplifie ta préférence).
- **Preuve du trou :** grep `orphan`/`no mapped requirement`/`coverage map` dans `goal:next` = **0**. ✅
- **Cible :** `goal/commands/next.md` — un check de traçabilité : tâche sans exigence → signaler comme scope creep ; exigence sans tâche → couverture manquante. Recoupe le thème récurrent plan-alignment/scope-creep (déjà P1 côté `deep-review`), ici côté **réconciliation de plan**.
- **Acceptance :** une itération qui a produit du travail non tracé à une exigence est signalée.

### P2-b — Discipline answer-first « clarifications bornées » dans `spec-first-dev` ✅ *(reframe — conflit partiel)*
- **Manque :** la Phase 1 de `spec-first-dev` pose ~12 questions et **attend**, sans borne ni priorisation. spec-kit borne l'interrogatoire.
- **Preuve cible (✅) :** `specify.md:128` « **LIMIT: Maximum 3 [NEEDS CLARIFICATION] markers total** » + L129 « Prioritize clarifications by impact: scope > security/privacy > user experience > technical details ».
- **⚠️ Conflit à gérer :** spec-kit résout ça par « **make informed guesses** » (`specify.md:123`), ce qui **contredit ta règle dure** « ask ONE focused question rather than guess » (et le manifeste spec-kit lui-même, `spec-driven.md:187` « Don't guess »). **Donc porter uniquement** la partie non-conflictuelle : le **cap + la priorisation (scope > sécu > UX > technique) + documenter le reste comme hypothèses explicites** — PAS le « guess librement ». La valeur est de **tuer l'interrogatoire de 12 questions**, pas d'inventer des réponses.
- **Cible :** `common/commands/spec-first-dev.md` Phase 1 — « priorise les questions par impact ; ne bloque que sur ce qui n'a pas de défaut raisonnable ET pas de réponse dans le codebase ; le reste devient une hypothèse écrite à valider ». P2 (reframe, pas P1, à cause du conflit).
- **Acceptance :** la Phase 1 hiérarchise/borne ses questions et écrit les hypothèses au lieu d'un interrogatoire non borné — sans jamais « deviner » en violation de la règle globale.

### P3 — Lint « adjectifs vagues » 🔎
- `analyze.md:125` (✅ ci-dessus) : signaler fast/scalable/secure/intuitive/robust sans critère mesurable. Fold optionnel dans le gate de spec, recoupe le lint de spec-impureté déjà noté dans l'audit AIDD. P3.

---

## 3. Motifs README / doc à corriger

**Aucun côté marketplace.** spec-kit n'est **pas vendored** et n'est référencé nulle part dans `plugins/` (pas de dérive de cross-référence). **Structure marketplace (Phase 4) — RAS** (confirmé cette session).

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

- **Machinerie Specify** (`.specify/extensions.yml`, presets, tokens `__SPECKIT_*__`, `init-options.json`, scaffolding de dossiers numérotés, hooks de branche) : exactement la surface d'outillage + git non sanctionné que tu évites. Ne pas importer.
- **`implement` sans TDD gaté-humain** : ta chaîne `feature-tdd-dev` (RED→GREEN visible) est plus forte. Ne pas aligner.
- **`constitution` articles dogmatiques** (library-first, CLI-mandate) : hors ton contexte ; seule la partie **simplicity gate** est retenue (P1-b).
- **`clarify` comme Q&A structuré** : `grill-me` (une question à la fois, ancré codebase) couvre l'axe plus finement. Skip.
- **« Make informed guesses »** (`specify.md:123`) : en **conflit** avec ta règle « ask rather than guess ». À NE PAS porter (cf. reframe P2-b).

---

## 5. Verdict cherry-pick

- **0 keep** — spine couvert/en-conflit, machinerie soudée rejetée.
- **4 port-technique** : Complexity-Tracking table (P1-a), Simplicity gate (P1-b), flag orphan-task/couverture (P2-a), clarifications bornées reframe (P2-b). + 1 P3 (lint adjectifs vagues).
- **5 skip** : `tasks` (couvert goal), `implement` (couvert feature-tdd, plus faible chez la cible), `clarify` (couvert grill-me), `constitution` (couvert install-global-claude-md ; sauf simplicity gate → P1-b), `taskstoissues` (couvert goal:draft-issue).

---

## 6. Sous-axes où la cible garde l'avantage (honnêteté)

- **Gates anti-abstraction formalisés** (Phase -1 Simplicity/Anti-Abstraction) : spec-kit a industrialisé la garde YAGNI dans son process ; toi tu la portes surtout en CLAUDE.md. → devenu P1-b.
- **Traçabilité requête↔tâche bidirectionnelle** avec détection d'orphelins : plus systématique que la réconciliation de `goal:next`. → P2-a.
- **Critères de succès mesurables + agnostiques-techno** enseignés par exemples good/bad (`specify.md:336`) : plus pédagogique que « command-line verifiable ». Fold optionnel.
- **Neutralité multi-agents** (Copilot/Cursor/Codex/Claude via presets) : industrialisation cross-outil, non pertinente pour ton usage mono-Claude.

---

## 7. Backlog exécutable (checklist)

```
[ ] P1-a  crispi-planning Phase 3 : table Complexity Tracking (Violation | Why | Simpler-Alt-Rejected)  [friction #1]
[ ] P1-b  spec-first-dev Phase 3 gate : checklist Simplicité / Anti-Abstraction (sans articles dogmatiques)  [friction #1]
[ ] P2-a  goal/next : flag orphan-task (scope creep) + exigence-sans-tâche (couverture manquante)  [friction #1]
[ ] P2-b  spec-first-dev Phase 1 : clarifications bornées + priorisées + hypothèses écrites — SANS « guess » (conflit règle globale)  [friction #3]
[ ] P3    lint « adjectifs vagues sans critère mesurable » (fold optionnel)
```

**Ordre recommandé :** P1-a + P1-b (cheap, friction #1, phase spec/plan) → P2-a (traçabilité scope-creep, recoupe le thème deep-review) → P2-b (reframe answer-first, attention au conflit guess) → P3.

**Rappel garde-fou :** la machinerie Specify et « make informed guesses » sont à laisser (§4). La leçon transversale : spec-kit est faible à **copier** (trop soudé, git-invasif) mais riche à **piller** — ses **gates de simplicité** sont le meilleur apport, car ils industrialisent exactement ta friction #1 dans la phase où elle fait le plus mal (la conception).
