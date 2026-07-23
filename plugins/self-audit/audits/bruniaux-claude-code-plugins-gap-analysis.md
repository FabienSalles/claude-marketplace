# État des lieux — marketplace Fabien vs `FlorianBruniaux/claude-code-plugins`

**Verdict (answer-first).** Un **marketplace complet et bien tenu** (8 plugins, 212 templates : sécurité,
devops, release, code-quality, pr-workflow, session-tools, ai-methodology). **0 keep, 4 port-technique,
12 skip** sur le cœur recouvrant. Sa chaîne dev/review/plan/TDD est **couverte, souvent plus finement**
chez toi (`deep-review` lit le vrai code + gate scope-creep + cap 2-5 vs ses audits grep-heuristiques à
scores pondérés). **Mais c'est la seule cible de toute la campagne à apporter dans un angle neuf : la
sécurité/méta-tooling du setup Claude lui-même** — auditer l'installation Claude comme surface d'attaque
(MCP vulnérables, skills/agents malveillants, hooks exfiltrants, memory-poisoning de CLAUDE.md). Zone que
tes 8 audits précédents n'avaient pas touchée, et que Bruniaux traite en premier. C'est de là que viennent
ses meilleures greffes.

> **Confiance :** ✅ = re-greppé fichier-en-main pendant CET audit · Fan-out : **101 agents, 0 erreur, ~5,0 M tokens** ; 33 forces cibles CONFIRMED, **1 ADJUSTED** (review-plan « do-nothing », conditionnel), **1 REFUTED** (une sous-affirmation handoff sur un chemin erroné — les quotes porteuses du port, elles, sont ✅ re-greppées).

---

## Méthode & sources

- **Tier `deep`** (Workflow 2 passes) sur les **16 unités du cœur recouvrant** (code-quality, pr-workflow, ai-methodology, security-suite, session-tools). **Hors périmètre par nature** : `devops-pipeline` (CI/CD, worktrees, deploy — tu évites les worktrees), `release-automation` (changelog/social), les hooks bulk.
- **Phase 2b** (✅) : re-grep des 4 ports à leur chemin réel + absences marketplace (deep-review LLM-trust=0, refactoring stack-native=0, handoff file:line=0) + **overlap `security-runtime`** (tu as déjà `claudemd-scanner.sh` + `prompt-injection-detector.sh`).

---

## 1. Points forts validés — à PRÉSERVER

| # | Force marketplace | Où | Face à Bruniaux |
|---|---|---|---|
| 1 | Review lit le **vrai code** avant d'affirmer | `deep-review.md` L51 « Read the actual test before claiming what it covers … never assert from the diff alone » | `audit-codebase` est **grep-heuristique** (concède lui-même « may be false positives »). ✅ |
| 2 | Gate **scope-creep** lié aux critères | `deep-review.md` L33 « Flag every change … that traces to no criterion as scope-creep (the over-engineering axis) » | les audits Bruniaux n'ont pas d'axe scope-creep. ✅ |
| 3 | Sortie **minimale ~2-5 findings** | `deep-review.md` L68 « Output: Final list of ~2-5 high-impact findings » | `audit-codebase` = scores pondérés + 3 tiers + matrices impact/effort (multi-option). ✅ |
| 4 | Scan **runtime** d'injection CLAUDE.md déjà présent | `security-runtime/hooks/scripts/claudemd-scanner.sh` | Bruniaux couvre l'axe **on-demand/supply-chain** que security-runtime ne fait pas (→ P2-a). ✅ |

---

## 2. Manquements réels — BACKLOG

### P1-a — Heuristique « idiome stack-natif > pattern GoF fait main » dans `refactoring-principles` ✅
- **Manque :** rien ne code la règle « si un pattern custom a un équivalent natif du framework, recommander le natif ». C'est ta friction #1 (over-engineering) frontale.
- **Preuve cible (✅) :** `code-quality/skills/design-patterns/SKILL.md:170` « IF pattern_detected == "custom" AND stack_has_native_equivalent: » + table `:189` « | Observer | Angular | RxJS Subject/BehaviorSubject | Use built-in Observables, not custom implementation | » (Singleton→DI/Context, Chain→Express middleware, etc.).
- **Preuve du trou :** grep `native equivalent`/`stack-native` dans `refactoring-principles` = **0**. ✅
- **Cible :** `craft/skills/refactoring-principles/SKILL.md` — une règle : « avant d'introduire un pattern GoF fait main, vérifier si la stack fournit l'idiome (DI, observables, middleware…) ; préférer le natif ». ~3 lignes.
- **Acceptance :** un Singleton/Observer/Chain custom réinventant un mécanisme natif est signalé et redirigé vers l'idiome de la stack.

