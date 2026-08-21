# Audit thématique — TDD, tests et vérification

> Vérifié contre `main` à jour le 2026-08-20 (section 6 réancrée).

**Périmètre.** Red-green-refactor, conventions de test, doubles/factories, debugging
systématique, root-cause, vérification avant de déclarer terminé, review de code.
**Date :** 2026-08-20. **Référentiel local :** `craft`, `phpunit`, `vitest`, `symfony`,
`superpowers` (fork), `common`, `goal`.
**Cibles relues sur clones frais** (pas de mémoire) : `obra/superpowers` @b36e082,
`bmad-code-org/BMAD-METHOD`, `github/spec-kit`, `buildermethods/agent-os`,
`mattpocock/skills`, `anthropics/skills`, `ai-driven-dev/framework`,
`FlorianBruniaux/claude-code-plugins`, `SuperClaude-Org/SuperClaude_Framework`,
`ruvnet/claude-flow`, `eyaltoledano/claude-task-master`.

> **Confiance :** ✅ = citation re-greppée fichier-en-main pendant CET audit ·
> 🔎 = relevé fan-out non re-vérifié par le main-loop.

---

## 1. Verdict (answer-first)

Sur **l'écriture du test** (quoi tester, où le tester, comment doubler) je suis nettement
au-dessus de tout le corpus : `craft:testing-principles` est le seul artefact des douze
repos qui traite le *choix du niveau*, l'interdiction de code de prod pour un test, et
l'anti-pattern « le double réimplémente la vraie logique ».
Sur **la preuve qu'un test protège vraiment quelque chose**, BMAD me bat à plat de couture :
la lentille `verification-gap` et la taxonomie « ce qui ne compte pas comme un test »
ferment des trous que je n'ai nulle part, et le *mutation check* d'obra non plus.
Les trois P1 sont donc tous du même côté : **auditer le test, pas seulement l'écrire**.

---

## 2. Ce que je fais MIEUX

| # | Force locale | Ancrage | Cible battue |
|---|---|---|---|
| 1 | **Choix du niveau où la règle métier se lit le mieux** — le test descend quand l'assertion haute devient du scraping ; « one owner per rule » ; l'orchestration est une intention en soi (assert ce qui transite vers le collaborateur doublé) | `plugins/craft/skills/testing-principles/SKILL.md` L227-252 | Personne. `obra/superpowers` s'arrête à « one behavior, clear name » (`skills/test-driven-development/SKILL.md` L200-205) ; spec-kit fixe des *catégories* de tests (`.specify/memory/constitution.md` L73-100) mais jamais le niveau d'une règle donnée. ✅ |
| 2 | **Interdiction de code de production au service du test** — six formes nommées (classe CSS, `js-*`, `id`, attribut, getter, méthode) + miroir : pas de classe « production-shaped » qui n'existe que pour les tests | `testing-principles` L167-187 ; déclinaison Symfony `plugins/symfony/skills/symfony-test-conventions/SKILL.md` L152-158 | `obra` ne bannit que **la méthode** (`test-driven-development/writing-good-tests.md` L123-127 « Production classes carry production methods only »). Le *locator* de test, mon cas le plus fréquent en Twig, n'y est pas. ✅ |
| 3 | **Le double ne réimplémente jamais le vrai corps** — avec le critère de réfutation : « si supprimer la vraie implémentation laisse l'assertion verte, le double a copié la logique » | `testing-principles` L133-166 | `obra/writing-good-tests.md` L81-98 dit « n'assert pas sur le mock » mais pas « le mock ne contient pas de logique » ; c'est précisément le piège Jest/`vi.mock` de module. ✅ |
| 4 | **Gate de DoD exécutée, jamais jugée par un modèle**, avec détection de fuite de scope (trace test Karpathy) | `plugins/goal/templates/done-criteria.template` L7-8, L22-32, L36-41, L57-70 | spec-kit fait tourner ses checklists en *lecture* et interdit à l'agent de cocher (`templates/commands/implement.md` L56-88) 🔎 — mais rien n'exécute. BMAD juge sur un diff relu (`bmad-build/step-03-implement.md` L40) ✅, pas sur des exit codes rejoués. |
| 5 | **Un test d'interface HTML assert du perceptible, pas du plumbing** — un dataset rendu = un test, `assertSelectorCount` acceptable seulement en invariant secondaire | `symfony-test-conventions` L92-150 ; `testing-principles` L188-226 | Aucune cible n'a d'équivalent framework-spécifique. Le plus proche, `bmad-qa-generate-e2e-tests/checklist.md` 🔎 (« semantic locators only »), est une ligne de checklist, pas une règle avec contre-exemple. |

