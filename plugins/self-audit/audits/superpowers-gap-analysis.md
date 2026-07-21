# État des lieux — marketplace Fabien vs `obra/superpowers`

**But de ce document.** Servir de backlog d'amélioration pour une **future session**
qui viendra enrichir le marketplace : ajouter ce qui manque vraiment vs `superpowers`,
corriger ce qui est perfectible, et surtout **ne pas toucher** aux divergences
assumées. Le doc est écrit pour être exécutable à froid : chaque action nomme un
fichier cible, un critère d'acceptation, et un niveau de confiance.

> **Convention de confiance dans ce doc :**
> - ✅ **vérifié** = citation lue verbatim dans le fichier réel pendant l'analyse (numéros de ligne indicatifs, décalage possible de ±1-2, texte exact).
> - 🔎 **à reconfirmer** = relevé par l'analyse multi-agents mais pas re-vérifié fichier-en-main ; la session d'implémentation rouvrira le fichier de toute façon.

---

## Méthode & sources

- Comparaison des **14 skills upstream** `obra/superpowers` (v5.1.0, clonées) contre le corpus complet du marketplace (~88 skills).
- Deux passes : (1) comparaison par skill (14 agents), (2) deep-dive verbatim sur les 7 points forts (7 agents).
- Vérifications manuelles ciblées sur les affirmations les plus lourdes (voir ✅ ci-dessous).
- Le README du plugin `superpowers` documente déjà les décisions cherry-pick ; ce doc **valide et corrige** ces motifs.

---

## 1. Points forts validés — à PRÉSERVER (ne pas affaiblir)

Ces 7 axes sont là où le marketplace bat `superpowers`. Une future refonte ne doit pas les diluer.

| # | Force | Où | Mécanisme (une ligne) |
|---|---|---|---|
| 1 | Vérification par exécution réelle | `goal/commands/run-issue.md` L111-112, L120 ; `goal/templates/goal-handoff.template` L37 ; `goal/templates/done-criteria.template` | Chaque règle métier → un check ligne de commande ; DoD jugée par un évaluateur tiers sur exit codes/stdout **affichés**. Upstream `executing-plans` L29 se limite à « Run verifications as specified » et `subagent-driven-development` L166-167 interdit au reviewer de re-run. ✅ |
| 2 | Réconciliation plan-vs-code | `goal/commands/next.md` L59, L69, L143 | Phase 2 grep le repo pour chaque nom encore référencé, corrige les claims périmés, ripple dans les itérations 2..N. Upstream « Follow plan steps exactly » (L28, L59), zéro détection de dérive. ✅ |
| 3 | Profondeur TDD (interdit test-only) | `craft/skills/testing-principles/SKILL.md` L101-107, L120-123 | Interdit **six** formes de code de prod pour un test (CSS/js-*/id/attribut/getter/méthode), locator jamais couvert par l'exception ; assertions sur contenu perçu. Upstream `testing-anti-patterns.md` bannit **les méthodes seulement** (L17, L63, L105). ✅ |
| 4 | Topologie anti-accumulation contexte | `goal/commands/next.md` L69 ; handoff plafonné | Session fraîche par itération + `/clear` + handoff ≤ 4000 car. Rend inatteignable l'échec confessé par SDD lui-même (« the single most expensive failure observed », L250 ; « 42k chars 99% history », L191). ✅ |
| 5 | Grill adversarial | `goal/skills/grill-adversarial/SKILL.md` L38-63, L91 | Énumère les états finis, invariants I1..In avec OWNER, matrice (état × action) en utilisateur hostile. Upstream `brainstorming` L30/L114/L119 : scan texte 4 points, une passe, « No need to re-review ». ✅ |
| 6 | TDD cross-layer + app-green | `craft/skills/tdd-workflow-principles/SKILL.md` L17, L78, L87, L89 | GREEN = « app must work in dev and prod » + checklist de câblage (DI/module/route). Upstream `test-driven-development` s'arrête à « test passes / output pristine » (L178-179, L335-336). ✅ |
| 7 | Filtre méta de review | `common/commands/deep-review.md` L49-56 | Agent 3 Meta-Reviewer retire les faux positifs, fusionne doublons, cape à ~2-5. Upstream `requesting-code-review` : un seul reviewer, aucune passe de dédup/cap. ✅ |

---

## 2. Manquements réels — BACKLOG à combler

Priorité : **P1** (cheap + valeur nette, à faire) · **P2** (valeur réelle, effort moyen) · **P3** (nice-to-have).

