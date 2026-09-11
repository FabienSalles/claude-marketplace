# Skill-Creator Review — Marketplace-Wide Consolidation

Date: 2026-09-09

Method: one review agent per plugin, each guided by the `skill-creator` skill's authoring methodology (description/triggering quality, progressive disclosure, conciseness, eval-first principle), ran against the plugin's full contents (SKILL.md files, references/, scripts/, hooks, commands, manifests, READMEs); the 29 per-plugin reports are synthesized here into one reusable improvement backlog. Scope: 29 plugins, 108 skills.

Cross-tool compatibility findings (Copilot/Codex portability, frontmatter fields, hook support) live in `docs/copilot-codex-compatibility-audit.md` and are excluded here.

## Cross-cutting themes

Patterns appearing in 3+ plugin reports. Each theme lists the affected plugins and one representative example.

### 1. Descriptions promise content the body does not deliver

Affected: astro, frontend, marketing-analytics, marketing-content, marketing-distribution, security-runtime (inverse: description omits its most important hook).

Representative: `marketing-content:schema-markup` lists "Event, Recipe" as supported schema types in both frontmatter and body, but `references/schema-types.md` has no Event or Recipe entry — a user asking for recipe markup triggers the skill correctly, then Claude improvises ungrounded JSON-LD. Same shape: `marketing-distribution:social-content` promises Facebook with zero Facebook specs in the body; `marketing-analytics:analytics-tracking` lists Mixpanel/Amplitude/PostHog/Segment in a table with no implementation guidance for any of them; `security-runtime`'s plugin.json omits the `secret-file-guard.sh` hook entirely.

### 2. Stale names and dead references after renames

Affected: common, frontend, git, goal, superpowers, audit (stale model names).

Representative: `goal`'s shared templates still name `/goal:auto` (now `/goal:supervise`) and a bare `/next` (now `/goal:next`) — both `/goal:plan` and `/goal:next` read these templates verbatim before emitting handoffs, so the dead names are an active source of confusion, not cosmetic. Same shape: `common:feature-tdd-dev` requires skills named `tdd-workflow` / `test-conventions` that exist nowhere in the marketplace; `frontend:frontend-best-practices` hardcodes an MCP server (`chrome-devtools`) that is not the one installed.

### 3. Cross-skill and skill-vs-reference contradictions

Affected: career, craft, git, nest, phpunit, pocock, self-audit, typescript.

Representative: `typescript` ships two direct contradictions — `ts-conventions` mints branded types via `unique symbol` + `mint()` and explicitly rejects the `__brand` string-literal shape, while `ts-oop` presents exactly that rejected shape as "✅ CORRECT" (the two skills cross-link on this exact topic); and `ts-code-conventions` mandates co-located spec files while `ts-ports-adapters`'s worked example uses the forbidden mirrored `tests/` tree. Same shape: `career`'s `evidence-schema.md` worked example instructs the reader to do what the SKILL.md forbids (one file per session vs one file per course); `pocock:grill-me` lacks the wait-for-answer clause its sibling has because the two are pinned at different upstream commits.

### 4. Duplicated rules and examples that drift

Affected: audit, goal, jquery, nest, release, security-runtime, self-audit, symfony, typescript, vitest, marketing-content.

Representative: `audit:security-overrides` §6 restates `ts-security`'s security checklist almost word-for-word (bcrypt rounds, JWT rules, Zod env validation) — two sources of truth for the same numeric conventions means one gets bumped and the other silently drifts. Same shape: `release`'s bump-classification table written out fully in both README.md and SKILL.md; `security-runtime`'s two injection-pattern arrays have already diverged; `goal:supervise` and `agents/goal-run-auditor.md` maintain the same report-table format independently.

### 5. Stack leakage into stack-agnostic content

Affected: common, craft, jquery, legacy, php, phpunit, product.

