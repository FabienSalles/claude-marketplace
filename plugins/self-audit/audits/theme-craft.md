# Audit thématique — Craft (OOP, DDD, refactoring, style de code)

> Vérifié contre `main` à jour le 2026-08-20 (section 6 réancrée).

**Date :** 2026-08-20 · **Lentille :** `plugins/self-audit/usage-profile.md` (friction n°1 = over-engineering)
**Cibles lues :** clones frais dans `scratchpad/targets/` — `mattpocock_skills`, `FlorianBruniaux_claude-code-plugins`,
`SuperClaude-Org_SuperClaude_Framework`, `ai-driven-dev_framework`, `buildermethods_agent-os`, `obra_superpowers`,
`anthropics_skills`, `bmad-code-org_BMAD-METHOD`, `github_spec-kit`, `ruvnet_claude-flow`, `eyaltoledano_claude-task-master`.

> ✅ = citation re-greppée fichier en main pendant cet audit · 🔎 = relevé non recontrôlé.

## 1. Verdict

Sur le **craft prescriptif** (règles OOP/DDD/style déclinées par langage), le marketplace n'a pas de concurrent :
aucune cible ne sépare règles cross-langage et exemples par langage, et les seuls packs « code quality » externes
(Bruniaux, SuperClaude, AIDD) sont des catalogues génériques qui **ajoutent de la surface** — exactement la friction n°1.
Le retard est ailleurs : `mattpocock/skills` possède un **vocabulaire de conception** (module / interface / depth / seam /
adapter / leverage / locality) et deux disciplines qui manquent ici — le **scan proactif de modules shallow** et la
**garde « un seul adaptateur = seam hypothétique »**, qui est un anti-over-engineering plus tranchant que tout ce que
`ddd-principles` dit aujourd'hui. Trois gaps P1 du précédent audit mattpocock sont **déjà fermés** mais la checklist ne l'acte pas.

## 2. Ce que je fais MIEUX

1. **Architecture à deux étages règles/exemples, unique dans le corpus.** `plugins/craft/skills/oop-principles/SKILL.md:9-11`
   déclare les règles, `plugins/php/skills/php-oop/SKILL.md:9` et `plugins/typescript/skills/ts-oop/SKILL.md` portent les
   exemples ; la table de correspondance est explicite (`plugins/craft/README.md:9-17`). Chez Bruniaux, tout est fondu dans
   un seul skill TS/JS avec détection de stack en dur (`FlorianBruniaux_claude-code-plugins/plugins/code-quality/skills/design-patterns/SKILL.md:76-95`) : ajouter PHP y coûte une réécriture. ✅
