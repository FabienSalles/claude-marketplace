# Audit TDD — divergences concrètes entre ton stack et obra/mattpocock

**Question posée** : si j'ai rejeté `obra/test-driven-development` et `mattpocock/tdd` parce qu'ils créeraient une "hésitation entre 3 frameworks TDD", est-ce que je rate des choses qui mériteraient d'être absorbées dans tes propres workflows ?

**Réponse courte** : oui, **3 améliorations à haut ROI** + 3 améliorations marginales. Tes workflows restent dominants sur 5 axes (cross-layer iterations, working-app-at-each-GREEN, bug-fix workflow, multi-phase command, framework specifics).

---

## 📊 Stack TDD comparée

| Asset | Type | Scope |
|---|---|---|
| **Tien — `craft:tdd-workflow-principles`** | skill cross-language | Principes abstraits (cross-layer, RGR, working app, bug-fix) |
| **Tien — `php-tdd-workflow`** | skill PHP/Symfony | Exemples PHPUnit, services.yaml, Symfony container |
| **Tien — `vitest-tdd-workflow`** | skill TS/NestJS | Exemples Vitest, providers, modules NestJS |
| **Tien — `/feature-tdd-dev`** | slash command | Workflow 7 phases (Discovery → Quality Review → Summary) |
| **Rejeté — `obra/test-driven-development`** | skill | Discipline "Iron Law" + rationalizations |
| **Rejeté — `mattpocock/tdd`** | skill | Behavior-vs-implementation + deep modules |

---

## 🟢 Tu es **plus fort** sur 5 axes (ne pas casser ce qui marche)

| Axe | Tien | obra | mattpocock |
|---|---|---|---|
| **Cross-layer iterations** (Controller → Domain → SPI → retour Controller) | ✅ explicit avec diagram | ❌ non abordé | 🟡 "tracer bullet" mais moins concret |
| **Working-app-at-each-GREEN** (template créé, service injecté, route OK, container lint OK) | ✅ checklist complète | ❌ | ❌ |
| **Bug-fix workflow** ("find existing tests", "real deps not mocks", red-green) | ✅ 5 steps explicites | 🟡 "write failing test reproducing it" (brief) | ❌ |
| **Multi-phase command avec subagents + GATES** | ✅ `/feature-tdd-dev` (7 phases : Discovery, Exploration, Clarifying, Architecture, Implementation, Quality Review, Summary) | ❌ | ❌ |
| **Framework-specific examples** (services.yaml, providers NestJS, debug:router, lint:container) | ✅ php-tdd-workflow + vitest-tdd-workflow | ❌ générique | ❌ générique |

---

## 🔴 3 améliorations à **haut ROI** (à absorber dans `craft:tdd-workflow-principles`)

### #1 ⭐⭐ Interface design / "deep modules" — _absent chez toi_

**Source** : `mattpocock/tdd` (lien vers `deep-modules.md` + `interface-design.md`)

**Concept** : avant d'écrire le premier test d'une itération, identifier les opportunités de "small interface, deep implementation" (Ousterhout, _A Philosophy of Software Design_). C'est le **dual du TDD** : tester via interface publique force des bonnes interfaces, mais il faut le rappeler explicitement.

**Citation mattpocock** :
> [ ] Identify opportunities for deep modules (small interface, deep implementation)
> [ ] Design interfaces for testability

**Pourquoi ça manque chez toi** : ton `/feature-tdd-dev` Phase 4 (TDD Architecture Design) lance des `code-architect` agents avec "minimal changes, clean architecture, pragmatic balance", mais **n'explicite pas** la notion d'interface publique simple cachant une implémentation riche. Résultat possible : Claude propose des interfaces qui fuient l'implémentation (3 paramètres optionnels, options bag, surface API large).

**Action proposée** :
- Ajouter une section `## Interface Design During TDD` dans `craft:tdd-workflow-principles` avec 2-3 paragraphes :
  - "Tester via l'interface publique force une bonne interface — mais c'est un effet, pas un résultat. Avant chaque itération, demande-toi : quelle est la **plus petite surface API** qui rendrait ce test possible ?"
  - "Si tu dois mocker un collaborateur interne pour tester, l'interface est trop large."
  - Lier à `oop-principles` / `ddd-principles` qui couvrent déjà l'idée mais pas dans le contexte TDD.

**Effort** : 30 min. **Impact** : ⭐⭐⭐⭐ (touche toutes les features eres + formation).

---

### #2 ⭐ "Tests survive refactors" — heuristique behavior-vs-implementation

**Source** : `mattpocock/tdd`

**Concept** : un test bien écrit teste un **comportement observable via API publique** et survit aux refactors internes. Le **warning sign** : si tu renommes une fonction interne et qu'un test casse, ce test testait l'implémentation, pas le comportement.

**Citation mattpocock** :
> The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

**Pourquoi ça manque chez toi** : ton `craft:tdd-workflow-principles` dit "Test behavior" et `php-test-conventions` parle de DAMP/AAA, mais aucun des deux ne donne ce **critère opérationnel** ("renomme une fonction interne — qu'est-ce qui casse ?"). Conséquence : les tests qui couplent à l'implémentation passent inaperçus.

