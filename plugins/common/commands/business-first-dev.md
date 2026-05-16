---
description: Business-first feature development — 5-phase workflow forcing business understanding before code exploration. Produces a validated spec then implements with iterative checkpoints.
argument-hint: Optional feature name or initial context
---

# Business-First Feature Development

Harness de developpement guide par le metier. Inspire du Harness Engineering (Fowler), du Context Engineering (Karpathy), et du Spec-Driven Development (OpenSpec, Spec Kit).

**Principe** : Comprendre le metier AVANT de toucher au code. Produire une spec validee qui contraint l'implementation.

**Quand utiliser ce workflow** :
- Le besoin est flou ou incomplet
- Tu ne connais pas le domaine metier
- Les edge cases ne sont pas identifies
- Les iterations d'implementation ne sont pas connues a l'avance
- Le projet ne suit pas un workflow TDD strict

**Quand utiliser /feature-tdd-dev a la place** :
- L'US est bien specifiee avec des criteres d'acceptation clairs
- Le workflow TDD est etabli (red-green-refactor)
- Les iterations sont connues

---

## Phase 1 : Comprendre

**But** : Extraire les connaissances metier que tu n'as pas. AUCUNE exploration de code ici.

**Round 1 -- Le Besoin** (toujours pose, adapte au contexte fourni) :

Poser ces questions en texte libre conversationnel. Adapter selon ce que l'utilisateur a deja fourni -- ne pas reposer ce qui est deja clair.

