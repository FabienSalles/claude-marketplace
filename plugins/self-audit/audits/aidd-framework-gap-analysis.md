# État des lieux — marketplace Fabien vs `ai-driven-dev/framework` (AIDD)

**Verdict (answer-first).** AIDD est un **SDLC industriel complet et concurrent** (7 plugins,
40 skills-routeurs, agnostique multi-outils, CI/release-please/skill-eval) qui **ré-implémente
la même colonne vertébrale** que ta stack `goal` + `craft` + `common` + `deep-review`. **Rien à
installer en bloc, 0 keep.** Sur tes axes de friction, ton marketplace est **égal ou plus sûr**
(git hook-enforced vs auto-commit AIDD ; staging manuel vs auto-ship sans gate ; spec mutable
« update-first » vs « immutable contract » plus fragile). Mais AIDD est **mieux industrialisé sur
un point décisif** : sa revue `05-review` ferme, avec une implémentation de référence propre, le
**trou plan-alignment/scope-creep de `deep-review`** — déjà signalé par DEUX audits précédents
(superpowers P2-a, mattpocock). **Troisième confirmation indépendante = P1 sans hésitation.**
Bilan : **2 P1, 3 P2, 3 P3, 0 skill adopté entier.**

> **Convention de confiance :**
> - ✅ **vérifié** = citation re-greppée fichier-en-main pendant CETTE analyse (texte exact, ligne ±2).
> - 🔎 **à reconfirmer** = relevé par le fan-out mais pas re-greppé par le main-loop.

---

## Méthode & sources

- **Tier `standard`** : fan-out **outil Agent** (10 agents, 1 par cluster de skills à fort recouvrement, ~700 k tokens), chacun lisant le répertoire cible ENTIER (SKILL.md router + `actions/` + `references/` + `assets/`) et les équivalents marketplace, posture adversariale anti home-team, rapport structuré + citations verbatim.
- **Phase 2b (main-loop)** : re-grep indépendant de TOUTES les citations porteuses **et** de l'absence côté marketplace. Confirmés à 0 : audit-codebase-entier dans `deep-review`, tier d'impact dans `run-issue`, triage de sévérité dans `grill-adversarial`. Toutes les forces cibles retenues sont ✅.
- **Périmètre** : AIDD ships 7 plugins / 40 skills. Clusters comparés à fond : `aidd-dev` (05-review, 04-audit, 03-assert+09-for-sure, 08-debug, 00-sdlc+01-plan+02-implement), `aidd-refine` (01-brainstorm+02-challenge+04-shadow-areas, 03-condense+05-fact-check), `aidd-pm` (02-user-stories+03-prd+04-spec), `aidd-vcs` (01-commit+02-pull-request), `aidd-context` (02-project-memory+10-learn+11-explore+04-skill-generate). **Triage direct (skip)** : `aidd-ui` (ALPHA, smoke-test seul), `aidd-orchestrator/00-async-dev` (automation PR async, hors scope solo), et les meta-générateurs `aidd-context/03-08` (redondants avec `skill-creator`/`plugin-dev` externes), `00-onboard`/`01-bootstrap`/`09-mermaid`/`12-cook` (orthogonaux).
- **Nature des skills** : routeurs courts (20-40 L) délégant à des fichiers `actions/references/assets` — le vrai contenu (rubriques, templates, validators YAML) est dans les supporting files, lus intégralement.

---

## 1. Points forts validés — à PRÉSERVER

