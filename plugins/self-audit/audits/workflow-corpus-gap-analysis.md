# Audit — 20 predefined workflows publics vs `goal-auto.js`

**v2 — 2026-07-28, après le refactor `goal-single-run`.** Remplace la v1 du même jour, qui portait
sur la version 919 lignes à tracks parallèles.

> ⚠️ **Document historique.** Le sujet audité, `workflows/goal-auto.js`, a été **supprimé le
> 2026-08-06** (voir `BACKLOG.md` §Done). Le runner actuel est `plugins/goal/scripts/goal-run.ts` +
> `goal-gate.ts`. Les mesures ci-dessous décrivent un code qui n'existe plus ; les verdicts sur le
> **corpus externe** restent valides. Pour la lecture à jour, voir
> [`theme-workflow.md`](theme-workflow.md).

| | v1 | v2 |
|---|---|---|
| Notre fichier | 919 l., tracks parallèles | **813 l., un seul mode** |
| Agents | 22 (20 extractions + avocat + procureur) | 3 (avocat + régression + procureur), corpus inchangé |
| Tokens | 1 344 504 | 275 284 |
| Citations vérifiées | 35 exactes / 1 dérive / 0 absente | **30 exactes / 1 dérive / 0 absente** |

**Corpus :** 20 fichiers `.claude/workflows/*.js` publics, inchangés depuis la v1.
**Fiches brutes :** `workflow-corpus-fiches.json` (corpus v1 + notre fiche v1).

---

## 1. Verdict

**Le refactor est un gain net, l'argument de `docs/why-not-parallel.md` est solide, et le code n'a pas
encore rattrapé son propre document.**

Ce qui est acquis : le flag argument a disparu (neuf sites branchaient sur `DIR === undefined`),
`gate/tracks.ts` avec, et les 87 tests passent. Le fichier a perdu sa dépendance la plus exotique du
corpus — `workflow()` ré-entrant sur un `scriptPath` dérivé. Sur les axes A4 et A8, le progrès est
sans réserve.

Deux constats moins confortables.

**Les huit points de la v1 survivent tous les huit.** Un seul a perdu la moitié de son objet (les
tracks ayant disparu, `track.prepare` n'existe plus — mais le titre de PR reste mutilé au lieu d'être
validé). Le refactor a supprimé un mode d'exécution, il n'a corrigé aucun défaut relevé.

**Cinq dettes nouvelles, toutes créées par le refactor, et concentrées exactement là où le document
se déclare résolu.** `why-not-parallel.md` §2 identifie correctement le Symptôme 1 : *« isolation was
verbal, never structural »*, parce que l'implémenteur, seul à écrire, ne savait pas dans quel arbre il
se tenait. La réponse retenue est de supprimer le worktree. Mais **le brief de l'implémenteur est
inchangé au mot près** (l.84), et le launcher livré le même jour lui passe le plan en **absolu,
résolu dans le checkout principal** (`goal-launch.sh:38`, parce que `.claude/` est gitignored et
absent du worktree). La première phrase que lit le seul agent qui écrit est donc un pointeur **hors**
de son arbre isolé.

Le motif se répète sur les cinq : la responsabilité est passée du fichier au launcher, mais rien
n'a suivi. Le run ne sait plus où il est, ne le dit à personne, et ne peut pas vérifier qu'il y est.

---

## 2. La grille, 21 fichiers × 8 axes

Corpus inchangé. Seule notre ligne bouge. Colonnes : verdict · contexte · état (+R = reprise à froid)
· bornes · écriture (c=commit p=push P=PR M=merge) · confiance · robustesse · commentaires · testé.

