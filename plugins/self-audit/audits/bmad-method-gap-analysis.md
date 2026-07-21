# État des lieux — marketplace Fabien vs `bmad-code-org/BMAD-METHOD`

**Verdict (answer-first).** BMAD est une **méthodologie agile-AI complète** (56 skills organisés
par phase : analysis → plan → solutioning → implementation, + skills de facilitation core) —
un framework d'équipe, pas un pack de discipline. **0 keep, 3 port-technique, 10 skip.** Son
recouvrement avec ta stack `goal`/`craft`/`deep-review` est **large mais peu profond** : chaque
skill BMAD ré-implémente un maillon que tu couvres déjà, souvent avec une **cérémonie agile lourde**
(scripts python memlog, couches de customisation TOML, composers HTML) qui va **contre ton anti-sur-ingénierie**.
Adopter un skill BMAD entier = explosion de surface. Mais **3 techniques crisp** valent la greffe,
et elles retombent **encore sur `deep-review`** (le point chaud récurrent de tous les audits) —
cette fois sous un angle **neuf** : discipline de preuve + sévérité au vrai call-site, pas le
plan-alignment déjà signalé 3 fois.

> **Confiance :** ✅ = citation re-greppée fichier-en-main pendant CET audit · 🔎 = relevé fan-out non re-greppé.
> Fan-out : **81 agents, 0 erreur, ~4,2 M tokens** ; toutes les forces cibles retenues sont ✅ CONFIRMED (pass 2 verbatim) ET re-greppées par le main-loop.

---

## Méthode & sources

- **Tier `deep`** (outil Workflow, 2 passes) sur les **13 skills du cœur SDLC** (les plus recouvrants), pas les 56 : `bmad-brainstorming`, `bmad-advanced-elicitation`, `bmad-review`, `bmad-code-review`, `bmad-prd`, `bmad-spec`, `bmad-architecture`, `bmad-create-epics-and-stories`, `bmad-dev-story`, `bmad-check-implementation-readiness`, `bmad-correct-course`, `bmad-retrospective`, `bmad-sprint-planning`.
- **Hors périmètre par nature** : les 43 autres skills (agents nommés PM/UX/architect, party-mode, forge-idea, prfaq, ux-*, generate-project-context, shims v6, etc.) — cérémonie d'équipe ou orthogonaux à un dev solo.
- **Phase 2b** : re-grep indépendant des 5 citations porteuses + de l'absence côté marketplace (deep-review verification-gap = 0 ; goal frein anti-sur-découpage = 0). ✅

---

## 1. Points forts validés — à PRÉSERVER

| # | Force marketplace | Où | Face à BMAD |
|---|---|---|---|
| 1 | Grill = trous → **règles métier + tests de séquence** | `goal/skills/grill-adversarial/SKILL.md` L72, L76 | `bmad-advanced-elicitation` : 71 méthodes de critique qui **réécrivent l'output**, jamais de test de régression. ✅ |
| 2 | Grill ancré au **codebase**, escalade humaine | `pocock/grill-me` L11 ; `grill-adversarial` L93 | BMAD raisonne sur le texte de conversation, ne grounde pas dans le repo. ✅ |
| 3 | `feature-tdd-dev` couvre **entièrement** le dev-story | `common/commands/feature-tdd-dev.md` | `bmad-dev-story` = coverage `full`, rien à ajouter. ✅ |
| 4 | Anti-sur-ingénierie (défaut « laisser ») | CLAUDE.md global | BMAD embarque python/TOML/HTML — surface lourde, contre ta préférence dure. ✅ |

---

## 2. Manquements réels — BACKLOG

### P1-a — Lentille « verification-gap » + discipline de preuve dans `deep-review` ✅
- **Manque :** `deep-review` gère les tests via un bucket « Missing coverage » d'une ligne ; il ne **trace pas** le comportement changé jusqu'à sa frontière observable la plus proche pour juger « une régression serait-elle attrapée ? », et n'impose pas de **lire le test avant de statuer**. Amplifie ta force #2 (root-cause + test de régression) et ta règle « verify before claiming ».
- **Preuve cible (✅) :** `bmad-review/references/lens-verification-gap.md`
  - L3 « if the behavior this change is supposed to produce broke where it's actually used, would verification fail? »
  - L13 « Read a test before claiming what it covers, runs, asserts, or misses. »
