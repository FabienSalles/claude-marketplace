# Claude Marketplace

A curated collection of skills, hooks, agents, and slash commands for [Claude Code](https://claude.ai/claude-code), organized into themed plugins so you can install only what you need.

## Contents

- [What's inside](#whats-inside)
- [Plugins](#plugins)
- [Installation](#installation)
- [Statusline](#statusline)
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
| [**php**](plugins/php/README.md) | 13 | PHP 8.2/8.3, code style, DDD, TDD, Symfony, Twig, Composer, OOP, refactoring, SQL |
| [**typescript**](plugins/typescript/README.md) | 8 | Typing, code style, functional, OOP, DDD events, refactoring, security audit |
| [**astro**](plugins/astro/README.md) | 11 | Components, routing, content collections, i18n, SEO, Tailwind, React islands, view transitions, env, analytics |
| [**nest**](plugins/nest/README.md) | 2 | NestJS architectural conventions, DDD with NestJS |
| [**frontend**](plugins/frontend/README.md) | 2 | Clean architecture (hexagonal), Container/Presentation patterns |
| [**vitest**](plugins/vitest/README.md) | 2 | TDD workflow + test conventions |
| [**tooling**](plugins/tooling/README.md) | 6 | Docker, Drizzle ORM, pnpm workspaces, Zod, Claude plugin conventions, npx skills |
| [**common**](plugins/common/README.md) | 4 skills + 4 commands + 9 hooks + 1 agent | Shared workflow tools: planning, context window, research, persona, TDD/feature-dev commands, code-review/test hooks |
| [**statusline**](plugins/statusline/README.md) | — | Colored statusline: cwd, branch, model, context %, 5h rate-limit usage + reset countdown |
| **security-audit** *(external)* | — | [netresearch/security-audit-skill](https://github.com/netresearch/security-audit-skill) — OWASP, CWE, CVSS |

## Installation

### Via Claude Code plugins (`/plugin`) — recommended

```text
/plugin marketplace add FabienSalles/claude-marketplace
/plugin install common@fabien-claude-marketplace
/plugin install php@fabien-claude-marketplace
# etc.
```

The `statusline` plugin needs one extra activation step — see [Statusline](#statusline) below.

### Via `setup.sh` (developer mode, symlinks)

For active development of the marketplace. Changes are live immediately because every component is symlinked into `~/.claude/`.

```bash
git clone https://github.com/FabienSalles/claude-marketplace.git
cd claude-marketplace

./setup.sh                  # interactive
./setup.sh --all            # install everything
./setup.sh --pack php ts    # selected packs (ts → typescript)
./setup.sh --status         # show installed packs
./setup.sh --remove php     # uninstall a pack
```

### Other install paths

- `npx skills add FabienSalles/claude-marketplace` — works with the `npx skills` ecosystem
- `claude plugin install FabienSalles/claude-marketplace/plugins/<name>` — single plugin via the official CLI
- `skillkit install FabienSalles/claude-marketplace` — `SKILL.md` is the same format

## Statusline

```
~/projects/foo |  main | Opus 4.7 | ctx:[████░░░░░░] 42% | 5h:67% · 1h42
```

Claude Code does not accept the `statusLine` key in `plugin.json`, so a small slash command finishes the wiring after `/plugin install statusline`:

```text
/plugin install statusline@fabien-claude-marketplace
/statusline:setup
```

Full details — colored screenshot, segment-by-segment breakdown, refresh-interval tip — live in [`plugins/statusline/README.md`](plugins/statusline/README.md).

## Repo structure

```
claude-marketplace/
├── .claude-plugin/marketplace.json     # Root marketplace manifest
├── plugins/
│   ├── php/                            # README + 13 skills
│   ├── typescript/                     # README + 8 skills
│   ├── astro/                          # README + 11 skills
│   ├── nest/                           # README + 2 skills
│   ├── frontend/                       # README + 2 skills
│   ├── vitest/                         # README + 2 skills
│   ├── tooling/                        # README + 6 skills + 1 hook
│   ├── common/                         # README + 4 skills + 4 commands + 9 hooks + 1 agent
│   └── statusline/                     # README + script + /statusline:setup
├── setup.sh                            # Symlink installer (dev mode)
├── EXTERNAL_PLUGINS.md                 # Plugins from other marketplaces (checklist)
└── README.md                           # This file
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOME` | `~/.claude` | Override the Claude config directory |

## License

MIT