---

## 3. Ce que je fais MOINS BIEN

### 3.1 Aucune lentille « verification-gap » côté test lui-même — BMAD ✅
`bmad-code-review/review-prompts/verification-gap.md` L53 pose la question falsifiable que
je ne pose nulle part : *un test compte seulement s'il tourne normalement ET qu'une assertion
observe la sortie/branche/contrat changés*. Puis il **énumère ce qui ne compte pas** :
« no execution ; source-text assertions ; success/no-throw/snapshot-only checks ; mock/log-call
checks ; tests that mock away the integration ; stale assertions or fixtures », avec l'exemple
`expect(x ?? DEFAULT).toBe(DEFAULT)` qui passe quand `x` manque.
**Pourquoi ça mord :** en PHPUnit, `$this->expectNotToPerformAssertions()` et les tests
« ça ne throw pas » sont la forme locale exacte ; en Vitest, `toBeDefined()` et les snapshots.
Grep local : zéro occurrence de `skip`, `no-throw`, `snapshot` dans `testing-principles` et
`vitest-test-conventions`. ✅

### 3.2 « Un test qui existe mais n'a pas tourné compte comme manquant » — BMAD ✅ + SuperClaude ✅
`bmad-build/step-03-implement.md` L47 : un test *unregistered, filtered out, skipped, disabled*
est traité comme absent, et « if a test disagrees with the matrix, **never edit the expectation
to match the code** : fix the code, or HALT ».
`SuperClaude_Framework/plugins/superclaude/core/RULES.md` L134 tape le même clou côté interdit —
« **Never Skip Tests** : never disable, comment out, or skip tests to achieve results » — avec
une heuristique de détection L145 (`grep -r "skip\|disable\|TODO" tests/`).
**Pourquoi ça mord :** `@group`/`--filter` PHPUnit et `it.skip`/`test.todo` Vitest sortent
silencieusement du gate `goal` (le gate lit un exit code 0, pas un compte de skips). Et
« ajuster l'attente au code » est exactement la sortie de secours que ma `verification-before-completion`
ne nomme pas.

### 3.3 Pas de *mutation check* — obra ✅
`obra_superpowers/skills/test-driven-development/writing-good-tests.md` L157-169 : avant de
finir, muter mentalement la prod (mauvaise constante, mauvaise branche, side-effect manquant,
retour vide, validation absente) ; **au moins un test doit tomber par mutation**. Plus la
« gate function » L67-79 : *nomme le changement de prod qui ferait échouer ce test, avant
d'écrire le corps* — et si tu ne peux pas le nommer, redessine.
**Pourquoi ça mord :** c'est le contrôle qui attrape mes deux anti-patterns déjà écrits
(tautologique, nom qui sur-promet) *par construction*, au lieu de les lister un par un.

