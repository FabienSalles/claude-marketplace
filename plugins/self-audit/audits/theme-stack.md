# Audit thématique — Couverture de stack (PHP/Symfony + TS/Nest/Astro/front)

> Vérifié contre `main` à jour le 2026-08-20 (section 6 réancrée).

**Date :** 2026-08-20 · **Lentille :** `plugins/self-audit/usage-profile.md` · **Posture :** anti-biais home-team.
**Cibles relues sur clones frais** (11 packs) + plugins externes réellement installés (`~/.claude/plugins/installed_plugins.json`).

## 1. Verdict

Oui, la profondeur de stack est réelle et non racontée : **aucune des 11 cibles externes ne contient une seule convention PHP, Symfony, Doctrine, Twig, NestJS ou Astro** — ce sont des packs de workflow (spec, TDD, orchestration), pas des packs de stack. Le seul concurrent sérieux, `mattpocock_skills`, n'a que 35 skills et zéro règle de typage/framework : sa valeur TS est *architecturale* (modules profonds outillés), pas conventionnelle.
La faiblesse n'est donc pas la comparaison, elle est interne : **pas de couche ORM/validation Symfony chez moi** (déléguée à un plugin externe daté Symfony 6.4), **pas de version PHP > 8.3**, et **aucune règle mécaniquement vérifiable** — tout est prose que rien ne fait échouer.

## 2. Ce que je fais MIEUX (ancré)

1. **Un skill = une règle opposable, versionnée par version de langage.** `plugins/php/skills/php-8-2/SKILL.md:9` (« always use `readonly class` instead of per-property `readonly` ») ; idem 8-0/8-1/8-3. Aucune cible n'a de skill scopé à une version de langage — `buildermethods_agent-os/profiles/default/global/tech-stack.md:1-16` est une liste de courses (« React 18, Tailwind v4, Express »), pas une convention.
2. **Décisions de conception avec critère de refus, pas des recettes.** `plugins/symfony/skills/twig-conventions/SKILL.md:38-45` (checklist 3 questions avant de créer un composant, défaut = HTML brut) et `plugins/tooling/skills/drizzle-conventions/SKILL.md:114-118` (arbre Query API / Select API / SQL brut). C'est exactement l'anti-over-engineering priorisé au §1 du profil d'usage.
3. **Organisation front côté framework, angle mort total ailleurs.** `plugins/symfony/skills/symfony-frontend/SKILL.md:11-45` (interdiction de `<script>`/`<style>` en Twig, une entrée Encore par feature) + `plugins/jquery/skills/jquery/SKILL.md:18-19` (hooks `js-*`). `anthropics_skills/skills/frontend-design/SKILL.md` traite l'esthétique, jamais le câblage build/template.
4. **Le test framework-bootant est traité comme une discipline séparée.** `plugins/symfony/skills/symfony-test-conventions/SKILL.md:22` (table de choix de classe de base) + `:73` (assertions natives contre lectures de crawler faites main), 3 références dédiées. `mattpocock_skills/skills/engineering/tdd/SKILL.md` fait 38 lignes, tous langages confondus.
5. **La chaîne TS est cohérente de bout en bout.** `plugins/typescript/skills/ts-conventions/SKILL.md:11` (strict obligatoire, justifié), `:150` (branded types), relayée par `plugins/tooling/skills/zod-conventions/SKILL.md:11,29` (`FooSchema` dans `packages/shared`) et `plugins/nest/skills/nest-conventions/SKILL.md:11` (1 module = 1 bounded context). Aucune cible ne descend à ce niveau.

## 3. Ce que je fais MOINS BIEN (ancré)