### P1-b — Deux règles de discipline anti-faux-positif sécurité ✅
- **Manque :** ton flux d'audit sécurité (plugin `audit` + overlay `security-overrides`) n'a pas de **pré-étape d'environnement** ni de règle « preuve concrète avant de reporter un secret ». Ferme friction #1 (bruit de FP) + amplifie ta règle verify-before-claiming.
- **Preuve cible (✅) :** `security-suite/commands/security-audit.md:29` « **Local dev**: `DEBUG=True`, CORS `*`, HTTP without TLS, `.env` files — all normal. Do NOT flag as vulnerabilities. » + `:94` « Only report a secret finding if you have **concrete proof from these commands** … Never report "secrets may be exposed" based on pattern matching alone. »
- **Cible :** `audit/skills/security-overrides` (ou le flux d'audit sécurité) — 2 règles : pré-étape env (dev/staging/prod suppriment les findings normaux-de-dev) + « secret = preuve concrète, jamais pattern-match seul ».
- **Acceptance :** un `.env` gitignoré en dev n'est pas un finding ; aucun secret reporté sans preuve d'exécution.

### P2-a — Commande d'audit supply-chain du setup Claude (complément de `security-runtime`) ✅
- **Manque :** `security-runtime` scanne **au runtime** l'injection dans CLAUDE.md. Rien n'**audite sur demande** l'installation Claude comme surface d'attaque : MCP vulnérables (vs CVE), skills/agents malveillants, hooks exfiltrants (reverse-shell / credential-access), memory-poisoning élargi. Amplifie ta force méta-tooling **et** sécurité.
- **Preuve cible (✅) :** `security-suite/commands/security-check.md:9` « Verifies your Claude Code setup for known malicious skills, vulnerable MCPs, dangerous patterns, and exposed secrets. » + `:95` « Prompt injection patterns in CLAUDE.md / SOUL.md / MEMORY.md? → HIGH ».
- **Cible :** nouvelle commande (ou mode on-demand de `security-runtime`) : check MCP↔CVE + détection skill/agent malveillant + grep exfiltration dans les hooks + memory-poisoning CLAUDE.md/MEMORY.md + scan secrets du dossier config. **Drop** le score 0-100 (multi-option, contre anti-over-engineering).
- **Pourquoi P2 :** NOUVELLE surface, mais **complémentaire** (pas doublon) de security-runtime et pile dans ta zone méta-tooling. À ouvrir si tu veux auditer périodiquement ton install. **Acceptance :** signale un MCP CVE-affecté / un hook exfiltrant / une injection CLAUDE.md, sans score cosmétique.

### P2-b — Lens « LLM Output Trust Boundary » dans `deep-review` ✅
- **Preuve cible (✅) :** `pr-workflow/skills/review-pr/SKILL.md:168-169` « LLM Output Trust Boundary … LLM-generated values (emails, URLs, names, IDs) written to DB or passed to [downstream] ». grep dans `deep-review` = **0**.
- **Cible :** `common/commands/deep-review.md`, 2 puces sous Agent 2 (Sécurité/Bugs) : valider les valeurs générées par LLM + la sortie d'outils structurée avant écriture DB / rendu. Pertinent en codebase AI-assisté. Marginal pour ton stack typé/schéma-validé (PHP/TS) → P2.

### P2-c — Convention `file:line` + « pas de full diff » dans le template de handoff `goal` ✅
- **Preuve cible (✅) :** `session-tools/skills/handoff-create/SKILL.md:74` « Use `path/to/file:line` format for all file references. » + `:76` « Do not include the full git diff or full file contents. Include only the code snippets that are non-obvious. » grep dans `goal-handoff.template` = **0**.
- **Cible :** `goal/templates/goal-handoff.template` — deux règles d'économie de contexte. Renforce le cap de handoff existant. Cheap. **Acceptance :** un handoff référence en `file:line` et n'embarque jamais un diff complet.

---

## 3. Motifs README / doc à corriger

**Aucun côté marketplace.** Bruniaux n'est ni vendored ni référencé dans `plugins/`. **Structure (Phase 4) — RAS.**

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

- **Audit codebase à scores pondérés + tiers + matrices** (`audit-codebase`) : format multi-option/haute-surface contre ton anti-over-engineering ; et grep-heuristique (FP admis). Le *besoin* audit-codebase-entier est déjà **P2-c dans l'audit AIDD** — ne pas ajouter une 2ᵉ version. Convergence, pas nouveau trou.
- **`diagnose` du setup Claude** : le *besoin* (diagnostiquer permissions/MCP/hooks) est réel et méta-tooling, MAIS l'impl **fetch un guide tiers + exécute un script d'env distant** = risque supply-chain. Ne pas porter l'impl.
- **`rtk-optimizer`** (wrapper de compression de sortie) : surface stateful contre anti-over-engineering, comme `03-condense` d'AIDD. Skip.
- **`audit-agents-skills` / `methodology-advisor` / `skill-creator`** : la couche méta (auditer/choisir/créer des skills) est **déjà ton `self-audit` + `tooling` + skill-creator externe**. Couvert.
- **`devops-pipeline` (worktrees, deploy) / `release-automation` (social)** : hors scope, non audités.

---

## 5. Verdict cherry-pick

- **0 keep, 4 port-technique, 12 skip.**
- **Ports :** stack-native heuristic → refactoring (P1-a), FP-guards sécurité → audit (P1-b), audit supply-chain Claude → nouvelle commande (P2-a), LLM-trust-boundary → deep-review (P2-b), handoff file:line → goal template (P2-c).
- **Convergences déjà au backlog** (ne pas re-porter) : whole-codebase audit (= AIDD P2-c), clarification bornée (methodology-advisor = spec-kit P2-b).

---

## 6. Sous-axes où la cible garde l'avantage (honnêteté)

- **Sécurité du setup Claude comme surface d'attaque** : vrai différenciateur (MCP↔CVE, skills malveillants, hooks exfiltrants, memory-poisoning). Ta `security-runtime` couvre le runtime CLAUDE.md ; Bruniaux couvre le supply-chain on-demand. → P2-a.
- **Diagnostic interactif de l'install Claude** (`diagnose`) : besoin réel non couvert — mais impl à risque (script distant). À réécrire proprement si besoin.
- **Audit codebase-entier scoré** : couverture large (7 catégories dont maturité `.claude/`) — mais format rejeté et gap déjà tracé (AIDD P2-c).
- **Ampleur produit** : 212 templates, 8 plugins, hooks auto-câblés, StarMapper. Industrialisation réelle ; devops/release hors ton axe.

---

## 7. Backlog exécutable (checklist)

```
[ ] P1-a  refactoring-principles : heuristique « idiome stack-natif > pattern GoF fait main » (~3 L)  [friction #1]
[ ] P1-b  audit/security-overrides : pré-étape env + « secret = preuve concrète, jamais pattern seul »  [friction #1 + verify]
[ ] P2-a  nouvelle commande (ou mode security-runtime) : audit supply-chain Claude (MCP↔CVE, skills/agents
          malveillants, hooks exfiltrants, memory-poisoning) — SANS score cosmétique  [méta-tooling + sécurité]
[ ] P2-b  deep-review : lens « LLM Output Trust Boundary » (2 puces sous Agent 2)
[ ] P2-c  goal-handoff.template : convention file:line + « pas de full diff, seulement le non-évident »
```

**Ordre recommandé :** P1-a + P1-b (cheap, friction #1) → P2-c (cheap, économie de contexte) → P2-b (marginal) → P2-a (nouvelle surface, gated — mais ta zone méta-tooling+sécurité, le meilleur apport unique de cette cible).

**Rappel garde-fou :** ne pas dupliquer l'audit-codebase (déjà AIDD P2-c) ni porter l'impl `diagnose` (script distant). Leçon transversale de la campagne complète : Bruniaux est le seul concurrent à apporter du neuf **hors du triangle spec/plan/review** — précisément parce qu'il regarde **Claude Code lui-même comme surface d'attaque**, un angle que ni toi ni les 8 autres cibles ne couvraient à fond.
