# Git — distillat formation (day-1 concepts + day-2 pratiques)

## Concepts

### Modèle mental fondamental
- Git n'est PAS comme SVN/CVS : ne pas raisonner par analogie. Il stocke des
  **snapshots complets** de chaque version de fichier, pas des deltas (les deltas
  n'apparaissent qu'à l'empaquetage, cf. packfiles).
- Deux structures de données centrales :
  - **L'historique** = « le marbre ». Grand livre immuable de toutes les
    contributions, chacune indexée par son hash SHA1.
  - **L'index** (staging / cache) = « la pâte à modeler ». État mutable qui
    prépare la prochaine contribution. On modèle dans l'index, puis on grave
    dans l'historique avec `commit`.

### Les trois zones
- **Working directory / work tree** : les fichiers réels sur disque.
- **Index / staging area** (`.git/index`) : modifications préparées pour le
  prochain commit. L'ajout à l'index est **local, non-versionné, non-partagé,
  temporaire**.
- **Dépôt local** (`.git`) : l'historique gravé.
- `git status` = « le GPS du développeur » : untracked / modified / staged /
  cas spéciaux (both modified = conflit). Il donne aussi des consignes pour s'en
  sortir — les lire.

### Modèle objet (day-2 07)
Tout vit dans `.git/`. Quatre types d'objets dans `.git/objects`, indexés par
hash SHA1 de leur **contenu** (même contenu = même hash = déduplication) :
- **blob** : contenu brut d'un fichier. Ne stocke PAS le nom du fichier.
- **tree** : structure d'un répertoire — noms de fichiers, permissions (644/755),
  hash des blobs et sous-trees.
- **commit** : snapshot à un instant T. Pointe vers un tree + métadonnées
  (auteur, date, message) + hash du/des commit(s) parent(s).
- **tag** : pointeur permanent vers un commit précis.

### Refs et HEAD
- Une **référence** = une étiquette qui pointe vers un commit. Une branche n'est
  qu'une ref mouvante ; un tag une ref fixe.
- `.git/HEAD` : fichier texte indiquant la branche courante, ex. `ref: refs/heads/main`.
- `.git/refs/heads/main` : contient le SHA1 du dernier commit de `main`.
- `HEAD` = dernier commit de la branche courante. **HEAD détaché** = HEAD pointe
  directement un commit, hors de toute branche.

### Packfiles
- Problème : 100 modifs d'un fichier = 100 blobs complets.
- Solution : Git empaquette (`.git/objects/pack/*.pack`) une version complète +
  des **deltas**. Déclenché par `push`, `git gc`, `git repack`. Peut réduire le
  dépôt de ~90 %.

### Adressage des révisions (day-1 06)
- `HEAD^` = parent (avant-dernier). Attention : `^` est spécial sous Windows/PowerShell.
- `<sha>^^` = 2 commits avant ; `<sha>~3` = 3 commits avant.
- `HEAD@{5}` = état de HEAD il y a 5 mouvements ; `branche@{yesterday}` = état
  daté d'une branche.
- Intervalles : `A..` = de A à HEAD ; `A~5..A` ; `HEAD~5..`.

### Config en cascade (day-1 04)
- Trois niveaux, chacun **surcharge** le supérieur :
  `git config --system` (machine) < `--global` (utilisateur) < `--local`/`--edit` (projet).
- `user.name` / `user.email` définissent l'identité. **Piège** : changer d'email
  fait voir plusieurs auteurs distincts à Git ; incohérence d'historique.
- `.gitignore` : globs, `/dir/` pour un dossier entier, `!` pour ré-inclure.
  Bonne pratique : partir des templates github/gitignore + un excludesfile global
  (`git config --global core.excludesfile ~/.gitignore_global`) pour `.DS_Store` etc.

### Commandes de base non-évidentes (day-1 05)
- `git add -p` / `-i` : staging partiel/interactif, morceau par morceau.
- Piège staging : commit ne prend que ce qui est **dans l'index**. Si on modifie
  un fichier APRÈS `git add`, la 2ᵉ modif n'est pas committée sans re-`add`.
- `git rm --cached <file>` : retire de l'index seulement, garde le fichier sur disque.
- `git mv` = `mv` + `add` dest + `rm` source.
- `git reset HEAD <file>` : désindexe (sort du staging).

## Clean
Nettoyage de l'historique et du working tree. **Règle cardinale répétée :
ne JAMAIS modifier un historique déjà partagé/poussé.**

### Committer proprement
- `git add -p` / `git commit -p` : choisir hunk par hunk ce qui entre dans le
  commit → commits atomiques et thématiques.

### Amender
- `git commit --amend` : **remplace** le dernier commit (nouveau SHA). OK si non
  poussé. Sur du poussé = réécriture d'historique.

### `git reset` — 3 modes (déplace HEAD, agit sur les zones)
- `git reset --soft HEAD~3` : déplace HEAD seul. Index CONSERVÉ + WD CONSERVÉ.
  Usage : refaire/regrouper des commits.
- `git reset --mixed HEAD~3` (défaut) : HEAD + réinitialise l'index. WD CONSERVÉ.
  Usage : désindexer.
- `git reset --hard HEAD~3` : ⚠️ réinitialise index ET working directory.
  Usage : tout annuler. **Piège** : perte des modifs non committées. Filet de
  sécurité → `git reflog` pour récupérer le SHA d'avant.

### `git restore` (day-1 09, Git ≥ 2.23)
- Remplace `git checkout` pour restaurer du contenu (checkout était trop
  polymorphe : changeait de branche OU restaurait, d'où erreurs).
- `git restore <file>` : annule les modifs non-indexées (restaure depuis l'index).
- `git restore --source=HEAD~2 <file>` / `--source=<commit> <file>` : restaure
  depuis une révision précise.
- Astuce reset d'un dossier : `rm -Rf folder/. && git restore folder`.
  ⚠️ les fichiers non-suivis sont perdus.

### `git stash` (day-2 04)
- `git stash` / `git stash save <msg>` : met de côté les modifs en cours.
- `git stash list` / `show [<stash>]`.
- `git stash apply [<stash>]` (garde le stash) vs `git stash pop` (applique + supprime).
- `git stash branch <name> [<stash>]` : crée une branche depuis un stash.
- `git stash drop` / `git stash clear`.

### Rebase interactif — « l'artillerie lourde »
- `git rebase -i HEAD~5` : modifier, réordonner, découper (split), fusionner (squash) des commits.
- **Fixup / autosquash** (workflow propre) :
  ```bash
  git add .
  git commit --fixup <commit_hash>
  git rebase -i --autosquash <commit_hash>
  ```
  Config : `git config --global rebase.autosquash true`.
- Pull en rebasant : `git pull --rebase origin main` ≡ `git fetch` + `git rebase`.
  Config : `git config pull.rebase true`.

### Revert vs reset (dans un contexte clean)
- `git revert <commit>` : crée un **nouveau** commit inverse → garde la trace,
  sûr sur du partagé. À préférer à reset dès que c'est poussé.

## Debug
Mener l'enquête sur l'historique.

### `git blame`
- `git blame [-L 12,22] <file>` : identifie l'auteur/commit de la dernière modif
  de chaque ligne (limitable à une plage de lignes).

### `git bisect` — recherche dichotomique
- Localise le commit ayant introduit un bug en O(log₂ n) : 1000 commits → 10
  tests au pire.
  ```bash
  git bisect start
  git bisect bad              # sous-entendu HEAD (le mauvais)
  git bisect good <dernier commit OK>
  # à chaque checkout auto : tester puis git bisect good|bad|skip
  git bisect reset           # terminer
  ```
- `skip` quand un commit n'est pas testable.

### `git log` en mode recherche (day-1 06)
- `git log --grep=keyword -i -E` : filtre sur le message (`-i` casse, `-E` regex).
- `git log --author=Toto`, `--since="1 hour ago"`, `--graph`, `--format=oneline`.
- `git log -S<string>` / pickaxe : traquer quand une chaîne est apparue/disparue.
- `git log --merge -p <fichier>` : lors d'un conflit, détaille les commits
  non-partagés touchant le fichier planté.

### `git reflog`
- Trace TOUTES les actions déplaçant HEAD (reset, rebase, checkout, commit…).
- **Local uniquement**, conservé ~90 jours par défaut. C'est le filet de sécurité
  n°1 pour retrouver un commit « perdu ».

## Emergency
Récupérer après une bêtise.

### Récupérer un état perdu via reflog (day-2 04)
```bash
git reflog                       # repérer le SHA d'avant l'incident
git reset <sha>                  # y revenir
```
Fonctionne même après un `reset --hard` malencontreux.

### « J'ai oublié de faire une branche »
Une branche n'est qu'une étiquette → on peut brancher a posteriori :
```bash
git branch <nouvelle-branche>    # étiquette l'état courant
git reset --soft HEAD~2          # recule main de 2 commits (garde le travail)
git switch <nouvelle-branche>    # (ou checkout) le travail est sur la branche
```

### `git cherry-pick <commit>`
- Récupère UN commit d'une autre branche. **Piège** : ne récupère pas
  l'historique associé → risque de conflits/duplication lors d'un futur merge.

### `git revert <commit>`
- Crée un commit qui rétablit l'état précédent. `-n` (`--no-commit`) : prépare
  l'inverse sans committer, pour validation.
- **Revert vs reset — règle clé** : sur des commits DÉJÀ POUSSÉS, utiliser
  `revert` (append-only, sûr) et jamais `reset`/rebase (réécrit l'historique
  partagé).

### `git worktree`
- `git worktree add <path> [<branch>]` : plusieurs working trees pour un même
  dépôt (traiter une urgence sans stasher/changer de branche).
- `git worktree list` / `git worktree prune`.

## Practices
Bonnes/mauvaises pratiques (day-2 05).

### Pourquoi un historique propre
- Log lisible (thèmes regroupés, ordonnés), cherry-pick/merge d'intervalles
  continus facilité, moins de conflits hors-sujet, récupération de branches sans
  dépendances superflues.
- Causes du bazar : correctif en plusieurs fois, commits fourre-tout, sujets
  entrelacés, plusieurs sujets sur une même branche de feature. → Committer
  atomique et thématique (`add -p`).

### Conventional Commits
- Format : `<type>(<scope optionnel>): <description>`.
- Types : `feat`, `fix`, `ci`, `perf`, `refactor` (sans impact fonctionnel),
  `docs`, `test`, `chore` (build/outillage/config/libs).
- Ex. : `feat(backend): add user management`, `fix(release): depend on latest rxjs`.

### Workflows de branches
- **Git Flow** : `main` (=prod/release courante), `develop` (changements pas
  encore releasés), `feature/*` (depuis develop), `release/*` (depuis develop),
  `hotfix/*` (depuis main). Lourd mais structuré.
- **GitHub Flow** : une branche par sujet + PR, merge sur main, simple.
- **Trunk Based Development** : petites branches courtes / commits directs sur le
  trunk, intégration continue.

### Ship / Show / Ask (arbitrer la revue)
- **Ship** : commit direct sur main. Pour changements mineurs, correctifs,
  retours déjà connus — pas besoin de review.
- **Show** : branche + PR **non bloquante**. Montrer, ouvrir la discussion,
  s'appuyer sur la CI.
- **Ask** : PR **bloquante**. Quand on a besoin d'aide/conseil, des doutes, ou du
  travail non terminé.

### Nommage de branches
- Politique interne : contexte (`main`, `dev`, `hotfix`) + suffixe de jalon
  (`develop/1.2`, `hotfix/234` avec n° de ticket).
- En cas de doute, créer une branche. Supprimer via `git branch -d` (ou `-D` si
  non fusionnée).

### Hooks (day-2 07)
- Scripts déclenchés à des moments précis (pre-commit, commit-msg…), côté client
  ou serveur : lancer des tests, valider le format du message.
- **Piège** : les hooks NE sont PAS transmis au clone/push/pull → prévoir un
  mécanisme de partage (ex. outil type husky, `core.hooksPath`).

### Submodules & subtrees (day-2 08)
- Dépôts imbriqués. **Si vous pouvez éviter, évitez** — préférez un gestionnaire
  de paquets (npm/composer/pip).
- **Submodule** : dépôt complet référencé par un hash de commit (`.gitmodules`).
  2 historiques séparés, léger. Cloner : `git clone --recurse-submodules` (ou
  `git submodule init && update`). Pousser : `git push --recurse-submodules=check`
  (évite les refs cassées).
- **Subtree** : copie intégrée dans un seul historique. Transparent au clone,
  `git pull` suffit, mais plus lourd et contribution amont plus complexe.
- Reco : submodule pour dépendances externes stables ; subtree pour du code
  partagé que vous contrôlez.

## Remote
Fetch / pull / push / tracking + config serveur.
(NB : le fetch/pull/push est enseigné dans day-1 09 ; day-2 06 couvre la config serveur.)

### `git remote`
```bash
git remote add <name> <url>
git remote rename <old> <new>
git remote show <name>
git remote rm <name>
```
Git gère volontiers plusieurs remotes (droits différents, équipes, prestataires).

### `git fetch` — la seule opération qui exige le réseau
- Récupère les dernières révisions **sans altérer les branches locales**. Après,
  on peut travailler offline.
- `git fetch origin main` / `git fetch origin` / `git fetch` / `git fetch --all`.

### `git pull` = `fetch` + `merge`
- `git pull origin main`. Décomposable : `git fetch` puis `git merge`.
- Éviter le merge commit : `git pull --rebase` (config `pull.rebase true`).

### `git push`
- `git push` (selon `push.default`), `git push -u <remote> <branch>` (établit le
  **tracking** upstream).
- Renommage à la volée : `git push -u origin master:mymaster`.
- Supprimer une branche distante : `git push origin :branch-to-delete`.

### Force push
- `git push --force` : **strictement à proscrire** — écrase toujours le distant,
  détruit le travail des autres. Dernier recours seulement.
- `git push --force-with-lease` : n'écrase QUE si la branche locale est à jour
  avec le distant (refuse si quelqu'un a poussé entre-temps). Le bon outil pour
  republier une branche de feature rebasée/squashée.

### Protocoles
- **SSH** (port 22) : R/W sécurisé, le plus courant (`ssh://user@git-repo`).
- **Git** (port 9418) : consultation seule, **déprécié GitHub depuis 2022**.
- **HTTP(S)/FTP/Filesystem** : à éviter si l'implémentation (smart vs dumb) est
  incertaine.

### Config serveur (day-2 06)
- **Bare repository** = dépôt sans working directory, dédié au partage :
  `git init --bare` / `git clone --bare --shared`.
- Clés SSH : `ssh-keygen -t rsa -C "email"`, clé privée gardée secrète, clé
  publique ajoutée aux `authorized_keys` du serveur.
- Restreindre un compte au strict Git : login-shell = `git-shell`.

## Merge & Rebase (day-1 08 — socle pour clean/remote)

### Prérequis d'une bonne fusion
- Working tree propre (rien de modifié/indexé), commits atomiques, savoir si on
  est en situation de fast-forward.

### Fast-forward vs true merge
- **Fast-forward** : la cible n'a pas avancé → l'étiquette avance simplement,
  **pas de commit de merge**.
- **True merge** : la cible a divergé → commit de merge à 2 parents.
- `git merge --no-ff` : force un commit de merge (garde la trace de la feature).
- `git merge --ff-only` : échoue si divergence (garantit pas de merge commit).
- `git merge --squash` : écrase tous les commits en un seul, **perd l'historique
  détaillé**, sans commit de merge.
- **Sens** : on *merge* vers sa branche, on *rebase* vers une autre.

### Résolution de conflit
- `git status` + marqueurs `<<<< ==== >>>>` (mode diff3 ajoute `||||` la base).
- `git diff` / `git difftool` / `git mergetool` (à configurer) /
  `git log --merge -p <fichier>`.
- **Ne pas oublier `git add` après résolution**, puis conclure.

### Rebase
- `git rebase newbase [branch]` : rejoue les commits sur une nouvelle base →
  **nouveaux SHA** (D'/E'). Conflits potentiels à chaque commit rejoué (vs une
  seule fois en merge).
- `git rebase --continue` / `--abort` / `--skip`.
- **RÈGLE D'OR** 🚨 : ne jamais rebaser (ni amender, ni reset) des commits déjà
  poussés sur une branche partagée — ça crée des commits divergents et casse le
  dépôt des collègues.