### 3.4 Pas de discipline de réception de review — obra ✅
`obra_superpowers/skills/receiving-code-review/SKILL.md` L16-25 (READ / UNDERSTAND / VERIFY /
EVALUATE / RESPOND / IMPLEMENT), L88-98 (**check YAGNI sur la suggestion du reviewer** :
grep le codebase, si l'endpoint n'est appelé nulle part → proposer la suppression plutôt que
« l'implémenter proprement »), L113-121 (quand pousser en arrière).
**Pourquoi ça mord :** friction n°1 du profil d'usage = over-engineering / scope creep
(25 « wrong approach », 14 « excessive changes »). Un reviewer qui dit « implémente ça
proprement » est un *générateur* de scope creep, et rien chez moi n'arme le refus.
`common:deep-review` est côté producteur ; l'axe réception reste vide. (Le sous-morceau
« pas d'accord performatif » a bien été porté, cf. §6.)

### 3.5 Les *seams* ne sont jamais pré-agréés avant d'écrire les tests — Pocock ✅
`mattpocock_skills/skills/engineering/tdd/SKILL.md` L20-24 : un *seam* est la frontière
publique où l'on observe le comportement ; « **Test only at pre-agreed seams.** Before writing
any test, write down the seams under test and confirm them with the user. No test is written
at an unconfirmed seam. You can't test everything, so agreeing the seams up front is how
testing effort lands on the critical paths and complex logic instead of every edge case. »
**Pourquoi ça mord :** mon `craft:testing-principles` §14 sait choisir le *niveau* d'une règle
déjà décidée, et `tdd-workflow-principles` L38-52 sait juger si une interface est trop large —
mais rien n'oblige à **négocier la liste des frontières avant de commencer**. C'est le contrôle
amont exact contre la friction n°1 du profil (over-engineering) appliquée aux tests : le
sur-test par cas limite. Sur une US Symfony, c'est la différence entre « on teste la
spécification et l'endpoint » et « on teste aussi chaque getter du DTO ».

*(Deux passes de review BMAD manquent aussi — `deletion-check.md` L5 sur les blocs supprimés,
`claims-check.md` L3-5 sur l'ordre « tracer avant de lire la narration ». Elles pèsent moins
que les cinq ci-dessus ; elles sont en P2-b et P2-d.)*

---

## 4. Gaps actionnables

### P1-a — Taxonomie « ce qui ne compte pas comme un test » ✅
- **Source :** `.../bmad-code-org_BMAD-METHOD/src/bmm-skills/ship/bmad-code-review/review-prompts/verification-gap.md` L53-55.
- **Cible :** `plugins/craft/skills/testing-principles/SKILL.md`, en fin de §2 (juste après
  « anti-pattern — tautological assertion »).
- **Acceptance :** §2 liste, en une puce, les formes de fausse couverture — assertion sur le
  texte source, `no-throw` / snapshot seul, assertion sur un appel de mock ou de log, test qui
  mocke l'intégration même qu'il prétend couvrir, fixture périmée — et donne le contre-exemple
  `expect(x ?? DEFAULT).toBe(DEFAULT)`. Une ligne correspondante dans la Quick Reference.
- **Effort :** ~6 lignes, aucun nouveau skill, aucune collision de routing.

### P1-b — Le test qui ne tourne pas compte comme absent ✅
- **Source :** `.../bmad-code-org_BMAD-METHOD/src/bmm-skills/ship/bmad-build/step-03-implement.md` L47.
- **Cible :** `plugins/superpowers/skills/verification-before-completion/SKILL.md`, table
  « Common Failures » L43-51, + `plugins/goal/templates/done-criteria.template` §baseline.
- **Acceptance :** (1) une ligne de table « Test de non-régression en place | le test a *tourné*
  dans la sortie affichée | son existence dans le fichier » ; (2) l'interdit explicite
  « ne jamais aligner l'attente sur le code — corriger le code ou s'arrêter » ; (3) la
  done-criteria mentionne qu'un `skip`/`--filter` qui exclut le test du scope invalide le gate.
- **Effort :** ~5 lignes réparties sur 2 fichiers.

### P1-c — Skill `receiving-code-review` (axe réception + YAGNI sur la suggestion) ✅
- **Source :** `.../obra_superpowers/skills/receiving-code-review/SKILL.md` L16-25, L88-98, L113-121.
- **Cible :** nouveau skill `plugins/common/skills/receiving-code-review/`, ou section dans
  `plugins/common/commands/deep-review.md`. Recommandation : **un skill**, parce que le
  déclencheur (recevoir un retour) n'est pas celui de `deep-review` (produire une review),
  et qu'une section ne se chargerait jamais au bon moment.
- **Acceptance :** le skill impose (a) vérifier la suggestion contre le codebase avant de
  l'implémenter, (b) le grep YAGNI — si le code visé n'a aucun appelant, proposer la
  suppression et non l'implémentation « propre », (c) clarifier **tous** les points flous
  avant d'en implémenter un seul, (d) un item à la fois, testé. Ne pas reporter la partie
  « pas de remerciement » : déjà dans `plugins/common/templates/global-claude-md.template` L102-105. ✅
- **Pourquoi P1 :** ferme la friction n°1 (over-engineering) sur un vecteur non couvert.

### P2-a — Mutation check en fin de cycle 🔎→✅
- **Source :** `.../obra_superpowers/skills/test-driven-development/writing-good-tests.md` L157-169
  et la gate function L67-79. ✅
- **Cible :** `plugins/craft/skills/tdd-workflow-principles/SKILL.md`, dans la phase REFACTOR
  (après L103) ou dans la Quick Reference L178-184.
- **Acceptance :** la phase REFACTOR se termine par « mute mentalement : constante, branche,
  side-effect, retour vide, validation manquante — au moins un test doit tomber pour chaque
  mutation réaliste ; une mutation que rien n'attrape = comportement non protégé ».
- **Effort :** ~4 lignes. Ne pas importer la gate function entière (redondante avec §2 local).

### P2-b — Passe « suppression » dans `deep-review` ✅
- **Source :** `.../bmad-code-org_BMAD-METHOD/src/bmm-skills/ship/bmad-code-review/references/deletion-check.md` L5.
- **Cible :** `plugins/common/commands/deep-review.md`, Agent 2 (liste de catégories L47-51).
- **Acceptance :** une catégorie « Deletions » : pour chaque bloc supprimé/remplacé hors
  renommage, le comportement ou contrat qu'il portait est-il ré-établi, ou volontairement
  retiré ? Sinon → régression / référence orpheline / code mort.

### P2-c — `find-polluter.sh` : le fork local a un bug corrigé en amont ✅
- **Source :** `.../obra_superpowers/skills/systematic-debugging/find-polluter.sh` L21-31 vs
  `plugins/superpowers/skills/systematic-debugging/find-polluter.sh` L23-25.
- **Le bug :** local fait `find . -path "./$TEST_PATTERN"` ; `find -path` ne fait pas matcher
  `**/` contre zéro niveau de répertoire, donc un motif `src/**/*.test.ts` **rate**
  `src/top.test.ts`. Upstream ajoute la variante `**/` réduite, le strip du `./` initial, et
  le garde `TOTAL=0` quand la liste est vide.
- **Cible :** `plugins/superpowers/skills/systematic-debugging/find-polluter.sh`.
- **Acceptance :** merger le correctif amont **en gardant** l'override local `TEST_RUNNER`
  (L17), qui n'existe pas upstream et qui est nécessaire hors npm (`make php/tests`).
  Bumper le pin de version dans le SKILL.md.

### P2-d — Ordre d'information en review : tracer avant de lire la narration ✅
- **Source :** `.../bmad-code-org_BMAD-METHOD/src/bmm-skills/ship/bmad-code-review/references/claims-check.md` L3-5.
- **Cible :** `plugins/common/commands/deep-review.md`, étapes 2-3.
- **Acceptance :** l'Agent 2 (adversarial) trace le diff **avant** de lire le message de commit
  / le corps de PR ; une passe finale falsifie chaque affirmation vérifiable de la narration
  contre le code tracé. Ne pas toucher à l'Agent 1, dont le rôle *est* de reconstruire l'intention.

### P2-e — Seams pré-agréés avant d'écrire les tests ✅
- **Source :** `.../mattpocock_skills/skills/engineering/tdd/SKILL.md` L20-24.
- **Cible :** `plugins/craft/skills/tdd-workflow-principles/SKILL.md`, dans « Interface Design
  During TDD » (L33-52) — pas dans `testing-principles`, parce que c'est une étape du *workflow*,
  pas une règle d'écriture.
- **Acceptance :** avant la première itération RED, la liste des frontières publiques à tester
  est écrite et validée avec l'utilisateur ; aucun test à une frontière non validée. La
  justification est explicite : borner l'effort aux chemins critiques plutôt que de couvrir
  chaque cas limite.
- **Pourquoi P2 et pas P1 :** la DoD fonctionnelle de `/goal:spec` joue déjà ce rôle sur les
  features passant par le workflow `goal`. Le trou ne s'ouvre que hors `goal`.

### P2-f — Règle des 3 hypothèses dans `systematic-debugging` ✅
- **Source :** `.../FlorianBruniaux_claude-code-plugins/plugins/code-quality/commands/investigate.md` L133-142.
- **Le delta :** mon fork a bien l'escalade *qualitative* (« each fix creates new symptoms
  elsewhere » → discuter avec l'humain, `plugins/superpowers/skills/systematic-debugging/SKILL.md`
  L205-214) mais **aucun compteur**. Bruniaux impose un arrêt dur après 3 hypothèses infirmées,
  avec trois options présentées à l'utilisateur (nouvelle hypothèse / instrumenter et attendre
  la prochaine occurrence / escalader).
