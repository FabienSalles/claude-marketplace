---
name: git
description: ACTIVATE for any git or PR operation — create/choose a branch, open or update a PR, "est-ce mergé ?", choose a base, rebase/merge, commit, push, force-push, worktree, cherry-pick, fork. ACTIVATE on 'branche', 'PR', 'merge', 'rebase', 'base main', 'fork', 'gh pr', 'commit', 'push', 'mets à jour', 'est-ce mergé'. Covers Fabien's transverse git conventions — fetch before reasoning on remote state, never ask what a command answers, branch/commit discipline, English conventional commits without AI trailer, PR (French title, ultra-succinct body, draft for WIP, fork targets parent), force-push and worktree guardrails, manual index mode. DO NOT use for Eres-specific fork conventions (see Eres marketplace).
version: 1.0.0
---

# git — discipline git & PR (conventions transverses)

Règles pour toute opération git / PR. À appliquer **par défaut**, sans les
redemander. Le cœur du skill est la **fraîcheur des refs** (§A) : la faute la
plus coûteuse est de raisonner sur un état distant périmé.

## A. Fraîcheur & source de vérité ← cœur

- **Fetch d'abord.** Toute décision qui dépend d'un statut distant (branche
  mergée ? PR ouverte ? base à jour ?) commence par `git fetch <remote> --prune`,
  puis lit `origin/*`, `gh pr list`, `gh pr view` sur le résultat frais. Les refs
  de suivi locales sont **périmées** tant qu'on n'a pas fetch.
- **Jamais de mémoire ni de contexte de session** pour un état git : une branche
  a pu bouger, une PR merger depuis. Re-vérifier au moment T.
- **Merge par squash** : un commit local n'est pas ancêtre de `main` même quand
  le travail y est. Vérifier par **contenu** (fichier / feature présent sur
  `origin/main`) et par le **titre de la PR mergée**, pas seulement
  `git branch --contains <sha>`.
- **« mets à jour » = ordre explicite** : fetch tous les remotes concernés (+
  `composer install` / install des deps si une branche de dépendance a bougé),
  sur **chaque** repo concerné (multi-repo), avant de continuer.

## B. Ne pas demander ce qui est vérifiable

Épuiser `git` / `gh` / `ls` avant toute question. Une question n'est légitime que
sur une **intention** que le state ne révèle pas (ex. « une PR combinée ou deux
PR stackées ? »), et seulement **après** avoir constaté l'état réel et frais.
Ne jamais poser au dev ce qu'une commande répond.

## C. Discipline de branche

- Vérifier `git branch --show-current` avant tout amend / commit / push.
- Nouvelle branche **depuis une base fraîche** : `git switch -c <x> origin/main`
  **après** fetch, jamais depuis un local en retard.
- Nouveau commit > `--amend` par défaut. `--amend` seulement si le commit est
  local non poussé, ou sur demande explicite.
- Déplacer un commit mal placé : cherry-pick sur la bonne base fraîche, vérifier
  build / tests, pas de reset destructif sans demande.

## D. Commits

- Message **anglais**, format `type(scope): summary`, conventional commits.
- Type sur le changement observable : un comportement qui change est `feat` /
  `fix`, **pas** `refactor` même si le diff est majoritairement du restructuring.
  `refactor` = ni bug fixé ni comportement changé.
- **Aucun trailer IA** : jamais `Co-Authored-By: Claude`, jamais « Generated
  with… ». Le commit est attribué au dev seul.

## E. Pull requests

- **Se mettre à jour sur `main` AVANT** d'ouvrir (rebase, histoire linéaire),
  jamais de PR depuis une branche en retard :

  ```bash
  git fetch upstream main
  git rebase upstream/main        # rebase, pas merge
  ```

- **Titre français**, préfixe conventionnel conservé, concis, sans ref ticket
  sauf demande. C'est une préférence **perso** (transverse à tes repos).

  ```
  feat(payment-information): découpe des modes de paiement par typologie d'offre
  ```

- **Description ultra-succincte** : seulement le **non-devinable** (décisions,
  comportement par cas, hors-périmètre volontaire). Quelques bullets max. Pas de
  dump de spec, pas de sections exhaustives « Pourquoi / Règles / À reviewer ».
  Pas de tiret cadratin `—` en milieu de phrase (marqueur IA).
- **`--body-file <fichier>` toujours** : le `--body -` de `gh` ne lit pas stdin
  et écrit littéralement « - ».
- **Fork** : la PR cible le **parent**, base `main` :

  ```bash
  gh repo view <owner>/<repo> --json parent
  gh pr create --repo <parent> --base main --head <fork-owner>:<branch> \
    --draft --title "<titre FR>" --body-file <fichier>
  ```

  Si le repo n'a pas de parent, il **est** l'upstream.
- **WIP / lot multi-itérations → `--draft`.**

## F. Force-push

