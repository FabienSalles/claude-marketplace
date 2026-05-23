# Backlog

Items identified during the marketplace audit and not yet executed. Loose priority — pick what's relevant when you come back.

> Where this lives: visible from the repo root, tracked by git, never expires. Update when you tackle an item (move it to a `## Done` section or delete).

---

## 🔐 MCPs hardening (manual configuration outside this repo)

### Restrict Cloudflare API token scope
- **Why:** the `claude.ai Cloudflare Developer Platform` MCP is connected with a token that has write/delete permissions on D1, KV, R2, Workers, Hyperdrive. A compromised session (prompt injection, malicious file) could delete production resources.
- **Effort:** ~10 min (manual, on dash.cloudflare.com)
- **Trigger:** before any session involving untrusted content (file uploads, web fetches from unknown sources, third-party MCP usage).
- **Action plan:**
  1. Go to https://dash.cloudflare.com → My Profile → API Tokens.
  2. Identify the token bound to the Claude MCP (look at last-used timestamps).
  3. Either rotate to a **read-only token** if you don't need write access for daily use, OR scope it to specific zones/resources only (exclude prod).
  4. If a separate "write" token is needed occasionally, create a short-lived one (24h TTL) and revoke after use.

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

## 🐘 Symfony plugin polish

### Make `symfony:php-prg-pattern` framework-agnostic
- **Why considered:** the PRG pattern itself (POST→redirect, POST-error→re-render, flash messages) is universal across PHP web frameworks (Laravel, Slim, vanilla PHP). The skill is currently in `symfony` because the code examples use Symfony classes (`RedirectResponse`, `UrlGeneratorInterface`, `#[Route]`, `getFlashBag()`). A Laravel user installing `php` alone would miss this pattern.
- **Currently NOT planned** — option (a) was chosen during the v2 refactor: keep the skill in `symfony` to avoid extra work, since the diagram and rules are already language-readable and a Laravel user can mentally translate the few Symfony-specific class names.
- **Effort if revisited:** ~30 min (replace examples with pseudo-code or PSR-7/PSR-15 interfaces, add a 5-line Laravel snippet alongside the Symfony one, move the skill back to `php`).
- **Trigger:** if a Laravel project lands on the agenda, or a public user opens an issue asking "where's PRG for Laravel?".

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
- Remove `playwright` MCP (real functional duplicate of `chrome-devtools`, 0 usage in history vs `chrome-devtools` actively used with 3 auto-allowed tools).
- Native BSD-vs-GNU lint hook shipped in `plugins/mac/hooks/bsd-gnu-lint.sh` + `hooks.json`. Warn-only (never blocks), runs on every PreToolUse:Bash. Detects: `grep -P`, `sed -i` without BSD empty suffix, `readlink -f`, `xargs -r`, `date -d`, GNU-only `realpath` flags, `mapfile`/`readarray`, `${var,,}`/`${var^^}`. Smoke-tested across 8 cases (5 trigger, 3 silent).
- Fix the `test-npx-skills` CI warning. Root cause: `npx skills` v1.5+ replaced the per-skill `SKILL.md` path output with a TUI summary (`Found <N> skills`). The CI grep was counting the old marker (2 incidental occurrences) and always tripped the warning. Switched the parser in `.github/workflows/validate.yml` to extract the `Found <N> skills` integer and compare to the 40-skill threshold; local run reports `Discovered 63 skills`.
- Disable `github@claude-plugins-official` plugin (the only thing it ships is a GitHub Copilot MCP pointing at `api.githubcopilot.com/mcp/`, which fails to connect without a Copilot subscription + valid `GITHUB_PERSONAL_ACCESS_TOKEN`). User does not use GitHub Copilot. Removed from `~/.claude/settings.json.enabledPlugins`; effective on next Claude Code restart.
- Cherry-pick `obra/superpowers` v5.1.0 into local `plugins/superpowers/` — 3 skills kept (`writing-plans`, `verification-before-completion`, `systematic-debugging`). Skipped: `brainstorming` (doublon `bmad-brainstorming`), `test-driven-development` (4th TDD framework → hesitation), `subagent-driven-development` / `requesting-code-review` / `receiving-code-review` / etc. (out of scope or covered). LICENSE + upstream attribution preserved.
- Cherry-pick `mattpocock/skills` into local `plugins/pocock/` — 3 skills kept (`grill-me`, `grill-with-docs`, `zoom-out`). Inverts the push-back loop: Claude grills before code. Skipped: `tdd` (4th TDD framework), `diagnose` (overlap `phpstan-resolver` + `systematic-debugging`), `triage` / `improve-codebase-architecture` / `to-issues` / `to-prd` / `prototype` / `caveman` / `handoff` / `write-a-skill` / `setup-matt-pocock-skills`. LICENSE + upstream attribution preserved.

