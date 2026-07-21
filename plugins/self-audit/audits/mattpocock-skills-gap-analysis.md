# État des lieux — marketplace Fabien vs `mattpocock/skills`

**Verdict (answer-first).** Rien à installer en bloc, mais **8 techniques ponctuelles à greffer**
sur des skills existants, dont **3 P1** qui ferment une friction connue. Le pack cible partage
exactement le problème que couvre déjà la famille `goal` + `grill` + `deep-review` + `craft`,
et Fabien en a **déjà vendored** le cœur (`pocock/grill-me`, `grill-with-docs`, `zoom-out`).
La cible n'apporte donc **aucune méthode nouvelle** — elle apporte des **heuristiques anti-sur-ingénierie
courtes et affûtées** que le marketplace n'a pas verbalisées. Aucun skill entier ne mérite un `keep` :
tout ce qui est structurant est soit déjà couvert, soit un choix de conception opposé (auto-commit,
DAG de tickets, sous-agents « design it twice »).

> **Convention de confiance :**
> - ✅ **vérifié** = citation re-greppée fichier-en-main pendant CETTE analyse (texte exact, ligne ±2).
> - 🔎 **à reconfirmer** = relevé par le fan-out mais pas re-greppé par le main-loop.

---

## Méthode & sources

- **Tier `deep`** : Workflow à 2 passes (116 agents, 0 erreur, ~5,7 M tokens).
  - Passe 1 (Compare) : 1 agent par skill du **main flow** (18 skills), lecture intégrale cible + équivalents marketplace, posture adversariale anti home-team, schéma JSON validé.
  - Passe 2 (Deep-dive) : 1 agent par force surfacée, extraction verbatim + verdict `CONFIRMED/REFUTED/ADJUSTED`.
- **Phase 2b (main-loop)** : re-grep indépendant des citations porteuses **et** de l'absence côté marketplace (deletion=0, tautolog=0, scope creep=0, plan-conformance=0, reset --hard bloqué=0, expand-contract=0). Toutes les forces cibles retenues sont ✅.
- **Transcript YouTube de Matt** utilisé comme lentille : il définit le « main flow » officiel
  (`grill-with-docs` → `prototype?` → `implement` **ou** `to-spec` → `to-tickets` → `implement` → `code-review`),
  la conscience du « smart zone » ~140 k tokens, la revue en sous-agents sur **deux axes** (spec vs standards),
  et l'issue-tracker/`triage`/docs de domaine. Cela a permis d'écarter le bruit (skills `in-progress`, `personal`, `deprecated`) et de concentrer l'audit sur les 22 skills « blessed » (`engineering` + `productivity`).
- **Périmètre cible** : le repo upstream ships **41 SKILL.md** (22 blessed). Les catégories `personal/`, `misc/` (hors git-guardrails), `deprecated/`, et la majorité de `in-progress/` sont hors-scope par nature (obsidian, édition d'articles, shoehorn, scaffolding d'exercices, writing-beats/fragments/shape).

---

## 1. Points forts validés — à PRÉSERVER

Là où le marketplace **bat** la cible (toutes citations ✅ re-greppées) :

| # | Force marketplace | Où | Face à la cible |
|---|---|---|---|
| 1 | Consentement git/commit explicite, défaut = **manual** | `goal/commands/run-issue.md` L227-228 ; `goal/commands/draft-issue.md` L9, L187 | `implement` finit sur « Commit your work to the current branch » **sans gate** ; `to-spec` auto-publie ET auto-applique un label triage sans demander. ✅ |
| 2 | Gate d'approbation avant tout code + cadence rouge/vert | `common/commands/feature-tdd-dev.md` L136 (« DO NOT START WITHOUT USER APPROVAL »), L148 | `tdd`/`implement` disent « /tdd where possible », aucun gate. ✅ |
| 3 | Spec = **contrat** avant code | `common/commands/spec-first-dev.md` L10, L153 (« implementation contract … update the spec FIRST ») | `to-spec` produit un artefact mais sans critères exécutables (Testing Decisions en prose). ✅ |
| 4 | Garde-fous debugging riches (rationalisations, red flags, escalade archi) | `superpowers/skills/systematic-debugging/SKILL.md` | `diagnosing-bugs` a **une** idée différenciante (cf. P2), mais moins de garde-fous autour. ✅ |
| 5 | Méta-review dédup + cap (Agent 3) | `common/commands/deep-review.md` | `code-review` garde 2 buckets non-fusionnés — choix opposé, pas supérieur (cf. §4). ✅ |