Representative: `phpunit:php-tdd-workflow` — the README claims the plugin was split out so "a user on Laravel, Drupal, or a pure-PHP library" can use it, but nearly every section is Symfony-only (`WebTestCase`, `services.yaml`, `bin/console`), and the "PHP-specific: Default Test Level" table is mislabeled: its rows prescribe Symfony base classes. Same shape: `craft:testing-principles` §15 embeds Jest/Cucumber/Pact content in the cross-language layer (Jest is not even this marketplace's TS runner); `php:php-ddd-conventions`'s "Forbidden in Domain Layer" list is entirely Symfony/Doctrine while the README claims Laravel compatibility; `legacy`'s Phase 5 references are PHP/Symfony-only under a stack-agnostic description.

### 6. Re-teaching what a frontier model already knows

Affected: audit, astro, common, marketing-analytics, marketing-content, marketing-strategy, nest, phpunit, tooling, typescript.

Representative: `marketing-strategy:marketing-psychology` re-teaches ~70 textbook concepts (Sunk Cost Fallacy, Anchoring, Loss Aversion) with full generic definitions before the one useful "Marketing application" line — the largest file in the pack, and most of its bulk is redundant with the model's own knowledge. Same shape: `audit:ts-security`'s full ❌/✅ pairs for textbook SQLi/XSS; `nest-conventions`'s full generic guard/pipe/filter class bodies; `tooling`'s Drizzle CRUD and Zod composition API documentation; `typescript:ts-code-conventions` explaining `?.` and template literals.

### 7. Trigger-phrase precision: bare keywords over- or under-trigger

Affected: astro, common, git, goal, marketing-analytics, pocock, tooling, vitest.

Representative: astro's three-way "hreflang" collision — `astro-i18n`, `astro-seo`, and `astro-sitemap` all carry the bare word as a trigger but each produces a different artifact (`<head>` link tags vs sitemap XML alternates), so "add hreflang to my pages" can route to the wrong output entirely. Same shape: `git:git` triggers on bare 'commit'/'push'/'merge' (common non-git words); `goal:grill-adversarial` triggers on bare 'state machine'/'invariants'; `vitest-test-conventions` on bare 'Vitest'; `pocock`'s grills under-trigger by relying on the literal word "grill".

### 8. Progressive-disclosure extraction targets (oversized bodies, missing TOCs, inline boilerplate)

Affected: git, goal, legacy, marketing-analytics, marketing-content, marketing-distribution, marketing-strategy.

Representative: `goal:plan` at 931 lines carries a ~125-line inline plan-file template (while the plugin has a `templates/` convention it doesn't use for its own output) and a ~95-line gate-writing guide only needed in Phase 3 — both are ready-made extractions to `templates/` and `references/`. Same shape: `marketing-analytics`' GA4/GSC skills repeat the same curl+python scaffold 7-8 times each instead of one parameterized script; `marketing-distribution:social-content`'s Reddit OAuth curl (~90 lines) belongs in `scripts/`; five `legacy` reference files exceed 300 lines with no table of contents.

### 9. No evals anywhere; every report ships ready-to-use scenarios

Affected: all 29 plugins (only `career` has an `evals/evals.json`, and it uses a bespoke schema incompatible with the skill-creator tooling).

Representative: the skill-creator eval-first principle is unmet marketplace-wide — no `evals/evals.json` exists for any skill except career's hand-rolled one. Each per-plugin report includes 2-3 concrete should-trigger / should-not-trigger / output-correctness scenarios ready to be seeded; the highest-payoff candidates are the skills whose defects above would have been caught mechanically (astro's hreflang collision, typescript's branded-type contradiction, mac's hook regex bug).

### 10. Time-sensitive data without refresh guards

Affected: audit, career, marketing-content, marketing-distribution, marketing-strategy, self-audit.

Representative: `marketing-content:content-calendar` / `linkedin-content` embed hard numeric claims ("LinkedIn Algorithm Signals (2026)", 2-6% engagement targets) with a one-line "Last reviewed 2026-07" disclaimer that downstream output will not carry. Same shape: `career`'s `marche-fr.md` market figures; `self-audit`'s `usage-profile.md` prioritization lens sourced 2026-07-20 with no staleness check; `audit`'s GitHub Action template naming specific model versions.

## Per-plugin findings

### astro

**P1**

- **astro-i18n / astro-seo / astro-sitemap**: all three descriptions carry the bare word "hreflang" as a trigger/covered-content term, but each implements a *different artifact* — `astro-i18n` and `astro-seo` both produce HTML `<link rel="alternate" hreflang>` tags in `<head>` (astro-seo's own reference correctly defers to astro-i18n for this), while `astro-sitemap` produces `item.links` alternates inside the sitemap XML `serialize()` callback (`skills/astro-sitemap/references/sitemap-configuration-examples.md:62-71`) — a structurally unrelated output. A query like "add hreflang to my pages" can route to the sitemap skill and produce XML-sitemap code when the user wanted `<head>` tags, or vice versa. → Disambiguate the trigger phrases so the artifact is named, not just the keyword:
  - `skills/astro-i18n/SKILL.md:3` — replace `'hreflang'` with `'hreflang link tags'` (or `'alternate language link in head'`).
  - `skills/astro-seo/SKILL.md:3` — replace `multilingual SEO with hreflang` with `multilingual SEO with hreflang <head> tags`.
  - `skills/astro-sitemap/SKILL.md:3` — replace `multi-language sitemap with hreflang` with `multi-language sitemap with hreflang XML alternates` (distinct from head tags — see astro-seo/astro-i18n).

**P2**

- Pack coverage gap: no skill for `astro:assets` (`<Image>`/`<Picture>`/`getImage()`) — add `astro-images` or fold into `astro-basics`.
- Pack coverage gap: Astro 5 Actions (`defineAction`, form-backed mutations) uncovered despite the "Astro 5.x" plugin claim — add a skill or mark out of scope in the README.
- `skills/astro-seo/SKILL.md:3` overclaims "multilingual SEO with hreflang" while the reference only points to astro-i18n — reword to "delegates hreflang implementation to astro-i18n".
- Eval ideas for astro-i18n / astro-content-collections / astro-seo (routing + output-correctness scenarios, including one that directly exercises the P1 collision).

**P3**

- `astro-tailwind`: the "Responsive Breakpoints" table restates Tailwind's stock defaults — first trim candidate.
- `astro-tailwind` DO NOT clause should name `astro-basics` like every sibling does.

### audit

**P1**

- **security-overrides** — Section "6. Project-Specific Patterns to Always Check" (`skills/security-overrides/SKILL.md:84-93`) restates `ts-security`'s "Security Checklist" (`skills/ts-security/SKILL.md:170-181`) almost word-for-word: bcrypt ≥12 rounds, Drizzle parameterized queries, JWT expiration/secret/algorithm, Zod env validation, Helmet headers, SameSite cookies. Two sources of truth for the same numeric conventions (e.g. `SALT_ROUNDS`) means one gets bumped and the other silently drifts. → Delete section 6 from `skills/security-overrides/SKILL.md`, and let section "5. Cross-References to Companion Skills" (line 77-82) be the only pointer to `audit:ts-security`'s checklist. Also trim the "Quick Reference" table's "Stack-specific" row (line 103) from a value list to `See audit:ts-security`.

**P2**

- `ts-security` body (`SKILL.md:21-156`) mostly re-teaches textbook OWASP patterns — collapse to one compact "project defaults" block (SALT_ROUNDS=12, JWT ≥32 chars + `algorithms: ['HS256']`, `sameSite: 'strict'`, `execFile` over `exec`, Zod env schema).
- `ts-security` description doesn't rule out PHP/Symfony — append `or PHP/Symfony findings (see security-audit:security-audit for those)` to the DO-NOT clause.

**P3**

- `templates/claude-code-security-review.yml` names specific model versions ("Opus 4.1", `claude-sonnet-4-6`) — rephrase model-agnostically.
- No `evals/evals.json` — seed triggering + FP-filter regression cases (Symfony-in-scope, Flask-out-of-scope, SALT_ROUNDS convention surfacing).

### career

**P1**

- **career-evidence** — `references/evidence-schema.md` §3 (frontmatter table, formation column) and §12 (worked example) model a **formation file as one session** (`date`, `jours`, `participants`, `canal`, `disclosure` all required, one session's worth of `## Réalisations`). This directly contradicts `skills/career-evidence/SKILL.md` §1-§2, which mandates **one file per course** (`formation`, `catalogue`, `duree_standard`, `premiere_session`, `derniere_session`, no `disclosure` at file level) with a session table in the body — the exact "training is the exception" rule the README calls out as the plugin's core differentiator. The reference file's own worked example instructs the reader to do the thing the SKILL.md explicitly forbids. → Rewrite `references/evidence-schema.md` §3's formation column and §12's worked example to match the course-per-file model: frontmatter carries `formation`, `catalogue`, `duree_standard`, `premiere_session`, `derniere_session` and no `disclosure`; body carries a `Sessions` table (Date | Days | Participants | Client | Format) mirroring `skills/career-evidence/SKILL.md` lines 100-103. File: `plugins/career/skills/career-evidence/references/evidence-schema.md:56-79,262-297`.
- **career-evidence** — `skills/career-evidence/SKILL.md` never links to `references/evidence-schema.md` anywhere in its body (only `references/quantification.md` is linked), even though evidence-schema.md opens with "the file format the whole plugin rests on" and carries the validation checklist and all three worked examples — which is also why the contradiction above went unnoticed. → Add a signpost after SKILL.md §2 ("Frontmatter"): "For the full field reference, worked examples per type and the validation checklist, see [references/evidence-schema.md](references/evidence-schema.md)." File: `plugins/career/skills/career-evidence/SKILL.md` (insert near line 92, end of §2).

**P2**

- `evals/evals.json` uses a bespoke `routing`/`behaviour` schema incompatible with skill-creator's grader tooling — add a `$comment` or a parallel canonical `evals[]` array.
- No eval exercises the course/session boundary the P1 sits on — add the "append a third session" case plus cv-tailor and linkedin-profile companions.
- `linkedin-profile/references/marche-fr.md` dated market figures — add a "flag as unverified if >6 months old" line.

**P3**

- `cv-tailor` carves out cover letters/proposals with no designated owner anywhere — note in the README's Related section.
- `ats-rules-fr.md` §12 EU AI Act date — apply the same reverify-if-stale pattern for consistency.

### common

**P1**

- **commands/feature-tdd-dev.md** — "Required Skills" section says: *"load and apply these skills: `tdd-workflow`, `test-conventions` (if available)"*. Neither name exists anywhere in the marketplace — the real skills are `craft:tdd-workflow-principles` plus the language companion (`phpunit:php-tdd-workflow` / `vitest:vitest-tdd-workflow`) and `phpunit:php-test-conventions` / `vitest:vitest-test-conventions`. The command then hardcodes PHP-only commands (`docker compose exec php ./vendor/bin/phpunit`, `make php/tests`) even though the README markets it as cross-language. → Rewrite the "Required Skills" block to point at `craft:tdd-workflow-principles` (it already routes to the right language companion) and drop the hardcoded PHP command block in favor of "run the project's test command for the changed file," mirroring how `common:spec-first-dev` Phase 4 already does this correctly. File: `plugins/common/commands/feature-tdd-dev.md` lines 10-14 and 150-161.
- **skills/product-research/SKILL.md** — the "Feeding into BMAD" section tells Claude to run `/bmad:bmm:workflows:create-product-brief`. No `bmad` plugin or command exists anywhere in this marketplace. Following this instruction produces a command-not-found dead end. → Remove the "Feeding into BMAD" section, or replace it with a generic close ("hand the findings to whatever planning workflow the project uses next"). File: `plugins/common/skills/product-research/SKILL.md` lines 83-88.

**P2**

- `crispi-planning` wall-clock phase budgets ("max 5 min") are unverifiable by a model — replace with size/scope proxies (bullet counts, plan-file length). Lines 25, 37, 49, 70, 90.
- `expert-persona-skills` — only the Security Auditor persona has a DO-NOT redirect; extend the clause to point PM/vendor/competitor asks at `marketing-strategy:product-marketing` / `competitor-analysis` / `common:product-research`.
- `context-window-management` triggers don't distinguish session degradation from factual "what's Claude's context window size?" — rewrite proposed in the source report (symptom-based ACTIVATE + explicit DO-NOT).

**P3**

- `expert-persona-skills` plural name inconsistent with singular siblings; French sentence mid-body in an English SKILL.md; `context-window-management` restates baseline tool hygiene; `deep-review` overlaps harness-native `code-review` with no distinguishing line.
- Eval ideas for claude-recovery, crispi-planning, expert-persona-skills (trigger/near-miss/negative triads in the source report).

### craft

**P1**

- **testing-principles** — §15 ("Test Doubles — the Doctrine the Reference Code Proves") is Jest/Cucumber/Gherkin/Pact-specific content (`jest.mock`, `node:assert` in Cucumber, `*.pact.spec.ts`, Gherkin steps) sitting inside a file whose own header promises "tool-specific examples... live in phpunit:php-test-conventions / vitest:vitest-test-conventions." Worse, **Jest isn't even this marketplace's TS test runner** — the companion is `vitest:*`; no `jest` skill exists anywhere. §15 also largely re-states §10/§11 under a new label, so it's both misplaced and redundant. The `jest.mock`/`jest.fn()` code example under §11 has the same problem. → Delete §15 entirely (or fold any genuinely cross-language claims into §10/§11 as one added sentence, generalized without naming Cucumber/node:assert). Rewrite the §11 code example in pseudocode (`double.mock(...)`, `double.fn()`) matching the file's own stated contract. File: `plugins/craft/skills/testing-principles/SKILL.md` (§11 lines ~150-162, §15 lines 253-279).

**P2**

- `ddd-fp-principles` §1 hardcodes the TS keyword `readonly` in the cross-language rules layer — replace with "all fields immutable (TS: `readonly`, and the equivalent marker in any other FP-capable language)". Line 16.
- `testing-principles` is the only one of the 7 skills without a trailing DO-NOT clause — append `DO NOT use for: tool-specific test syntax (see phpunit:php-test-conventions / vitest:vitest-test-conventions), TDD process/iteration order (see craft:tdd-workflow-principles).`

**P3**

- `ddd-fp-principles` has only one language companion — note where a future second FP companion slots in (README).
- Re-check `testing-principles` length after the P1 trim; eval triads for testing-principles / tdd-workflow-principles / code-style-principles in the source report.

### frontend

**P1**

- **frontend-best-practices** — Habit #3 ("Chrome DevTools as first reflex") hardcodes a single MCP tool call: `` Use the `chrome-devtools` MCP (`mcp__chrome-devtools__evaluate_script`) `` (skills/frontend-best-practices/SKILL.md:100). The actual browser-automation MCP in this environment is `claude-in-chrome` (`mcp__claude-in-chrome__javascript_tool`, `read_console_messages`, etc.). The skill gives zero fallback and its own rule is "don't ask the user for values, inspect directly" — if `chrome-devtools` isn't installed, following the letter of the skill leaves Claude unable to inspect at all, silently defeating the skill's central value proposition with no documented recovery path. → Generalize the instruction instead of naming one server: "Use whatever browser-automation MCP is available (`chrome-devtools`'s `evaluate_script`, or `claude-in-chrome`'s `javascript_tool`/`read_console_messages`) to retrieve `getBoundingClientRect()`, `getComputedStyle()`, and DOM structure." Keep the example script (already tool-agnostic JS) and only fix the one paragraph naming the tool.

**P2**

- `frontend-clean-architecture` and `craft:ddd-principles` describe the same domain-purity concepts with no cross-reference in either direction — add a one-line body pointer (and optionally list it among craft's companions).
- `plugin.json` description omits the third skill — rewrite to `"Frontend clean architecture (hexagonal), Container/Presentation patterns, and safe-editing practices for existing UI."` (plugins/frontend/.claude-plugin/plugin.json:4).

**P3**

- Bilingual trigger phrases in one skill only — pick a pack-wide convention; "frontend" is a broad name for a stack-specific pack (discoverability note only).
- Eval ideas: shared-component additive-variant check, incompatible-constraints lift, autonomous devtools inspection; component-split thresholds.

### git

**P1**

- **git** — README misrepresents the PR language default. `README.md`'s skill table says "PR conventions (**French title**, ultra-succinct body, draft for WIP, fork targets parent)", but `skills/git/SKILL.md` §F actually says the default is **English** title/body, French only when the repository's own `CLAUDE.md` asks for it. Anyone reading the README without opening SKILL.md gets the opposite default. → Fix `plugins/git/README.md` line 17, e.g.: `PR conventions (English title/body by default — French only if the repo's CLAUDE.md asks — ultra-succinct body, draft for WIP, fork targets parent)`.

**P2**

- Bare single-word triggers ('commit', 'push', 'merge', 'branche') over-trigger on non-git language — pair them with git context (`'git commit'`, `'merge la branche'`, `'historique git'`) in the frontmatter description.
- §E/§I reference policy names (`manual` / `commit` / `commit+pr`) without defining their origin — add one line: "Policy names come from `goal:plan`'s commit-policy field; outside a goal workflow, treat the session as manual."

**P3**

- §F (PR conventions, ~150 of 327 lines) is a clean extraction to `references/pr-conventions.md`; "ACTIVATE" phrasing is house style — confirm deliberate.
- Eval ideas: fetch-before-answering, one-branch-one-PR, the never-post-review-reply-without-consent guardrail, and a colloquial-"commit" should-not-trigger probe.

### goal

**P1**

- **`plan` / `next` (via `templates/`)** — Both shared templates still name a command that no longer exists. `templates/goal-handoff.template:4-5` says *"Both `/goal:plan` ... and `/next` (between-iteration handoff) emit THIS text"* and *"`/goal:auto` builds its subagent brief from it too"*; `templates/post-merge.template:3,7` says *"Both `/goal:auto` (final report) and `/goal:next` ... emit THIS text"* and *"`/goal:auto` may not delete a branch..."*. There is no `/goal:auto` skill in this plugin (confirmed via `find` and `grep -rn "goal:auto"`) — the command that plays that role today is `/goal:supervise`. The bare `/next` on line 4 of `goal-handoff.template` is also wrong — the skill is namespaced `/goal:next` everywhere else. Because `/goal:plan` and `/goal:next` both read these templates' "How to fill it" section verbatim before emitting a handoff, this is an active source of confusion, not cosmetic. → In `templates/goal-handoff.template` lines 4-5: replace `` `/next` `` with `` `/goal:next` `` and `` `/goal:auto` `` with `` `/goal:supervise` ``. In `templates/post-merge.template` lines 3 and 7: replace both `` `/goal:auto` `` occurrences with `` `/goal:supervise` ``.

**P2**

- `plan/SKILL.md` (931 lines): extract the inline ~125-line plan-file template (lines 642-767) to `templates/goal-plan.template` and the gate-writing guide (lines 488-583) to `references/gate-writing-guide.md`, each with a one-line Phase 3 pointer.
- `supervise/SKILL.md:198-270` and `agents/goal-run-auditor.md:37-80` maintain the Duration/Attribution report-table format independently with slightly different wording — move shared rules to one file both `Read`, or add cross-reference comments so an edit to one prompts a check of the other.
- `grill-adversarial` description ends with bare CS vocabulary ('state machine', 'invariants', 'edge transitions') that adds false-positive surface — rewrite the trigger tail to workflow-specific phrases plus a DO-NOT for generic algorithm-design questions.

**P3**

- Eval scenarios for `supervise` (halt classification), `spec` (evidence gate, multi-signal split, fixed-premise STOP), `plan` (unmapped business rule, missing gate1) — detailed in the source report; no evals exist for any goal skill.
- `templates/post-merge.template:20` names a `-tracks-spec.md` path that matches no naming convention in `plan/SKILL.md` — check in the same pass as the P1 rename.

### jquery

**P1**

(none)

**P2**

- `references/anti-patterns.md` #3 and #8 are Symfony-specific (FormType, name-strategy IDs) while SKILL.md and README claim "framework-agnostic" — rewrite both with backend-neutral phrasing.
- Anti-patterns #3-#7 and #10 duplicate SKILL.md's own ✅/❌ pairs nearly verbatim — trim the reference to the 4 net-new entries (#1, #2, #8, #9) or move all examples to the reference and keep SKILL.md to rule + link.
- `plugin.json` description is a weaker rewrite of the SKILL.md description (drops triggers and DO-NOT scope) — align or deliberately keep as one-line summary.

**P3**

- `.trigger('focus')` preference lacks its rationale; "ACTIVATE" phrasing note; eval triad (per-block scoping output check, React near-miss, lazy `data-*` regression).

### legacy

**P1**

(none)

**P2**

- Three Phase-5 references (`deterministic-tools.md`, `safety-net.md`, `write-the-analyzer.md`) are PHP/Symfony-only under a stack-agnostic description — either scope the plugin description or split by stack the way `audit-prep.md` §4 already does (e.g. `deterministic-tools-ts.md`).
- Five reference files exceed 300 lines (up to 967) with no anchor-linked table of contents — add a "## Contents" block to each.
- Provenance tagging inconsistent: `safety-net.md`/`audit-prep.md` use a blanket disclaimer while the other three tag per-command `[ran here]`/`[not run here]` — align or explain the difference in one line.

**P3**

- Add English trigger equivalents for the audit-prep half ('security assessment prep'); seed the three eval scenarios (onboarding, audit-prep handoff, PR-description near-miss); pick one canonical term between "shared brain" and "knowledge base".

### mac

**P1**

- **bsd-gnu-lint hook** — the `sed -i` detector never fires on either realistic broken form. Verified by direct test: `sed -i 's/foo/bar/' file.txt` and `sed -i "s/foo/bar/" file.txt` (the two idioms every GNU-habituated user actually types) produce **no warning**, because the trigger regex requires a non-quote character immediately after `-i␣`, and both real-world scripts start their next token with a quote. The only string that lights it up is the unquoted, syntactically-unusual `sed -i s/foo/bar/ file.txt`. → In `plugins/mac/hooks/bsd-gnu-lint.sh` lines 34-37, drop the `[^'\"]` exclusion from the trigger clause (match `sed … -i[[:space:]]+` unconditionally) and keep only the second grep as the "already portable" exclusion (`''`, `""`, or `.ext` immediately after `-i`). Confirmed via:
  ```
  echo "sed -i 's/foo/bar/' file.txt" | grep -qE "sed[[:space:]]+(-[A-Za-z]*)?-i[[:space:]]+[^'\"]" # → no match (bug)
  ```
  The other 6 detectors were each verified to match their canonical broken form correctly — this is isolated to the `sed -i` branch.
- **README.md** — line 12 of `plugins/mac/README.md` documents the sed detection as working, which is currently false per the bug above; once the regex is fixed this line becomes accurate again, no separate edit needed.

**P2**

- The hook fires BSD-portability advice on commands targeting Linux (`ssh host "sed -i ..."`, `docker exec`) — skip those prefixes or add an `additionalContext` caveat.
- `mac-platform` SKILL.md has the same blind spot — add `scripts explicitly targeting Linux/CI runners or remote hosts (BSD caveats don't apply there)` to the DO-NOT clause (line 3).

**P3**

- Eval triad (setup.sh warning, `${NAME,,}` + bash-3.2 shebang, ubuntu-latest near-miss); house-style phrasing note; decide now whether "mac" grows beyond shell portability.

### marketing-analytics

**P1**

- **analytics-tracking**: the "Tool Integrations" table (`skills/analytics-tracking/SKILL.md:289-301`) lists Mixpanel, Amplitude, PostHog and Segment as things this skill helps with, but the skill provides zero implementation guidance for any of them — every deep-dive reference and every prerequisite is Google-stack only. Because the description's trigger phrases include generic terms like "event tracking" and "tracking plan", a request like "set up Mixpanel tracking for our signup funnel" will trigger this skill, which then has nothing but a one-line table cell to go on — high risk of Claude fabricating plausible-but-wrong Mixpanel/Segment API calls for a real production integration. → Either cut the table down to GA4/GTM (the tools this skill actually implements) or explicitly caveat the other rows as "not covered here, no implementation detail provided." Simplest fix: trim the table to two rows (GA4, GTM).

**P2**

- `google-analytics` and `search-console` bodies are 7-8 near-identical curl+python blocks each — extract one parameterized `scripts/run_report.py` + parser, shrink each SKILL.md to a dimensions/metrics table + one canonical example (~150 lines saved per file).
- `analytics-tracking` "Core Principles" and "Task-Specific Questions" restate generic analytics best practice — trim to the Object-Action naming format and the privacy/consent question.
- "SET UP or audit" is ambiguous next to google-analytics's reporting trigger — tighten to implementation-audit vs data-audit wording (rewrite in the source report).

**P3**

- Qualify bare "sessions"/"page views" triggers; add a TOC to `ga4-implementation.md` (290 lines, about to cross the threshold); eval scenarios for all three skills (dateRanges/dimension assertions, striking-distance filter, tracking-plan template compliance).

### marketing-content

**P1**

- **schema-markup**: The frontmatter description lists `"...HowTo, Review, LocalBusiness, Event, Recipe"` as supported types, and the body (line 13) repeats the list — but `skills/schema-markup/references/schema-types.md` has no Event or Recipe entry (TOC stops at 8 types, and the HowTo section even says "Do not use HowTo for recipes (use Recipe schema instead)" without ever providing that Recipe schema). A user who asks for event or recipe markup triggers the skill correctly, then Claude has nothing grounded to pull from and will improvise JSON-LD without the Google-requirements table the other 8 types get. → Either add "Event" and "Recipe" sections to `references/schema-types.md` (same JSON-LD template + Google requirements format as the existing 8), or drop them from the description/body. Minimal fix if trimming:
  ```
  description: "ACTIVATE when the user asks for Schema.org structured data (JSON-LD) to earn rich results — FAQ, Product, Article, Breadcrumb, Organization, HowTo, Review, LocalBusiness. Trigger phrases: 'schema markup', 'structured data', 'JSON-LD', 'rich snippets', 'rich results', 'FAQ schema', 'product schema', 'article schema'. For technical SEO diagnostics, see seo-audit."
  ```
  Files: `skills/schema-markup/SKILL.md:4`, `skills/schema-markup/SKILL.md:13`, `skills/schema-markup/references/schema-types.md`.

**P2**

- copywriting / copy-editing / write-blog re-teach the same writing-mechanics rules three times — keep the full treatment in `copy-editing` only, one-line pointers in the other two (files and line ranges in the source report).
- `write-blog`'s 50-line conditional Unsplash block (lines 238-289) → move to `references/unsplash-sourcing.md` with a one-line pointer.
- content-calendar / linkedin-content hard numeric benchmarks with a "Last reviewed 2026-07" disclaimer — replace non-load-bearing numbers with directional guidance.

**P3**

- Unenforceable "80%/90% active voice" percentage MUSTs — reframe directionally; duplicated SemRush curl pattern across write-blog/seo-content-brief; overlapping SERP-analysis steps (correctly disambiguated, no action).
- Eval scenarios: schema-markup JSON validity + the Recipe should-fail-gracefully case; seo-audit deterministic scoring; write-blog structural checklist.

### marketing-distribution

**P1**

- **social-content**: description and README both list **Facebook** as a covered platform ("Reddit, Twitter/X, LinkedIn, Instagram, Facebook, TikTok"), but the "Platform Specifications" section (`skills/social-content/SKILL.md:29-124`) only covers Twitter/X, LinkedIn, Instagram, TikTok. There is no Facebook character limit, image size, posting-time, or hashtag guidance anywhere in the body. A user who asks for a Facebook post gets Claude improvising specs with nothing to ground them, or silently falling back to Instagram numbers. → Either add a `### Facebook` spec table (character limit ~63,206 but effective ~40-80 words, image 1200x630, hashtag guidance "1-2 or none"), or drop "Facebook" from the description/README table and trigger list. Files: `skills/social-content/SKILL.md`, `.claude-plugin/plugin.json:4`, `README.md:15`.

**P2**

- Six near-identical "Last reviewed 2026-07 — verify before quoting" hedges across social-content and email-subject-lines — collapse to one caveat at the top of the numeric-claims section.
- Platform tables are ~200 of 463 lines and most requests need one platform — split to `references/platforms/{twitter,linkedin,instagram,tiktok}.md` (domain-organization pattern).
- Reddit OAuth flow (~90 lines of curl, partially re-derived in thread-writer) — extract `scripts/reddit_auth.sh` + `scripts/reddit_post.sh` shared by both skills.

**P3**

- Add pre-flight checklists to email-subject-lines/social-content mirroring thread-writer's; description rewrite ready if Facebook is dropped; Reddit-posting-only coverage note.
- Eval scenarios: Facebook-gap probe, confirm-before-post gates, platform-native variants, 20-tweet pushback, spam-word check on user-supplied drafts.

### marketing-strategy

**P1**

(none)

**P2**

- `marketing-psychology` (453 lines) re-teaches ~70 textbook concepts before each "Marketing application" line — trim each entry to name + application line (or move the glossary to `references/mental-models-glossary.md`), cutting the file roughly in half.
- `competitor-analysis` front-loads ~70 lines of optional API mechanics (SemRush/SerpAPI/ScrapingBee curl, column-code tables) ahead of the Step 1-10 workflow — move to `references/api-integrations.md` with one-line pointers from Steps 3/4.

**P3**

- No pricing-strategy skill (Van Westendorp, packaging, WTP) despite the pack otherwise covering the strategy layer; hardcoded "2025" in marketing-ideas #6; ICP / Target Customer / Target Audience terminology drift across three skills.
- Eval scenarios: no-API-keys graceful fallback, scope-down requests, key-set curl correctness; product-marketing-context auto-draft vs Q&A path selection and partial-update behavior.

### nest

**P1**

- **nest-conventions + nest-ddd-conventions**: the two skills leave a real gap on domain-error-to-HTTP mapping that will produce broken code when both are followed together. `nest-ddd-conventions` (skills/nest-ddd-conventions/SKILL.md:34) puts domain exceptions in `domain/error/` and forbids the domain layer from importing anything HTTP-related, so a domain error cannot be an `HttpException`. But the only exception-handling guidance in the pack, `nest-conventions`'s Exception Filters section (skills/nest-conventions/SKILL.md:129-151), is `@Catch(HttpException)` — it never catches the domain error base class. Concrete failure: agent throws `class ReceiptNotFoundError extends Error {}` from a domain service per the DDD skill, the filter shown in nest-conventions silently misses it, and the request falls through as an unhandled 500 instead of the intended 404. → Add a short "Domain error → HTTP mapping" subsection (in `nest-ddd-conventions`'s directory-structure section or right after `nest-conventions`'s Exception Filters section) showing a base `DomainError` class and an infrastructure-layer filter/mapper that translates it to the right `HttpException`, and cross-reference it from both files.

**P2**

- The Symbol-token repository example is duplicated almost verbatim (`RECEIPT_REPOSITORY` etc.) across both skills — split the concern: module-registration/`@Inject()` in nest-conventions, port+adapter in nest-ddd-conventions, mutual pointers.
- Guards/Pipes/Filters sections show full textbook implementations — trim each to the one-line convention + decorator-placement snippet.

**P3**

- Drop the constructor-injection ❌/✅ pair (restates a universal default); eval quartet covering the boundary between the two skills (upload endpoint, domain-service near-miss, port placement, ConfigService-in-domain flag).

### php

**P1**

- **php-ddd-conventions** — the entire "Forbidden in Domain Layer" list (`UploadedFile`, `Request`/`Response`/`RedirectResponse` from `Symfony\Component\HttpFoundation`, Doctrine entities/`EntityManagerInterface`) is Symfony-specific, but `README.md` claims the plugin is framework-agnostic and that "a Laravel project takes `php` alone or `php` + `phpunit`". A Laravel consumer following this skill gets advice about the wrong HTTP/ORM classes (Illuminate `Request`, Eloquent models) with no coverage at all. → Either (a) generalize the "Forbidden"/"Allowed" tables in `skills/php-ddd-conventions/SKILL.md` to name the *category* ("framework HTTP request/response objects", "ORM entities/EntityManagerInterface-equivalent") with Symfony classes as one worked example, or (b) narrow the README claim — drop "a Laravel project takes `php` alone" and note that the DDD skill's examples assume Symfony HttpFoundation + Doctrine. (b) is the cheaper fix: one sentence in `README.md`'s intro and in the DDD row of the skills table.

**P2**

- Cross-check that `php-8-0`'s constructor examples and `php-code-conventions`'s parameter-ordering rule never produce two different "correct" orderings for the same constructor (next time either is edited).
- README groups `php-sql-conventions` and `php-composer-conventions` under one unrelated "Data & tooling" header — split or flatten.

**P3**

- Version-named skills (`php-8-0`…) vs rule-named alternative; `php-code-conventions` Quick Reference restates the body; two near-duplicate SQL JOIN examples; no exception-handling conventions skill (idea only).
- Eval scenarios: named-arguments mechanics (4-arg constructor, 3-arg call, native-function exception), domain-purity boundary triad, `empty()`/nullsafe/parameter-ordering sweep.

### phpunit

**P1**

- **php-tdd-workflow** — README claims this plugin was split out "so a user on Laravel, Drupal, or a pure-PHP library can pull just the testing skills without dragging in Symfony-specific conventions," but `php-tdd-workflow` delivers almost nothing else. Every section except "Refactor with Data Providers" and "Mocks Hiding Bugs" is Symfony-only (`WebTestCase`, Twig components, `services.yaml`, `bin/console debug:router`, `docker compose exec php`). Worse, the "PHP-specific: Default Test Level" table is *mislabeled* — its own rows prescribe `WebTestCase` for controllers and `KernelTestCase` for repositories, both Symfony base classes, under a "PHP-specific" heading. → Two viable fixes, pick one:
  1. Match what `php-test-conventions` already does: move the Symfony-only sections into a new `symfony:symfony-tdd-workflow` skill, leaving `phpunit:php-tdd-workflow` framework-agnostic.
  2. Cheaper: stop claiming portability. Drop the Laravel/Drupal sentence from `plugins/phpunit/README.md` and relabel the table's Controller/Repository rows "Symfony-specific" in `plugins/phpunit/skills/php-tdd-workflow/SKILL.md`.

**P2**

- Both skills teach deprecated PHPUnit doc-comment annotations (`/** @test */`, `/** @dataProvider */`) as primary syntax — switch to `#[Test]` / `#[DataProvider(...)]` attributes, caption any kept docblock form "PHPUnit < 10" (line refs in the source report).
- The "Commands" section hardcodes one team's Makefile + Docker Compose — caption as project convention or keep only `./vendor/bin/phpunit`.

**P3**

- "SUT Naming" / "Factory Methods" sections state things a frontier model already does — trim candidates.
- Eval scenarios: Symfony TDD end-to-end, Laravel/Livewire near-miss (probes the P1 leak), data-provider refactor, Prophecy-vs-createMock ruling, WebTestCase routing to symfony:symfony-test-conventions.

### pocock

**P1**

- **grill-me** — Body never tells Claude to wait for the user's answer before asking the next question, so "relentless interview" can degenerate into Claude firing off several questions in one message (defeats the whole point of a turn-by-turn grill). The sibling skill `grill-with-docs`, pinned from a later upstream commit, already has this instruction — the two drifted apart because each is frozen at a different `mattpocock@<hash>`. → Add the same clause. File: `plugins/pocock/skills/grill-me/SKILL.md`, line 9.
  Current: `Ask the questions one at a time.`
  Fix: `Ask the questions one at a time, waiting for feedback on each question before continuing.`

**P2**

- Both grill descriptions under-trigger (rely on the literal "grill me" / "stress-test") — widen with 'poke holes in this', 'devil's advocate', 'pre-mortem' (full rewrites for both descriptions in the source report).
- Routing by filesystem state ("Pick X when there's an existing CONTEXT.md") is decided blind at trigger time — either accept, or have grill-with-docs confirm before writing to docs when not obviously invoked for that.

**P3**

- Eval scenarios (one-question-at-a-time check, glossary-ambiguity flag, no-CONTEXT.md fallback preference); `zoom-out` needs a no-glossary fallback clause; `<what-to-do>` tag drift between snapshots is expected, no action.

### product

**P1**

(none)

**P2**

- `goal:plan` covers the exact territory `product:vertical-slice`/`product:delivery` own without naming either — add a pointer in goal:plan's description (cross-plugin coordination) and one line in this plugin's README naming the goal workflow as a caller.

**P3**

- PHP-flavored pseudocode in the deliberately stack-agnostic `delivery/references/feature-flags.md:48-59` — swap for neutral pseudocode; make the BC-break pre-approval condition explicitly apply outside the goal workflow; scoped-out prioritization/DoD coverage is likely intentional.
- Eval scenarios: conjunction-splitting before horizontal split, "can't be split" reframing, expand/contract sequence with the destructive drop in its own slice, flag-cleanup-never-shares-a-plan enforcement.

### release

**P1**

(none)

**P2**

- `version-bump` Step 2's "stale before the branch" branch has no concrete detection command — add an explicit staleness check (diff the plugin's version at `last_bump` vs current `plugin.json`, or commit count on the plugin's path). File: `plugins/release/skills/version-bump/SKILL.md:32-40`.
- The bump-classification table is written out fully in both README.md:16-26 and SKILL.md:42-57 — keep it in SKILL.md only, README points to it.

**P3**

- Frontmatter premise repeated as the body's opening; changelog/tagging deliberately excluded with no owner (note for future); benign co-firing with `git:git` worth a note.
- Eval scenarios: minor-bump end-to-end with validation scripts, per-plugin classification on a mixed branch (major + patch), plugin.json/marketplace.json mismatch repair.

### security-runtime

**P1**

- **plugin.json description** — the marketplace-facing description only names two of the three hooks ("CLAUDE.md injection scanner (SessionStart) + Bash prompt injection detector (PreToolUse)") and omits `secret-file-guard.sh`, which the README itself calls the hook that exists because the other two weren't enough. Anyone scanning the catalog has no way to know this plugin blocks credential-file reads at all. → Rewrite `description` in `plugins/security-runtime/.claude-plugin/plugin.json` to cover all three hooks, e.g.:
  `"Runtime security hooks for every Claude Code session: CLAUDE.md injection scanner (SessionStart), Bash prompt-injection detector (PreToolUse), and a credential-file read guard for Read/Grep/Bash (PreToolUse)."`

**P2**

- Keywords have no term for the secret guard — add `"secrets"`/`"credentials"`.
- `claudemd-scanner.sh` and `prompt-injection-detector.sh` hand-maintain diverging PATTERNS arrays for the same conceptual check — share one pattern source or comment why they differ (lines in the source report).
- Null-byte branch of the injection detector is untested — add a positive case to `tests/test_prompt-injection-detector.sh`.

**P3**

- Note in the README why this pack deliberately has no skill (hooks are Claude-Code-native); consider generating the hook's regex list from `permissions-deny.json` to remove the manual glob/regex sync.

### self-audit

**P1**

- **compare (command)**: Phase 2's tier bullet and the Tiers table disagree on what `quick` does. `commands/compare.md:49-50` says *"`quick` / `standard` — Agent tool fan-out: launch the subagents in parallel"* (both tiers fan out one agent per target skill), but the Tiers table at `commands/compare.md:101` says *"`quick` | 1 agent de synthèse (outil Agent), pas de fan-out par skill"* (explicitly no per-skill fan-out). A model executing `tier=quick` has two contradictory instructions for the single most consequential branch point in the command (cost: "faible" vs a full per-skill fan-out). → Make Phase 2's bullet tier-specific: split into `quick — single synthesis agent, no per-skill fan-out` / `standard — Agent tool fan-out, one agent per target skill + Phase 2b verbatim check`.

**P2**

- The audits register lives inside `commands/compare.md` itself and Phase 5 appends to it (mutable log state in an instruction file), duplicating README tables — move to `audits/REGISTER.md`, README links or regenerates.
- Phase 1's `git clone` "into the scratchpad" has no portable path — name a concrete location or ask the user.

**P3**

- `usage-profile.md` (the whole prioritization lens) has no staleness guard — flag and offer a refresh when >60 days old; add 2-3 smoke-test scenarios (quick-tier fan-out assertion, `no-repo-audit` section omission, fabricated-quote rejection in Phase 2b).

### statusline

**P1**

- **commands/setup.md (no companion skill)** — the plugin's core value depends on a manual follow-up step (`/plugin install statusline` alone does not activate the bar, per README.md:15), but nothing routes a user who describes the symptom in natural language ("I installed the statusline plugin but nothing shows at the bottom") to the `/statusline:setup` command. Slash commands are only reached if the user already knows the exact name — there is no `available_skills` entry for Claude to consult. → Add `skills/setup/SKILL.md` as a thin wrapper whose body just tells Claude to run the existing `/statusline:setup` command (don't duplicate the bash block). Proposed description:
  `Activate or repair the statusline plugin's status bar. Use whenever the user installed or upgraded the statusline plugin and the bar isn't showing at the bottom of the terminal, asks how to finish setting up the statusline, reports the statusline is missing/blank/stale after a plugin update, or runs "/plugin install statusline" and expects it to just work. Claude Code does not read the statusLine key from plugin.json, so this plugin always needs a manual activation step — this skill finds and runs it.`
  File: `plugins/statusline/commands/setup.md`.

**P2**

- The setup script prints `✓ statusLine registered` unconditionally after the `mv` — add a `jq empty "$settings_file"` post-write check with a distinct failure message pointing at the `.bak` (lines 38-42).
- Eval scenarios for the setup command: fresh machine, stale-symlink upgrade, corrupted settings.json.

**P3**

- Add `"rate-limit"` to plugin.json keywords; `/…:setup` name collision with security-runtime:setup is cosmetic (namespaced).

### superpowers

**P1**

- **plugin (README.md)**: README line 3 states "Local plugin version `5.1.1`" while `.claude-plugin/plugin.json` actually declares `"version": "5.1.3"`. The revision-tracking scheme the README itself describes (bump the trailing digit on each cherry-pick) is exactly what makes this drift misleading — a reader trusting the README will misjudge how many local divergences have shipped. → Update the README line to `5.1.3` (or whatever the current `plugin.json` version is at merge time). File: `plugins/superpowers/README.md:3`, cross-check `plugins/superpowers/.claude-plugin/plugin.json:3`.
- **systematic-debugging**: The section heading `## your human partner's Signals You're Doing It Wrong` is grammatically broken — it reads as an unsubstituted template variable (something like `{{user}}'s Signals...`) that never got reworded when copied from upstream. It renders every time the skill triggers. → Reword to e.g. `## Signals You're Doing It Wrong`. File: `plugins/superpowers/skills/systematic-debugging/SKILL.md:235`.

**P2**

- Both skills close with fabricated-looking "Real-World Impact" statistics ("First-time fix rate: 95% vs 40%", "1847 tests passed") — replace with a one-line rationale or drop; ironic in a skill whose thesis is "evidence before claims".
- Heavy ALL-CAPS "Iron Law"/MUST/NEVER framing is skill-creator's own yellow flag — if a local divergence is ever taken, keep the name as a label, not the enforcement mechanism.
- "You'll be replaced" threat register in verification-before-completion:116 — drop the clause on next local edit.
- `condition-based-waiting-example.ts` hardcodes an unrelated upstream project's internals — trim to the generic `waitFor` helper or mark illustrative-only.

**P3**

- Upstream "Use when..." phrasing vs house "ACTIVATE" style — leave (rewrite risks merge conflicts with the documented refresh procedure); three same-discipline recap sections could merge.
- Eval scenarios: retry-pressure resistance, 3-failed-fixes architecture branch, CSS near-miss carve-out; hedge-word gate, subagent-report red flag, informational should-not-trigger.

### symfony

**P1**

(none)

**P2**

- `twig-conventions` states the component-vs-HTML rule twice (bullets + "Decision checklist") — keep one form.
- `twig-conventions` states the `trans_default_domain` isolation rule three times — delete the "When to Set the Domain Explicitly" middle section, keep The Solution + Quick Reference.
- `prg-pattern`'s 25-line ASCII flow diagram duplicates the table and code below it — delete the diagram.

**P3**

- 3 of 5 skills carry the `symfony-` prefix, 2 don't — pick a convention for future skills, don't rename now; twig-conventions' DO-NOT clause is the only one without a redirect target.
- Eval scenarios for symfony-form (data_class ownership, DataTransformer placement, negative boundary), prg-pattern (redirect-on-success, re-render-on-error, flash), twig-conventions (premature extraction, component isolation diagnosis, ClockInterface).

### tooling

**P1**

- **drizzle-conventions**: the Migrations section teaches "always `drizzle-kit generate`, never hand-edit the journal" but never warns about the exact silent-failure mode the plugin's own hook exists to fix: `drizzle-kit migrate` silently skips any migration whose journal `when` is `<= max(created_at)` already applied — the comment in `hooks/fix-drizzle-journal-timestamp.sh` states this plainly, so it's a known, previously-hit production risk, not a hypothetical. A reader who regenerates a migration (e.g. after a rebase collapses branches) gets no warning that the next `migrate` can exit 0 while silently doing nothing. → Add one line to the Migrations section naming the failure mode ("journal `when` must stay strictly increasing — `migrate` silently skips entries that aren't") and pointing at `hooks/fix-drizzle-journal-timestamp.sh` as the available (manually-wired) fix. Files: `skills/drizzle-conventions/SKILL.md` (Migrations section), cross-referencing `hooks/fix-drizzle-journal-timestamp.sh`.

**P2**

- `claude-plugin-conventions` has near-total trigger/content overlap with `plugin-dev:plugin-structure` — decide ownership (retire one, or split marketplace/distribution vs directory scaffolding).
- `npx-skills-conventions` three-way overlap with `plugin-dev:skill-development` and `skill-creator` — rewrite the description to front-load its unique npx/skills.sh/SkillKit distribution angle (proposed text in the source report).
- `npx-skills-conventions`'s own "Writing Style Rules" prescribes third-person descriptions while every skill in this plugin (itself included) uses "ACTIVATE..." — scope the rule to the skills.sh spec or drop it.
- drizzle/zod skills document plain library API (`insert`/`update`/`delete`, `.extend()`/`.pick()`) — trim to the opinionated conventions (decision tree, naming, `packages/shared` placement, `z.coerce`, pipe wiring).

**P3**

- Pack mixes two audiences (app-stack vs plugin-authoring) — note for a future split; make the hook discoverable from the skill (P1 does this) and consider relocating it under the skill's `scripts/`; no lint/format/CI companion skill (idea only).
- Eval scenarios: docker-integration RTFM-checklist discipline (n8n, "don't overthink" redis, Dockerfile near-miss) and routing probes for the two overlap pairs above.

### typescript

**P1**

- **ts-conventions vs ts-oop** — Branded-type pattern directly contradicts itself across the two skills. `ts-conventions` (Branded Types section) mints brands through a `unique symbol` + `mint<'TenantId'>()` factory and explicitly calls out the alternative as wrong: *"A string-literal key such as `string & { readonly __brand: 'TenantId' }` is addressable, which makes passing through the factory optional — and a proof that is optional is not a proof."* `ts-oop` ("TS-specific: Branded Types for Primitive Identifiers") then presents exactly that rejected shape as the "✅ CORRECT" example: `type TenantId = string & { readonly __brand: 'TenantId' }` plus a factory that does `return id as TenantId` — an `as`-cast the sibling skill treats as domain debt. The two skills even cross-link on this exact topic. → Rewrite `ts-oop`'s branded-type example to reuse `ts-conventions`'s `Brand<T, B>` / `mint()` shape (drop the `__brand` string-literal type and the `as`-cast factory), or delete the section and point to `ts-conventions` only, since it already owns brands. Files: `plugins/typescript/skills/ts-oop/SKILL.md` (lines 126-144), `plugins/typescript/skills/ts-conventions/SKILL.md` (lines 188-217).
- **ts-code-conventions vs ts-ports-adapters** — Test-file location rule contradicts an in-pack example. `ts-code-conventions` states as a hard, measured rule: *"A test file sits beside the file it exercises, Name.spec.ts next to Name.ts, never mirrored into a separate top-level tests/ tree"* with the measure "Zero .spec.ts files live outside the directory of the file they test." `ts-ports-adapters`'s own worked example puts its spec file at `tests/Unit/Command/Domain/Features/generateReceiptHandler.spec.ts` — precisely the mirrored tree the other skill forbids. → Either move the example to a co-located path (`GenerateReceiptHandler.spec.ts` beside `GenerateReceiptHandler.ts`), or if the mirrored `tests/` layout is the real convention for that reference codebase, soften `ts-code-conventions`'s rule to scope it. Files: `plugins/typescript/skills/ts-code-conventions/SKILL.md` (lines 87-88), `plugins/typescript/skills/ts-ports-adapters/SKILL.md` (line 140).

**P2**

- `ts-code-conventions` lines 17-49 explain baseline `?.`/`??`/template-literal syntax — compress to one-line reminders in the Quick Reference.
- Both ts-oop and ts-conventions document branded types in near-full detail — after the P1 fix, trim ts-oop's section to a 2-3 line pointer.
- `ts-functional` "Error and Composition Conventions" asserts the same infrastructure-only constraint four times across nine bullets — consolidate into one rule + one measure.

**P3**

- Eval scenarios per skill (as-const union check, unknown-narrowing, Brand+mint with no bare cast — would have caught the P1; port-currying, in-memory double, test-location regression; curried consumer, push-branch-into-handler).
- No coverage of raw exception handling at genuine infrastructure boundaries (minor, likely intentional); `ts-refactoring` at 73 lines is thin — check next audit whether to grow or merge.

### vitest

**P1**

(none)

**P2**

- Drop the bare `'Vitest'` trigger token (fires on config/CLI/migration questions the skill doesn't cover) — replace with `'Vitest test'` in `skills/vitest-test-conventions/SKILL.md:3`.
- Cross-reference style inconsistent within one file pair (bare name vs `vitest:`-qualified) — standardize on fully-qualified.

**P3**

- The "Compare objects" Quick Reference row restates the Structured Assertions section (third statement including the reference file) — drop or differentiate; `common:feature-tdd-dev`'s vague description gives no defer-to-language-skill signal (informational).
- Eval scenarios: NestJS TDD should-trigger pair, PHPUnit near-miss routing, vi.fn/it.each conventions, Jest-to-Vitest config-migration should-not-trigger (the exact case the bare trigger risks).

## Suggested execution order

### 1. Quick wins (mechanical, low risk — single-line or single-block edits)

- **mac**: fix the `sed -i` regex in `hooks/bsd-gnu-lint.sh` (verified bug, one clause).
- **goal**: rename `/goal:auto` → `/goal:supervise` and `/next` → `/goal:next` in the two templates; check the `-tracks-spec.md` drift in the same pass.
- **superpowers**: README version `5.1.1` → `5.1.3`; reword the broken `## your human partner's Signals...` heading.
- **git**: fix the README's "French title" claim to match SKILL.md §F.
- **pocock**: add the wait-for-answer clause to `grill-me` line 9.
- **common**: fix `feature-tdd-dev`'s dead skill names + PHP-hardcoded commands; remove the BMAD dead end in `product-research`.
- **career**: add the missing signpost link to `references/evidence-schema.md` (the schema rewrite itself is structural, below).
- **security-runtime**: rewrite plugin.json description + keywords to cover all three hooks.
- **self-audit**: make Phase 2's tier bullet agree with the Tiers table.
- **tooling**: add the one-line journal-timestamp warning to `drizzle-conventions` Migrations.
- **frontend**: generalize the hardcoded `chrome-devtools` MCP paragraph; fix plugin.json description.
- **audit**: delete `security-overrides` §6, point at ts-security's checklist.
- **release**: deduplicate the bump table (README points to SKILL.md).

### 2. Description-quality pass (frontmatter/trigger edits, one sweep across plugins)

- **astro**: disambiguate the three hreflang triggers (artifact-named phrases).
- **git**: contextualize bare 'commit'/'push'/'merge' triggers.
- **goal**: rewrite `grill-adversarial`'s trigger tail (drop bare CS vocabulary, add DO-NOT).
- **vitest**: drop the bare 'Vitest' token.
- **marketing-analytics**: implementation-audit vs data-audit disambiguation; qualify 'sessions'/'page views'.
- **marketing-content**: trim schema-markup's description if Event/Recipe aren't added (paired with structural fix below).
- **marketing-distribution**: drop or deliver Facebook (paired with structural fix below).
- **pocock**: widen both grill descriptions with synonym triggers.
- **common**: extend `expert-persona-skills`' DO-NOT redirects; rewrite `context-window-management`'s trigger.
- **craft**: append `testing-principles`' missing DO-NOT clause.
- **audit**: add the PHP/Symfony exclusion to `ts-security`.
- **mac**: add the Linux-target exclusion to `mac-platform`'s DO-NOT.
- **tooling**: front-load `npx-skills-conventions`' distribution angle; resolve the `claude-plugin-conventions` / `plugin-dev` competing descriptions.
- **jquery**: align plugin.json description with the SKILL.md framing.

### 3. Structural work (splits, references/ extractions, new skills, content rewrites)

- **Contradiction repairs**: typescript (branded-type + test-location reconciliation), career (rewrite evidence-schema.md §3/§12 to the course-per-file model), craft (delete testing-principles §15, de-Jest §11), nest (add the domain-error → HTTP mapping subsection both skills cross-reference), phpunit (split `symfony-tdd-workflow` out or drop the portability claim; migrate to PHPUnit attributes), php (generalize or scope the DDD forbidden-list).
- **Progressive-disclosure extractions**: goal (plan template → `templates/`, gate guide → `references/`; unify the supervise/auditor report format), git (§F → `references/pr-conventions.md`), marketing-distribution (platform tables → `references/platforms/`, Reddit curl → `scripts/`), marketing-strategy (psychology glossary + competitor API mechanics → `references/`), marketing-analytics (parameterized `scripts/run_report.py` for GA4/GSC), marketing-content (Unsplash block → `references/`; consolidate writing-mechanics in copy-editing), legacy (TOCs for the five long references; per-stack split of the three PHP-only ones), symfony (delete the duplicated rule statements), jquery (deduplicate SKILL.md vs anti-patterns.md), superpowers (impact-stats and example-file cleanup as local divergences).
- **Content gaps / new skills**: statusline (thin `setup` wrapper skill — the pack's only P1), astro (`astro-images`, `astro-actions` or explicit out-of-scope notes), marketing-content (add Event/Recipe schema sections or trim the promise), marketing-distribution (add the Facebook spec table or trim), self-audit (move the register out of the command file), security-runtime (share the pattern source, add the null-byte test).
- **Evals**: seed `evals/evals.json` marketplace-wide from the ready scenarios in each per-plugin report, prioritizing the skills whose P1s would have been caught mechanically (astro routing collision, typescript branded types, mac hook behavior, goal supervise classification) and normalizing career's bespoke schema.