**Action proposée** : Ajouter à `craft:tdd-workflow-principles` (section "Anti-Patterns") :
> **Warning sign : un test qui casse sur un refactor interne (rename, extract) sans changement de comportement testait l'implémentation. À réécrire en termes d'API publique.**

**Effort** : 5 min. **Impact** : ⭐⭐⭐ (catch les tests fragiles avant qu'ils coûtent).

---

### #3 ⭐ "Common Rationalizations" — table anti-procrastination

**Source** : `obra/test-driven-development`

**Concept** : un tableau "excuse → réalité" qui catch les rationalisations courantes ("trop simple à tester", "je testerai après", "j'ai déjà testé manuellement", "écrire après ≠ TDD mais ça revient au même"...).

**Citation obra** (extrait — la table complète a 11 lignes) :
> | "Test après achève le même goal" | Tests-après = "que fait ce code ?" Tests-first = "que devrait faire ce code ?" |
> | "Déjà testé manuellement" | Ad-hoc ≠ systématique. Pas de trace, pas rejouable. |
> | "Supprimer X heures = gaspillage" | Sunk cost fallacy. Garder du code non-vérifié = dette technique. |

**Pourquoi ça manque chez toi** : ton anti-pattern list est descriptive ("Writing implementation before the failing test"). Elle dit **quoi éviter**, pas **comment résister à l'auto-justification quand tu te chopes en flagrant délit**.

**Action proposée** : Ajouter à `craft:tdd-workflow-principles` une section `## Common Rationalizations` reprenant 5-7 lignes adaptées à ton contexte (eres, formation). Pas besoin de copier les 11 d'obra — adapter à tes cas réels.

**Effort** : 20 min. **Impact** : ⭐⭐⭐ (renforce la discipline en moment de friction).

---

## 🟡 3 améliorations à **ROI marginal** (à considérer)

### #4 Naming explicite de l'anti-pattern "horizontal slicing"

**Source** : `mattpocock/tdd`

Tu adresses déjà le problème via "cross-layer iterations" et "Anti-patterns: Completing one layer entirely before starting the next". Mattpocock le nomme **"horizontal slicing"** et explique le _pourquoi_ : tests écrits en bulk testent un comportement **imaginé**, pas réel.

**Action proposée** : ajouter le terme `horizontal slicing` comme alias dans `craft:tdd-workflow-principles` pour que Claude le reconnaisse quand tu (ou tes collègues) l'utilisent.

**Effort** : 2 min. **Impact** : ⭐ (lexique).

---

### #5 "Delete and start over" — discipline obra

**Source** : `obra/test-driven-development`

Obra dit littéralement :
> Write code before the test? **Delete it. Start over.**
> No exceptions:
> - Don't keep it as "reference"
> - Don't "adapt" it while writing tests
> - Don't look at it

Ton workflow dit "anti-pattern" sans préciser quoi faire quand tu te chopes.

**Action proposée** : ajouter une ligne dans `craft:tdd-workflow-principles` : "Si tu te chopes à coder avant le test failing → supprime le code, recommence test-first. Pas d'adaptation."

**Impact** : ⭐⭐ si tu prends la discipline au sérieux ; ⭐ si tu préfères une approche plus souple ("écrit le test maintenant, garde le code en référence"). Question de philosophie — pas tranchant.

**Effort** : 5 min.

---

### #6 "You can't test everything" — pragmatisme explicite

**Source** : `mattpocock/tdd`

> You can't test everything. Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

Ton `/feature-tdd-dev` Phase 3 (Clarifying Questions) couvre ça implicitement, mais ne dit pas "on ne testera pas X" — il liste les ambiguïtés à clarifier. Conséquence possible : Claude tend à proposer des tests pour tout, ce qui gonfle les itérations.

**Action proposée** : ajouter une question explicite dans `/feature-tdd-dev` Phase 3 : "Quelles sont les 2-3 behaviors **critiques** dont tu veux la couverture forte ? Le reste sera testé pragmatiquement (smoke ou rien)."

**Effort** : 5 min. **Impact** : ⭐⭐ (réduit le temps d'écriture de tests sur les features secondaires).

---

## 🎯 Plan de réfaction proposé

Si tu valides, je peux faire les 3 améliorations à haut ROI dans un seul commit :

1. `craft:tdd-workflow-principles` → ajout section `Interface Design During TDD`
2. `craft:tdd-workflow-principles` → ajout warning sign "tests survive refactors" dans Anti-Patterns
3. `craft:tdd-workflow-principles` → ajout section `Common Rationalizations` (5-7 lignes adaptées eres/formation)

Bump version `craft:tdd-workflow-principles` 1.0 → 1.1.

Les 3 améliorations marginales (#4-#6) peuvent attendre ou être groupées dans un second commit.

---

## ❓ Le verdict initial "3 frameworks TDD = Claude hésite" tient-il toujours ?

**Oui, mais avec une nuance**. Les 3 améliorations à haut ROI peuvent être absorbées **dans tes skills existants** sans installer obra ou mattpocock. Pas besoin de leur skill complet ; juste les bonnes idées portées dans ton vocabulaire et ton contexte (eres, Symfony, NestJS).

C'est exactement le pattern "garde 3 cherry-picks utiles, skip les doublons" appliqué récursivement : on cherry-pick les **idées**, pas les fichiers entiers.
