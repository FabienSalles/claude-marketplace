# Claude Marketplace

A curated collection of skills, hooks, agents, and slash commands for [Claude Code](https://claude.ai/claude-code), organized into themed plugins so you can install only what you need.

## Contents

- [What's inside](#whats-inside)
- [Plugins](#plugins)
- [Installation](#installation)
- [Statusline](#statusline)
- [Health check](#health-check)
- [Repo structure](#repo-structure)
- [Environment](#environment)
- [License](#license)

## What's inside

- **Modular** — every plugin is independent. Pick the stacks you work with.
- **Battle-tested conventions** — skills encode rules from real projects, not hypothetical best practices.
- **Plugin-native** — install via `/plugin` (recommended) or `./setup.sh` (developer mode).
- **Bundled statusline** — colored bar with context %, model, git branch, and 5h rate-limit reset countdown.

## Plugins

Each row links to the plugin's own README with the full skill catalog and direct links to every `SKILL.md`.

| Plugin | Skills | What's inside |
|---|---|---|
| [**php**](plugins/php/README.md) | 8 | PHP 8.2/8.3 language conventions — code style, OOP, DDD, refactoring, SQL, Composer. Framework-agnostic. |
| [**phpunit**](plugins/phpunit/README.md) | 2 | PHPUnit TDD workflow + test writing conventions. Layers on `craft` principles. |
| [**symfony**](plugins/symfony/README.md) | 3 | Personal Symfony overlay — FormType, Twig component, PRG pattern. Distinct from `atournayre/symfony`. |
| [**typescript**](plugins/typescript/README.md) | 7 | Typing, code style, functional, OOP, DDD events, refactoring (security audit moved to **audit**) |
| [**astro**](plugins/astro/README.md) | 11 | Components, routing, content collections, i18n, SEO, Tailwind, React islands, view transitions, env, analytics |
| [**nest**](plugins/nest/README.md) | 2 | NestJS architectural conventions, DDD with NestJS |
| [**frontend**](plugins/frontend/README.md) | 3 | Clean architecture (hexagonal), Container/Presentation patterns, best-practices for editing existing UI |
| [**vitest**](plugins/vitest/README.md) | 2 | TDD workflow + test conventions |
| [**tooling**](plugins/tooling/README.md) | 6 | Docker, Drizzle ORM, pnpm workspaces, Zod, Claude plugin conventions, npx skills |
| [**common**](plugins/common/README.md) | 4 skills + 4 commands + 9 hooks + 1 agent | Shared workflow tools: planning, context window, research, persona, TDD/feature-dev commands, code-review/test hooks |
| [**goal**](plugins/goal/README.md) | 2 commands + 1 hook + 1 script + 1 template | Autonomous issue→PR workflow on top of Claude Code's native `/goal`: `/draft-issue` (spec → GitHub issue), `/run-issue` (issue → spec → branch → /goal), Stop hook that auto-regenerates a PR-shippable execution log. Permissive — falls back gracefully without `common`/`pocock`/`superpowers` |
| [**craft**](plugins/craft/README.md) | 7 | Cross-language software craftsmanship principles (refactoring, OOP, code-style, testing, TDD workflow, DDD-OOP, DDD-FP; security planned) — pairs with language example skills |
| [**statusline**](plugins/statusline/README.md) | — | Colored statusline: cwd, branch, model, context %, 5h rate-limit usage + reset countdown |
| [**mac**](plugins/mac/README.md) | 1 skill + 1 hook | macOS / BSD platform discipline — shell/bash 3.2 vs Homebrew bash 5+, BSD vs GNU command portability, plus a PreToolUse `bsd-gnu-lint` hook that warns on GNU-only flags in Bash commands |
| [**audit**](plugins/audit/README.md) | 2 | Audit hub: overlay on `netresearch/security-audit` (`security-overrides`) + stack-specific code patterns (`ts-security`; PHP planned) |
| [**security-runtime**](plugins/security-runtime/README.md) | 2 hooks | Runtime security: `claudemd-scanner` (SessionStart) flags injection patterns in CLAUDE.md files, `prompt-injection-detector` (PreToolUse:Bash) blocks Bash commands containing AI-instruction overrides |
| [**superpowers**](plugins/superpowers/README.md) | 2 | Cherry-picked subset of [obra/superpowers](https://github.com/obra/superpowers): `verification-before-completion`, `systematic-debugging` |
| [**pocock**](plugins/pocock/README.md) | 3 | Cherry-picked subset of [mattpocock/skills](https://github.com/mattpocock/skills): `grill-me`, `grill-with-docs`, `zoom-out` |
| [**marketing-content**](plugins/marketing-content/README.md) | 10 | Content & copywriting — LinkedIn, SEO blog, direct-response copy, editing, editorial strategy, calendar, repurposing, SEO briefs, site audit, schema markup |
| [**marketing-strategy**](plugins/marketing-strategy/README.md) | 6 | Strategic marketing — ICP, 70+ mental models, 139 growth ideas, competitor analysis, positioning/GTM (April Dunford), shared product-marketing context |
| [**marketing-distribution**](plugins/marketing-distribution/README.md) | 4 | Distribution channels — multi-platform social posts, Twitter/X threads + Reddit posts, email subject lines, newsletter growth |
| [**marketing-analytics**](plugins/marketing-analytics/README.md) | 3 | Analytics — GA4/GTM/UTM tracking setup, Google Analytics Data API reporting, Google Search Console reporting |
| **security-audit** *(external)* | — | [netresearch/security-audit-skill](https://github.com/netresearch/security-audit-skill) — OWASP, CWE, CVSS, 61 references |

## Installation

### Via Claude Code plugins (`/plugin`) — recommended

```text
/plugin marketplace add FabienSalles/claude-marketplace
/plugin install common@fabien-claude-marketplace
/plugin install php@fabien-claude-marketplace
# etc.
```

The `statusline` plugin needs one extra activation step — see [Statusline](#statusline) below.

### Via `setup.sh` (local marketplace registration)

For active development of the marketplace. The script registers this clone as a local marketplace in `~/.claude/settings.json` (`extraKnownMarketplaces.fabien-claude-marketplace`) and toggles packs via `enabledPlugins.<pack>@fabien-claude-marketplace`. No symlinks — edits in `plugins/*/` are picked up live on the next Claude Code session.

```bash
git clone https://github.com/FabienSalles/claude-marketplace.git
cd claude-marketplace

./setup.sh                  # interactive
./setup.sh --all            # install everything
./setup.sh --pack php ts    # selected packs (ts → typescript)
./setup.sh --status         # show installed packs
./setup.sh --remove php     # uninstall a pack
```

### Via `npx skills add`

Works with the [`npx skills`](https://github.com/anthropics/skills) ecosystem. Same `SKILL.md` format, no Claude Code required.

```bash
# List available skills
npx skills add FabienSalles/claude-marketplace --list

# Install everything
npx skills add FabienSalles/claude-marketplace
```

### Via `claude plugin install`

Install a single plugin through the official Claude Code CLI (without going through `/plugin marketplace add`).

```bash
# Install one plugin
claude plugin install FabienSalles/claude-marketplace/plugins/php

# Validate a plugin manifest
claude plugin validate plugins/php
```

### Via `skillkit`

Natively compatible — same `SKILL.md` format.

```bash
skillkit install FabienSalles/claude-marketplace
```

## Statusline

![Statusline preview](docs/statusline-preview.png)

Claude Code does not accept the `statusLine` key in `plugin.json`, so a small slash command finishes the wiring after `/plugin install statusline`:

```text
/plugin install statusline@fabien-claude-marketplace
/statusline:setup
```

Full details — colored screenshot, segment-by-segment breakdown, refresh-interval tip — live in [`plugins/statusline/README.md`](plugins/statusline/README.md).

## Health check

A local diagnostic script orchestrating the native `claude plugin` commands:

```bash
./scripts/health-check.sh           # full run (re-syncs upstream marketplaces)
./scripts/health-check.sh --quick   # skip the upstream sync (faster, for dev loops)
```

What it does:

1. Re-syncs all upstream marketplaces (skippable via `--quick`).
2. Validates the root `marketplace.json` manifest.
3. Validates each plugin manifest (per-plugin `✓`/`✗`).
4. Checks every `${CLAUDE_PLUGIN_ROOT}/...` reference in `hooks.json` and slash-command files actually resolves to an existing file. Catches renames/moves not propagated to the JSON.
5. Lists installed plugins overview.

Exits `1` on any failure — usable in pre-commit hooks or local CI.

The same script also runs in the GitHub Actions workflow on every PR and on a nightly cron (`06:00 UTC`), across `ubuntu-latest` and `macos-latest`.

## Repo structure

```
claude-marketplace/
├── .claude-plugin/marketplace.json     # Root marketplace manifest
├── plugins/
│   ├── php/                            # README + 8 skills (language only)
│   ├── phpunit/                        # README + 2 skills (TDD workflow + test conventions)
│   ├── symfony/            # README + 3 skills (FormType, Twig, PRG)
│   ├── typescript/                     # README + 8 skills
│   ├── astro/                          # README + 11 skills
│   ├── nest/                           # README + 2 skills
│   ├── frontend/                       # README + 3 skills
│   ├── vitest/                         # README + 2 skills
│   ├── tooling/                        # README + 6 skills + 1 hook
│   ├── common/                         # README + 4 skills + 4 commands + 9 hooks + 1 agent
│   ├── craft/                          # README + 7 skills (cross-language principles)
│   ├── statusline/                     # README + script + /statusline:setup
│   ├── mac/                            # README + 1 skill + 1 hook (BSD/GNU lint)
│   ├── audit/                          # README + 1 skill (security overlay on netresearch)
│   ├── security-runtime/               # README + 2 hooks (claudemd-scanner, prompt-injection-detector)
│   ├── superpowers/                    # README + 2 skills (cherry-pick obra)
│   ├── pocock/                         # README + 3 skills (cherry-pick mattpocock)
│   └── goal/                           # README + 2 commands + 1 hook + 1 script + 1 template (autonomous issue→PR)
├── scripts/
│   └── health-check.sh                 # Local diagnostic (also runs in CI)
├── setup.sh                            # Registers this dir as a local marketplace, toggles packs
├── EXTERNAL_PLUGINS.md                 # Plugins from other marketplaces (checklist)
├── BACKLOG.md                          # Identified-but-not-yet-done items (pick-up when relevant)
└── README.md                           # This file
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOME` | `~/.claude` | Override the Claude config directory |

## License

MIT