- **Preuve du trou :** grep verification-gap/`read the test` dans `deep-review.md` = **0**. ✅
- **Cible :** `common/commands/deep-review.md`, catégorie « Tests » de l'Agent 2 — ~5 lignes de prose : la question-clé, l'étape « tracer jusqu'à la frontière observable la plus proche », la règle de preuve « lire le vrai test / chercher par symbole avant de dire couvert/manquant ». **Ne PAS** importer la machinerie `customize.toml`/`resolve_customization.py`.
- **Acceptance :** deep-review signale un comportement changé dont la régression ne serait pas attrapée, en citant le test lu (ou son absence prouvée par recherche de symbole).

### P1-b — Sévérité au **vrai call-site**, pas la pire lecture théorique, dans `deep-review` ✅
- **Manque :** `deep-review` note depuis le hunk du diff ; rien ne force à ouvrir la source autour du finding pour juger l'atteignabilité réelle. Résultat : faux positifs de sévérité théorique (bruit) — l'inverse de ta préférence « fix minimal, pas de sur-signalement ».
- **Preuve cible (✅) :** `bmad-code-review/steps/step-03-triage.md:26` « Read the code before rating … Do not rate from the diff hunk alone. Severity reflects the real consequence at a real call site, not the worst theoretical reading. » ; défère les pré-existants via `step-03-triage.md:37` « **defer** — Pre-existing issue not caused by the current change ».
- **Cible :** `common/commands/deep-review.md`, Agent 2 / Meta-Reviewer — 1-2 phrases : avant d'assigner une sévérité, lire les call-sites/gardes hors hunk et noter par conséquence réelle ; bucket `defer` pour les pré-existants.
- **Pourquoi P1 :** cheap, réduit directement le bruit de review (le Meta-Reviewer cape déjà à 2-5 ; ceci attaque la cause en amont). **NB :** distinct du trou plan-alignment (déjà P1 dans les audits mattpocock/AIDD) — ici c'est la **qualité de sévérité**, complémentaire. Les deux se posent dans le même fichier → à traiter en une passe `deep-review`.
- **Acceptance :** une sévérité n'est assignée qu'après lecture des call-sites hors diff ; un pré-existant est marqué `defer`, pas noté comme finding du changement.

### P2 — Frein anti-sur-découpage dans `goal` Phase 3 ✅
- **Manque :** `goal/run-issue` Phase 3 ne pousse qu'à **plus de slices** (« prefer small slices ») ; aucun contrepoids quand plusieurs itérations retoucheraient les **mêmes fichiers cœur** sans boucle de feedback entre elles. C'est ta friction #1 (sur-ingénierie par sur-fragmentation).
- **Preuve cible (✅) :** `bmad-create-epics-and-stories/steps/step-02-design-epics.md:59` « **Implementation Efficiency**: Consider consolidating epics that all modify the same core files into fewer epics ». Grep `consolidat` dans `run-issue.md` = **0**. ✅
- **Cible :** `goal/commands/run-issue.md` Phase 3 — une phrase de garde : « quand des itérations candidates retouchent en boucle les mêmes fichiers cœur sans feedback intermédiaire, les consolider en une itération à sous-étapes ordonnées plutôt que fragmenter ».
- **Acceptance :** une décomposition qui éclaterait le même fichier sur N itérations est consolidée.

### P3 — Ledger de couverture exigence→unité 🔎
- **Manque :** BMAD maintient une carte exigence→epic→story garantissant qu'aucune FR n'est perdue à la décomposition (`step-02-design-epics.md:169` « This ensures no FRs are missed. » ✅). `goal` mappe règles-métier→tests mais n'a pas de **ledger de complétude** sur les exigences de la source.
- **Cible :** optionnel — une case « couverture des exigences » dans le plan `goal`. P3 : peser vs le coût d'un registre formel pour un dev solo.

---

## 3. Motifs README / doc à corriger