- `git push --force` **interdit**. `--force-with-lease` seulement sur demande
  explicite (revert d'un commit local, rebase / squash demandé), jamais par
  défaut. `--force-with-lease` refuse de pousser si le remote a bougé depuis le
  dernier fetch — c'est le garde-fou anti-écrasement.

## G. Worktrees

Pas de worktree auto sans demande explicite.

## H. Mode manual (index)

En politique **manual**, ne **jamais** `git add` de contenu ni `git reset` /
`git restore` sur l'index : le hook `git-add-empty` pose déjà les intent-to-add
(` A`) pour rendre les nouveaux fichiers visibles au diff sans les stager.
Laisser le dev stager et reviewer lui-même.

## Anti-patterns (❌ / ✅)

- ❌ Lire `origin/main` sans fetch → conclure « retrieve pas mergé » (faux) →
  poser une mauvaise question au dev.
  ✅ `git fetch` d'abord → le commit `024ef9a … (#158)` est visible → agir.

- ❌ `git branch -r --contains <sha>` seul pour « est-ce mergé ? » : rate les
  squash-merges.
  ✅ + vérifier le fichier / la feature réellement présents sur `origin/main`.

- ❌ Créer une branche depuis un local en retard.
  ✅ `git switch -c <x> origin/main` après fetch.

- ❌ Référence cross-repo partielle dans un body de PR (`#55`, « la PR contract »).
  ✅ Toujours la forme complète **`owner/repo#N`** — un `#N` seul est ambigu
  hors du repo courant.

- ❌ Déclarer l'état d'une PR dépendance de mémoire de session (« elle est
  mergée »).
  ✅ Vérifier au moment T par `gh pr view <owner/repo#N>` — une PR a pu merger ou
  être fermée depuis.

### Exemple canonique — description de PR (incident PR #160)

❌ Avant (écrit par Claude, trop bavard) :

```md
- Submit valide → POST `CreatePaymentInformationRequest` vers individual.contract.service, PRG vers l'étape origine des fonds.
- Endpoints POST contract-first (dépendance : PR #55 individual.contract.service). Sauvegarde idempotente (delete-then-insert côté serveur).
- Bump `individual-contract-service-contracts` : requests structure pro par typologie (Spirica / Swisslife).
- Périmètre : ELV + SPK. SWL (type de compte + structure) à l'itération suivante.
```

✅ Après (corrigé par Fabien) :

```md
- Submit valide → POST `CreatePaymentInformationRequest` vers individual.contract.service, redirection vers l'étape origine des fonds.
- Bump `individual-contract-service-contracts`
- Périmètre : ELV + SPK. SWL (type de compte + structure) à l'itération suivante.
```

Règles illustrées : dépendance résolue → bullet **supprimée** (pas corrigée) ;
détails d'implémentation de l'**autre** repo → supprimés ; détail devinable
depuis le diff → supprimé (`Bump X` seul suffit) ; jargon (PRG) → mot simple.

## Pratiques git (distillat formation)

Enseignements les plus précieux / non-évidents. Notes complètes (concepts, clean,
debug, emergency, practices, remote) : **`references/formation-git.md`**.

- **Règle d'or, non négociable** : ne jamais réécrire un historique déjà
  poussé/partagé (`rebase`, `commit --amend`, `reset --hard`, `push --force`).
  Sur du poussé, corriger par un **nouveau commit** ou `git revert`.
- **`push --force` interdit** ; exclusivement `git push --force-with-lease`, qui
  refuse d'écraser si le distant a bougé depuis le dernier fetch, et seulement
  sur ses propres branches de feature.
- **Filet de sécurité universel = `git reflog`** : trace tout mouvement de HEAD
  (reset/rebase/checkout), local, gardé ~90 j. Après un `reset --hard` ou un
  rebase raté, retrouver le SHA d'avant via `reflog` puis `git reset <sha>`.
- **Les 3 modes de `reset`** : `--soft` (garde index+WD, pour regrouper des
  commits), `--mixed`/défaut (désindexe, garde WD), `--hard` (⚠️ détruit
  index+WD). Ne jamais dégainer `--hard` sur du travail non committé à l'aveugle.
- **`git bisect`** localise un commit fautif en O(log₂ n) : `bisect start` /
  `bad` (=HEAD) / `good <sha>`, tester chaque checkout, répondre `good|bad|skip`,
  finir par `reset`.
- **Commits atomiques via `git add -p` / `commit -p`** (hunk par hunk) : un sujet
  par commit → log lisible, cherry-pick propre, moins de conflits hors-sujet.
- **Piège staging** : `commit` ne prend que ce qui est dans l'index ; une modif
  faite après `git add` n'est pas committée sans re-`add`.
- **`cherry-pick` ne rapporte pas l'historique** du commit source → risque de
  conflits/doublons au merge ultérieur.
- **Fast-forward vs true merge** : `--ff-only` garantit l'absence de merge commit
  (échoue si divergence), `--no-ff` force la trace de la feature, `--squash`
  aplatit en perdant l'historique détaillé. Choisir consciemment.
- **`git switch` / `git restore` remplacent `git checkout`** (Git ≥ 2.23) :
  `switch` pour naviguer entre branches, `restore` pour restaurer du contenu.
- **Les hooks ne se clonent/pushent pas** : un hook local (pre-commit,
  commit-msg) n'est jamais transmis ; pas de garantie partagée sans `core.hooksPath`.
- **Submodules / subtrees : à éviter** au profit d'un gestionnaire de paquets ;
  si imposé, cloner avec `--recurse-submodules`, pousser avec
  `--recurse-submodules=check` pour ne pas laisser de référence cassée.