| Fichier | A | l. | verdict | ctx | état | bornes | écrit | confiance | rob | com | test |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Synto/implement-plan | A | 1036 | schema | struct | commit **+R** | 8 | c p – M | brute | an | .14 | – |
| grove/wfl-run-sprint | A | 421 | schema | struct | external **+R** | 3 | – – – M | brute | an | .22 | – |
| OTGW/implement-next-task | A | 361 | schema | struct | commit **+R** | 4 | c p – – | brute | an | .14 | – |
| rulebook/feature-pipeline | A | 88 | schema | prose | memory | 0 | – – – – | brute | an | 0 | – |
| Picka/ticket-inner-loop | B | 321 | schema | struct | memory | 4 | – – – – | brute | an | .14 | – |
| jodex/story-ship-review-loop | B | 238 | schema | struct | memory | 3 | c – – – | brute | –n | .01 | – |
| Routerly/dev-loop | B | 221 | schema | struct | file | 4 | – – – – | brute | an | .02 | – |
| Apologue/fix-until-green | B | 97 | schema | struct | memory | 6 | – – – – | brute | an | .10 | – |
| salesforcedx/review-plan | C | 267 | schema | struct | none | 0 | c – – – | brute | an | .05 | – |
| sceneview/review-fanout | C | 202 | schema | struct | none | 3 | – – – – | brute | an | .13 | – |
| cord-api-v3/review-pr | C | 124 | schema | struct | none | 3 | – – – – | brute | an | .03 | – |
| code-dot-org/port-cucumber | D | 746 | schema | struct | commit | 5 | c – – – | brute | an | .06 | – |
| neon/docs-fact-conflicts | D | 362 | schema | struct | none | 4 | – – – – | brute | an | .25 | – |
| sceneview/fix-issue-batch | D | 315 | schema | struct | external | 4 | c p P **M** | brute | a– | .10 | – |
| reverselab/ctf-24h-fleet | D | 205 | **prose** | prose | memory | 4 | – – – – | brute | an | .08 | – |
| meow-rs/cleanup-issues-prs | D | 193 | schema | struct | none | 4 | – – – – | brute | –n | .01 | – |
| coinbase/code-connect-refresh | E | 1126 | schema | struct | file **+R** | 3 | – – – – | brute | –n | .03 | – |
| socket-cli/refresh-repo-map | E | 108 | schema | struct | none | 0 | – – – – | brute | an | .07 | – |
| tinyusb/validate | E | 100 | schema | struct | none | 5 | – – – – | brute | an | .01 | – |
| FrontAgent/oss-harness | E | 143 | schema | struct | none | 0 | – – – – | brute | –n | 0 | – |
| **goal-auto.js v1** | A | 919 | exitCode | struct | checkbox +R | 5 | c p P – | réduite | an | .11 | – |
| **goal-auto.js v2** | A | **813** | **exitCode** | struct | checkbox **+R** | 4 | c p P – | **réduite** | an | .11 | – |

Les faits structurants n'ont pas bougé :

1. **20/21 délèguent le verdict à un schéma rempli par un agent.** Nous sommes seuls sur `exitCode`.
2. **21/21 lisent du texte non fiable ; 1/21 le réduit** à un vocabulaire fermé avant qu'un modèle le
   voie.
3. **Reprise à froid : 5/21.**
4. **3/21 mergent sans humain.** Toujours pas nous.
5. **Tests : 0/21.** Les 87 tests du plugin couvrent le gate (7 fichiers) et le launcher (1). **Aucun
   n'exerce le workflow.**

---

## 3. Régression des huit points de la v1

Vérifié ligne à ligne sur le fichier courant. **8 survivent, 0 corrigé, 0 aggravé.**

| # | Point | Statut | Ancre courante |
|---|---|---|---|
| 1 | Aucun `try/catch` autour d'un `agent()` | **survit** | l.39/41 restent les deux seules occurrences ; `release()` l.470 n'est atteint que sur 7 retours explicites |
| 2 | `exitCode: -1` lu comme un refus du gate | **survit** | l.79 → l.700 `outcome: 'the gate refused it'` ; `grep '=== -1'` : **0 occurrence** |
| 3 | Chaîne du plan atteignant un shell sans test de forme | **survit à moitié** | `track.prepare` : **absent** (0 occurrence de `prepare`). Le titre : l.180 `replace(/'/g, '')` puis l.227 `--title '${facts.title}'` |
| 4 | Pas de taxonomie transitoire vs refus | **survit** | l.699-700 absorbe un test rouge, un binaire manquant et le `-1` fabriqué dans la même branche |
| 5 | Pas de constructeur de rapport | **survit** | 8 retours à la main ; `pushed` sous 3 formes (l.735, l.738→163, l.805) |
| 6 | Fan-out des lentilles sans plafond | **survit** | l.352 ; `grep BATCH` : **0 occurrence** |
| 7 | Aucune couture de test | **survit** | `grep dryRun` : **0 occurrence** ; `runner` l.66 ferme sur l'`agent` ambiant |
| 8 | Deux parsings positionnels | **survit** | l.193-194 et l.310 inchangés |

Le point 3 mérite une note : le refactor a **augmenté** l'incohérence qu'il dénonçait. Le remote
(l.546), la base de PR (l.561) et le numéro d'issue (l.568) reçoivent chacun un test de forme par
regex. Le titre de PR n'en a toujours pas.