- **Cible :** `plugins/superpowers/skills/systematic-debugging/SKILL.md`, phase 3 (L146-169).
- **Acceptance :** après 3 hypothèses infirmées, la phase 3 s'arrête et présente les trois
  options. Effort ~5 lignes. Bumper le pin de fork dans le frontmatter.

### P3-a — Matrice I/O & cas limites gelée dans la spec 🔎
- **Source :** `.../bmad-code-org_BMAD-METHOD/src/bmm-skills/ship/bmad-build/spec-template.md` L33-41, L82-91.
- **Idée :** un tableau `Scénario | Entrée/État | Sortie attendue | Gestion d'erreur` gelé
  après approbation, chaque ligne devant être couverte par un test qui a tourné.
- **Verdict :** recouvre largement la DoD fonctionnelle de `/goal:spec` (un critère observable
  par règle métier). Le delta réel est la *forme tabulaire*, pas la discipline. **P3, à ne
  prendre que si une spec se révèle trop peu dense en cas limites.**

### P3-b — Checklist comme « unit tests for English » 🔎
- **Source :** `.../github_spec-kit/templates/commands/checklist.md` L9-26, L150-255.
- **Idée :** une checklist valide les **exigences**, jamais l'implémentation ; interdit tout
  item commençant par « Verify/Test/Confirm » + comportement.
