---
name: pr-creation
description: ACTIVATE when opening a GitHub pull request, writing a PR title or description, or running `gh pr create`. ACTIVATE for 'create PR', 'ouvrir une PR', 'initie ma PR', 'gh pr create', 'PR description', 'titre de PR', 'PR body'. Covers Fabien's PR conventions — update on main BEFORE opening, English conventional commit message, French PR title, ultra-succinct description (only the non-guessable), draft for WIP, no AI trailer, fork base repo. DO NOT use for general commit-message style unrelated to PRs, or git rebase mechanics.
version: 1.0.0
---

# PR creation — conventions Fabien

Règles pour créer / mettre à jour une pull request. À appliquer **par défaut**, sans
les redemander.

## 1. Se mettre à jour avec `main` AVANT d'ouvrir la PR

Jamais de PR depuis une branche en retard. Avant `gh pr create` :

```bash
git fetch upstream main            # 'upstream' = repo parent (voir §5 pour un fork)
git rebase --onto upstream/main <base-commit>   # ou: git rebase upstream/main
```

Rebase (histoire linéaire), pas merge. Sur une branche feature, en refinement
itératif explicite, `git push --force-with-lease` est autorisé.

## 2. Message de commit → **anglais**, conventional commits, SANS trailer IA

- Anglais, format `type(scope): summary`.
- **Jamais** de `Co-Authored-By: Claude` ni « Generated with… ». Le commit est
  attribué au dev seul.
- Choisir le type sur le changement le plus significatif : un changement de
  comportement observable est `feat`/`fix`, **pas** `refactor` — même si le diff
  est majoritairement du restructuring. `refactor` = ni bug fixé ni comportement
  changé.

## 3. Titre de PR → **français**

Préfixe conventionnel conservé, résumé en français. Concis, pas de ref ticket
sauf demande.

```
feat(payment-information): découpe des modes de paiement par typologie d'offre
```

## 4. Description → **ultra-succincte**, seulement le non-devinable

Le style de Fabien est minimaliste : souvent 1-2 lignes ou un simple screenshot.
Ne PAS déverser le spec, ne PAS décrire l'intégralité du travail.

- Quelques bullet points max, chacun sur **ce qui ne se devine pas** depuis le
  titre / le diff (décisions, comportement par cas, ce qui est volontairement
  hors périmètre).
- Pas de sections « Pourquoi / Règles métier / À reviewer » exhaustives.
- Pas de tiret cadratin `—` en milieu de phrase (marqueur IA).
- WIP / lot multi-itérations → **draft** (`--draft`).

Exemple (bon niveau de détail) :

```md
- Rendu de l'étape choisi par typologie d'offre (résolu sur `offerCode`), et non plus par le seul statut TNS.
- ELV (`assvie_spk`) : compte bancaire seul, corrige la fuite des blocs « choix du compte » / « structure ».
- SPK (`perin_spk`) : comportement inchangé, gaté à l'offre.
```

Passer la description via `--body-file <fichier>` (le `--body -` de `gh` ne lit
pas stdin et écrit littéralement « - »).

## 5. Repo de base sur un fork

Si le remote est un fork, la PR cible le **parent**, base `main` :

```bash
gh repo view <owner>/<repo> --json parent   # trouver le parent
gh pr create --repo <parent> --base main --head <fork-owner>:<branch> \
  --draft --title "<titre FR>" --body-file <fichier>
```

## 6. Mode manual (politique commit/PR)

En manual, ne **jamais** `git add` de contenu ni `git reset`/`git restore` sur
l'index : le hook `git-add-empty` pose déjà les intent-to-add (` A`) pour rendre
les nouveaux fichiers visibles au diff sans les stager. Laisser le dev stager et
reviewer lui-même.