---

## 4. Les cinq dettes du refactor

Toutes vérifiées verbatim des deux côtés, toutes marquées `isNew` par le procureur.

### P1 · Le brief ne nomme pas l'arbre — A5

`why-not-parallel.md:74-77` diagnostique la perte du 27/07 : *« The **implementer**, which is the only
thing that writes, was told nothing at all: its brief never mentioned the worktree »*. Vérifié : le
brief (l.82-102) ne nomme toujours **ni répertoire, ni branche, ni arbre**. Et `goal-launch.sh:38`
construit `plan_abs` dans le checkout principal — le commentaire l.55-57 du launcher dit lui-même
pourquoi : « `.claude/` is gitignored, so it does not exist inside the worktree that was just
created ».

Le mécanisme qui rendait vrai « le gate juge l'arbre dans lequel il se tient » est devenu une
hypothèse d'environnement que le script ne peut ni vérifier, ni rapporter.

> `jodex/story-ship-review-loop.js:183` — `Worktree: ${worktreePath}`
> `:191` — `Use absolute paths rooted at ${worktreePath}.`

jodex a gardé son worktree et dépense trois lignes à dire à son agent écrivain où il se tient. Nous
avons supprimé le worktree et dépensons zéro.

**Acceptation :** le brief nomme le répertoire de travail, et le run refuse de démarrer si son cwd
n'est pas l'arbre portant la branche qu'il poussera. Confiance ✅.

### P1 · `gh pr ready` infère le dépôt — A5

Vérifié : `l.790` — `const ready = shipping.pr ? await runner('gh pr ready', 'pr:ready', 'Ship') : undefined;`
Ni `--repo`, ni numéro de PR. À l.135 : *« The remote is declared in the plan and never inferred. »*

Ce n'est pas un héritage. Le message de `a7076ef`, le même jour, dit : *« which is why gh is given
`--repo` and the branch explicitly rather than left to infer either »*. Ce commit a bien ajouté
`--repo "$repo"` à `gh pr create` et `gh pr edit` (l.227-228). Il a laissé le troisième appel nu — et
c'est la **dernière écriture du run**.

> `sceneview/fix-issue-batch.js:276` — `gh pr ready ${fixRes.pr} --repo ${REPO} --undo`

**Acceptation :** `gh pr ready <n> --repo "$repo"`. Confiance ✅.

### P2 · La mémoire inter-runs est structurellement morte — A3

L'auditeur lit `.claude/goal-runs/` en relatif (l.394) et y écrit `<sha>.md` (l.386). Son cwd est le
worktree. `.claude/` est gitignored — vérifié, `.gitignore:1` — donc absent du worktree que le
launcher vient de créer.

Conséquence : tout run lancé par `goal-launch.sh` lit un répertoire vide et répond « ce qui récurre
entre runs » sur un échantillon de un.

**Et je vais plus loin que le procureur, c'est mon constat :** le rapport d'audit lui-même est écrit
dans le `.claude/` du worktree, donc dans un répertoire gitignored qui disparaît avec le worktree.
Non seulement la mémoire ne se lit pas, **elle ne s'écrit nulle part de durable**.

> `coinbase/cds:17` — `const PROGRESS_FILE = PROJECT_ROOT + '/.claude/code-connect-progress.json';`

**Acceptation :** le chemin des rapports est ancré sur la racine du dépôt principal, pas sur le cwd.
Confiance ✅.

### P2 · Le rapport ne nomme ni branche, ni répertoire, ni sha — A8

Vérifié l.799-807 : `done` porte `plan`, `landed`, `notAttempted`, `pushed`, `pr`, `ready`. Rien qui
identifie **où** ça s'est passé.

Le code de tracks supprimé retournait `worktree: report.status === 'done' ? undefined : dir`. Le seul
champ qui disait quel arbre avait été touché est parti avec les tracks, et rien ne l'a remplacé. Un
run halté dit à un humain « the working tree of the halted iteration is left exactly as the
implementer left it » (l.246) sans dire de quel arbre il parle — alors que c'est précisément
l'information dont il a besoin maintenant qu'il y en a plusieurs.

> `Synto:680` — `function planResult(plan, branch, worktreePath, fields) {`

**Acceptation :** un constructeur unique portant `branch`, `dir` et `sha`. Ferme aussi le point 5 de
la v1. Confiance ✅.