**Aucun côté marketplace.** BMAD est listé dans `EXTERNAL_PLUGINS.md` (§3, « BMAD — à documenter, source externe non-marketplace ») mais **jamais vendored** dans `plugins/`, et aucun skill ne le référence → pas de dérive de cross-référence. *(Ta note « To document » dans `EXTERNAL_PLUGINS.md` reste valable : BMAD est bien installé sous `~/.claude/commands/bmad/` sans provenance marketplace tracée.)*

**Structure marketplace (Phase 4) — RAS** (confirmé cette session) : dossiers tous enregistrés, `plugin.json` présents, pas d'entrée morte.

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

- **Pas de moteur de brainstorming génératif** (`bmad-brainstorming`, modèle 3-postures Facilitator/Creative-Partner/Ideate-for-me, discipline divergent→convergent — ✅ CONFIRMED SKILL.md:12, converge.md:3) : ton marketplace est **critique/planification**, pas idéation. L'ajouter = surface contre l'anti-sur-ingénierie. Choix, pas trou.
- **Pas de catalogue de 71 méthodes d'élicitation** (`bmad-advanced-elicitation`) : `grill-me` + `grill-adversarial` couvrent l'axe critique avec des **tests de régression** ; le catalogue est de la largeur sans les dents. Assumé.
- **Pas de couche PRD / sprint / retrospective d'équipe** (`bmad-prd`, `bmad-sprint-planning`, `bmad-retrospective`) : BMAD est agile-team-shaped ; tu es solo. Assumé.
- **Runtime lourd** (python memlog, customisation TOML, composer HTML) : explicitement rejeté.

---

## 5. Verdict cherry-pick

- **0 keep** — aucun skill entier ; adoption = explosion de surface + cérémonie agile contre ta préférence.
- **3 port-technique** : verification-gap + preuve dans `deep-review` (P1-a), sévérité vrai-call-site (P1-b), frein anti-sur-découpage dans `goal` (P2). + 1 P3 optionnel (ledger de couverture).
- **10 skip** : brainstorming, advanced-elicitation, prd, spec (couvert spec-first), architecture (couvert craft:ddd), dev-story (**full**), check-implementation-readiness, correct-course (couvert goal:next), retrospective, sprint-planning.

---

## 6. Sous-axes où la cible garde l'avantage (honnêteté)

- **Largeur des lentilles de critique** : 71 méthodes nommées (Tree of Thoughts, Six Hats, First Principles, Pre-mortem, Red Team…) — plus large que la famille grill, mais hors scope.
- **Facilitation générative 3-postures** : vrai moteur d'idéation divergent→convergent, que le marketplace n'a pas (et ne veut pas, cf. §4).
- **Traçabilité des exigences** : carte FR→epic→story avec garantie de complétude — plus rigoureux que le mapping règles→tests de `goal` (→ P3).
- **Industrialisation méthodologique** : rôles d'agents nommés, party-mode multi-agents, sharding de docs — architecture d'équipe complète. Non pertinent solo, mais réel.

---

## 7. Backlog exécutable (checklist)

```
[ ] P1-a  deep-review : lentille verification-gap + « lire le test avant de statuer » (~5 L, Agent 2 Tests)
[ ] P1-b  deep-review : sévérité au vrai call-site + bucket `defer` pré-existants (1-2 phrases)
          → P1-a et P1-b se posent dans le MÊME fichier deep-review.md — une seule passe
[ ] P2    goal/run-issue Phase 3 : frein de consolidation anti-sur-découpage (1 phrase)
[ ] P3    (optionnel) ledger de couverture exigence→unité dans le plan goal
```

**Ordre recommandé :** P1-a + P1-b ensemble (même fichier `deep-review`, cheap, amplifient verify+root-cause) → P2 (1 phrase, ferme friction #1) → P3 (peser).

**Rappel garde-fou :** les §4 (brainstorming génératif, catalogue d'élicitation, cérémonie PRD/sprint/retro, runtime lourd) sont des divergences **assumées** — ne pas les prendre pour des trous. Sous anti-sur-ingénierie, préférer « laisser ». La leçon transversale : de BMAD, n'extraire que les **règles de discipline de review** (preuve, call-site réel) et **un frein de décomposition** — jamais sa cérémonie d'équipe ni son runtime.
