# Audit thématique — Méta-tooling et ergonomie du pack

> Vérifié contre `main` à jour le 2026-08-20 (section 6 réancrée).

**Date :** 2026-08-20 · **Lentille :** [`usage-profile.md`](../usage-profile.md) · **Cibles :** 11 clones frais
**Périmètre :** architecture des skills, descriptions/déclencheurs, progressive disclosure, structure plugin/marketplace, distribution, hooks, doc, self-audit, évals.

## 1. Verdict

Sur la **gouvernance** (CI structurelle, parité manifeste, registre d'audits, divergences assumées écrites), ce marketplace est au-dessus de tout le corpus : aucune cible n'a l'équivalent, et 4 des 11 n'ont même pas de workflow CI.
Sur la **mécanique du skill lui-même**, il est en retard : SKILL.md médian 116 lignes contre 32 chez `ai-driven-dev`, 0,41 fichier `references/` par skill contre 5,5, **zéro eval** sur 103 skills, et 3 descriptions au-dessus du plafond de 1024 caractères que sa propre skill `npx-skills-conventions` documente.
La doc, elle, a été recalée depuis : le README racine annonce désormais 2 761 lignes / 444 tests, et `check-doc-counts.sh plugins/goal` passe.

## 2. Ce que je fais MIEUX

1. **CI structurelle réelle, unique dans le corpus.** `.github/workflows/validate.yml:53-72` compare `name`/`version`/`description` entre `marketplace.json` et chaque `plugin.json` (0 dérive constatée sur 29 plugins), `:110-120` exécute `claude plugin validate` sur la racine puis sur chaque plugin. `anthropics_skills/`, `obra_superpowers/` et `FlorianBruniaux_claude-code-plugins/` n'ont **aucun** `.github/workflows/`. ✅
2. **Désambiguïsation de routage entre skills.** 69/103 descriptions portent un `DO NOT use for: … (see plugin:skill)`, et `scripts/validate-skills.sh:78-104` résout chaque pointeur `see …` contre l'arborescence réelle (pointeur mort = build rouge). Aucune cible ne fait ça : `obra_superpowers/skills/writing-skills/SKILL.md:199` s'arrête à « Keyword Coverage ». ✅
3. **Registre d'audits versionné + verdicts « skip » assumés.** `plugins/self-audit/commands/compare.md:107-120` — 12 lignes datées avec tier et statut, dont 4 `skip intégral`. Un pack qui documente ce qu'il a refusé d'importer est un objet que je n'ai trouvé nulle part ailleurs. ✅
4. **Une lentille de priorisation explicite.** `usage-profile.md:8-21` fait dépendre P1/P2/P3 de frictions mesurées (`/insights`, 131 sessions), pas de l'attrait de la feature. C'est ce qui rend les « skip » défendables. ✅
5. **Distribution double sans divergence de source.** Même arbre servi par `/plugin marketplace add` et par `npx skills add` (README.md:12), contre `SuperClaude-Org` qui impose un `install.sh` + `PLUGIN_INSTALL.md` séparés, ou `ruvnet_claude-flow` qui éclate 176 SKILL.md sur 40 `plugin.json`. ✅

## 3. Ce que je fais MOINS BIEN

1. **Progressive disclosure quasi absente.** 42 fichiers `references/` pour 103 skills (0,41/skill). `ai-driven-dev_framework` : 116 `references/` + 142 `actions/` pour 47 skills (5,5/skill), avec un SKILL.md réduit à un routeur — `plugins/aidd-orchestrator/skills/02-backlog/SKILL.md:9-40` tient en un mermaid + une table de 8 actions, 48 lignes, et dit ligne 29 « Read only the next action file ». Mon médian est 116 lignes, mon p90 333, et `plugins/goal/skills/plan/SKILL.md` fait **930 lignes** chargées d'un bloc. ✅
2. **Zéro eval sur 103 skills.** Aucun fichier `evals.json` n'existe dans le dépôt. `anthropics_skills/skills/skill-creator/` livre le schéma (`references/schemas.md:9-33`), le runner (`scripts/run_eval.py`), l'agrégation (`scripts/aggregate_benchmark.py`) et un optimiseur de description (`scripts/improve_description.py`) ; `obra_superpowers/skills/writing-skills/testing-skills-with-subagents.md:9-11` pose le protocole RED/GREEN (« If you didn't watch an agent fail without the skill, you don't know if the skill prevents the right failures »). Rien de tout ça ici. ✅
3. **Mes descriptions violent ma propre spec.** `plugins/tooling/skills/npx-skills-conventions/SKILL.md:18` déclare `description` ≤ 1024 caractères et « no angle brackets ». Or : `plugins/git/skills/git/SKILL.md:3` = 1 243 car., `symfony/symfony-frontend` = 1 116, `frontend/frontend-best-practices` = 1 057 ; et 10 SKILL.md contiennent `<` ou `>` dans la description. `validate-skills.sh` ne teste ni la longueur ni les chevrons. ✅
4. **Le pattern `Covers: …` est un anti-pattern documenté.** `obra_superpowers/skills/writing-skills/SKILL.md:152-156` rapporte une mesure : quand la description résume le workflow, l'agent **suit la description au lieu de lire la skill** (un review au lieu de deux). Mes descriptions font médian 491 caractères précisément parce qu'elles résument le contenu. C'est un risque de déclenchement dégradé, pas seulement du bruit. 🔎 (pas re-mesuré chez moi)
5. **Aucun signal de cycle de vie sur une skill.** `mattpocock_skills/skills/` range les skills en `engineering/`, `productivity/`, `in-progress/`, `deprecated/`, `misc/` — le lecteur sait d'un coup d'œil ce qui est mûr. Ici les 103 skills sont au même niveau de confiance déclarée, y compris celles jamais réutilisées. ✅

## 4. Gaps

### P1

| Gap | Fichier cible | Critère d'acceptation | Conf. |
|---|---|---|---|
| Descriptions hors spec non détectées | `scripts/validate-skills.sh` | Le script échoue si une `description` dépasse 1024 caractères ou contient `<`/`>` ; les 3 descriptions actuellement > 1024 sont réécrites sous le plafond. | ✅ |
| Le README racine porte des chiffres non couverts par la CI | `.github/workflows/validate.yml` (step ligne 80) + `scripts/check-doc-counts.sh` | Les chiffres du README racine sont désormais justes (2 761 / 444), mais aucun script ne les vérifie : `check-doc-counts.sh` doit couvrir aussi le `README.md` racine pour que la correction tienne. | ✅ |

### P2

| Gap | Fichier cible | Critère d'acceptation | Conf. |
|---|---|---|---|
| Pas d'eval, donc pas de preuve de déclenchement | `plugins/tooling/skills/npx-skills-conventions/` + un `evals/evals.json` par skill à fort trafic | Le schéma `evals.json` d'Anthropic (`skill_name`, `prompt`, `expectations`) est documenté dans la skill, et au moins les 5 skills les plus chargées (`git`, `goal:plan`, `craft:tdd-workflow-principles`, `php-code-conventions`, `product:vertical-slice`) ont un `evals/evals.json` exécutable. | ✅ |
| SKILL.md monolithiques | `plugins/goal/skills/plan/SKILL.md` (930 l.), `marketing-distribution/social-content` (463), `marketing-strategy/marketing-psychology` (453), `marketing-ideas` (419) | Chacune passe sous 250 lignes, le reste déplacé en `references/` chargées à la demande, avec une table de routage en tête façon `aidd .../02-backlog/SKILL.md:31-40`. | ✅ |
| 11 plugins échappent au contrôle de compteur | `scripts/validate-skills.sh:113-119` + les READMEs concernés | Le script échoue si un plugin possédant ≥1 skill n'a pas de titre `## Skills (N)` ; les 11 plugins listés en §6 sont mis en conformité. | ✅ |
| Clé `version:` non spec dans les frontmatters | tous les `SKILL.md` | Soit `version` passe sous `metadata.version` (accepté par `anthropics_skills/.../quick_validate.py:47`), soit `npx-skills-conventions:24-26` documente le choix **sans** l'attribuer à un template Anthropic qui ne la contient pas. | ✅ |

### P3

| Gap | Fichier cible | Critère d'acceptation | Conf. |
|---|---|---|---|
| Pas de glossaire de domaine du pack | `CONTEXT.md` racine | Un glossaire façon `mattpocock_skills/CONTEXT.md` fixe le vocabulaire transverse (skill / plugin / pack / overlay / gate / slice) et liste les ambiguïtés résolues. | 🔎 |
| Pas de signal de maturité par skill | `CONTRIBUTING.md` + frontmatter | Une convention (bucket de dossier ou `metadata.status`) distingue mûr / expérimental / déprécié. | 🔎 |
| `improve_description.py` non porté | `plugins/tooling/skills/npx-skills-conventions/` | Une procédure d'optimisation de description mesurée (A/B sur prompts de déclenchement) est décrite, même sans script. | 🔎 |

## 5. Divergences ASSUMÉES — ne pas « corriger »

- **Pas de runtime lourd.** Aucun serveur MCP, aucune persona, aucun `install.sh`. `SuperClaude-Org` (61 commandes, 42 agents, 8 skills) et `ruvnet_claude-flow` (40 `plugin.json`, crates Rust) sont l'inverse ; `usage-profile.md:13` refuse explicitement ce qui ajoute de la surface.
- **Skills >> commandes.** 103 skills pour 9 commandes. `github_spec-kit` (36 commandes, 0 skill), `eyaltoledano_claude-task-master` (47 commandes, 0 skill) et `buildermethods_agent-os` (0 skill) misent sur l'invocation explicite. Le déclenchement automatique par description est le choix ici.
- **Descriptions longues et directives.** Le format `ACTIVATE … Covers … DO NOT use for` (93/103) est verbeux face au `Use when …` d'Anthropic, mais c'est ce qui arbitre entre 103 skills dont beaucoup sont quasi-homonymes (`php-refactoring` / `ts-refactoring` / `refactoring-principles`). Le §3.4 vise le segment `Covers:`, pas le `DO NOT use for:`.
- **Aucune automatisation git dans le tooling.** `compare.md:16` verrouille la commande en lecture seule. Conforme à `usage-profile.md:15-17`.
- **Une seule langue par artefact, français pour les audits.** Les rapports `audits/*.md` sont en français ; les artefacts forge restent en anglais. Choix, pas incohérence.

## 6. Dérives de doc constatées (exhaustif)

1. **Registre et README à jour.** `plugins/self-audit/README.md` liste les **six** `theme-*.md` et les **11** cibles ; le registre `commands/compare.md:121-126` porte les **six** lignes `theme-*`. Dérive fermée par la présente PR.
2. **`plugins/tooling/skills/npx-skills-conventions/SKILL.md:24`** — « Anthropic's own template ships it » (à propos de `version:`) est faux sur le clone frais : `anthropics_skills/template/SKILL.md:1-4` ne contient que `name` et `description`, et `skills/skill-creator/scripts/quick_validate.py:47` rejette `version` comme clé inattendue.
3. **Contrainte documentée non tenue** — `npx-skills-conventions:18` fixe `description` ≤ 1024 caractères : violée par **3** skills sur 103 — `git/skills/git` (1 243), `symfony/symfony-frontend` (1 116), `frontend/frontend-best-practices` (1 057). Re-mesuré le 2026-08-20.
4. **Contrainte documentée non tenue (bis)** — même ligne, « no angle brackets » : **10** SKILL.md en contiennent (`frontend-clean-architecture`, `goal:supervise`, `php-8-1`, `php-code-conventions`, `php-test-conventions`, `prg-pattern`, `symfony-frontend`, `symfony-test-conventions`, `ts-functional`, `vitest-test-conventions`). Re-mesuré le 2026-08-20.
5. **`CONTRIBUTING.md:58`** — « Keep the `## Skills (N)` count in sync … it's a convention readers rely on ». **11 plugins** n'ont pas ce titre et sont donc silencieusement sautés par `validate-skills.sh:116-119` : `audit`, `craft`, `goal`, `mac`, `pocock`, `product`, `superpowers` (titre absent) et `marketing-analytics`, `marketing-content`, `marketing-distribution`, `marketing-strategy` (`## Skills` sans compteur). `security-runtime`, `self-audit`, `statusline` n'ont pas de skill — cas légitime.
6. **`plugins/self-audit/README.md:30` et `commands/compare.md:83-92`** décrivent un template canonique à **8 sections** ; les audits thématiques en produisent 6 sans que la doc l'autorise. À trancher : soit un second template déclaré, soit alignement.
7. **`scripts/check-doc-counts.sh`** échoue avec un message brut (`usage: check-doc-counts.sh <root>`) quand on l'appelle sans argument depuis la racine, alors que `health-check.sh` et `validate-skills.sh` s'exécutent sans argument. Incohérence d'ergonomie entre les trois scripts documentés côte à côte.

**Fermées en amont depuis la rédaction** (retirées de cette liste) : la table « Reports produced so far » du README de `self-audit` (elle liste désormais les 11 cibles et les 6 thèmes) ; la phrase « across all six » ; les compteurs du `README.md` racine (2 761 / 444, `check-doc-counts.sh plugins/goal` vert) ; le lien mort `plugins/common/README.md:25` (pointe maintenant `../goal/skills/spec/SKILL.md`) ; l'écart catalogue racine ↔ `marketplace.json` (29 = 29).