### P2 · La reprise promise est refusée par le launcher — A3

`l.668` promet : *« relaunch and the plan's checkboxes resume the run here »*.
`goal-launch.sh:44` : `[ -e "$tree" ] && die "a worktree already holds $work_id: $tree"`.

Le geste documenté meurt sur le worktree que le premier run a laissé. Reprendre demande de savoir
qu'il faut `cd` dans le worktree et relancer `claude` à la main — ce que le fichier qui fait la
promesse ne dit nulle part.

**Acceptation :** le message de pause donne le geste qui marche, ou le launcher réutilise un worktree
existant. Confiance ✅.

### Bonus · Le workflow n'a aucun préflight à lui — A7

Vérifié : son premier acte est `l.478` `${GATE} lock ${PLAN}`. Toutes les préconditions du nouveau
design mono-mode (être sur `feature/<work-id>`, se tenir dans un répertoire isolé, une base à jour)
vivent en prose dans `commands/auto.md`, exécutée par un modèle. Et `l.161` pousse `git push -u
${remote} HEAD` — **la branche sur laquelle le checkout se trouve**, quelle qu'elle soit.

Tant que les tracks existaient, le workflow créait ses branches lui-même. Il ne les crée plus, et il
n'a rien mis à la place.

---

## 5. Deux invariants énoncés que le code ne tient pas

Trouvés par l'agent qui remplissait la fiche, vérifiés.

**« it never reads a title, a body or a comment »** (l.104-106) contre
`gh api repos/:owner/:repo/issues/comments/${panel} --jq .body` (l.435). Le code lit bien un corps de
commentaire. C'est **son propre** commentaire, adressé par l'id que `gh` a imprimé, et la sortie est
réduite par `grep` avant tout modèle — le design est défendable et c'est le meilleur du fichier. Mais
la phrase qui l'énonce est fausse, et c'est l'invariant le plus important du harness. Il faut la
réécrire, pas changer le code.

**« never commits »** (l.1-4) alors que le fichier pilote `${GATE} commit` (l.692), `git push`
(l.161), `gh pr create` (l.227) et `gh pr ready` (l.790). L'intention est claire — il ne commit pas
*lui-même* — mais la formulation ne la porte pas.

---

## 6. Anti-patterns du corpus — inchangés depuis la v1

158 anti-patterns sur 20 fichiers. Sept motifs récurrents, dont trois valent d'être relus à la
lumière du refactor :

**1. Le verdict typé puis ignoré (≥ 6 fichiers).** `feature-pipeline.js:83` produit `passed` et
enchaîne inconditionnellement ; `review-plan.js:253` commit sur la seule présence d'un message ;
`FrontAgent:137` retourne `accept|revise` que rien ne lit. **Un schéma n'est pas un gate.**

**2. Texte non fiable interpolé brut dans un prompt (≥ 6 fichiers).** `cleanup-issues-prs.js:103`
colle un titre d'issue dans le prompt d'un agent qui exécute ensuite `gh issue close`.

**3. La garantie qui n'est que de la prose (≥ 5 fichiers).** `refresh-repo-map.js:74` « Do NOT commit
anything », `FrontAgent:110` « Do not edit files. » — aucune adossée à une restriction d'outil.
**C'est le motif dont la section 5 ci-dessus est notre propre version**, en plus bénin : chez nous
c'est un commentaire qui décrit mal du code correct, pas un prompt qui remplace un mécanisme.

Les quatre autres : chemin absolu machine-spécifique (4 fichiers), aucune borne (≥ 4), état en
mémoire seule (≥ 3), code mort livré (≥ 4).

---

## 7. La taille, après

813 lignes contre 220 de médiane. Le tri de la v1 tient, moins les tracks :

| Mécanisme | ~l. | Risque payé |
|---|---|---|
| Hash du plan épinglé une fois | 14 | **réel**, personne d'autre ne le fait |
| Plancher de tokens à la frontière | 12 | **réel** — mais inerte si `budget.total` est falsy (l.662) |
| Lecteur GitHub en quarantaine | 30 | **réel**, seul du corpus |
| `gate check` rejoué sur tout le reste avant la 1re implémentation | 10 | **réel**, la ligne la moins chère du fichier par token économisé |
| Miroir PR en draft dès la 1re itération | 130 | **réel** — halter est le cas attendu |
| Panneau de contrôle distant | 60 | **réel en tier 1** ; le canal label reste un doublon |
| Auditeur | 37 | **cassé** tant que le chemin est relatif (§4) |
| **Lentilles** | **106** | **imaginaire, de l'aveu du fichier** (l.261-263, off par défaut, après `gh pr ready`) |