- **Verdict :** orthogonal à ma stack (mon grill adversarial couvre l'axe « la spec tient-elle
  debout »). P3, et probablement skip.

---

## 5. Divergences ASSUMÉES — ne pas « corriger »

1. **Pas de skill `test-driven-development` porté depuis obra.** Ce serait un 4ᵉ cadre TDD à
   côté de `craft:tdd-workflow-principles`, `phpunit:php-tdd-workflow`,
   `vitest:vitest-tdd-workflow` et `common:feature-tdd-dev` → hésitation de routing. Le delta
   réel (mutation check, gate « nomme le break ») se greffe dans l'existant, cf. P2-a.
   Motif déjà consigné dans `plugins/superpowers/README.md` L15.
2. **Itérations cross-layer plutôt que RGR par couche.** `craft:tdd-workflow-principles`
   L17-31 tranche pour la tranche verticale et interdit explicitement le slicing horizontal ;
   obra L47-69 reste sur le cycle canonique. Choix délibéré, aligné sur `product:vertical-slice`.
3. **`goal` n'automatise ni commit ni PR par défaut** (`done-criteria.template` L42-46, mode
   `manual`). Toutes les cibles à gate (BMAD, spec-kit) supposent un pipeline qui commit.
   Préférence dure du profil d'usage : staging manuel. Ne pas « aligner ».
4. **Le fork `superpowers` reste à 2 skills sur 14.** Les 12 autres sont soit couverts, soit
   des cérémonies d'orchestration (worktrees, dispatch parallèle, subagent-driven dev) que
   `goal` couvre à ma façon. La dérive amont mesurée sur ces 2 skills est **négligeable** :
   le fork local est un *sur-ensemble* du texte amont (sections « Why This Matters »,
   « Real-World Impact » ajoutées localement), seul `find-polluter.sh` a réellement divergé
   (P2-c).
5. **Le refactor reste dans la boucle RGR.** Pocock l'en sort explicitement —
   « Refactoring is not part of the loop. It belongs to the review stage »
   (`mattpocock_skills/skills/engineering/tdd/SKILL.md` L37) ✅. Mon
   `craft:tdd-workflow-principles` L91-103 en fait au contraire le moment où l'on chasse la
   duplication **dans les tests aussi** (passe de consolidation en data providers). Position
   assumée : différer le refactor jusqu'à la review, c'est le ne jamais faire sur un projet solo.
6. **Le méta-reviewer de `deep-review` fusionne et cape les findings.** Pocock lance ses deux
   axes (Standards / Spec) en sous-agents parallèles **qui ne fusionnent ni ne re-classent
   jamais**, « so one axis can't mask the other »
   (`mattpocock_skills/skills/engineering/code-review/SKILL.md` L38-57) ✅. C'est une critique
   valide de mon Agent 3 (`plugins/common/commands/deep-review.md` L60-68) : un cap à ~2-5
   findings peut effacer l'axe le moins bruyant. Assumé quand même — la friction du profil est
   le bruit de review, pas le manque de couverture. À rouvrir seulement si un axe se révèle
   systématiquement absent des sorties.