---

## 2. Manquements réels — BACKLOG

Priorité pondérée par `usage-profile.md` : **P1** (cheap + ferme une friction) · **P2** (valeur réelle, effort moyen) · **P3** (nice-to-have).

### P1-a — Axe « scope-creep / spec-conformance » dans `deep-review` ✅ **(convergence : = superpowers P2-a)**
- **Manque :** `deep-review` est côté producteur (bug/sécu/perf sur le diff seul). Il n'a **aucune** notion de spec d'origine, donc ne peut voir ni (a) une exigence omise en silence, ni surtout **(b) du comportement livré qui n'a pas été demandé** = sur-ingénierie. Or la sur-ingénierie est la **friction #1** de Fabien.
- **Preuve cible :** `code-review/SKILL.md` L72 — « (b) behaviour in the diff that wasn't asked for (scope creep); … Quote the spec line for each finding ». ✅
- **Preuve du trou :** grep `scope creep`/`plan-alignment` dans `deep-review.md` = **0**. ✅
- **Cible :** `common/commands/deep-review.md` — paramètre optionnel spec/issue (déductible des refs d'issue en message de commit, ou fourni) + une instruction reviewer qui rapporte (a) exigences manquantes/partielles et **(b) comportement non demandé**, en citant la ligne de spec.
- **Pourquoi P1 :** ferme friction #1 **et** deux audits indépendants (superpowers + celui-ci) pointent le **même fichier, même trou**. La moitié « scope creep » est la partie porteuse.
- **Acceptance :** avec une spec fournie, une omission silencieuse ET un ajout non demandé sont signalés, ligne de spec à l'appui. Ne PAS porter la baseline Fowler (couverte par `craft:refactoring-principles`/`code-style-principles`).

### P1-b — « Deletion test » dans `refactoring-principles` ✅
- **Manque :** aucun détecteur d'abstraction shallow. La friction #1 (over-engineering) réclame exactement ce jugement.
- **Preuve cible :** `codebase-design/SKILL.md` L63 — « The deletion test. Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep. » ; reformulé actionnable dans `improve-codebase-architecture/SKILL.md` L35. ✅
- **Preuve du trou :** grep `deletion` dans `refactoring-principles/SKILL.md` = **0**. ✅
- **Cible :** `craft/skills/refactoring-principles/SKILL.md` — une règle numérotée, langage-agnostique.
- **Effort :** ~2 lignes. **Acceptance :** le « deletion test » présent comme check anti-abstraction-inutile.

### P1-c — Anti-pattern « test tautologique » dans `testing-principles` ✅
- **Manque :** rien ne nomme l'assertion qui **recalcule** l'attendu comme le code (`expect(add(a,b)).toBe(a+b)`), donc passe par construction. Amplifie la force « gate = tests verts » (un test tautologique est un faux vert).
- **Preuve cible :** `tdd/SKILL.md` L29 — « Tautological — the assertion recomputes the expected value the way the code does … Expected values must come from an independent source of truth ». ✅
- **Preuve du trou :** grep `tautolog` dans `testing-principles/SKILL.md` = **0**. ✅ (complémentaire, pas doublon, de superpowers P1-a « mock hygiene »)
- **Cible :** `craft/skills/testing-principles/SKILL.md`, §2 « What NOT to Test » ou note anti-pattern.
- **Effort :** ~2 lignes. **Acceptance :** l'anti-pattern nommé + la règle « valeur attendue = source de vérité indépendante ».

### P2-a — Gate « boucle rouge AVANT toute hypothèse » dans `systematic-debugging` ✅
- **Manque :** `systematic-debugging` liste « Reproduce Consistently » comme une étape parmi d'autres ; il ne **bloque** jamais la formation d'hypothèse sur l'existence d'une commande rouge automatisée. La cible en fait le cœur du skill.
- **Preuve cible :** `diagnosing-bugs/SKILL.md` L60 — « If you catch yourself reading code to build a theory before this command exists, stop … No red-capable command, no Phase 2. » + critère de complétion L53 (« name one command … already run … paste the invocation and its output ») + « 3–5 ranked hypotheses » L84. ✅
- **Cible :** `superpowers/skills/systematic-debugging/SKILL.md` Phase 1 — greffer le gate + le critère « paste output ». Amplifie la force #2 de Fabien (root-cause + test de régression) et ferme la friction #3 (détours au lieu de reproduire).
- **Effort :** moyen. **Acceptance :** Phase 2 inatteignable sans une commande rouge déjà exécutée et son output collé.

### P2-b — Hook PreToolUse bloquant le git destructif (repris de `git-guardrails`) ✅
- **Manque :** aucun hook ne bloque `reset --hard`, `clean -fd/-f`, `branch -D`, `checkout .`/`restore .`. L'infra existe déjà (`common/hooks/` : `block-claude-coauthor.sh`, `git-add-empty.sh`, `warn-use-git-mv.sh`).
- **Preuve cible :** `git-guardrails-claude-code/scripts/block-dangerous-git.sh` L8 — tableau shell prêt à lever (`"git reset --hard"` …). ✅
- **Preuve du trou :** `reset --hard` bloqué nulle part dans `plugins/` = **0**. ✅
- **Cible :** nouveau `common/hooks/block-destructive-git.sh` câblé dans `common/hooks/hooks.json`, convention `{"decision":"block"}`.
- **Garde-fou impératif :** **OMETTRE** le pattern `git push` nu de la cible — le CLAUDE.md de Fabien déclare `git push` standard (y compris main sur repo solo) comme workflow normal. Ne garder QUE `--force`/`--force-with-lease`. Sinon le hook combat ses propres règles.
- **Pourquoi P2 et pas P1 :** friction #2 (git non sanctionné), mais les commandes destructives visées sont rarement émises spontanément par Claude — la vraie friction observée (`git add -A`, PR sans accord) est **déjà** couverte par `git-add-empty.sh`. Défensif, fréquence basse → P2.

### P2-c — Expand–contract pour refactors larges dans `goal`/`run-issue` ✅
- **Manque :** `goal` Phase 3 ne connaît que « thin vertical slice qui laisse l'app verte ». Un rename de colonne / retypage de symbole partagé (blast radius large) ne **peut pas** rester vert en une slice ; le skill forcerait et échouerait.
- **Preuve cible :** `to-tickets/SKILL.md` L40 — « sequence it as expand–contract. First expand … migrate call sites in batches sized by blast radius … keeping CI green batch to batch … Finally contract ». ✅
- **Cible :** `goal/commands/run-issue.md` Phase 3 — clause d'exception « refactor large = expand → migrate par lots → contract », 3-4 lignes. Ne PAS porter le DAG de blocking-edges (cf. §4).
- **Effort :** faible. **Acceptance :** un changement mécanique large est séquencé expand-contract au lieu d'être forcé en slice.

### P3 — Craft d'authoring de skills (pruning + négation→positif) 🔎
- **Manque :** `npx-skills-conventions` cape à « < 2000 mots » (longueur) mais n'a pas de **méthode de coupe**. La cible a le test no-op **par phrase** (`writing-great-skills/SKILL.md` L59), le test « behaviour vs default » (L82), et « négation → prompt le positif » (L83 — qui recoupe **la propre politique commentaires de Fabien**).
- **Cible :** section « Content quality & pruning » dans `tooling/skills/npx-skills-conventions/` (recoupe superpowers P3 form-matching, complémentaire). **Effort :** moyen, cœur de métier pour un mainteneur de 25+ skills.

### P3 — « One adapter = hypothetical, two = real » dans `ddd-principles` 🔎
- Garde crisp contre les ports/seams prématurés (`codebase-design/SKILL.md` L65). ✅ vérifié. Une phrase dans `craft/skills/ddd-principles/SKILL.md` §Ports & Adapters. Faible valeur marginale (over-engineering déjà bien couvert) → optionnel.

### P3 — Heuristique « seams » (to-spec/tdd) 🔎
- « Use the highest seam possible … the ideal number is one » (`to-spec/SKILL.md` L15) — où poser la frontière de test. ✅ vérifié. Optionnel dans `spec-first-dev` Phase 3 ou `testing-principles`.

---

## 3. Motifs README / doc à corriger — le plugin `pocock` a dérivé de l'upstream

Le plugin `pocock/` est un **subset vendored** de CETTE cible ; corriger sa doc est donc en scope. Les copies pinnées (`mattpocock@62f43a1`, `@e74f006`) sont un **choix assumé** (snapshots figés, descriptions élargies pour le triggering) — **ce n'est PAS un bug**. En revanche le README décrit un upstream qui a changé :

| Ligne README `pocock/README.md` | Écrit | Réalité upstream 2026-07 | Confiance |
|---|---|---|---|
| « The upstream plugin ships **14 skills** » | 14 | **41 SKILL.md** (22 blessed) | ✅ (find) |
| Skip-table `diagnose` | nom `diagnose` | renommé **`diagnosing-bugs`** | ✅ |
| Skip-table `to-issues` / `to-prd` | ces noms | renommés **`to-tickets`** / **`to-spec`** | ✅ |
| Skip-table `caveman` / `write-a-skill` | ces noms | `caveman` **supprimé** ; `write-a-skill` → **`writing-great-skills`** | ✅ |
| Instructions « refresh » | `git diff … engineering/zoom-out` | **`zoom-out` supprimé upstream** — chemin mort ; la copie vendored est un orphelin sans contrepartie amont | ✅ |
| « grill-with-docs = grill-me + maintient CONTEXT.md » | monolithe | upstream a **restructuré** : `grill-me`/`grill-with-docs` sont désormais de fins wrappers sur un skill `grilling` + `domain-modeling` | ✅ |

> **Action doc (zéro code, haute valeur) :** rafraîchir le tableau skip et le compte de skills dans `pocock/README.md`, et remplacer les instructions de refresh (le path `zoom-out` n'existe plus ; documenter que `zoom-out` est un snapshot orphelin conservé volontairement).

**Structure marketplace (Phase 4) — RAS :** tous les dossiers `plugins/*` sont enregistrés dans `marketplace.json`, aucune entrée morte, chaque plugin a son `plugin.json`, `security-audit` est un source github externe **volontaire** (pas de dossier attendu), et la migration `docs/superpowers-gap-analysis.md` → `plugins/self-audit/audits/` est cohérente (aucune référence pendante). **Nit mineur** : `EXTERNAL_PLUGINS.md` nomme le marketplace atournayre `atournayre/claude-marketplace` (étape 1) puis `atournayre-claude-plugin-marketplace` (étape 2) — incohérence cosmétique.

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

- **DAG de tickets à blocking-edges + frontière** (`to-tickets` L38) : `goal` est **linéaire séquentiel** par choix. Le DAG (travail agrabbable en parallèle) est une autre topologie, pas un trou.
- **`DESIGN-IT-TWICE` : spawn 3+ sous-agents pour « radically different interfaces »** (`codebase-design/DESIGN-IT-TWICE.md` L21) : ✅ vérifié — cette technique **AMPLIFIE** la friction #1 (sur-ingénierie). Ne PAS porter.
- **Auto-commit final (`implement`) + auto-publish/label (`to-spec`)** : opposés au staging manuel. Choix, pas oubli.
- **Issue-tracker + triage-labels + docs de domaine scaffoldés (`setup-matt-pocock-skills`)** : workflow orthogonal ; `goal` possède déjà la persistance de plan sur branche. Skip.
- **`wayfinder` « never resolve more than one ticket per session »** (L105) : `goal` a déjà la topologie `/clear`-par-itération (superpowers force 4). Couvert.
- **`ask-matt` (carte de flow « demande à l'auteur »)** : Fabien n'a pas de skill « ask the author » — la couche méta est `self-audit`. Divergence assumée.

---

## 5. Verdict cherry-pick

- **0 keep** (skill entier) — tout le structurant est couvert ou opposé.
- **8 port-technique** (greffes ciblées) : `deep-review` scope-creep (P1-a), deletion test (P1-b), test tautologique (P1-c), gate boucle-rouge (P2-a), hook git destructif (P2-b), expand-contract (P2-c), pruning skill-authoring (P3), one/two-adapter (P3), seams (P3).
- **9 skip** : `implement`, `domain-modeling`, `wayfinder`, `triage`, `prototype`, `ask-matt`, `setup-matt-pocock-skills`, `research`, `handoff` (tous couverts ou hors-scope solo).
- **Déjà vendored** (rappel) : `grill-me`, `grill-with-docs`, `zoom-out` dans `plugins/pocock/`.

---

## 6. Sous-axes où la cible garde l'avantage (honnêteté)

- **`diagnosing-bugs`** : menu ordonné de **10 techniques** de construction de boucle rouge (failing test, curl, CLI+snapshot, headless, replay trace, harness jetable, fuzz, git-bisect, differential, HITL) — plus concret que la prose Phase 1 de `systematic-debugging`. + « pas de seam correct = c'est ça le finding » (L114 ✅) contre notre « test = MUST » sans nuance.
- **`triage`** : redondance-avant-de-construire (chercher l'implémentation existante par concept de domaine, L70 ✅), vérifier-la-claim-avant-de-griller (L74 ✅), dédup des rejets passés — vraie discipline d'issue-tracker sans équivalent interne (atlassian = MCP externe, autre axe). Hors-scope solo mais réel.
- **`prototype`** : « throwaway code answers **one** question, don't generalise, skip polish » (LOGIC.md L77, SKILL.md L24 ✅) — cadrage anti-sur-ingénierie net. Couvert indirectement par le CLAUDE.md, mais mieux formulé.
- **`ask-matt`** : graphe de skills auto-documenté (« main flow + on-ramps », L11 ✅) — navigation que `self-audit` ne fournit pas.

---

## 7. Backlog exécutable (checklist)

```
[ ] P1-a  deep-review : axe spec-conformance + SCOPE-CREEP (param spec optionnel)   [ferme friction #1 ; = superpowers P2-a]
[ ] P1-b  Deletion test → craft/skills/refactoring-principles/SKILL.md (~2 lignes)
[ ] P1-c  Anti-pattern test tautologique → craft/skills/testing-principles/SKILL.md (~2 lignes)
[ ] P3-DOC  Rafraîchir pocock/README.md (compte de skills, noms renommés, path zoom-out mort)
[ ] P2-a  Gate boucle-rouge-avant-hypothèse → superpowers/skills/systematic-debugging (Phase 1)
[ ] P2-b  Hook block-destructive-git → common/hooks/ (OMETTRE push nu ; garder --force uniquement)
[ ] P2-c  Clause expand-contract refactors larges → goal/commands/run-issue.md (Phase 3)
[ ] P3    Pruning skill-authoring (no-op test + négation→positif) → tooling/npx-skills-conventions
[ ] P3    one/two-adapter + seams heuristics (optionnels, valeur marginale)
```

**Ordre recommandé :** P3-DOC (zéro risque, réaligne la doc vendored) → P1-b / P1-c (≤2 lignes, always-on) → P1-a (convergence, friction #1) → P2-b (défensif, infra prête) → P2-a / P2-c (effort moyen) → P3 (fond).

**Rappel garde-fou :** tout item touchant au §4 (divergences assumées) remonte en question explicite avant implémentation. Sous anti-over-engineering, préférer « laisser » à « ajouter » en cas de doute — les P3 sont explicitement optionnels.