| # | Force marketplace | Où | Face à AIDD |
|---|---|---|---|
| 1 | Git **hook-enforced** + staging manuel par défaut | `common/hooks/{block-claude-coauthor,git-add-empty}.sh` ; `goal/commands/next.md` L77 | `01-commit` push optionnel, mode `auto` commit sans consentement (`00-sdlc/SKILL.md:27` « decide alone and never ask ») ; auto-commit par phase (`02-implement/SKILL.md:25`). ✅ |
| 2 | Spec **mutable** « update-first » | `common/commands/spec-first-dev.md` L153 | `04-spec` « immutable contract » — plus fragile ; done-when « observable behavior, not a command » (`phase-template.md:43`), plus faible que les critères ligne-de-commande. ✅ |
| 3 | Debugging : Iron-Law reproduce-avant-hypothèse | `superpowers/skills/systematic-debugging/SKILL.md` | `02-debug` énumère des hypothèses scorées 1-10 **sans reproduction** (`02-debug.md:20`) — exactement le mode d'échec que le marketplace bloque. ✅ |
| 4 | Topologie contexte frais/itération + `/clear` | `goal/commands/next.md` | `00-sdlc` délègue tout en auto ; pas de RED-GREEN test-first (`02-execute.md:17` vs `feature-tdd-dev.md:136`). ✅ |
| 5 | Grill adversarial : états/invariants/matrice hostile | `goal/skills/grill-adversarial/SKILL.md` | `01-brainstorm` = interview plus générique, pas de machine à états. ✅ |

---

## 2. Manquements réels — BACKLOG

### P1-a — Axe plan-alignment + scope-creep + verdict-gate dans `deep-review` ✅ **(3ᵉ confirmation indépendante)**
- **Manque :** `deep-review` est producteur-side (bug/sécu/perf sur le diff seul). Il n'ingère jamais de plan → aveugle à (a) une exigence omise en silence et (b) du comportement livré non demandé (= sur-ingénierie, **friction #1**). Superpowers P2-a et l'audit mattpocock l'avaient déjà pointé ; AIDD en fournit **l'implémentation de référence la plus propre**.
- **Preuve cible (✅ toutes re-greppées) :** `05-review/actions/02-review-functional.md`
  - L15 « Take the plan from the arguments; if absent, ask for the acceptance criteria, and mark … "Not run" when none are available » (jamais inventer).
  - L16 « For every acceptance criterion, check the box `[x]` only when the diff shows evidence, citing the `file:line`; leave it `[ ]` when unmet … naming the gap ».
  - L17 « any unplanned change in the diff that traces to no criterion » (= détecteur de scope-creep).
  - Verdict-gate `references/review-rubric.md` L15/L19 « An unchecked criterion tagged `fix` … cannot yield `approve` ».
- **Preuve du trou :** grep `whole codebase`/plan-alignment absent ; `deep-review` n'ingère aucun plan. ✅
- **Cible :** `common/commands/deep-review.md` — insérer une **pré-passe plan-alignment** entre « Identify Changes » et le Builder : ingérer plan/critères (ou « Not run », jamais inventer) → tracer chaque critère en `[x]/[ ]` avec `file:line` → lister les hunks sans critère comme scope-creep → **gate** : un critère `fix` non coché bloque `approve`. **Garder** le moteur 3-agents + le cap ~2-5 + la suppression explicite des nitpicks de `deep-review` (`deep-review.md:47`). **Ne PAS** porter l'axe `review-code` naming/style d'AIDD (collision avec la low-noise deliberée + anti-over-engineering).
- **Pourquoi P1 :** ferme friction #1 (scope-creep) + #3 (réponses fondées) ; **trois audits convergent sur le même fichier**. Cet item **fusionne et remplace** mattpocock-P1-a et superpowers-P2-a.
- **Acceptance :** avec un plan fourni, une exigence omise ET un ajout non demandé sont signalés ligne-à-ligne, et un critère `fix` non satisfait empêche l'`approve`.

### P1-b — « Condition de succès runnable gelée » dans `verification-before-completion` ✅
- **Manque :** `verification-before-completion` dit « run *some* verification » ; il ne force pas à **nommer d'avance** LA commande exit-0 et à la **re-lancer soi-même** au moment de conclure. Amplifie ta force « gate = tests verts » + « evidence before claiming ».
- **Preuve cible (✅) :** `03-assert/actions/01-assert.md:5` **et** `09-for-sure/actions/01-init-tracking.md:22` — « It must be a runnable command. `npm test exits 0` is valid; "the code is clean" is invalid and is pushed back to `eslint . exits 0` » ; `04-audit`… non — `03-assert:4` « could I execute this with zero ambiguity? … "Make the code better" is rejected ».
- **Cible :** `superpowers/skills/verification-before-completion/SKILL.md` — ajouter une clause : « nomme d'abord UNE commande qui exit-0 quand c'est fini ; refuse les buts invérifiables et reformule-les en commande ; au moment de déclarer terminé, **re-lance cette commande exacte** et lis le code de sortie — le "succès" d'un sous-agent ne suffit jamais ».
- **Effort :** ~3 lignes. **NE PAS** porter la boucle autonome `09-for-sure` (never-stop, auto-accept, sans cap → viole git/consentement + non bornée). **Acceptance :** la règle exige une commande exit-0 pré-engagée, re-jouée par le main-loop avant toute assertion de complétion.