2. **Exemples ancrés dans du code métier réel, avant/après.** `php-oop/SKILL.md:11-25` (Tell-Don't-Ask sur un IdentityDocument),
   `plugins/typescript/skills/ts-refactoring/SKILL.md:13-25` (deux chemins de création d'un `UploadFile`).
   La cible la plus proche, `SuperClaude-Org_SuperClaude_Framework/plugins/superclaude/agents/refactoring-expert.md`, tient en
   48 lignes de puces génériques ; `FlorianBruniaux/.../agents/refactoring-specialist.md:36-85` illustre en pseudo-JS jetable. ✅
3. **La contrainte anti-sur-ingénierie est déjà écrite comme règle, pas comme intention.** Test de suppression :
   `craft/skills/refactoring-principles/SKILL.md:59-73` ; commentaires « justify or delete » : `craft/skills/code-style-principles/SKILL.md:65-93` ;
   passe scope-creep en revue : `plugins/common/commands/deep-review.md:33` (« Flag every change … that traces to no criterion »). ✅
4. **Coût de contexte tenu.** Les 7 skills `craft` totalisent 943 lignes, la plus grosse en fait 275
   (`testing-principles`), les autres 73→184. En face, un seul skill cible en fait 566
   (`design-patterns/SKILL.md`) plus trois références GoF et une checklist de scoring. ✅
5. **Deux styles DDD assumés côte à côte.** `craft/skills/ddd-principles/SKILL.md:9-13` (OOP) et
   `craft/skills/ddd-fp-principles/SKILL.md:9-12` (FP, records immutables, smart constructors `make*`) avec routage explicite
   entre les deux. Aucune cible ne modélise le DDD fonctionnel ; `mattpocock` traite le domaine par le glossaire, pas par la modélisation. ✅

## 3. Ce que je fais MOINS BIEN

1. **Pas de vocabulaire de conception partagé.** `mattpocock_skills/skills/engineering/codebase-design/SKILL.md:14-28` définit
   module / interface / implementation / depth / seam / adapter / leverage / locality, et L105-109 **rejette** explicitement
   « boundary » et la définition ratio-de-lignes d'Ousterhout. Ici, « deep modules » n'apparaît qu'une fois
   (`craft/skills/tdd-workflow-principles/SKILL.md:49`) et « seam » n'apparaît dans `craft` que dans la clause d'exemption du test de suppression
   (`craft/skills/refactoring-principles/SKILL.md:71`), plus `plugins/legacy/skills/discovery/references/safety-net.md:288`. Résultat : les skills craft nomment la même chose de trois façons. ✅
2. **Garde « un adaptateur = seam hypothétique » absente — et c'est la meilleure règle anti-over-engineering du corpus.**
   `codebase-design/DEEPENING.md:29` : « One adapter means a hypothetical seam. Two adapters means a real one … A single-adapter
   seam is just indirection. » Mon `ddd-principles/SKILL.md:37-45` prescrit ports & adapters **sans condition**, ce qui pousse
   Claude à créer une interface par service. ✅
3. **Aucune entrée proactive : le craft ici est réactif.** `mattpocock_skills/skills/engineering/improve-codebase-architecture/SKILL.md:20-23`
   cadre le scan par les hot spots de `git log` (« Scope before you scan: YAGNI »), L35 utilise le test de suppression comme filtre de candidats.
   Mes skills craft ne se déclenchent que quand Fabien dit « refactor ». ✅
4. **Baseline de smells nommée, absente de la revue.** `mattpocock_skills/skills/engineering/code-review/SKILL.md:45-56` liste 12 smells Fowler
   (*Mysterious Name, Data Clumps, Primitive Obsession, Speculative Generality, Middle Man…*) chacun en *quoi → comment corriger*,
   encadrés par deux règles (`L40-41` : « The repo overrides » et « Always a judgement call »). Mon `deep-review.md:49` dit
   « Architecture: Coupling, SOLID violations, pattern inconsistency » — trop vague pour produire un finding citable. ✅
5. **Purety du domaine déclarative, jamais mécanique.** `craft/skills/ddd-principles/SKILL.md:35` pose le critère
   « if the domain layer compiles WITHOUT the framework, it's pure » sans outil pour le prouver.
   `mattpocock_skills/skills/in-progress/setup-ts-deep-modules/SKILL.md:26-35` installe dependency-cruiser avec 4 règles `error`,
   et L79-85 exige de **prouver que les règles mordent** (ajouter une violation, la voir échouer, la retirer). 🔎 (dossier `in-progress`) ✅ pour la citation.

## 4. Gaps

| # | Gap | Fichier cible | Où greffer | Critère d'acceptation | Conf. |
|---|---|---|---|---|---|
| **P1-a** | Garde anti-port prématuré | `codebase-design/DEEPENING.md:29` | `craft/skills/ddd-principles/SKILL.md` §2 (2 lignes) | Demander un port pour un service à implémentation unique déclenche « un seul adaptateur = indirection », et un port n'est proposé que si un second adaptateur (test ou transport) est nommé. | ✅ |
| **P1-b** | Baseline Fowler nommée en revue | `code-review/SKILL.md:45-56` | `plugins/common/commands/deep-review.md`, Agent 2 (liste de 12 smells + « le repo prime », « toujours un jugement ») | Une revue sur un diff contenant un data clump ou une speculative generality nomme le smell et cite le hunk, sans être bloquante. | ✅ |
| **P2-a** | Vocabulaire de conception unifié | `codebase-design/SKILL.md:14-28`, `:105-109` | En-tête de `craft/skills/refactoring-principles/SKILL.md` (glossaire de 6 termes, **pas** un nouveau skill) | Les skills `craft` et `deep-review` disent « seam » et « interface » aux mêmes endroits ; « boundary » disparaît des textes craft. | ✅ |
| **P2-b** | « Replace, don't layer » sur les tests | `codebase-design/DEEPENING.md:32-37` | `craft/skills/testing-principles/SKILL.md` (règle : après fusion de modules shallow, **supprimer** les anciens tests unitaires) | Après un refactoring qui fusionne deux modules, les anciens tests ne sont pas conservés « au cas où » ; les nouveaux passent par l'interface. | ✅ |
| **P3-a** | Vérification mécanique des frontières | `setup-ts-deep-modules/SKILL.md:26-35`, `:79-85` | Note dans `craft/skills/ddd-principles/SKILL.md` §1 renvoyant vers deptrac (PHP) / dependency-cruiser (TS), sans installeur | Le critère de pureté nomme la commande qui le prouve. Pas de skill d'installation : ce serait de la surface. | 🔎 |
| **P3-b** | Glossaire de domaine vivant + ADR parcimonieux | `domain-modeling/SKILL.md:66-73` (les 3 critères : irréversible, surprenant, vrai arbitrage) | Rien à créer : `pocock:grill-with-docs` est déjà vendored ; au plus, les 3 critères ADR dans `craft/skills/ddd-principles`. | Une proposition d'ADR ne sort que si les 3 critères tiennent. | ✅ |

**Déjà fermés depuis l'audit mattpocock de 2026-07** (donc à retirer du backlog, cf. §6) : test de suppression
(`refactoring-principles/SKILL.md:59-73`), assertion tautologique (`testing-principles/SKILL.md:40`), scope-creep en revue
(`deep-review.md:29-34`). ✅

## 5. Divergences assumées

- **Pas de catalogue GoF.** `design-patterns/SKILL.md:1-8` (23 patterns, 566 lignes, 3 modes détection/suggestion/évaluation)
  offre à Claude un menu de patterns à appliquer. C'est un multiplicateur de la friction n°1. Le marketplace garde des règles
  de pression (Tell-Don't-Ask, whole object, test de suppression) et aucune bibliothèque de solutions.
- **Pas de notation chiffrée de la qualité.** `design-patterns/checklists/pattern-evaluation.md:13-20` note chaque critère 0-10
  et moyenne. Une pseudo-métrique qui déplace la discussion du code vers le score.
- **Pas de « design it twice » multi-agents.** `codebase-design/DESIGN-IT-TWICE.md:19-28` lance 3-4 sous-agents pour produire
  des interfaces radicalement différentes. Pour un usage solo, le grill à une question (`pocock:grill-me`) tranche plus vite pour bien moins de tokens.
- **Pas de rapport HTML Tailwind + Mermaid par CDN.** `improve-codebase-architecture/SKILL.md:39-41`. Artefact lourd, hors repo,
  dépendant du réseau ; la sortie terminale suffit.
- **Le style typographique reste dans le référentiel.** `code-style-principles/SKILL.md:15-21` (ligne vide avant/après les structures
  de contrôle) n'a d'équivalent nulle part ailleurs : c'est du house style délibéré, pas un manque des cibles.
- **Double référentiel DDD (OOP + FP).** Aucune cible ne le fait ; le coût est une décision de routage supplémentaire, assumée
  parce que les deux styles coexistent réellement (PHP/Symfony vs TS).

## 6. Dérives de doc constatées

1. **`plugins/self-audit/audits/mattpocock-skills-gap-analysis.md:156-157`** — les items P1-b (test de suppression) et P1-c
   (assertion tautologique) sont encore `[ ]` alors que le code est livré (`refactoring-principles/SKILL.md:59-73`,
   `testing-principles/SKILL.md:40`) ; idem P1-a, livré en `deep-review.md:29-34`. La checklist ment sur l'état réel. ✅
2. **`plugins/craft/README.md:21`** annonce « (More to come: `security-audit-principles`) » alors que le tableau du bas
   (`README.md:41`) le classe « ❌ NOT planned ». Le README se contredit à 23 lignes d'écart. ✅
3. **Versions de frontmatter incohérentes** : 6 des 7 skills `craft` sont en `version: "1.0"` (seul
   `tdd-workflow-principles/SKILL.md:4` est en `1.1`) alors que leurs compagnons d'exemples sont en `2.0`
   (`php-oop/SKILL.md:4`, `ts-refactoring/SKILL.md:4`) — deux fois refondus, la couche règles n'a jamais
   été renumérotée alors que `plugins/craft/.claude-plugin/plugin.json:3` est en `1.1.2`. Cosmétique, mais rend le versioning ininterprétable. ✅
4. **Déséquilibre de volume non documenté** : `ts-conventions/SKILL.md` (247 lignes) est plus gros que n'importe quel skill de
   `craft` et chevauche `ts-code-conventions` (60 lignes) sans que `craft/README.md` explique le partage — le tableau
   règles/exemples ne le mentionne pas du tout. ✅