1. Qui utilise cette fonctionnalite ? (persona : CGP, client, admin, batch...)
2. Quel est le flux complet ? (etape par etape, ce que l'utilisateur voit et fait)
3. Quelles regles metier s'appliquent ? (validations, calculs, conditions, limites)
4. Vocabulaire metier ? (termes FR/EN a aligner sur l'UL wiki)
5. Cas limites metier connus ? (pas techniques -- les vrais cas business : client sans contrat, montant zero, multi-beneficiaires...)
6. Qu'est-ce qui est explicitement hors scope ?

**ATTENDRE les reponses avant de continuer.**

**Round 2 -- Le Systeme** (apres Round 1, questions adaptees aux reponses) :

**Principe** : Ne poser que les questions auxquelles tu ne peux PAS repondre en explorant le code. Les questions techniques (quel pattern ? quel FormType ? quelle route ?) seront resolues en Phase 2 par exploration du code. Ici, on cherche uniquement les informations externes au code.

1. Maquette ou design Figma existant ?
2. **Adherences inter-projets** : la feature est-elle 100% autonome dans ce repo, ou depend-elle d'autres projets ? (ex: client d'API ici, endpoint/service dans un autre repo). Si oui, quels repos scanner pour recuperer le contexte ? (contracts, DTOs, endpoints)
3. D'ou viennent les donnees ? (nouvelle API a creer, donnees en dur, source externe)
4. Contraintes non deductibles du code ? (deadlines, contraintes legales, decisions d'equipe)
5. Quelque chose que tu sais et que je ne peux pas trouver dans le code ?

**ATTENDRE les reponses avant de continuer.**

**Synthese** : Presenter un resume structure :

```
## Comprehension du besoin

### Ubiquitous Language (FR -> EN)
| Terme FR | Terme EN | Definition |
|----------|----------|------------|

### Flux utilisateur
1. L'utilisateur fait X
2. Le systeme fait Y
3. ...

### Regles metier
- RM1: Si [condition] alors [resultat]
- RM2: ...

### Sources de donnees
- [Systeme] -> [endpoint/table] -> [donnees]

### Perimetre
- IN: ...
- OUT: ...
```

**GATE** : Demander "Cette comprehension est-elle correcte ? Qu'est-ce qui manque ?"

Iterer sur la synthese jusqu'a confirmation explicite. **NE PAS passer a la Phase 2 sans validation.**

---

## Phase 2 : Explorer

**But** : Explorer le code GUIDE par la comprehension metier validee.

**Principe** : Les agents explorateurs recoivent la synthese metier de Phase 1 en input. Ils cherchent "comment le code gere [concept metier X]", pas "quels patterns existent en general".

**Actions** :

1. Lancer 1-2 agents explorateurs (subagent_type: Explore) avec des prompts derives de Phase 1 :
   - "Comment [concept metier A] est implemente ? Trace controller -> domain -> SPI -> config YAML."
   - "Quel est le pattern HTTP client pour [systeme B] ? Trace Guzzle client, repository interface, serializer."
2. Lire les fichiers identifies par les agents
3. Presenter les resultats MAPPES aux concepts metier :
   - "Pour [concept X], le pattern existant est : [controller] -> [interface domain] -> [implementation SPI]"
   - "Pour [concept Y], rien n'existe encore -- a creer en suivant le pattern de [concept Z]"

**GATE** : Checkpoint rapide -- "Ces patterns correspondent a ce que tu attends ?"

---

## Phase 3 : Specifier

**But** : Produire UNE specification d'implementation concrete, validee, persistee en fichier.

**Principe** : Pas de multiples architectes. L'architecture est dictee par les conventions DDD/hexagonale du projet et les skills charges. Produire un document actionnable.

**Persister** le document dans `.claude/plans/<feature>-spec.md` :

```markdown
# Spec : [Nom de la feature]

## Contexte metier
[Resume valide de Phase 1]

## Patterns existants
[Resultats mappes de Phase 2]

## Implementation

### Fichiers a creer
- `src/Domain/[BoundedContext]/...` : [description, signatures de methodes]
- `src/Infrastructure/[BoundedContext]/...` : [description]
- `src/Api/[BoundedContext]/...` : [description]

### Fichiers a modifier
- `config/services.yaml` : [wiring exact des services]
- `config/routes/...` : [routes si necessaire]

### Templates/JS (si applicable)
- `templates/...` : [description]
- `assets/...` : [description]

### Traductions
- `translations/...` : [cles a ajouter]

### Tests
- Unit: [quoi tester, quels cas]
- Integration: [quoi tester]
- Acceptance: [quoi tester, optionnel]

## Ubiquitous Language
[Table UL de Phase 1]
```

**GATE** : "Valides-tu cette specification ? Qu'est-ce que tu changerais ?"

La spec validee devient le **contrat d'implementation**. Toute deviation doit revenir a la spec. Si un changement est necessaire pendant l'implementation, mettre a jour la spec AVANT d'implementer.

---

## Phase 4 : Implementer

**But** : Construire la feature en suivant la spec, avec des checkpoints reguliers.

**Actions** :

1. **Proposer le decoupage** en iterations base sur la spec. Le nombre depend du scope :
   - Petite feature : 1-2 iterations
   - Feature moyenne : 3-4 iterations
   - Grande feature : 5+ iterations (envisager de decouper en PRs)

2. **Pour chaque iteration** :
   a. Annoncer ce qui sera construit
   b. Implementer selon la specification
   c. Lancer le CI (`make php/qa`, `make php/tests`, ou equivalent du projet)
   d. **Checkpoint** : "Iteration N terminee. Resultat : [resume]. CI : [statut]. Tu veux revoir avant de continuer ?"

3. **Si correction** : mettre a jour la spec puis appliquer la correction

**Strategie de test** -- TDD par defaut, permissif sur la typologie :
- **Toujours en TDD (test-first).** Ecrire le test AVANT le code de production, dans la meme iteration. Activer le skill `php-tdd-workflow` ou `vitest-tdd-workflow` selon le projet.
- Adapter la **typologie de tests** au projet :
  - Projet avec tests etablis -> suivre les patterns et types de tests existants (unit, integration, functional)
  - Projet nouveau -> demander "Quel niveau de tests pour cette feature ?"
- Ne pas forcer un type de test particulier. Si le projet ne teste que les FormTypes en integration, ne pas inventer des tests unitaires ou fonctionnels non demandes.
- **Eviter les tests d'implementation** (ex: compter le nombre de choix d'un formulaire). Tester le comportement : soumission valide, soumission invalide, regles metier.

---

## Phase 5 : Verifier et Resumer

**But** : S'assurer que l'implementation respecte la spec.

**Actions** :

1. Lancer le CI complet
2. Checklist de verification :
   - [ ] Regles metier implementees vs spec
   - [ ] Nommage UL respecte
   - [ ] Services YAML wires
   - [ ] Tests couvrent les regles metier
3. Resume : fichiers crees/modifies, regles metier couvertes, prochaines etapes

---

## Regles

- **Jamais de code avant Phase 2.** Phase 1 est purement conversationnelle.
- **Jamais de Phase 2 sans validation Phase 1.** L'utilisateur doit confirmer la comprehension.
- **Une seule approche architecturale.** Pas 3 alternatives -- l'architecture est dictee par le projet.
- **La spec est le contrat.** Toute deviation = mise a jour de la spec d'abord.
- **Checkpoints obligatoires.** L'utilisateur peut toujours corriger entre les iterations.
- **Adapter, pas imposer.** Le workflow s'adapte au projet (tests, iterations, conventions).