### P2-a — Couche de triage sévérité sur `grill-adversarial` ✅
- **Manque :** `grill-adversarial` est **tout-ou-rien** : « **Nothing is frozen** until every cell is resolved » (L88), « cell is a functional hole » (L63) — aucun triage. grep sévérité = **0**. ✅
- **Preuve cible (✅) :** `04-shadow-areas/references/severity-rubric.md:58` « will the gap stop that phase entirely? If yes, assign `blocker` » ; L62 « Do not assign `blocker` for gaps that are discoverable and fixable within the current phase » ; set verrouillé `["blocker","major","minor"]` (`locked-sets.json:11`).
- **Cible :** `goal/skills/grill-adversarial/SKILL.md` — greffer la cascade blocker/major/minor : « ces 2 cellules bloquent le gel, ces 5 sont major-à-traiter-en-itération, ces 3 mineures ». Ferme friction #1 (ne pas sur-ingénierer le plan en chassant les cellules mineures) + sert #3.
- **Effort :** faible-moyen. **Acceptance :** une cellule non résolue reçoit une sévérité ; seules les `blocker` gèlent le plan.

### P2-b — Tier d'impact/blast-radius sur les itérations `goal` ✅
- **Manque :** `goal` ordonne par dépendance/slicing, **jamais par rayon d'impact**. grep `blast radius`/`critic` dans `run-issue` = **0**. ✅
- **Preuve cible (✅) :** `aidd-pm/skills/02-user-stories/references/rating.md:47` « **critic**: it touches a critical path (auth, payments, data integrity) or risks data loss or downtime. It needs explicit review before build. » (+ L45-46 minor/major).
- **Cible :** template de plan `goal/commands/run-issue.md` — un tag `Impact: minor|major|critic` par `### Iteration`, règle « une itération `critic` force un checkpoint de review explicite avant build ». ~3 lignes. Ferme friction #1.
- **Acceptance :** chaque itération porte un tier ; une `critic` déclenche un point de contrôle avant implémentation.

### P2-c — Audit codebase-entier read-only multi-piliers (NOUVELLE commande fine) ✅ *(gated sur besoin réel)*
- **Manque réel :** `deep-review` est **diff-scoped** ; aucun audit santé du **codebase entier**. grep = **0**. ✅ Seule vraie capacité absente.
- **Preuve cible (✅) :** `04-audit/SKILL.md:16-22` = 7 piliers (`code-quality`, `architecture`, `security`, `dependencies`, `performance`, `tests`, `ui`) ; rubrique `audit-template.md:23-27` 🔴/🟡/🟢 + effort `S/M/L` ; table Findings `Sev|Category|Location|Issue|Fix|Effort` chaque ligne un `file:line` (L30-34).
- **Cible :** **UNE** commande fine (p.ex. `common/commands/audit-codebase.md`), **pas** l'arbre 7-fichiers : porter la rubrique de sévérité + la forme du rapport + la table de piliers **moins `security`** (déféré à `netresearch:security-audit` externe) + `code-quality`/`architecture`/`tests` **pointant vers `craft:*-principles`** (ne pas ré-encoder SOLID/DRY/DAMP) + les règles anti-hallucination (« never assert without evidence »).
- **Pourquoi P2 (pas P1) :** NOUVELLE surface. Sous anti-over-engineering, à faire **seulement si** tu veux réellement un health-check périodique. C'est du méta-tooling, pas une friction. **Acceptance :** une commande produit un rapport ranké multi-piliers sans dupliquer `deep-review` (diff) ni les principes `craft`.