7. **Pas de gate PASS/CONCERNS/FAIL/WAIVED.** BMAD n'en a d'ailleurs plus qu'un seul en
   dépôt 🔎. Un verdict à quatre niveaux jugé par un modèle est strictement plus faible que
   des exit codes rejoués — c'est le sens de `done-criteria.template` L7-8.

---

## 6. Dérives de doc constatées

| # | Où | Constat | Confiance |
|---|---|---|---|
| 1 | `plugins/common/commands/feature-tdd-dev.md` L13-14, L85 | Référence trois fois des skills **inexistants** : `tdd-workflow` et `test-conventions`. Les vrais noms sont `craft:tdd-workflow-principles`, `craft:testing-principles`, plus les déclinaisons `phpunit:` / `vitest:`. Grep sur `^name: tdd-workflow$` dans `plugins/` = 0 hit. | ✅ |
| 2 | `plugins/common/commands/feature-tdd-dev.md` L152-160 | Une commande présentée comme cross-langage code en dur des commandes PHP/Docker (`docker compose exec php ./vendor/bin/phpunit`, `make php/tests`) dans sa phase 5. Un projet NestJS suivant la commande à la lettre lance la mauvaise commande. | ✅ |
| 3 | `plugins/superpowers/README.md` L15 | Le motif de skip de `test-driven-development` énumère « `php-tdd-workflow`, `vitest-tdd-workflow`, `common:feature-tdd-dev` » et **omet `craft:tdd-workflow-principles`**, qui est pourtant le cadre de référence. Le « 4ᵉ cadre » en est en réalité un 5ᵉ. | ✅ |
| 4 | `plugins/self-audit/audits/superpowers-gap-analysis.md` L46 | Cite `test-driven-development/testing-anti-patterns.md` comme source amont. Ce fichier **n'existe plus** dans obra @b36e082 ; le contenu vit maintenant dans `writing-good-tests.md`. Le backlog est encore lisible, la citation ne l'est plus. | ✅ |
| 5 | `plugins/self-audit/audits/superpowers-gap-analysis.md` L124-129 | La checklist finale liste P1-a, P1-b et P2-a comme **non faits** ; les trois ont atterri : mock hygiene → `testing-principles` L124-125, anti-accord-performatif → `global-claude-md.template` L102-105, plan-alignment → `deep-review.md` L27-34. Idem pour le P1-a de `bmad-method-gap-analysis.md` (verification-gap + sévérité au vrai call-site) → `deep-review.md` L51, L56. Les cases restent à cocher. | ✅ |
| 6 | `plugins/self-audit/usage-profile.md` L3 | Le profil est daté du 2026-07-20 et se dit « à rafraîchir » ; il pondère cet audit sans avoir bougé depuis. À relancer avant le prochain audit thématique. | ✅ |

---

## 7. Backlog exécutable à froid

```
[ ] P1-a  testing-principles §2 : taxonomie « ce qui ne compte pas comme un test »
[ ] P1-b  verification-before-completion + done-criteria : un test non exécuté = absent ;
          jamais aligner l'attente sur le code
[ ] P1-c  nouveau skill common:receiving-code-review (vérifier / grep YAGNI / clarifier
          avant d'implémenter)
[ ] P2-a  tdd-workflow-principles : mutation check en fin de REFACTOR
[ ] P2-b  deep-review Agent 2 : catégorie « Deletions »
[ ] P2-c  find-polluter.sh : merger le correctif amont, garder TEST_RUNNER, bumper le pin
[ ] P2-d  deep-review : tracer le diff avant de lire commit/PR, puis falsifier la narration
[ ] P2-e  tdd-workflow-principles : seams pré-agréés avant la 1re itération RED
[ ] P2-f  systematic-debugging phase 3 : règle des 3 hypothèses
[ ] DOC-1 feature-tdd-dev : corriger les 3 références à des skills inexistants
[ ] DOC-2 feature-tdd-dev : sortir les commandes PHP/Docker en dur de la phase 5
[ ] DOC-3 superpowers/README.md L15 : ajouter craft:tdd-workflow-principles au motif de skip
[ ] DOC-4 superpowers-gap-analysis.md L46 : testing-anti-patterns.md → writing-good-tests.md
[ ] DOC-5 superpowers-gap-analysis.md L124-129 + bmad-method-gap-analysis.md : cocher les
          items livrés
[ ] DOC-6 relancer /insights et rafraîchir usage-profile.md
```
