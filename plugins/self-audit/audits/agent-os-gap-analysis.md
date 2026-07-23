# État des lieux — marketplace Fabien vs `buildermethods/agent-os`

**Verdict (answer-first).** **Quasi-skip : 0 keep, 0 port immédiat, 5/5 skip — 1 seule idée P3
(optionnelle) qui touche ta force méta-tooling.** agent-os (Brian Casel) est un petit framework
(5 commandes, 328 K) articulé autour d'un mécanisme **discover / index / inject « standards »** +
un bootstrap produit (`plan-product`, `shape-spec`). Sa chaîne de spec/plan est **couverte, souvent
avec moins de cérémonie chez toi** (`spec-first-dev` fichier plat + simplicity gate + TDD-gaté vs
son dossier horodaté à 5 fichiers). La seule capacité **réellement absente** est la **découverte
bottom-up des conventions d'un codebase** (`discover-standards`) — direction repo→standards que tes
commandes, orientées injection standards→repo, ne font pas. C'est du méta-tooling (ta force), donc
noté **P3 optionnel**, pas skip pur — mais spéculatif pour un solo qui a déjà ses standards `craft`.

> **Confiance :** ✅ = re-greppé fichier-en-main pendant CET audit · Fan-out : **26 agents, 0 erreur, ~1,3 M tokens** ; forces cibles ✅ CONFIRMED (pass 2).

---

## Méthode & sources

- **Tier `deep`** (Workflow 2 passes) sur les **5 commandes** : `plan-product`, `shape-spec`, `discover-standards`, `index-standards`, `inject-standards`.
- **Couverture :** `full=2` (shape-spec, inject-standards), `partial=1`, `none=2`.
- **Phase 2b** (✅) : `discover-standards.md:3` / `:168` ; `shape-spec.md:17` ; absence marketplace : `install-global-claude-md` ne découvre pas depuis le repo (0).

---

## 1. Points forts validés — à PRÉSERVER

| # | Force marketplace | Où | Face à agent-os |
|---|---|---|---|
| 1 | Spec = **fichier plat** unique, moins de cérémonie | `spec-first-dev.md` L120 « Persist … at `.claude/plans/<feature>-spec.md` » | `shape-spec` = dossier horodaté à 5 fichiers, plus lourd. ✅ |
| 2 | **Simplicity gate** anti-sur-ingénierie dans la spec | `spec-first-dev.md` L158 « **Simplicity check** … every layer earns its place » | `plan-product`/`shape-spec` n'ont aucun garde équivalent. ✅ |
| 3 | TDD **gaté rouge→vert** obligatoire | `spec-first-dev.md` L176 « No production code … before a failing test demands it » | `shape-spec` produit un plan sans discipline test-first. ✅ |
| 4 | Jamais d'écrasement sans diff | `install-global-claude-md.md` L29 « **Never overwrite without showing the diff first** » | `plan-product` offre « Start fresh (replace all) » sans diff avant d'effacer mission/roadmap. ✅ |

---

## 2. Manquements réels — BACKLOG