### P3-a — Deux tournures debug dans `systematic-debugging` ✅
- **Preuve cible (✅) :** `08-debug/actions/03-reflect-issue.md:15` « List 5 to 7 fresh possible sources, distinct from those already invalidated » (élargit l'espace d'hypothèses à la ré-entrée — le marketplace n'a que « question architecture ») ; L17 « Remove the temporary logs once the root cause is found » ; `01-reproduce.md:19` « Commit the failing test, linking the issue id » (red-commit-avant-fix, amplifie root-cause+régression) ; L23 « Review for scope creep. When the diff drifted, split or revert ».
- **Cible :** `superpowers/skills/systematic-debugging/SKILL.md` — greffer le stuck-path « broaden-then-instrument-then-cleanup » en complément de l'escalade architecture, + durcir le failing-test en red-commit isolé. **Note :** le gate mattpocock « boucle rouge AVANT hypothèse » reste indépendant — AIDD ne le fournit pas (son `02-debug` EST le mode d'échec).

### P3-b — Cascade de vérification + marqueur `unverified` dans le template CLAUDE.md global ✅
- **Preuve cible (✅) :** `05-fact-check/references/verification-cascade.md` L9 (tier 1 memory/docs), L24 « A web lookup is a last resort, never an opener », L37 « `unverified`: no tier produced a source. The claim is kept and hedged, never asserted and never deleted ».
- **Cible :** `common/templates/global-claude-md.template`, sous « Verification Before Claiming » (L7) — ajouter l'**ordre** (memory/docs → codebase → web, web en dernier recours) et le marqueur `unverified`. Fold texte, near-zéro coût. Recoupe ta règle globale existante.

### P3-c — Boucle de capture d'apprentissage scorée/gatée (`10-learn`) 🔎 *(optionnel, skip-leaning)*
- Le seul morceau d'`aidd-context` avec du fit : le loop score 0-10 → reconcile(new/covered/supersedes) → gate « bar at 6 » → écrire seulement après décision (`10-learn/actions/02-assess.md`, `SKILL.md:33`). **À NE porter que découplé** d'`aidd_docs/`, pointé vers `doc:adr`/`CLAUDE.md`/`.claude/plans/`. Même ainsi P3 : peser si une étape de capture formelle vaut mieux qu'écrire un ADR à la main. `02-project-memory` = **skip** (instance-type de ta friction #1).

---

## 3. Motifs README / doc à corriger

