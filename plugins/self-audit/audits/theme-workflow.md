# Audit thématique — workflow spec → plan → exécution

> Vérifié contre `main` à jour le 2026-08-20 (section 6 réancrée).

**Date :** 2026-08-20. **Référentiel :** `plugins/goal` (+ `product`, `pocock`, `common`).
**Cibles relues sur clones frais :** spec-kit (`ead30d9`, 2026-08-20), BMAD (`67d876f`, 2026-08-19),
mattpocock (`885e2ca`, 2026-08-19), anthropics/skills (`0a64e39`, 2026-08-18), claude-flow
(`fa13ee4`, 2026-08-15), AIDD (`33a1d31`, 2026-08-14), superpowers (`b36e082`, 2026-08-12),
SuperClaude (`10be750`, 2026-07-21), Bruniaux (`78a3a27`, 2026-06-04), agent-os (`cae8e66`,
2026-05-05), task-master (`c0c98d3`, 2026-04-23).
**Lentille :** `plugins/self-audit/usage-profile.md`.

---

## 1. Verdict

Sur la **vérification** — juge programme, bite check, plan empreinté, plafond de diff numérique — je
suis devant les onze cibles sans exception : aucune ne fait dépendre son verdict d'un code de sortie
qu'un modèle ne peut pas réécrire. Sur le **cycle de vie d'un run** — fusible, forensique après halt,
mémoire entre tentatives — je suis derrière superpowers et BMAD, qui ont tous deux le compteur de
boucle et l'état terminal que je n'ai pas. Et **rien de mécanique ne lit mon plan avant qu'il gèle** :
c'est le seul gap qui morde directement sur la friction n°1 du profil d'usage.

---

## 2. Ce que je fais MIEUX

1. **Le juge est un programme, et il est le seul committeur.** `src/gate/scope.ts:143` et `:149` sont
   les deux **seules** occurrences de `git('add', …)` et `git('commit', …)` dans tout `src/` +
   `scripts/` (vérifié par grep). **Battus :** spec-kit, dont le gate d'implémentation compte des
   `- [ ]` dans `checklists/*` et demande à l'humain « proceed anyway ? »
   (`templates/commands/implement.md:79-84`) ; et BMAD, dont le verdict est une triage LLM
   (`src/bmm-skills/ship/bmad-build/step-04-review.md:31-45`). Chez eux le modèle remplit un schéma ;
   ici il ne touche jamais l'index.

2. **Le bite check — le test doit avoir été rouge.** `src/gate/bite.ts:53` met l'implémentation de côté
   depuis HEAD, rejoue `gate1`, et refuse la tranche si la commande passe quand même.
   **Battu :** BMAD, qui est le plus proche du corpus avec son Matrix Test Audit
   (`step-03-implement.md:45-47`, « exists but was skipped/filtered/unregistered counts as missing ») —
   mais c'est un modèle qui lit une matrice, pas un processus qui rejoue une commande. Les dix autres
   n'ont rien : elles acceptent un diff quand la suite est verte.

3. **Le gel du plan est une empreinte, pas une phrase.** `src/plan-guard.ts:52-55` hache chaque ligne
   `gateN=`/`dodN=` plus la vacuité de `test_files` par bloc ; `scripts/goal-run.ts:99-107` refuse
   l'itération dont le gate ne publie pas de `plan_hash`. **Battu :** BMAD gèle avec une balise XML
   `<frozen-after-approval>` (`spec-template.md:15-42`) que seul un modèle lit ; AIDD interdit à
   l'exécuteur d'éditer le plan en prose (`plugins/aidd-dev/agents/executor.md:22`) ; SuperClaude n'a
   aucune notion de plan verrouillé. Une prose est une intention, un hash est un mécanisme.