### P1-a — Deux règles d'hygiène de mock 🔎
- **Manque :** (a) un mock doit **mirror la structure complète** de la vraie donnée (un mock partiel échoue en silence sur un champ omis) ; (b) mocker **au bon niveau** (ne pas stubber une méthode high-level dont le test dépend du side-effect ; observer le vrai comportement d'abord).
- **Source upstream :** `test-driven-development/testing-anti-patterns.md`.
- **Cible :** `craft/skills/testing-principles/SKILL.md`, à côté du §10 « Mocks Can Hide Real Bugs ».
- **Effort :** ~4 lignes. Pas de nouveau skill, pas de collision de routing.
- **Acceptance :** les deux règles présentes dans `testing-principles`, formulées cross-language.

### P1-b — Interdiction de l'accord performatif 🔎 (absence ✅ : grep marketplace = zéro hit)
- **Manque :** aucune règle contre « You're absolutely right », « Great point », gratitude performative.
- **Source upstream :** `receiving-code-review`.
- **Cible :** `common/templates/global-claude-md.template` (always-on, injecté dans le CLAUDE.md global).
- **Effort :** ~2 lignes.
- **Acceptance :** la règle est dans le template ; un futur `install-global-claude-md` la propage.

### P2-a — Plan-alignment en code review ✅ (le trou est confirmé)
- **Manque :** `deep-review` est **côté producteur** : les 3 agents ne lisent que le diff, l'Agent 1 devine l'intention (« best guess », `deep-review.md` L33). Il ne reçoit jamais le plan/les exigences, donc ne peut **structurellement pas** vérifier « l'implémentation fait-elle ce qui était demandé ? ». Si une tâche devait ajouter du rate-limiting et que le diff l'omet en silence, `deep-review` est aveugle.
- **Source upstream :** `requesting-code-review/SKILL.md` L38 (`{PLAN_OR_REQUIREMENTS} - What it should do`). ✅
- **Cible :** `common/commands/deep-review.md` — ajouter un paramètre optionnel plan/requirements + un check plan-alignment en première passe.
- **Effort :** moyen (réutilise le moteur 3-agents existant).
- **Acceptance :** quand un plan est fourni, une omission silencieuse par rapport au plan est détectée.

### P2-b — Règle « No Placeholders » dans les plans 🔎
- **Manque :** rien n'interdit « TBD » / « add error handling » / « similar to iteration N » dans un doc de plan, ni un scan de cohérence des signatures inter-itérations. Les templates `goal`/`spec-first` sont eux-mêmes à trous (`[Step description]`).
- **Source upstream :** `writing-plans`.
- **Cible :** templates de `goal` (`run-issue` spec template) et/ou `common/commands/spec-first-dev.md`.
- **Effort :** faible.
- **Acceptance :** un plan contenant un placeholder est rejeté / signalé avant gel.

### P3 — Craft d'authoring de skills 🔎
- **Manque :** « Match the Form to the Failure » et le piège « la description ne doit PAS résumer le workflow » (une description qui résume le process fait suivre le résumé **au lieu** du corps). Pertinent car plusieurs descriptions du marketplace résument justement leur workflow.
- **Source upstream :** `writing-skills` (689 lignes, la plus grosse).
- **Cible :** `tooling/skills/npx-skills-conventions` ou `tooling/skills/claude-plugin-conventions`.
- **Effort :** moyen. Travail cœur pour un mainteneur de 25+ skills, pas hors-scope.
- **Acceptance :** les deux principes documentés ; audit rapide des descriptions qui résument leur workflow.

---

## 3. Motifs README à corriger — zéro code, haute valeur

Le README du plugin `superpowers` documente ~6 décisions avec un **mauvais motif** (équivalent externe au repo, non pertinent, ou sur un autre axe). Les **décisions restent bonnes**, seul le texte est à réaligner sur l'équivalent interne réel.

| Skip | Motif écrit (faux/faible) | Motif correct | Confiance |
|---|---|---|---|
| `systematic-debugging` (keep) | « complements `qa:phpstan-resolver` » | `qa` est **externe** (marketplace atournayre). Vrai motif, plus fort : **aucune discipline native de root-cause** dans ce repo. | ✅ (`qa` absent de `plugins/`, présent dans `EXTERNAL_PLUGINS.md` L37) |
| `brainstorming` | « Duplicates `bmad-brainstorming` » | BMAD est **hors-marketplace** (`~/.claude/commands/bmad/`, listé dans `EXTERNAL_PLUGINS.md` L47 comme source à documenter). Un utilisateur du marketplace sans BMAD n'a aucun remplaçant nommé. Vrai équivalent interne : `spec-first-dev` + famille grill. | ✅ (BMAD non dans `plugins/`) |
| `subagent-driven-development` | « handled manually + `audit-trail.sh` » | `audit-trail.sh` est un **simple logger** PostToolUse de commandes Bash, sans rapport avec l'orchestration. Vrai substitut : le workflow `goal`. | ✅ (script lu) |
| `requesting-code-review` | « `deep-review` covers it » | `deep-review` est côté **producteur/reviewer** ; ce skill est côté **demandeur** (axe plan-alignment). Axes orthogonaux → cf. P2-a. | ✅ |
| `receiving-code-review` | « `deep-review` covers it » | `deep-review` est sur le mauvais axe ; la vraie valeur (anti-accord performatif + triage/pushback) manque → cf. P1-b. | ✅ |
| `writing-plans` | « delta covered by `php-tdd-workflow` », voir `docs/tdd-workflow-audit.md` | Motif surévalué (ignore No-Placeholders → cf. P2-b) **et** le doc cité ne parle jamais de writing-plans. | ✅ (grep `writing-plans` dans `tdd-workflow-audit.md` = 0) |

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

Une future session pourrait prendre ces absences pour des trous. Ce sont des **choix**. Ne pas les annuler sans décision explicite.

- **Worktrees OFF par défaut** (`using-git-worktrees`, moitié de `finishing-a-development-branch`) : le CLAUDE.md global interdit l'auto-création. Choix, pas oubli.
- **Pas de génération divergente 2-3 approches** (`brainstorming`) : CLAUDE.md dit « recommend ONE » ; les skills de planning disent « one approach, not three ».
- **`/clear` humain entre itérations** (`goal`) : conviction (« don't drop /goal and walk away »). Rend impossible l'échec de contexte de SDD (force 4), mais au prix de l'exécution continue non-attendue d'upstream. Assumé.
- **Pas d'exécution hands-off par subagents** (`subagent-driven-development`) : topologie « humain = controller » choisie.

---

## 5. Verdict cherry-pick (rappel)

- **2 keeps — SAFE** : `verification-before-completion` (axe complétion, complémentaire au « Verification Before Claiming » du CLAUDE.md qui vise l'axe faits/citations), `systematic-debugging` (comble un vrai vide root-cause).
- **12 skips — 6 SAFE, 6 au MOTIF questionable** (décision défendable mais texte à corriger, cf. §3) : `writing-plans`, `brainstorming`, `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`, `writing-skills`.

---

## 6. Sous-axes où upstream / la plateforme gardent l'avantage (honnêteté)

- **Native `verify`** (built-in harness) place la barre plus haut que la DoD `goal` sur l'axe **comportemental** : « drive the affected flow, not just tests or typecheck ». La DoD reste centrée commande/test et peut être satisfaite sans jamais piloter le vrai flux utilisateur. Piste : une étape « flux piloté » optionnelle dans la DoD.
- **Plan-alignment** (cf. P2-a) : upstream `requesting-code-review` reçoit `{PLAN_OR_REQUIREMENTS}` et vérifie l'écart implémentation-vs-plan ; `deep-review` ne le peut pas.

---

## 7. Backlog exécutable (checklist pour la future session)

```
[ ] P1-a  Ajouter les 2 règles d'hygiène de mock dans craft:testing-principles (près du §10)
[ ] P1-b  Ajouter la règle anti-accord-performatif dans common/templates/global-claude-md.template
[ ] P3-README  Corriger les 6 motifs de skip dans plugins/superpowers/README.md (§3)
[ ] P2-a  deep-review : paramètre plan/requirements optionnel + check plan-alignment en 1re passe
[ ] P2-b  No-Placeholders : durcir les templates goal/spec-first (interdire [placeholder]/TBD)
[ ] P3    writing-skills : porter form-matching + « description ≠ résumé du workflow » dans tooling
[ ] Audit  Passer les descriptions de skills au filtre « description qui résume son workflow » (P3)
```

**Ordre recommandé :** P3-README (zéro risque, réaligne la doc) → P1-a / P1-b (cheap, always-on) → P2-a / P2-b (effort moyen) → P3 (fond).

**Rappel garde-fou :** tout item qui toucherait au §4 (divergences assumées) doit être remonté en question explicite avant implémentation. Sous la policy anti-over-engineering, préférer « laisser » à « ajouter » en cas de doute.