### P3 — Découverte bottom-up de conventions codebase (méta-tooling) 🔎 *(optionnel)*
- **Manque :** tes commandes vont **standards→repo** (`install-global-claude-md` injecte des règles pré-écrites ; `craft:*-principles` = tes standards authored). Personne ne fait **repo→standards** : extraire les conventions **non documentées** d'un codebase existant en standards concis.
- **Preuve cible (✅) :** `discover-standards.md:3` « Extract tribal knowledge from your codebase into concise, documented standards. » + discipline token-frugale `:168` « Standards will be injected into AI context windows. Every word costs tokens. » + boucle « 1-2 questions sur le *pourquoi* du pattern, une à la fois » (`:74`).
- **Preuve du trou :** `install-global-claude-md` ne découvre rien depuis le repo = **0**. ✅ (les 3 hits « extract convention » du marketplace sont mes propres rapports d'audit, pas une capacité)
- **Pourquoi P3 et pas plus :** ça **amplifie** ta force méta-tooling (utile pour onboarder un codebase client brownfield en un CLAUDE.md/craft-override), mais c'est de la **surface nouvelle** pour un solo qui a déjà ses standards transverses. À faire **seulement** si tu bosses régulièrement sur des repos tiers dont il faut capturer les conventions. La discipline token-frugale, elle, **recoupe déjà** le port `writing-great-skills` (pruning) du backlog mattpocock — ne pas la re-porter.
- **Cible éventuelle :** une commande fine `common/commands/discover-standards.md` (repo→brouillon de règles, une question-pourquoi à la fois, token-frugal), pointant vers `.claude/` / `craft`. **Acceptance :** produit un brouillon de standards ancré sur des patterns réels du repo, validé question par question, sans surface générée d'office.

*(Aucun P1/P2 : le reste est couvert ou hors altitude.)*

---

## 3. Motifs README / doc à corriger

**Aucun côté marketplace.** agent-os n'est ni vendored ni référencé dans `plugins/`. **Structure (Phase 4) — RAS.**

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

- **Altitude « vision produit »** (`plan-product` : mission/roadmap/tech-stack bootstrap) : ta chaîne est feature/itération-driven (`goal` + `spec-first`) ; tes produits sont déjà définis. Ajouter un onboarding produit = scope creep. Choix.
- **Spec comme archive horodatée découvrable** (`shape-spec.md:267` « Specs are discoverable months later ») vs ton **fichier de travail** `.claude/plans/`. Philosophie d'archive vs working-file — divergence assumée, pas trou.
- **Hard-gate plan-mode** (`shape-spec.md:17` « If NOT in plan mode, stop immediately ») : contrainte de mode que tes commandes n'imposent pas. Choix (souplesse).
- **Convention de dossier `agent-os/product/` + `standards/`** : layout que tu n'utilises pas. Ne pas adopter.

---

## 5. Verdict cherry-pick

- **0 keep, 0 port immédiat, 5 skip.** Chaîne spec/plan couverte avec moins de cérémonie ; bootstrap produit hors altitude.
- **1 P3 optionnel** : découverte bottom-up de standards (méta-tooling), conditionnée à un vrai besoin brownfield-tiers.

---

## 6. Sous-axes où la cible garde l'avantage (honnêteté)

- **`discover-standards` — extraction repo→standards** : vraie capacité absente (→ P3). La direction inverse de tes commandes d'injection.
- **`AskUserQuestion` structuré, une question à la fois** (`plan-product.md:9`) : UX d'élicitation plus propre que les batches prose de `spec-first`. Mais `grill-me` fait déjà « une question à la fois » ; l'outil structuré est un détail d'implémentation, pas une méthode neuve.
- **Décision references-vs-inline à l'injection** (`inject-standards.md:131` : @-référence pour rester sync vs coller pour l'autonomie) : micro-décision d'authoring utile — recoupe le craft d'authoring de skills déjà noté (writing-great-skills). Marginal.
- **Discipline token-frugale des standards** (`:168`) : bien argumentée ; recoupe le port pruning déjà au backlog. Doublon.

---

## 7. Backlog exécutable (checklist)

```
[ ] P3 (optionnel)  common/commands/discover-standards : extraction bottom-up repo→brouillon de règles,
       une question-pourquoi à la fois, token-frugal — SEULEMENT si besoin brownfield-tiers récurrent.
       Ne PAS re-porter la discipline token-frugale (déjà couverte par le port writing-great-skills mattpocock).
```

**Rappel garde-fou :** le bootstrap produit, l'archive horodatée et le hard-gate plan-mode sont des divergences
**assumées** (§4). Sous anti-sur-ingénierie, le P3 reste **conditionnel** : ne l'ouvrir que si tu captures
régulièrement les conventions de codebases tiers. Leçon transversale : agent-os est propre et minimaliste
(rare dans cette salve), mais son unique apport net — la **direction repo→standards** — est un nice-to-have
méta-tooling, pas un manque qui te coûte aujourd'hui.