Rien n'a changé sur les lentilles : ~106 lignes qui, par construction, ne peuvent modifier aucune
issue de run. Les couper libère de quoi payer les cinq dettes ci-dessus.

---

## 8. Divergences assumées — à ne PAS « corriger »

- **Le verdict est un code de sortie.** Seuls du corpus. C'est aussi ce qui rend le gate testable
  (7 fichiers de tests) là où le workflow ne l'est pas.
- **Un halt est final.** Le corpus répare en boucle. Seule la *taxonomie* transitoire/refus est à
  porter, jamais la boucle.
- **Write-only vers GitHub** (moyennant la reformulation de §5).
- **Aucun merge automatique.**
- **Le gate est un fichier séparé.**
- **Pas de parallélisme dans le workflow.** L'argument de `why-not-parallel.md` est validé par
  l'audit : le corpus confirme le précédent Airflow, et la seule ligne du corpus qui ré-entre dans
  son propre script (`ctf-24h-fleet`) le fait sur un *autre* workflow, pas sur elle-même.

---

## 9. Pérennité — une exposition en moins

Sur les 21 fichiers : `phase`/`agent` 21, `schema` 20, `args` 19, `log` 18, `parallel` 10,
`agentType` 10, `model` 7, `pipeline` 5, `effort` 5, `workflow()` 4, `budget` **1**.

**Bonne nouvelle du refactor : nous n'utilisons plus `workflow()`.** C'était notre usage le plus
exotique du corpus — un script se ré-appelant par un `scriptPath` dérivé d'un autre argument. Il est
parti avec les tracks, et avec lui le risque de rupture le plus concret.

Reste **`budget`, dont nous sommes le seul utilisateur des 21**. Le plancher de tokens repose
entièrement dessus, et une primitive que personne n'exerce est celle dont une régression passe
inaperçue. Aggravant : `l.662` rend le plancher **silencieusement inerte** quand `budget.total` est
falsy, ce qui est le cas par défaut hors directive de budget. La seule borne de coût du run ne
s'arme donc que si on la demande explicitement.

---

## 10. Checklist exécutable, dans l'ordre

Les deux premiers sont des dettes du refactor, pas des défauts hérités.

1. **Nommer l'arbre dans le brief de l'implémenteur**, et refuser un run dont le cwd n'est pas l'arbre
   portant la branche qu'il poussera. C'est la thèse même du refactor, impayée. **(P1, A5)**
2. **`gh pr ready <n> --repo "$repo"`.** Une ligne, et c'est la dernière écriture du run. **(P1, A5)**
3. **Ancrer `.claude/goal-runs/` sur la racine du dépôt principal.** Sinon l'auditeur est décoratif.
   **(P2, A3)**
4. **`try/catch` autour de la boucle** : un throw libère le verrou, qui est désormais la seule
   exclusion inter-runs qui reste. **(P1 v1, A7)**
5. **`exitCode === -1` devient un `paused`, jamais un `halted`.** **(P1 v1, A1)**
6. **Constructeur de rapport unique portant `branch`, `dir`, `sha`.** Ferme les points 4 et 5.
   **(P2, A8)**
7. **Réécrire les deux phrases de §5** pour qu'elles décrivent le code. Coût : deux commentaires.
8. **Décider** : garde-t-on les lentilles (~106 l.) et le canal label ? **(décision produit)**
9. Test de forme sur le titre de PR ; taxonomie transitoire/refus ; plafond sur les lentilles ; clés
   explicites au lieu des parsings positionnels. **(P2/P3)**
10. Couture de test / dry-run. **(P3 — 0/21 dans le corpus)**

Et le point que le document fait déjà lui-même, l.169 : *« /goal:auto has never run end to end on the
refactored harness. »* Les 87 tests prouvent que les conditionnelles de mode ont disparu ; aucun ne
prouve que le run marche. **Les cinq dettes de la §4 auraient toutes été trouvées par un seul
lancement de bout en bout**, et aucune n'est chère à corriger.

---

## Annexe

`workflow-corpus-fiches.json` — les 21 fiches structurées de la v1 (20 extractions du corpus + notre
fiche 919 l.) et le dossier à charge v1, tels que rendus par les agents avant vérification.