1. **Zéro règle mécaniquement exécutable sur toute la stack.** `mattpocock_skills/skills/in-progress/setup-ts-deep-modules/SKILL.md:60-70` installe dependency-cruiser **et exige la preuve que la règle mord** (passe → casse sur un import profond → repasse). Mes règles de frontière (`plugins/frontend/skills/frontend-clean-architecture/SKILL.md`, `plugins/php/skills/php-ddd-conventions/SKILL.md:17-41`) ne sont que de la prose : rien ne fait échouer un import domaine → infra. L'audit `plugins/self-audit/audits/mattpocock-skills-gap-analysis.md:28` a classé `in-progress/` hors-scope en bloc — arbitrage à rouvrir, celui-ci n'est pas un skill d'écriture.
2. **Doctrine est un trou chez moi, comblé par l'externe mais mal daté.** Rien dans `plugins/php/` ni `plugins/symfony/` sur entités/DQL/QueryBuilder/migrations — `plugins/php/skills/php-sql-conventions/SKILL.md:3` exclut explicitement « Doctrine ORM/DQL, database migrations ». **Ce n'est pas un gap ouvert** : `symfony@atournayre-claude-plugin-marketplace` est installé et ship 499 lignes de `symfony-skill/references/doctrine-advanced.md`. Mais il est pinné Symfony 6.4 (`.../symfony-skill/SKILL.md:3,17`) et enseigne des `partial` objects (`doctrine-advanced.md:28-35`) que Doctrine ORM 3 déprécie 🔎.
3. **Le versionnage PHP s'arrête à 8.3, la stack a bougé.** `plugins/php/skills/` ne contient ni 8-4 ni 8-5 alors que le pattern « une skill par version » est justement ma force. Symétriquement, **aucun skill Symfony ne nomme sa version** (grep `symfony (6|7)` sur `plugins/symfony/` : 0 hit) : mes overlays sont supposés valables partout, ce qui n'est vrai ni pour Encore (déprécié au profit d'AssetMapper) ni pour les composants Twig.
4. **Aucune skill ne dit comment détecter la version du projet.** Les descriptions disent « in a PHP 8.2+ project » (`plugins/php/skills/php-8-2/SKILL.md:3`) sans jamais indiquer de lire `composer.json` (`php-composer-conventions` ne parle que de contraintes de dépendances). Sur un legacy 8.0, Claude peut charger 8-3 et écrire des constantes typées invalides.
5. **Le front hors Astro est mince et daté.** `plugins/frontend/skills/` = 3 skills React génériques ; Tailwind n'existe que dans `plugins/astro/skills/astro-tailwind/SKILL.md` ; accessibilité : aucune règle dans `plugins/frontend`, `plugins/symfony`, `plugins/jquery` — le grep `aria-|wcag|accessib` ne remonte que deux faux positifs (`symfony-test-conventions/SKILL.md:156` « accessible role », `twig-conventions/SKILL.md:104` « not accessible »). Un projet Symfony + Twig + Tailwind n'a aucune couverture styling ni a11y.

## 4. Gaps

| P | Fichier cible | Critère d'acceptation | Conf. |
|---|---|---|---|
| P1 | `plugins/php/skills/php-8-4/SKILL.md` (+ `php-8-5`) | Même forme que `php-8-2` : 1 règle opposable par version (property hooks / `new` en initialiseur ; puis 8.5). README `plugins/php/README.md:3` et `marketplace.json:14` passent de « 8.0–8.3 » à la nouvelle borne. | ✅ |
| P1 | `plugins/php/skills/php-version-detection` **ou** section dans `php-composer-conventions` | Procédure : lire `composer.json` `require.php` / `config.platform.php` **avant** d'appliquer une règle de version ; en cas d'ambiguïté, poser une question au lieu de supposer. Testable : un projet `"php": "^8.0"` ne déclenche pas les constantes typées. | ✅ |
| P1 | `plugins/symfony/skills/symfony-version-scope/SKILL.md` (ou en-tête de chaque skill symfony) | Chaque skill Symfony déclare la fourchette de version où sa règle tient ; `symfony-frontend` explicite Encore vs AssetMapper et le critère de choix. Aujourd'hui aucun fichier ne nomme une version. | ✅ |
| P2 | `plugins/typescript/skills/ts-module-boundaries/SKILL.md` | Porte la règle de `setup-ts-deep-modules` : frontières de packages **vérifiées par un outil** (dependency-cruiser ou équivalent), avec l'étape « prouver que ça casse » de `SKILL.md:60-70`. Doit rester opt-in (le profil d'usage rejette l'outillage imposé). | 🔎 |
| P2 | `plugins/symfony/skills/symfony-validation/SKILL.md` | Où vivent les contraintes (entité vs DTO vs FormType), rapport avec `data_class` (`symfony-form/SKILL.md:9`), et pourquoi ne pas dupliquer la validation domaine. Actuellement 0 skill sur `Assert\*`. | ✅ |
| P2 | `plugins/frontend/skills/tailwind-conventions/SKILL.md` (hors Astro) | Règles Tailwind framework-agnostiques (tokens `@theme`, quand extraire un composant, interdiction du duplicata utilitaire) réutilisables depuis Twig/React. Extrait de `astro-tailwind/SKILL.md:31` puis référencé par lui. | 🔎 |
| P3 | `plugins/php/skills/php-doctrine-conventions/SKILL.md` | **Uniquement** un overlay personnel (direction des requêtes, mapping, migrations générées jamais éditées à la main) renvoyant à l'externe pour le reste. Ne pas réécrire les 499 lignes déjà installées. | 🔎 |
| P3 | `plugins/frontend/skills/a11y-conventions/SKILL.md` | Minimum opposable (rôles, focus, labels de formulaire) applicable en Twig comme en React. Faible priorité : absent du profil d'usage. | 🔎 |

## 5. Divergences ASSUMÉES

- **Pas de skill « choix de stack »** (`ai-driven-dev_framework/.../stack-heuristics.md`, `agent-os/.../tech-stack.md`) : ma stack est fixée, un arbre de décision Next vs Astro vs FastAPI est du bruit.
- **jQuery conservé** (`plugins/jquery/`) alors qu'aucune cible n'en parle : c'est la réalité du legacy Symfony, pas un retard.
- **Pas de skill Prisma / TypeORM / Laravel** : Drizzle et Doctrine sont les seuls ORM réellement utilisés.
- **Pas d'installation d'outillage imposée par un skill** (contrairement à Pocock) : le §2 du profil d'usage rejette tout ce qui automatise sans accord ; si `ts-module-boundaries` arrive, il reste user-invoked.

## 6. Dérives de doc constatées

- `plugins/php/README.md:3` et `.claude-plugin/marketplace.json:14` annoncent « PHP 8.0–8.3 » : exact aujourd'hui, mais c'est la borne qui date le pack, à bouger avec le gap P1.
- Descriptions « in a PHP 8.x+ project » (`php-8-2/SKILL.md:3`, `php-8-3/SKILL.md:3`) : la condition d'activation repose sur une information que le skill n'apprend jamais à Claude à obtenir.
- `plugins/symfony/README.md` / `marketplace.json:34` : « Distinct from atournayre/symfony — these are personal overlays » est vrai, mais aucun des deux ne dit *ce que l'externe couvre* (Doctrine, sécurité, API Platform, perf). Un lecteur conclut à un trou qui n'en est pas un.
- `plugins/astro/skills/astro-basics/SKILL.md:9` (« Astro 5.x ») et `astro-view-transitions/SKILL.md:27` (note legacy Astro 4) sont le bon modèle de datation — c'est exactement ce qui manque côté Symfony.
- Aucune dérive README ↔ skills : les 10 plugins de stack listent bien tous leurs skills.