---

## ❌ Rejected after evaluation

### `atournayre/customize` (Bash Security Validator + Hooks) — _evaluated, not adopted_
- **What it does:** PreToolUse hook running a TypeScript validator via `bun` to block destructive bash commands (`rm -rf /`, `dd`, fork bombs, writes to `/etc`/`/usr`/`/bin`, …).
- **Why rejected:**
  1. **Doesn't address the actual friction**: usage report flags portability (BSD vs GNU), not destructive commands. customize is a security validator, not a portability validator.
  2. Requires `bun` runtime (not installed) and adds startup latency on every Bash invocation.
  3. The native BSD-vs-GNU lint hook (planned above) addresses the real problem in pure bash, zero dependency, zero overhead.
- **If revisited:** would only be relevant as defense-in-depth against accidental destructive commands, after `bun` is installed and a measurable risk is identified. Low priority.

### `florian-claude-tools/security-suite` — _adopted, then superseded by internal `security-runtime`_
- **What it was:** 7 skills + 2 agents + 13 PreToolUse / PostToolUse bash hooks (dangerous-actions-blocker, prompt-injection-detector, output-secrets-scanner, repo-integrity-scanner, security-gate, sandbox-validation, pre-commit-secrets, claudemd-scanner, …). Installed during the audit work (commit history visible in BACKLOG ✅ Done section).
- **Why superseded:**
  1. **Footprint disproportionné** — 13 always-on hooks (~458 tokens of context) versus the 2 hooks that actually mattered for this threat model.
  2. **Real value concentrated in 2 hooks** — `claudemd-scanner` (SessionStart) and `prompt-injection-detector` (PreToolUse:Bash). The other 11 either overlapped with existing tooling (`pre-commit-secrets` is covered by per-project pre-commit configs, `dangerous-actions-blocker` is covered by Claude Code's native blocklist) or were defensive-of-defensive layers with negligible marginal value.
  3. **Replacement built locally** — `plugins/security-runtime/` ships those 2 hooks, smoke-tested (8 + 12 cases), with a README explaining the threat model and what is *not* covered (notably: MCP-vector prompt injection — token scoping is still required for that).
- **Current state:** `security-suite@florian-claude-tools` is **disabled** in `~/.claude/settings.json`. The marketplace `florian-claude-tools` is still registered, so re-enabling is one toggle away if a real gap is identified.
- **If revisited:** would only be considered if (a) the threat model widens beyond CLAUDE.md + Bash injection, and (b) a specific hook in the 13 is identified as having unique coverage not replicable in ~30 lines of bash. Low probability.

### `ctxharness` as pre-commit on this marketplace — _piloted, not adopted_
- **What it does:** scans declared markdown files (CLAUDE.md, AGENTS.md, docs/) for verifiable claims (semver, paths, scripts) and flags drift against ground truth.
- **Pilot result:** `ctxharness init` + `ctxharness scan README.md` on this repo produced 4 false positives — `SKILL.md`, `plugin.json`, `marketplace.json`, `hooks.json` all flagged as "NOT FOUND" because `scan` resolves paths at repo root only, while these files live in `plugins/*/` subdirectories. Real drifts here (version `plugin.json` ↔ `marketplace.json`, plugin count in README, skill-name ↔ directory-name) would require hand-written custom assertions — not auto-discovery.
- **Why rejected here:**
  1. The marketplace has no CLAUDE.md / AGENTS.md at the root (those live in `~/.claude/` and are out of scope).
  2. Two existing guardrails already cover the relevant invariants: `claude plugin validate` for manifest correctness, and `scripts/health-check.sh` for marketplace state.
  3. Net value here would be marginal — and would add commit-time friction.
- **Where it still makes sense:** real product repos (eres, formation, RAG) that maintain rich CLAUDE.md / SKILL.md / docs with version, path, and count claims that drift often. Install there, not here.

### `atournayre/gemini` (Gemini CLI delegation: 1M context, Deep Think, Google Search) — _evaluated, not adopted_
- **What it does:** Delegates queries to the `gemini` CLI for ultra-long context (1M tokens), Deep Think reasoning, and Google Search.
- **Why rejected:**
  1. **Already covered by current setup**: Claude Opus 4.7 (1M context) is already running here — feature #1 brings nothing.
  2. Claude `extended thinking` covers Deep Think.
  3. `WebSearch` covers most search use cases.
  4. Plugin requires a Google AI Studio API key (free tier sufficient, but a non-Anthropic dependency).
  5. User preference: stay on Claude Code + local models if extra capacity is needed (no value in adding a Google dependency).
- **If revisited:** only relevant if heavy reliance on Google-indexed corpora (recent web data) or if Claude quota becomes a constraint — neither applies today.
