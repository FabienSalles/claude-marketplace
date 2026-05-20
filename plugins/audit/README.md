# audit

Personal **audit overlay** that complements upstream audit skills without modifying them.

## Pattern — overlay, not replacement

The community provides comprehensive audit skills (e.g. [`netresearch/security-audit-skill`](https://github.com/netresearch/security-audit-skill) — 61 reference files covering OWASP, CWE, CVSS, Symfony, NestJS, etc.). This plugin **does not duplicate** that content. Instead, it provides a **thin overlay** of personal/project-specific overrides:

- Stack scoping (which languages/frameworks are in scope)
- False-positive filters specific to your projects
- Output format and severity conventions
- Stack-specific language skills inside this plugin (e.g. `ts-security`, future `php-security`)

When you ask for a security audit, **both** load in parallel:

```
🔵 netresearch:security-audit         → 80+ checkpoints, OWASP/CWE/CVSS, 61 refs
🟢 audit:security-overrides           → your conventions, FP filters, output style
🟢 audit:ts-security                  → TS/NestJS code patterns (Drizzle/JWT/bcrypt/…)
```

Upstream can ship 100 updates — your overlay stays untouched. Run `claude plugin update security-audit` to sync upstream.

## What's included

**Skills**

| Skill | Status |
|---|---|
| `security-overrides` | ✓ shipped (cross-language overlay on netresearch/security-audit) |
| `ts-security` | ✓ shipped (TS/NestJS code patterns) |
| `php-security` | _planned (PHP/Symfony code patterns — currently covered by netresearch)_ |
| `dependency-audit` | _planned (overrides for SCA / npm audit / composer audit)_ |
| `accessibility-audit` | _planned (a11y / WCAG overrides)_ |

**Commands**

| Command | Purpose |
|---|---|
| `/audit:install-security-review-action` | Drop the canonical `anthropics/claude-code-security-review` workflow into the current repo |

**Templates**

| Template | Purpose |
|---|---|
| `templates/claude-code-security-review.yml` | Source for the GitHub Action workflow (used by the install command) |

## Required upstream

For the security overlay to be useful, install:

```
/plugin install security-audit@fabien-claude-marketplace
```

(Referenced in this marketplace's `marketplace.json` as a re-export of `netresearch/security-audit-skill`.)

## Installing the GitHub Action on a production repo

The `anthropics/claude-code-security-review` GitHub Action runs the security review automatically on every PR, with diff-aware scanning (only changed files are analysed → costs bounded).

To install on a repo:

```
cd <your-repo>
/audit:install-security-review-action
```

The slash command copies `templates/claude-code-security-review.yml` to `<repo>/.github/workflows/security-review.yml`. After install, you must manually:

1. Add `CLAUDE_API_KEY` in GitHub Settings → Secrets and variables → Actions.
2. For repos accepting external contributors, enable "Require approval for first-time contributors" in Settings → Actions → General (the action is not hardened against prompt injection).
3. Commit & push the workflow file.
