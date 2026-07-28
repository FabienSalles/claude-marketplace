# Corrections à faire sur `goal-auto.js`

Ce que l'audit du 2026-07-28 a trouvé sur le harness refactoré, et comment le corriger. Le rapport
complet, avec le corpus de comparaison et les citations vérifiées, est dans
`plugins/self-audit/audits/workflow-corpus-gap-analysis.md`.

Toutes les lignes citées sont celles de `workflows/goal-auto.js` à 813 lignes, vérifiées verbatim.

## Vue d'ensemble

| # | Correction | Axe | Origine | Coût |
|---|---|---|---|---|
| 1 | Le brief nomme l'arbre, et le run refuse un mauvais cwd | écriture | **refactor** | ~20 l. |
| 2 | `gh pr ready` reçoit son dépôt et sa PR | écriture | **refactor** | 2 l. |
| 3 | `.claude/goal-runs/` ancré sur le dépôt principal | état | **refactor** | ~5 l. |
| 4 | Un throw libère le verrou | robustesse | v1 | ~10 l. + indentation |
| 5 | `exitCode -1` devient une pause, jamais un halt | verdict | v1 | ~8 l. |
| 6 | Un constructeur de rapport unique | maintenabilité | v1 + refactor | ~25 l., −40 l. |
| 7 | Deux phrases d'en-tête à réécrire | doc | refactor | 2 commentaires |
| 8 | Le plancher de tokens dit qu'il est inerte | bornes | v1 | 3 l. |
| 9 | Décision : garde-t-on les lentilles et le canal label ? | produit | v1 | −130 l. si non |
| 10 | Reliquats : titre de PR, taxonomie transitoire, plafond, parsings | divers | v1 | ~30 l. |

Les corrections 1, 2 et 3 sont des dettes créées par le refactor `goal-single-run`. Les autres
préexistaient. **Les trois premières auraient été trouvées par un seul lancement de bout en bout**,
ce que `why-not-parallel.md:169` reconnaît n'avoir jamais eu lieu.

---

## 1. Le brief ne nomme pas l'arbre dans lequel il écrit

### Le défaut

`why-not-parallel.md:74-77` diagnostique la perte du 27/07 :

> The **implementer**, which is the only thing that writes, was told nothing at all: its brief never
> mentioned the worktree, and neither did its agent definition.

Le brief est inchangé. `l.84` commence par :

```js
`Implement iteration ${iteration} of the locked plan ${PLAN}.`,
```

et rien dans `brief()` (l.82-102) ne nomme un répertoire, une branche ou un arbre.

Pire : `goal-launch.sh:38` construit le chemin du plan **en absolu, dans le checkout principal**, et
le launcher explique lui-même pourquoi (l.55-57) : `.claude/` est gitignored, donc absent du worktree
qu'il vient de créer. La première phrase que lit le seul agent qui écrit est donc un pointeur **hors**
de son arbre isolé.

### Pourquoi ça compte

Le refactor a supprimé le worktree du workflow pour que l'isolation devienne une propriété du
répertoire de lancement. C'est juste. Mais il a aussi supprimé le préfixe `cd` qui confinait les
commandes, sans rien mettre à la place. Il ne reste **aucun mécanisme** qui rende vrai « le gate juge
l'arbre dans lequel il se tient » : c'est devenu une hypothèse d'environnement que le script ne
vérifie pas et ne rapporte pas.

Le corpus montre le geste attendu. `jodex/story-ship-review-loop.js:183` ouvre le prompt de son agent
écrivain par `Worktree: ${worktreePath}`, et `:191` exige `Use absolute paths rooted at
${worktreePath}`.

### Le correctif

Deux moitiés. D'abord, apprendre où l'on est, une fois, au survey :

```js
// Le workflow n'a ni disque ni shell : la seule façon de savoir où il se tient est de demander.
const located = await runner(
  String.raw`printf '%s\t%s\n' "$(pwd)" "$(git rev-parse --abbrev-ref HEAD)"`,
  'locate',
  'Survey',
);

const [DIR, BRANCH] = located.output.trim().split('\t');
```

Puis refuser un run qui ne se tient pas là où il croit :

