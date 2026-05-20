# Backlog

Items identified during the marketplace audit and not yet executed. Loose priority — pick what's relevant when you come back.

> Where this lives: visible from the repo root, tracked by git, never expires. Update when you tackle an item (move it to a `## Done` section or delete).

---

## 🖥️ macOS / BSD portability

### Native BSD-vs-GNU lint hook in `plugins/mac/hooks/`
- **Why:** the usage report flags recurring BSD/GNU issues (`grep -P`, GNU `realpath`, `sed -i 's/x/y/' file` missing BSD suffix, `mapfile`, bash 4+ features in `#!/bin/bash` scripts). The `mac-platform` skill documents these *passively* (Claude reads them). A PreToolUse hook on `Bash` matcher would *actively* warn when these patterns appear in commands or fresh scripts, before they fail silently on macOS.
- **Effort:** ~30 min (write `plugins/mac/hooks/bsd-gnu-lint.sh` in pure bash, register in `plugins/mac/.claude-plugin/hooks.json`, smoke test)
- **Trigger:** next time `claude` writes a broken setup.sh or you see a `grep -P` slip through.
- **Path:** `plugins/mac/hooks/bsd-gnu-lint.sh` (new file)
- **Patterns to detect (warn, not block):** `grep -P`, `realpath` (without `coreutils`-aware shim), `sed -i 's/...' file` (no BSD suffix), `readlink -f`, `xargs -r`, `date -d`, `mapfile`/`readarray`, `${var,,}`/`${var^^}`.

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
- Install `florian-claude-tools/security-suite` (7 skills, 2 agents, 13 bash hooks: dangerous-actions-blocker, prompt-injection-detector, output-secrets-scanner, repo-integrity-scanner, security-gate, sandbox-validation, pre-commit-secrets, …). Token cost ~458 always-on. Pairs with existing `security-guidance@claude-plugins-official` (no strict overlap). Hooks activate on next Claude Code session.
- Add `audit:install-security-review-action` command + `templates/claude-code-security-review.yml` for installing the `anthropics/claude-code-security-review` GitHub Action into any production repo (`/audit:install-security-review-action` from within the target repo).

---

## ❌ Rejected after evaluation

### `atournayre/customize` (Bash Security Validator + Hooks) — _evaluated, not adopted_
- **What it does:** PreToolUse hook running a TypeScript validator via `bun` to block destructive bash commands (`rm -rf /`, `dd`, fork bombs, writes to `/etc`/`/usr`/`/bin`, …).
- **Why rejected:**
  1. **Doesn't address the actual friction**: usage report flags portability (BSD vs GNU), not destructive commands. customize is a security validator, not a portability validator.
  2. Requires `bun` runtime (not installed) and adds startup latency on every Bash invocation.
  3. The native BSD-vs-GNU lint hook (planned above) addresses the real problem in pure bash, zero dependency, zero overhead.
- **If revisited:** would only be relevant as defense-in-depth against accidental destructive commands, after `bun` is installed and a measurable risk is identified. Low priority.

### `atournayre/gemini` (Gemini CLI delegation: 1M context, Deep Think, Google Search) — _evaluated, not adopted_
- **What it does:** Delegates queries to the `gemini` CLI for ultra-long context (1M tokens), Deep Think reasoning, and Google Search.
- **Why rejected:**
  1. **Already covered by current setup**: Claude Opus 4.7 (1M context) is already running here — feature #1 brings nothing.
  2. Claude `extended thinking` covers Deep Think.
  3. `WebSearch` covers most search use cases.
  4. Plugin requires a Google AI Studio API key (free tier sufficient, but a non-Anthropic dependency).
  5. User preference: stay on Claude Code + local models if extra capacity is needed (no value in adding a Google dependency).
- **If revisited:** only relevant if heavy reliance on Google-indexed corpora (recent web data) or if Claude quota becomes a constraint — neither applies today.