**Aucun côté marketplace pour cette cible.** AIDD n'est **vendored nulle part** dans `plugins/` et n'est **référencé dans aucun doc** (grep = 0) — donc pas de dérive de cross-référence à corriger (contrairement à l'audit mattpocock où `plugins/pocock/README.md` avait dérivé).

**Observation qualité sur la CIBLE (honnêteté, non-actionnable pour toi) :** contradiction interne relevée par le fan-out — `00-sdlc/SKILL.md:31` « Never auto-branch » vs `02-implement/actions/01-prepare.md:16` crée automatiquement une branche.

**Structure marketplace (Phase 4) — RAS** (confirmé cette session) : tous les `plugins/*` enregistrés dans `marketplace.json`, aucune entrée morte, chaque plugin a son `plugin.json`, `security-audit` = source github externe volontaire.

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

- **Pas d'auto-commit / auto-ship** : AIDD commit par phase (`02-implement:25`) et ship sans gate humain (`05-ship.md:15-16`, mode auto `00-sdlc:27`). Ton défaut manuel (`next.md:77`) est un **choix**, plus sûr. Ne pas aligner.
- **Local-first opt-in** vs pipeline tracker-first d'AIDD (sync issues/PR). Choix.
- **Itérations linéaires `goal`** vs plan-phasé AIDD (équivalents fonctionnels ; ta topologie contexte-frais est ≥). Ne pas remplacer.
- **Spec mutable « update-first »** vs `immutable contract`. Ton modèle est le plus fort — ne PAS adopter l'immutabilité.
- **Pas de mode terse toggle** (`03-condense`) : surface stateful orthogonale, contre anti-over-engineering. Un one-liner de style dans CLAUDE.md suffirait si le bloat devenait un vrai pain.
- **Pas de couche PRD / formalisme INVEST** (`03-prd`, `02-user-stories`) : hors scope dev-centric solo.
- **VCS skills = skip net** : `01-commit`/`02-pull-request` sont un **passif** contre ta discipline git hook-enforced (ils poussent/PR ; toi tu es plus sûr). Confirmé, pas un trou.

---

## 5. Verdict cherry-pick

- **0 keep** (aucun skill entier) — tout le structurant est couvert ou opposé, et la cible est un framework industriel dont l'adoption en bloc contredirait tes défauts (git manuel, anti-surface).
- **8 port-technique** : plan-alignment `deep-review` (P1-a), condition-succès-runnable (P1-b), triage-sévérité grill (P2-a), tier d'impact (P2-b), audit-codebase (P2-c), tournures debug (P3-a), cascade-vérif globale (P3-b), capture scorée (P3-c optionnel).
- **Clusters skip** : SDLC spine (`00-sdlc/01-plan/02-implement`), VCS (net liability), `03-condense`/`05-fact-check` (comme skills), `aidd-pm` skills entiers, `02-project-memory`/`11-explore`/`04-skill-generate`, `aidd-ui`, `aidd-orchestrator`, meta-générateurs.

---

## 6. Sous-axes où la cible garde l'avantage (honnêteté)

- **Audit codebase-entier 7-piliers** : vraie capacité absente (→ P2-c). `deep-review` ne fait que le diff.
- **Discipline de rapport déterministe** : AIDD ferme la forme de ses rapports par des **validators YAML** (`review-validator.yml`, `spec-validator.yml` — ensemble de sections clos, seuils durs « contains_implementation_details »/« multiple_targets »). Tes rapports sont plus libres/prose. Reproductibilité supérieure côté AIDD.
- **Reviewed-SHA freshness gate** (`05-ship.md:16`, `git diff --name-only <reviewed-sha> HEAD`) : prouve que le diff shippé == le diff reviewé. Optionnel-futur pour une éventuelle policy PR automatisée dans `goal`.
- **Industrialisation** : release-please, CI, harness `skill-eval`, distribution agnostique (Cursor/Codex/Copilot/OpenCode). Tu es mono-outil (Claude) par choix — avantage AIDD non pertinent pour ton usage, mais réel.

---

## 7. Backlog exécutable (checklist)

```
[ ] P1-a  deep-review : pré-passe plan-alignment + scope-creep + verdict-gate   [3 audits convergent ; friction #1/#3]
          → fusionne/remplace mattpocock-P1-a et superpowers-P2-a
[ ] P1-b  verification-before-completion : condition de succès runnable gelée + re-run par le main-loop (~3 L)
[ ] P2-a  grill-adversarial : couche de triage blocker/major/minor
[ ] P2-b  goal/run-issue : tag Impact minor|major|critic par itération (~3 L)
[ ] P2-c  NOUVELLE commande audit-codebase 7-piliers (moins security) — SEULEMENT si health-check voulu
[ ] P3-a  systematic-debugging : broaden-then-instrument-cleanup + red-commit-avant-fix
[ ] P3-b  global-claude-md.template : ordre de cascade de vérif + marqueur `unverified`
[ ] P3-c  (optionnel) capture scorée/gatée découplée → doc:adr / CLAUDE.md / .claude/plans
```

**Ordre recommandé :** P1-b / P2-b (≤3 L, cheap) → P1-a (convergence, headline) → P2-a → P3-b (fold texte) → P3-a → P2-c (nouvelle surface, gated) → P3-c (peser).

**Rappel garde-fou :** tout item touchant au §4 (divergences assumées) remonte en question explicite avant implémentation. Sous anti-over-engineering, préférer « laisser » à « ajouter » — P2-c et P3-c sont explicitement conditionnels. La leçon transversale de cet audit : **ne PAS adopter le modèle AIDD (auto-git, tracker-first, immutabilité)** ; n'en extraire que les rubriques déterministes qui durcissent tes skills existants.