```js
const WORK_ID = PLAN.split('/').pop().replace(/-spec\.md$/, '');

if (BRANCH !== `feature/${WORK_ID}`) {
  await release();

  return {
    status: 'refused',
    plan: PLAN,
    landed: [],
    notAttempted: pending,
    detail: `This run stands on \`${BRANCH}\` in ${DIR}, and the plan ${PLAN} is delivered on \`feature/${WORK_ID}\`. It pushes the branch the checkout is on, so running it here would push the wrong one. Launch it with scripts/goal-launch.sh, which creates the worktree and the branch together.`,
  };
}
```

Enfin, le brief nomme l'arbre :

```js
const brief = (iteration) =>
  [
    `Implement iteration ${iteration} of the locked plan ${PLAN}.`,
    '',
    `You are working in ${DIR}, on branch ${BRANCH}. Every path you write is inside it. The plan is`,
    'given as an absolute path and lives outside this tree on purpose: read it there, write nowhere',
    'near it.',
    '',
    // … le reste inchangé
```

### Critère d'acceptation

Un run lancé depuis un checkout dont la branche ne correspond pas au plan refuse avant de prendre
quoi que ce soit, et le brief de l'implémenteur contient le chemin absolu de son arbre de travail.

### Note

`commands/auto.md` vérifie déjà la branche en préflight. Ce n'est pas un doublon inutile : la version
prose est exécutée par un modèle, celle-ci est un fait. C'est exactement le raisonnement que
`workflow-parity.md` applique déjà à la policy, tenue « held twice ».

---

## 2. `gh pr ready` infère le dépôt que le fichier interdit d'inférer

### Le défaut

```js
// l.790
const ready = shipping.pr ? await runner('gh pr ready', 'pr:ready', 'Ship') : undefined;
```

Ni `--repo`, ni sélecteur de PR. Contre `l.135` :

> The remote is declared in the plan and never inferred.

Et contre le message du commit `a7076ef`, écrit le même après-midi :

> It names both what the run pushes to and the repository the pull request opens on, **which is why
> gh is given `--repo` and the branch explicitly rather than left to infer either.**

Ce commit a bien ajouté `--repo "$repo"` à `gh pr create` et `gh pr edit` (l.227-228). Il a laissé le
troisième appel nu, et c'est **la dernière écriture du run**.

### Pourquoi ça compte

C'est le scénario nommé dans le commit : sur un fork, `gh` cible le parent. `gh pr create` est
protégé, `gh pr ready` ne l'est pas. Le run peut donc marquer prête une PR sur le dépôt de quelqu'un
d'autre, à 3h du matin, comme dernier geste.

`sceneview/fix-issue-batch.js:276` fait l'opération inverse et nomme quand même les deux :
`gh pr ready ${fixRes.pr} --repo ${REPO} --undo`.

### Le correctif

Minimal, en réutilisant `repoOf()` déjà présent l.142 :

```js
const ready = shipping.pr
  ? await runner(
      `repo="$(${repoOf(REMOTE)})" && gh pr ready --repo "$repo" "${BRANCH}"`,
      'pr:ready',
      'Ship',
    )
  : undefined;
```

Plus solide, si on veut fermer le sujet : capturer le numéro de PR au moment du `create` (il est dans
l'URL que `gh` imprime, comme on le fait déjà pour l'id du commentaire de contrôle l.594) et le
passer ici. Ça évite de dépendre de la résolution par nom de branche.

### Critère d'acceptation

Aucun appel `gh` du fichier ne s'exécute sans `--repo`.

---

## 3. La mémoire inter-runs de l'auditeur est structurellement morte

### Le défaut

```js
// l.386
`Audit the run that just ended on plan ${PLAN} and write its report to .claude/goal-runs/${sha}.md.`,
// l.394
'Read the reports already in .claude/goal-runs/ and say which failures recur across runs rather',
```

Chemin relatif, donc résolu contre le cwd de l'agent, donc contre le **worktree**. `.claude/` est
gitignored (`.gitignore:1`), donc absent de tout worktree fraîchement créé — le launcher le dit
lui-même l.55-57.

### Pourquoi ça compte

Deux conséquences, et la seconde est pire que la première.

1. **La lecture est vide.** Tout run lancé par `goal-launch.sh` lit un répertoire inexistant et
   répond « quelles pannes récurrent entre runs » sur un échantillon de un. C'est la seule
   justification de l'étape.
2. **L'écriture est jetable.** Le rapport atterrit dans le `.claude/` du worktree, gitignored, qui
   disparaît quand le worktree est supprimé. La mémoire ne se lit pas et **ne s'écrit nulle part de
   durable**.

`coinbase/cds:17` ancre son fichier d'état inter-runs sur une racine absolue précisément pour que le
cwd ne décide pas si la mémoire existe.

### Le correctif

`git rev-parse --git-common-dir` renvoie le `.git` du dépôt **principal**, même depuis un worktree.
Son parent est donc toujours le checkout principal, dans les deux cas :

```js
// Le répertoire des rapports appartient au dépôt, pas au worktree du run : `--git-common-dir`
// pointe le .git principal depuis n'importe quel worktree, et son parent est le seul endroit où
// `.claude/` existe réellement.
const RUNS = (
  await runner('cd "$(dirname "$(git rev-parse --git-common-dir)")" && pwd', 'runs-dir', 'Survey')
).output.trim();
```

puis dans `audit()` :

```js
`Audit the run that just ended on plan ${PLAN} and write its report to ${RUNS}/.claude/goal-runs/${sha}.md.`,
…
`Read the reports already in ${RUNS}/.claude/goal-runs/ and say which failures recur across runs rather`,
```

et le repli l.402 avec le même chemin.

### Critère d'acceptation

Deux runs successifs lancés depuis deux worktrees différents écrivent dans le même répertoire, et le
second lit le rapport du premier.

---

## 4. Un throw laisse le verrou pris

### Le défaut

Le fichier contient **exactement deux** occurrences de `try`/`catch`, l.39 et l.41, autour du
`JSON.parse` des args. Aucun `agent()`, `parallel()` ou `runner()` n'est protégé.

`release()` (l.470) n'est atteint que sur sept retours explicites. Un throw d'agent laisse
`<plan>.run.lock` pris, et il bloque **tous les runs suivants**, y compris la reprise de celui-là.

### Pourquoi ça compte

C'est le *Known gap n°1* de `workflow-parity.md`, décrit comme « un process crashé ». L'audit le
précise : un simple throw suffit, ce qui est bien plus fréquent. Et depuis la suppression des tracks,
**le verrou est la seule exclusion inter-runs qui reste**.

`grove/wfl-run-sprint.js:169-172` fait le teardown-sur-throw en six lignes.

### Le correctif

Rendre `release()` idempotent, puis envelopper le corps du run :

```js
let released = false;

const release = async () => {
  if (released) {
    return;
  }

  released = true;

  return runner(`${GATE} unlock ${PLAN}`, 'unlock', 'Iterate');
};
```

```js
const lock = await runner(`${GATE} lock ${PLAN}`, 'lock', 'Survey');

// Le verrou n'est pas pris sur ce chemin : c'est le seul qui ne doit pas le rendre.
if (lock.exitCode !== 0) {
  return { status: 'refused', plan: PLAN, landed: [], notAttempted: [], detail: lock.output };
}

try {
  // … tout le reste du fichier, `return` compris
} finally {
  await release();
}
```

Les `await release()` explicites peuvent rester : l'idempotence les rend inoffensifs, et les
supprimer d'un coup est un diff plus risqué que l'ajout du `finally`.

**Coût réel :** l'indentation de ~330 lignes. C'est ce qui rend ce correctif plus cher qu'il n'en a
l'air, et c'est la seule raison de ne pas le faire en premier.

### Critère d'acceptation

Un agent qui throw au milieu de la boucle laisse le verrou rendu. Testable en injectant un `GATE`
qui n'existe pas.

---

## 5. Un agent muet est rapporté comme un refus du gate

### Le défaut

```js
// l.79
return result ?? { exitCode: -1, output: `The runner returned nothing for: ${command}` };
```

```js
// l.699-700
if (gate.exitCode !== 0) {
  stopped = { status: 'halted', iteration, outcome: 'the gate refused it', from: index + 1, detail: gate.output };
}
```

`grep '=== -1'` sur le fichier : **zéro occurrence**. Le `-1` fabriqué traverse sans branche et
devient « le gate a refusé ».

### Pourquoi ça compte

Le run halte, poste sur l'issue que le gate a refusé, n'attaque aucune itération suivante — alors que
le gate n'a peut-être jamais tourné. C'est un mensonge adressé à quelqu'un qui dort, sur le seul
canal dont il dispose.

La même branche absorbe aujourd'hui trois choses différentes : un test rouge, un binaire manquant, et
un agent mort. `Synto:189` maintient un bit `infra` distinct exactement pour ça.

### Le correctif

```js
if (gate.exitCode === -1) {
  stopped = {
    status: 'paused',
    iteration,
    outcome: 'the gate could not be run',
    from: index + 1,
    detail: `The runner that should have replayed the gate for iteration ${iteration} returned nothing, so no verdict exists: the gate may never have run. The tree holds whatever the implementer wrote and nothing was committed. Review it, then relaunch — the plan's checkboxes resume here.\n\n${gate.output}`,
  };
} else if (gate.exitCode !== 0) {
  stopped = { status: 'halted', iteration, outcome: 'the gate refused it', from: index + 1, detail: gate.output };
}
```

`from: index + 1` est volontaire et cohérent avec le cas « l'implémenteur n'a rien rendu » (l.684) :
l'itération a bien été tentée, elle n'est simplement pas jugée.

### Critère d'acceptation

Le statut `halted` n'est produit que par une sortie non nulle **et** non `-1`. Un `paused` n'est jamais
présenté comme un refus.

### Ce que ce correctif n'est PAS

Ce n'est pas une boucle de réparation. Le corpus en est plein (`Apologue/fix-until-green.js` en 97
lignes), et **il ne faut pas la porter** : « un halt est final » est un choix assumé, et un agent qui
répare ce que personne n'a regardé est précisément ce que le harness refuse. Seule la *classification*
change.

---

## 6. Un constructeur de rapport unique

### Le défaut

Huit objets de retour construits à la main : l.482, 491, 501, 515, 525, 716, 770, 799. `pushed` y
apparaît sous trois formes : `report.push = { pushed, detail }` (l.735), `report.push = await
pushBranch(REMOTE)` qui rend `{ pushed, scanned, detail }` (l.738 via l.163), et `pushed:
shipping.pushed` à plat (l.805).

Et depuis le refactor, **aucun de ces objets ne nomme la branche, le répertoire ni le sha** — alors
que l'identité du run est devenue son répertoire. Le code de tracks supprimé retournait
`worktree: … ? undefined : dir` ; ce champ est parti et rien ne l'a remplacé.

Un run halté dit à l'humain (l.246) :

> The working tree of the halted iteration is left exactly as the implementer left it, on the machine
> that ran it.

sans dire **de quel arbre** il parle, ce qui est précisément l'information dont il a besoin maintenant
qu'il peut y en avoir plusieurs.

### Le correctif

Un helper, défini après `landed` et `record`, portant ce qui est vrai de tout run :

```js
const outcome = (fields) => ({
  plan: PLAN,
  dir: DIR,
  branch: BRANCH,
  landed,
  notAttempted: [],
  pushed: shipping.pushed,
  pr: shipping.pr,
  detail: shipping.blocked ?? shipping.prError ?? '',
  ...fields,
});
```

Les refus antérieurs à la boucle (verrou, survey, `check`, hash, remote) n'ont ni `landed` ni
`shipping` : ils gardent un second helper, plus pauvre :

```js
const refusal = (detail, notAttempted = []) => ({
  status: 'refused', plan: PLAN, dir: DIR, branch: BRANCH, landed: [], notAttempted, detail,
});
```

C'est la seule contrainte d'ordre du correctif, et elle est réelle : deux helpers plutôt qu'un, parce
que le run n'a pas le même état avant et après la boucle.

> `Synto:680` — `function planResult(plan, branch, worktreePath, fields) {`, un helper unique pour
> 1036 lignes et une dizaine de retours anticipés.

### Critère d'acceptation

Tout `return` du fichier passe par l'un des deux helpers, et tout rapport porte `dir`, `branch` et le
sha du commit de tête.

---

## 7. Deux phrases qui décrivent mal du code correct

### `l.104-106`

```js
// The run is write-only towards GitHub: it posts, and it never reads a title, a body or a
// comment.
```

Le code lit bien un corps de commentaire, l.435 :

```js
`gh api repos/:owner/:repo/issues/comments/${panel} --jq .body …`
```

C'est **son propre** commentaire, adressé par l'id que `gh` a imprimé en le postant, et la sortie est
réduite par `grep` à trois verbes avant qu'un modèle la voie. Le design est juste, c'est même le
meilleur du fichier. C'est la **phrase** qui est fausse, et elle énonce l'invariant le plus important
du harness.

Remplacement proposé :

```js
// The run is write-only towards GitHub with one exception it authored itself: it posts, and the
// only thing it ever reads back is the control panel comment it wrote, by the id gh printed. Not a
// title, not a body it did not write, not somebody else's comment. That read is reduced to three
// verbs by grep in the shell before any model sees it.
```

### `l.1-4`

```js
// … It never implements, never commits and never ticks …
```

Le fichier pilote `${GATE} commit` (l.692), `git push` (l.161), `gh pr create` (l.227) et
`gh pr ready` (l.790). L'intention — il ne commit pas *lui-même*, il appelle le gate qui vérifie
d'abord — est juste ; la formulation ne la porte pas. Une reformulation en « no write to the tree and
no commit happens except through the gate, which verifies first » suffit.

### Pourquoi ça compte

C'est notre version, bénigne, du deuxième anti-pattern le plus fréquent du corpus : la garantie qui
n'existe qu'en prose. Chez `refresh-repo-map.js:74` (« Do NOT commit anything ») c'est un prompt qui
remplace un mécanisme ; ici c'est un commentaire qui décrit mal un mécanisme correct. Moins grave, et
à corriger quand même : un lecteur qui vérifie l'invariant trouve une contradiction et perd confiance
dans le reste.

---

## 8. Le plancher de tokens est silencieusement inerte

### Le défaut

```js
// l.662
if (budget.total && budget.remaining() < ITERATION_FLOOR) {
```

`budget.total` vaut `null` quand aucune directive de budget n'a été donnée, c'est-à-dire par défaut.
Le garde-fou ne s'arme donc que si on le demande explicitement, et rien ne le dit.

Aggravant : `budget` est **la seule primitive du runtime dont nous sommes l'unique utilisateur sur les
21 fichiers audités**. Une primitive que personne n'exerce est celle dont une régression passe
inaperçue.

### Le correctif

Le garde doit rester — sans `budget.total`, `remaining()` vaut `Infinity` et la comparaison serait
inutile. Ce qui manque, c'est de le dire :

```js
if (!budget.total) {
  log('No token target for this run, so the iteration floor is inert: nothing will pause the run before the plan ends.');
}
```

### Critère d'acceptation

Un run sans budget déclaré l'annonce dans son journal.

---

## 9. Décision produit : les lentilles et le canal label

Ce n'est pas un correctif, c'est un arbitrage. Les deux blocs pèsent ~130 lignes.

**Les lentilles (l.264-369, ~106 lignes).** Trois faits, tous dans le fichier :

- `l.261-263` concède que la fiabilité mesurée d'un juge LLM est faible ;
- `l.795` les désactive par défaut (`input.lenses === true`) ;
- `l.790-794` les fait tourner **après** `gh pr ready`.

Elles ne peuvent donc, par construction, modifier aucune issue de run. C'est assumé et documenté
(« a lens never blocks »), mais le coût est de ~106 lignes pour un commentaire sur une PR déjà prête.

**Le canal label (l.435, première commande de `readControls`).** Tier 0 lit les labels `goal:*`, tier
1 lit le panneau de cases que le run a écrit lui-même. Les deux portent **le même vocabulaire de trois
verbes**. Le tier 1 est plus sûr (l'id du commentaire vient de l'URL que `gh` a imprimée, donc rien
d'autre n'est jamais lu) et plus expressif. Le tier 0 n'apporte que la possibilité de piloter sans que
le run ait démarré.

**Si les deux sautent :** −130 lignes, et rien qui puisse changer l'issue d'un run. Le budget libéré
paie les corrections 1 à 6.

**Si on les garde :** ajouter le plafond de concurrence de la correction 10, parce qu'un plan de 15
itérations dispatche ~77 agents de lentille en une fois (l.352, aucun `BATCH` dans le fichier).

---

## 10. Les reliquats

Petits, tous hérités, aucun bloquant.

**Le titre de PR n'a pas de test de forme.** `l.180` `const quoted = (text) => text.replace(/'/g, '').trim();`
mutile au lieu de valider, puis `l.227` l'interpole entre apostrophes. Le remote (l.546), la base de PR
(l.561) et l'issue (l.568) reçoivent chacun un test par regex : le titre est le seul qui n'en a pas.
Le correctif est une regex de forme et un refus, comme les trois autres.

**Aucune taxonomie transitoire vs refus, au-delà du `-1`.** La correction 5 traite l'agent muet. Reste
le cas d'un gate qui sort non nul parce qu'un binaire manque. Le distinguer demande une convention de
code de sortie côté `goal-gate.ts` (par exemple 3 = l'environnement, 1 = le code), donc une décision
sur le gate avant une ligne de workflow. À traiter séparément.

**Plafond de concurrence sur les lentilles.** Voir la correction 9 : le point disparaît si les
lentilles sautent.

**Deux parsings positionnels.** `l.193-194` lit `lines[0]` / `lines[1]` dans la sortie concaténée de
trois `sed` ; `l.310` déstructure cinq champs tabulés. Un plan sans `Delivery mode:` décale
silencieusement le titre de PR et la sélection des lentilles. Le correctif est de préfixer chaque
ligne par sa clé et de lire par clé, comme `parseFacts` le fait déjà à moitié avec son préfixe
`facts\t`.

**Reliquat de formatage.** Double ligne vide l.484-485, laissée par la suppression des tracks.

---

## Ce qui n'est pas à corriger

Six choses que l'audit valide explicitement, et que le corpus rend visibles par contraste.

- **Le verdict est un code de sortie**, pas un schéma rempli par un agent. 1/21 dans le corpus, et
  l'anti-pattern le plus fréquent des 20 autres est son inverse : un verdict typé puis ignoré
  (`feature-pipeline.js:83`, `review-plan.js:253`, `FrontAgent:137`). Un schéma n'est pas un gate.
- **Le texte non fiable est réduit à un vocabulaire fermé** avant qu'un modèle le voie. 21/21 des
  fichiers du corpus lisent du texte de tiers ; 1/21 le filtre.
- **Un halt est final.** Voir la correction 5.
- **Aucun merge automatique.** 3/21 mergent sans humain.
- **Le hash du plan épinglé une fois.** Personne dans le corpus n'épingle le contrat qu'il exécute.
- **`gate check` rejoué sur toutes les itérations avant la première implémentation.** Personne dans le
  corpus ne valide sa liste de travail avant de la commencer. C'est la ligne la moins chère du fichier
  par token économisé.

Et le refactor lui-même : l'argument de `why-not-parallel.md` tient, l'audit le confirme, et il a fait
disparaître notre dépendance la plus exotique du corpus (`workflow()` ré-entrant, 4/21).

---

## Ordre recommandé

1. **Correction 2** (`gh pr ready --repo`) : deux lignes, et c'est la dernière écriture du run.
2. **Correction 5** (`-1` devient une pause) : huit lignes, et ça arrête de mentir à quelqu'un qui dort.
3. **Correction 3** (`.claude/goal-runs/` ancré) : sinon l'auditeur est décoratif.
4. **Correction 1** (nommer l'arbre, refuser un mauvais cwd) : la thèse du refactor, impayée.
5. **Correction 9** (arbitrage lentilles / label) : à trancher avant la 6, parce qu'elle change ce que
   le constructeur de rapport doit porter.
6. **Correction 6** (constructeur unique) : dépend de 1 pour `dir` et `branch`.
7. **Correction 4** (`try`/`finally`) : le plus cher en diff, à faire seul.
8. **Corrections 7, 8, 10** : au fil de l'eau.

Et le préalable qui vaut plus que la moitié de cette liste : **un lancement de bout en bout**. Les 87
tests prouvent que les conditionnelles de mode ont disparu ; aucun ne prouve que le run marche.