4. **Des bornes numériques et un refus qu'aucune déclaration ne lève.** `max_diff` par tranche
   (aucune des onze cibles ne borne la taille d'un changement), et `src/core/rules/never.ts:10-16`
   refuse `.env`, `node_modules/`, clés et keystores **avant** le scope check, quoi qu'en dise le bloc
   `gate`. **Battu :** le `file-guard.sh` de Bruniaux (`plugins/pr-workflow/hooks/hooks.json:3-24`) est
   un hook de patterns que la config peut desserrer.

5. **Trois niveaux distincts, avec une règle de retour.** `/goal:tickets` coupe le chantier en laissant
   les tickets non-élaborés à dessein (`skills/tickets/SKILL.md:16-22`), `/goal:spec` ferme le
   fonctionnel, et `/goal:plan` refuse d'improviser : « un trou fonctionnel est une faute de spec »
   (`skills/plan/SKILL.md:194-204`). **Battu :** `wayfinder` de mattpocock
   (`skills/engineering/wayfinder/SKILL.md:19-25`) est le seul niveau-chantier comparable du corpus et
   n'a pas de chemin de retour ; spec-kit et agent-os confondent le fonctionnel et le technique dans un
   seul `spec.md`.

---

## 3. Ce que je fais MOINS BIEN

1. **Aucun fusible sur la session d'implémenteur.** `src/run/iteration.ts:79-97` lance `claude -p` avec
   pour seule contrainte `ceiling()` (un `ulimit -u`), **sans `timeout`**, et la boucle de reprise
   (`:126-144`) ne compte que les échecs quota. **Chez la cible :** superpowers plafonne la boucle de
   correction à 5 rounds avec adjudication obligatoire au plafond
   (`skills/subagent-driven-development/SKILL.md:411-429`) ; BMAD incrémente `review_loop_iteration`
   en frontmatter et HALT au-delà de 5 (`step-04-review.md:45`) ; Bruniaux cape à 3 tentatives
   (`plugins/pr-workflow/commands/plan-execute.md:80-87`). **Ça mord :** le mode `commit+pr` existe pour
   tourner la nuit ; une tranche impossible consomme la fenêtre d'usage entière sans que rien ne
   l'arrête.

2. **Un run halté n'écrit aucun rapport.** L'auditeur n'est invoqué que dans `close()`
   (`src/run/close.ts:209`), que `scripts/goal-run.ts:129` n'atteint jamais quand `runIteration` sort
   sur un refus. **Chez la cible :** `bmad-build-auto` écrit un statut terminal et sa condition
   bloquante **à chaque sortie**, dans la spec ou un `bmad-build-auto-result-*.md`
   (`src/bmm-skills/ship/bmad-build-auto/workflow.md:7-56`). **Ça mord :** le halt est exactement le cas
   où `/goal:supervise` doit classifier « plan fautif » vs « implémentation fautive »
   (`skills/supervise/SKILL.md:16-22`), et il n'a qu'un fichier log pour le faire.

3. **Rien de mécanique ne lit le plan avant qu'il gèle.** Le grill est humain, `grill-adversarial` est
   opt-in et humain aussi. **Chez la cible :** anthropics fait relire l'artefact par un sous-agent
   **sans contexte** et conditionne la sortie à sa capacité à répondre sans nouvelle lacune
   (`skills/doc-coauthoring/SKILL.md:255-277`, `:329-331`) ; superpowers écrit le plan explicitement
   « for a zero-context engineer » (`skills/writing-plans/SKILL.md:10-12`) mais se contente d'une
   auto-revue (`:141-151`). **Ça mord :** c'est la friction n°1 du profil — over-engineering — et un plan
   que personne ne réfute est exactement l'endroit où le scope creep est gelé avant d'être coûteux.

4. **La mémoire entre tentatives est une case à cocher.** Tout mon état de reprise tient dans le `- [x]`
   posé par `src/gate/scope.ts:158`. Un relaunch après halt ne sait pas ce qui a déjà été tenté.
   **Chez la cible :** BMAD écrit `baseline_commit` en frontmatter et ne l'écrase jamais à la reprise
   (`step-03-implement.md:21`), et tient un Spec Change Log append-only portant les instructions KEEP
   — ce qui a marché et doit survivre (`spec-template.md:63-73`) ; superpowers tient un ledger
   `progress.md` par plan, gitignored, dont chaque ligne `Ruling:` est rejouée à l'humain à la fin
   (`skills/subagent-driven-development/SKILL.md:141-152`, `:471-480`). **Ça mord :** la règle « un seul
   relaunch » de `/goal:supervise` est précisément le moment où cette mémoire paierait.

5. **`grill-adversarial` génère des trous et ne les réfute jamais.** La méthode s'arrête à
   l'énumération (`skills/grill-adversarial/SKILL.md:38-50`). **Chez la cible :** le
   `plan-challenger` de Bruniaux impose une seconde passe où **chaque** défi soulevé doit être réfuté —
   le plan le gère-t-il déjà ? le pattern existe-t-il dans le code ? l'échec est-il atteignable ? le
   risque est-il proportionné au coût du correctif ? (`plugins/pr-workflow/agents/plan-challenger.md:70-77`).
   **Ça mord :** sans cette moitié, un grill adversarial produit une liste de scénarios plausibles dont
   une partie deviendra des règles métier inutiles — c'est de l'over-engineering fabriqué en amont.

---

## 4. Gaps actionnables

### P1

| Gap | Fichier cible | Critère d'acceptation | Conf. |
|---|---|---|---|
| **Fusible sur l'implémenteur** | `obra_superpowers/skills/subagent-driven-development/SKILL.md:411-429` ; `bmad-code-org_BMAD-METHOD/src/bmm-skills/ship/bmad-build/step-04-review.md:45` | `src/run/iteration.ts` passe un `timeout` au spawn de l'implémenteur (variable d'env, défaut explicite) ; un dépassement est un halt nommé, pas un quota. Un test l'exerce contre le double de `CommandRunner`. | ✅ |
| **Rapport de halt** | `bmad-code-org_BMAD-METHOD/src/bmm-skills/ship/bmad-build-auto/workflow.md:7-56` | Tout chemin de sortie non-`LANDED` écrit sous `.claude/goal-runs/<work-id>/<run-id>/` un rapport nommant l'itération, la commande refusée, sa sortie et l'état de l'arbre. Le corpus de rapports cesse d'être « succès seulement » par construction. | 🔎 (bornes de lignes rapportées par l'explorateur, non relues ligne à ligne par moi) |
| **Relecteur sans contexte avant le gel** | `anthropics_skills/skills/doc-coauthoring/SKILL.md:255-277`, `:329-331` | Phase 4 de `/goal:plan`, avant `git checkout -b` : un sous-agent sans contexte reçoit le plan seul et doit énoncer, pour l'itération 1, ce qu'il ferait et ce qui lui manque. Toute lacune retourne au plan avant le lock. Opt-out explicite, comme l'est le grill adversarial. | ✅ |

### P2

| Gap | Fichier cible | Critère d'acceptation | Conf. |
|---|---|---|---|
| **Journal des tentatives, append-only** | `obra_superpowers/skills/subagent-driven-development/SKILL.md:141-152`, `:471-480` ; `BMAD/.../bmad-build/spec-template.md:63-73` | Chaque tentative refusée ajoute une ligne datée (itération, cause, ce qui doit survivre) dans le répertoire de run ; `/goal:supervise` la lit avant de classifier, et la rejoue à l'humain à l'arrêt. | ✅ |
| **Passe de réfutation dans `grill-adversarial`** | `FlorianBruniaux_claude-code-plugins/plugins/pr-workflow/agents/plan-challenger.md:70-77` | Une étape terminale : pour chaque trou généré, quatre tests (déjà couvert ? pattern existant ? atteignable ? coût proportionné ?). Ce qui survit devient une règle ; le reste est listé comme écarté, avec le motif. | ✅ |
| **Évaluer les skills de `goal`** | `anthropics_skills/skills/skill-creator/SKILL.md:308-314`, `:394` | `plugins/goal/evals/evals.json` existe (aujourd'hui seul `plugins/career/evals/evals.json` existe), avec un bras `without_skill` rejoué à chaque itération et une réserve held-out pour la description. Amplifie la force « méta-tooling » du profil. | ✅ |

### P3

- **Passe `converge` idempotente** — `github_spec-kit/templates/commands/converge.md:59-84` (ré-dérive ce
  qui n'est pas construit et **append** ; laisse `tasks.md` inchangé octet pour octet quand rien ne
  manque, `:84-86`). `/goal:next` réconcilie déjà plan↔code (`skills/next/SKILL.md:74-101`) ; ne reste
  que la garantie d'idempotence, marginale. Conf. ✅
- **Chaînage du handoff en frontmatter** — `github_spec-kit/templates/commands/specify.md:3-10`. Mes
  handoffs sont de la prose imprimée ; l'utilité est cosmétique tant que Claude Code n'enchaîne pas
  seul. Conf. ✅
- **Invariant « au moins une sous-tâche sans dépendance »** —
  `eyaltoledano_claude-task-master/scripts/modules/dependency-manager.js:1113`. Mes plans sont une liste
  plate sans graphe de dépendances ; l'invariant est déjà vrai par construction. Skip sauf si le split
  multi-plans gagne des `Trigger:` croisés. Conf. 🔎

---

## 5. Divergences ASSUMÉES — ne pas « corriger »

- **Pas d'auto-merge.** Bruniaux fait `gh pr merge --squash --delete-branch` sans étape humaine
  (`plugins/pr-workflow/commands/plan-execute.md:141-143`). C'est exactement ce que la friction n°2 du
  profil d'usage interdit. Superpowers est du bon côté : l'intégration est un menu humain de trois
  options (`skills/finishing-a-development-branch/SKILL.md:53-82`), et BMAD ne pousse jamais
  (`step-05-present.md:9`).
- **Pas de worktree automatique.** Bruniaux en crée un d'office (`plan-execute.md:25`), AIDD via un hook
  `WorktreeCreate` (`.claude/hooks/worktree-create.js:40`) ; superpowers exige le consentement
  (`skills/using-git-worktrees/SKILL.md:41-45`). Mon choix est le même, et `docs/open-questions.md:13-40`
  l'assume déjà comme question ouverte plutôt que comme dette — ne pas la refermer par imitation.
- **Pas de runtime lourd.** task-master (CLI + MCP), claude-flow (40 plugins, serveurs MCP propriétaires)
  et SuperClaude (Serena MCP déclaré « mandatory » dans `plugins/superclaude/commands/load.md:37` alors
  que le `.mcp.json` du plugin ne l'embarque pas) achètent leur persistance de session au prix d'une
  plateforme. Le disque et git suffisent.
- **Une question à la fois.** mattpocock interroge par « frontière » — toutes les décisions dont les
  prérequis sont réglés, en une salve numérotée (`skills/productivity/grilling/SKILL.md:6-18`). C'est
  défendable et c'est l'inverse de ma règle (`skills/spec/SKILL.md:159-166`). Le seul emprunt utile — la
  réponse recommandée jointe à chaque question — est déjà en place (`skills/spec/SKILL.md:147`).
- **Pas de parallélisme intra-plan.** `docs/why-not-parallel.md` ; le split produit plusieurs plans à
  fichiers prouvés disjoints (`skills/plan/SKILL.md:395-404`), pas un plan à branches.
- **`manual` par défaut, staging jamais automatisé** (`skills/next/SKILL.md:112-117`).

---

## 6. Dérives de doc constatées

1. **`plugins/self-audit/audits/workflow-corpus-gap-analysis.md` (v2, 2026-07-28) audite un fichier qui
   n'existe plus.** Tout le document porte sur `goal-auto.js` (813 lignes) et `goal-launch.sh` ;
   `plugins/goal/scripts/` ne contient que `goal-gate.ts` et `goal-run.ts`, et `grep -r goal-auto` sur le
   plugin ne retourne rien. Ses cinq items P1/P2 (brief qui ne nomme pas l'arbre, `gh pr ready` sans
   `--repo`, mémoire inter-runs morte…) sont inactionnables tels qu'écrits et doivent être re-mesurés ou
   archivés — plusieurs sont d'ailleurs devenus sans objet avec la suppression du worktree.

2. **Les audits par cible de `plugins/self-audit/audits/` sont datés 2026-07 et ratent la vague d'août.**
   Trois cas vérifiés : `spec-kit-gap-analysis.md` décrit un spine `specify → plan → tasks → implement`
   sans un mot de `converge` (`templates/commands/converge.md`) ni du moteur Python
   `src/specify_cli/workflows/` avec sa reprise par `runs/{id}/state.json` ; `bmad-method-gap-analysis.md`
   parle de « 56 skills organisés par phase » et ne mentionne ni `bmad-build`, ni le couple
   supervisé/`-auto`, ni la balise `<frozen-after-approval>` ; `aidd-framework-gap-analysis.md` annonce
   « 40 skills-routeurs » là où le README auto-synchronisé du clone frais en déclare 47
   (`README.md:14`, vérifié : 47 `SKILL.md`).

3. **Une note d'honnêteté, à conserver telle quelle :** `plugins/goal/README.md:193`, `:200`, `:202` marquent
   explicitement `/goal:supervise` « Never exercised by a real run », `plan-guard.ts` « Never run » et
   `goal-run-reviewer`/`goal-session-auditor` « Never fired ». Vérifié : `plan-guard.ts` n'est appelé par
   rien sous `src/` (seuls `tests/` et la prose de `skills/supervise/SKILL.md` le nomment). C'est le
   contraire d'une dérive, et c'est ce qui rend le reste du README crédible — les chiffres qu'il avance
   (1 641 lignes de runner, 54 fichiers de test) tombent juste au fichier près.
