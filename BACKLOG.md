# Backlog

Items identified during the marketplace audit and not yet executed. Loose priority — pick what's relevant when you come back.

> Where this lives: visible from the repo root, tracked by git, never expires. Update when you tackle an item (move it to a `## Done` section or delete).

---

## 🔧 External plugins to evaluate

### Install `atournayre/Customize` (Bash Security Validator + Hooks)
- **Why:** the usage report flags recurring BSD/GNU/setup.sh issues. This plugin ships a pre-built **Bash Security Validator** that catches dangerous patterns at write time — directly addressing the friction.
- **Effort:** ~30 min (install + smoke test on a setup.sh edit)
- **Trigger to pick up:** next time `claude` writes a broken setup.sh or hook script.
- **Install:** `/plugin install Customize@atournayre-claude-plugin-marketplace`

### Install `atournayre/Gemini` (delegation to Gemini CLI, 1M context)
- **Why:** with ~105 messages/day on this account, long architecture sessions sometimes hit Claude's context window. Gemini-CLI delegation buys 1M token capacity for those moments.
- **Effort:** ~15 min (install + try one architecture session)
- **Trigger:** next time you start a large architecture/RAG planning session.
- **Install:** `/plugin install Gemini@atournayre-claude-plugin-marketplace`

---

## 🛠️ CI hygiene (visible in every CI run)

### Investigate the `npx skills add . --list` discovery shortfall
- **Symptom:** the `test-npx-skills` job warns: `Expected at least 40 skills discovered, got 2`. Pre-existed before the recent refactor — likely an `npx skills` CLI behavior change.
- **Effort:** ~1 h (reproduce locally, check the `skills` CLI version, possibly adjust the test or open an upstream issue)
- **Trigger:** every CI run currently emits this warning.
- **File:** `.github/workflows/validate.yml` (job `test-npx-skills`)

---

## 🛡️ Audit plugin extensions

### `audit:php-security` skill (if a real PHP gap emerges)
- **Why considered:** symmetry with `audit:ts-security`. **Currently NOT planned** because `netresearch/security-audit-skill` already provides `symfony-security.md`, `php-security-features.md`, `laravel-security.md`. Add only if you encounter PHP patterns the upstream misses (custom Symfony FormType validation, Doctrine repository patterns, LexikJWT setup, sodium hashing conventions, etc.).
- **Effort:** ~2 h (read upstream PHP refs, identify true gaps, write the overlay)
- **Trigger:** when you start a Symfony project with custom security patterns and feel the gap.
- **Path:** `plugins/audit/skills/php-security/`

### `audit:dependency-audit` skill (SCA / npm audit / composer audit overlay)
- **Why:** declared as `_planned_` in `audit/README.md`. Overlay personal conventions for dependency vulnerability triage (severity mapping, suppression rules, monorepo scoping).
- **Effort:** ~2 h
- **Trigger:** next time you triage a dependabot/snyk/renovate PR queue.
- **Path:** `plugins/audit/skills/dependency-audit/`

### `audit:accessibility-audit` skill (a11y / WCAG overlay)
- **Why:** declared as `_planned_` in `audit/README.md`. Frontend audit (Astro/React) — likely useful for the formation/training side.
- **Effort:** ~2-3 h
- **Trigger:** next a11y review on a public-facing site.
- **Path:** `plugins/audit/skills/accessibility-audit/`

---

## 🧩 Craft plugin extensions

(No additional principles families identified during the audit beyond the 7 shipped.)

---

## 🗂️ How to add to this list

- Append a new section under the relevant category.
- Each entry: **Why** (problem) + **Effort** (rough) + **Trigger** (what would make you pick it up) + concrete pointer (file, command, link).
- When done, move it to a `## ✅ Done` section at the bottom with the commit SHA, or just delete.

---

## ✅ Done

- Bump `actions/checkout@v4` → `@v5` and `actions/setup-node@v4` → `@v5` (Node 24, kills Node 20 deprecation warnings) — covers 6 occurrences in `.github/workflows/validate.yml`.
