# Guide d'usage — skills cherry-pickés `superpowers` + `pocock`

Ce guide explique **quand et comment** te servir des 6 skills ajoutés via les plugins `superpowers@fabien-claude-marketplace` (cherry-pick `obra/superpowers`) et `pocock@fabien-claude-marketplace` (cherry-pick `mattpocock/skills`).

Tous les exemples ci-dessous sont écrits avec ton contexte réel (eres, dotfiles, formation PHPUnit, RAG, refactoring souscription-individuelle).

---

## Vue d'ensemble — mode de déclenchement

| Skill | Plugin | Trigger | Quand Claude le charge |
|---|---|---|---|
| `verification-before-completion` | superpowers | Auto | Claude est sur le point de dire "done/passes/fixed" |
| `systematic-debugging` | superpowers | Auto | Tu signales un bug, un test qui fail, un comportement inattendu |
| `grill-me` | pocock | Auto | Tu écris "grille-moi", "grill me", "stress-test mon plan" |
| `grill-with-docs` | pocock | Auto | Même que `grill-me`, en présence de `CONTEXT.md` / `docs/adr/` |
| `zoom-out` | pocock | **Manuel uniquement** (`disable-model-invocation: true`) | Tu invoques `/zoom-out` ou tu nommes le skill |

> `writing-plans` (obra) a été initialement cherry-pické puis **retiré en v5.1.1** : doublon réel avec `/spec-first-dev`. Voir `tdd-workflow-audit.md` pour le détail.

---

## 1. `zoom-out` (pocock) — _user-trigger uniquement_

### Ce qu'il fait

Force Claude à **monter d'un niveau d'abstraction** au lieu de plonger dans le code. Il te répond avec une carte des modules, des callers, et utilise le vocabulaire du glossaire métier (CONTEXT.md s'il existe).

### Quand l'utiliser

- 🟢 Tu hérites d'un projet eres que tu ne connais pas et tu veux comprendre l'archi avant de toucher
- 🟢 On te file un ticket sur un module opaque (`Refund`, `Beneficiary`, `ContractStatus`...) et tu veux savoir où ça vit dans le système
- 🟢 Tu reviens sur un projet après 6 mois et tu as oublié les boundaries

### Quand NE PAS l'utiliser

- 🔴 Tu connais déjà bien le périmètre → tu vas perdre du temps
- 🔴 Tu cherches une réponse précise (signature de méthode, valeur de constante) → utilise `Grep`/`Read` directement

### Comment l'invoquer

`zoom-out` a `disable-model-invocation: true` : Claude **ne le déclenchera jamais tout seul**. Tu dois être explicite :

```
/zoom-out
```

Ou en langage naturel :
```
Utilise le skill zoom-out sur src/Subscription/Individual/
```

### Exemple concret — refactoring souscription-individuelle

Plutôt que :
> "Claude, regarde le dossier src/Subscription/Individual et explique-moi"

→ Claude va lire les fichiers un par un et te faire un résumé technique.

Avec `zoom-out` :
> "/zoom-out src/Subscription/Individual"

→ Claude va d'abord chercher `CONTEXT.md`, `docs/adr/`, les callers depuis d'autres bounded contexts, et te répondra :
>
> "**Subscription/Individual** est appelé par `Api/Souscription`, `Workflow/Onboarding`, et `Admin/Backoffice`.
> Il publie `IndividualSubscribed` consommé par `Notification` et `Accounting`.
> Glossaire (CONTEXT.md) : `IndividualSubscription` = adhésion personne physique seule (sans bénéficiaire) ≠ `GroupSubscription`."

---

## 2. `grill-me` (pocock) — Socratique léger

### Ce qu'il fait

Inverse le pattern habituel "Claude propose verbeux / toi tu pushes back". Au lieu de ça, **Claude te grille** : une question à la fois, en parcourant l'arbre de décision, avec sa préconisation à chaque branche.

### Quand l'utiliser

- 🟢 Tu prends une **décision ponctuelle hors feature-dev** : choix entre 2 libs, scope d'un refacto, design d'un hook, structure d'un test fixture
- 🟢 Tu as une idée floue dans la tête et tu veux que Claude force la clarification avant qu'il code
- 🟢 Tu veux **stress-tester** un plan que tu as déjà écrit (mental check)

### Quand NE PAS l'utiliser

- 🔴 Tu démarres une **feature DDD/Symfony complète sur eres** → utilise `/spec-first-dev` qui est plus structuré (Round 1 business + Round 2 système + UL + GATE de validation)
- 🔴 Tu as déjà tout clair dans la tête → tu vas perdre du temps en aller-retour

### Différence vs `/spec-first-dev` Phase 1

| | `/spec-first-dev` | `grill-me` |
|---|---|---|
| Structure | Checklist fixe (6 questions business + 5 questions système) | Émergent, dépend du sujet |
| Sortie | Synthèse markdown formelle (UL/User flow/BR/Scope) | Pas de sortie persistée |
| Scope | Feature dev DDD eres | N'importe quelle décision |

### Comment l'invoquer

Auto-trigger sur des phrases comme :
- *"grille-moi sur le hook BSD/GNU lint avant que je l'écrive"*
- *"stress-test mon plan d'archi RAG"*
- *"grill me on this refactor"*

### Exemple concret — hook BSD/GNU lint (item BACKLOG)

```
Toi : "grille-moi sur le hook BSD/GNU lint qu'on a au BACKLOG"

Claude : Q1: Tu veux que le hook warn ou block ?
         Reco: warn (BACKLOG le dit : "warn, not block").
Toi : warn

Claude : Q2: Détection par string match sur la commande, ou parse AST bash ?
         Reco: string match (zero dep, ~50 lignes bash natif).
Toi : string match

Claude : Q3: Tu cibles seulement `Bash` tool, ou aussi les `Edit/Write` sur 
         des fichiers .sh ?
         Reco: les deux (un script .sh fraîchement créé peut contenir 
         grep -P qui shippera tel quel).
Toi : seulement Bash pour v1

Claude : Q4: Les patterns sont en dur dans le hook, ou dans un fichier YAML
         versionné séparément ?
         Reco: en dur pour v1 (8 patterns, pas besoin de YAML).
...
```

→ À la fin, vous avez aligné sur les 4-5 décisions clés avant le moindre code.

---

## 3. `grill-with-docs` (pocock) — Socratique + maintenance de la doc domain

### Ce qu'il fait

Comme `grill-me`, **plus** la mise à jour vivante de `CONTEXT.md` (le glossaire du bounded context) et la création parcimonieuse d'ADR (Architecture Decision Records) au fil des décisions cristallisées.

### Quand l'utiliser

- 🟢 Tu travailles sur un projet eres **DDD avec `CONTEXT.md` ou `docs/adr/` déjà présents**
- 🟢 Tu veux pousser la rigueur ubiquitous language au-delà du « ça compile » : qu'un terme imprécis te soit immédiatement challengé
- 🟢 Tu prépares une **décision archi structurante** (event sourcing pour les Orders, séparation read/write...) qui mérite un ADR

### Quand NE PAS l'utiliser

- 🔴 Projet sans glossaire / sans culture DDD → `grill-me` suffit, pas la peine d'amorcer artificiellement un `CONTEXT.md` que personne ne maintiendra
- 🔴 Décision purement technique sans impact sur le langage métier (ex : choix d'un transport HTTP) → `grill-me`

### Différence vs `grill-me`

`grill-me` = pur interview. `grill-with-docs` = interview **+** met à jour `CONTEXT.md` au moment où un terme est résolu, et propose un ADR uniquement si les 3 critères sont réunis :

1. **Hard to reverse** (changer d'avis coûterait cher)
2. **Surprising without context** (un futur lecteur se demanderait pourquoi)
3. **Real trade-off** (il y avait vraiment plusieurs options)

### Comment l'invoquer

Auto-trigger sur les mêmes phrases que `grill-me`. Claude détecte la présence de `CONTEXT.md` / `docs/adr/` et bascule sur `grill-with-docs`.

### Exemple concret — formation PHPUnit, refonte du module "Beneficiary"

```
Toi : "grille-moi sur le redesign du module Beneficiary"

Claude : (lit CONTEXT.md → voit que "Beneficiary" est déjà défini)
        
        Avant de commencer : ton CONTEXT.md définit `Beneficiary` 
        comme "personne désignée par le souscripteur pour recevoir 
        les prestations". Le redesign concerne ça, ou tu parles aussi 
        des `Insured` (assurés directs) ?
Toi : Bonne question — je pensais Beneficiary uniquement. Insured est out of scope.

Claude : (met à jour CONTEXT.md inline pour clarifier la frontière)
        
        Q1: Un Beneficiary peut-il être lié à plusieurs Subscriptions, 
        ou strictement 1:1 ?
        Reco: regarde Subscription.beneficiaries (collection) → 1:N existant.
Toi : 1:N confirmé

Claude : Q2: ...
```

À la fin : `CONTEXT.md` enrichi avec la frontière `Beneficiary` vs `Insured`, plus éventuellement un ADR si une décision est structurante (ex: "On garde 1:N mais on ajoute une contrainte d'unicité par Subscription").

---

## 4. `verification-before-completion` (obra) — discipline « evidence before claims »

### Ce qu'il fait

Skill de **discipline d'auto-vérification**. Avant que Claude dise "done", "passes", "fixed", "looks good", il **doit** avoir exécuté la commande de vérification dans le message en cours et lu la sortie. *Confidence ≠ evidence.*

### Pourquoi ça compte pour toi

Le rapport d'audit a montré **26 "wrong approach" / "mostly_achieved" sur 35 sessions** : Claude annonce "done" trop tôt, sans avoir lancé les tests. Ce skill adresse ça **directement**.

### Quand l'utiliser

- 🟢 **Tu n'as rien à faire — il s'auto-déclenche** dès que Claude est sur le point de claim une réussite

### Comment le forcer si Claude oublie

- *"vérifie avant de conclure"*
- *"montre-moi la preuve que ça passe"*
- *"run the tests and show me the output before saying done"*

### Effet attendu

Avant ce skill :
> "J'ai fixé le bug, les tests passent maintenant."

Après ce skill :
> "Je viens de tourner `make php/qa` : 12/12 tests passent (exit code 0). Le bug est fixé."
> _(avec la sortie de la commande dans le message)_

### Exemple concret — refacto souscription-individuelle

```
Toi : "fixe le bug de validation sur le formulaire de souscription"
Claude : (édite le code)
        → s'auto-déclenche verification-before-completion
        → tourne `make php/qa`
        → "Build vert : 247/247 tests passent, PHPStan 0 erreur, php-cs-fixer 
           OK. Le bug est fixé. Voici la sortie : [..]"
```

vs. l'ancien comportement où il aurait dit "c'est bon !" sans tourner les tests.

---

## 5. `systematic-debugging` (obra) — méthode debug en 4 phases

### Ce qu'il fait

Force Claude à suivre une méthode **systématique** avant tout fix :

1. **Phase 1 — Root Cause Investigation** : lire les erreurs, reproduire, vérifier les changements récents, instrumenter les boundaries dans les systèmes multi-composants
2. **Phase 2 — Pattern Analysis** : comprendre pourquoi (pas juste où)
3. **Phase 3 — Fix Design** : proposer un fix au root cause, pas au symptôme
4. **Phase 4 — Verification** : red-green cycle pour valider que le fix tient

### Quand l'utiliser

- 🟢 **Tu n'as rien à faire — auto-trigger** sur "bug", "test fails", "ça crash", "comportement inattendu", "build error", "perf problem"
- 🟢 Sur les bugs eres qui touchent plusieurs services (API + worker + DB) → la Phase 1 instrumentation des boundaries est précieuse

### Quand le forcer

- *"applique systematic-debugging"*
- *"ne propose pas de fix avant d'avoir trouvé la root cause"*

### Différence vs `qa:phpstan-resolver` (que tu as déjà)

| | `qa:phpstan-resolver` | `systematic-debugging` |
|---|---|---|
| Scope | PHP / PHPStan uniquement | Language-agnostic (TS, bash, infra, Symfony, NestJS...) |
| Méthode | Loop sur les erreurs PHPStan jusqu'à zéro | 4 phases avant tout fix |
| Cible | Erreurs typage | Bugs runtime, échecs CI, perf, intégration |

Les deux sont **complémentaires** : `phpstan-resolver` résout les erreurs de types, `systematic-debugging` résout les vrais bugs (logique métier, intégration, perf).

### Exemple concret — bug en prod sur souscription

```
Toi : "Les utilisateurs se plaignent que la souscription échoue 
       silencieusement depuis hier."

Claude : (auto-trigger systematic-debugging)

        Phase 1 — Root Cause Investigation
        
        1. Erreurs : pas de stack trace côté front. Je regarde les logs API
           (Datadog ? Sentry ?)
        2. Reproduction : peux-tu me donner un user ID qui a échoué ?
        3. Changements récents : `git log --since=yesterday` montre 3 commits 
           dont 1 sur le service de validation.
        4. Boundaries : je vais instrumenter API → Domain → Repository pour 
           voir où ça casse.

        Donne-moi un user ID que je puisse rejouer, et je tourne 
        les diagnostics avant de proposer un fix.
```

vs. l'ancien comportement où Claude aurait dit "c'est sûrement le validator, je change la règle".

---

## 🎯 Table de décision rapide

| Situation | Skill |
|---|---|
| Démarrer une feature DDD complète sur eres | `/spec-first-dev` _(pas un skill cherry-pick — workflow maison)_ |
| Décision ponctuelle hors feature-dev (lib, hook, refacto isolé) | `grill-me` |
| Idem mais projet DDD avec CONTEXT.md / ADR | `grill-with-docs` |
| Entrer dans une codebase inconnue | `/zoom-out` |
| Bug, test qui fail, comportement inattendu | `systematic-debugging` _(auto)_ |
| Claude vient de dire "done" sans preuve | `verification-before-completion` _(auto)_ |
| Plan d'implémentation feature | `/spec-first-dev` _(workflow maison, plus structuré que writing-plans)_ |

---

## Références

- Upstream `obra/superpowers` : https://github.com/obra/superpowers (MIT)
- Upstream `mattpocock/skills` : https://github.com/mattpocock/skills (MIT)
- README plugin : [`plugins/superpowers/README.md`](../plugins/superpowers/README.md), [`plugins/pocock/README.md`](../plugins/pocock/README.md)
- Workflow maison à comparer : `/spec-first-dev` ([`plugins/common/commands/spec-first-dev.md`](../plugins/common/commands/spec-first-dev.md))
