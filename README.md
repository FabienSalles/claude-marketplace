# Claude Marketplace

A curated collection of skills, hooks, agents, and slash commands for [Claude Code](https://claude.ai/claude-code), organized into themed packs.

## Available packs

| Pack | Skills | Description |
|------|--------|-------------|
| **php** | 13 | PHP 8.2/8.3, conventions, DDD, TDD, Symfony, Twig, Composer, OOP, refactoring, SQL |
| **typescript** | 8 | Conventions, typing, DDD events, functional programming, OOP, refactoring, security |
| **astro** | 11 | Astro 5.x — components, routing, collections, i18n, SEO, Tailwind, React islands, transitions |
| **nest** | 2 | NestJS architectural conventions, DDD with NestJS |
| **frontend** | 2 | Clean architecture (hexagonal), Container/Presentation patterns |
| **vitest** | 2 | TDD workflow, test conventions and patterns |
| **tooling** | 6 | Docker, Drizzle ORM, pnpm workspaces, Zod, Claude Code plugin conventions, npx skills conventions |
| **common** | — | Shared hooks, agents, commands, skills (planning, context, research, etc.) + `skillListingBudgetFraction = 0.06` |
| **statusline** | — | Claude Code statusline — cwd, git branch, model, context progress bar, 5h rate limit + time-to-reset |
| **security-audit** *(external)* | — | [netresearch/security-audit-skill](https://github.com/netresearch/security-audit-skill) — OWASP, CWE, CVSS |

## Installation

### Via Claude Code plugins (`/plugin`)

Recommended for end users. No clone, no script.

```text
/plugin marketplace add FabienSalles/claude-marketplace
/plugin install common@fabien-claude-marketplace
/plugin install php@fabien-claude-marketplace
# etc.
```

Each plugin is independent — install only what you need. The `statusline` plugin has a [dedicated activation step](#statusline) because Claude Code does not accept the `statusLine` key in `plugin.json`.

### Via `setup.sh` (developer mode, symlinks)

For active development of the marketplace. Changes are live immediately because every skill/hook/command is symlinked into `~/.claude/`.

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

Claude Code does not accept the `statusLine` key in `plugin.json`, so `/plugin install statusline` alone cannot activate the bar. Two activation paths are provided:

```text
# After /plugin install: run the bundled slash command
/statusline:setup
```

```bash
# Or from a clone: setup.sh wires the symlink + settings.json
./setup.sh --pack statusline
```

Both create the stable symlink `~/.claude/statusline-command.sh → ${CLAUDE_PLUGIN_ROOT}/statusline.sh` and add the `statusLine` entry to `~/.claude/settings.json` (with a backup). After a plugin upgrade, re-run `/statusline:setup` to refresh the symlink target.

### What the bar shows

Segments are joined by ` | `:

| Segment | Color | Content |
|---|---|---|
| `~/path` | blue | current directory (HOME replaced with `~`) |
|  `branch` | yellow | git branch (falls back to worktree name) |
| `Model name` | cyan | active Claude model |
| `ctx:[████░░░░░░] 42%` | green / yellow / red | context window usage (green <50%, yellow ≥50%, red ≥80%) |
| `5h:67% · 1h42` | magenta | 5h rate-limit usage + time until reset (the `· HhMM` only appears when `rate_limits.five_hour.resets_at` is provided) |

Example render:

```
~/projects/foo |  main | Opus 4.7 | ctx:[████░░░░░░] 42% | 5h:67% · 1h42
```

Tip: add `"refreshInterval": 60` next to `statusLine` in `~/.claude/settings.json` so the bar (including the countdown) refreshes every minute even when no event fires.

Requires `jq`. Source: [`plugins/statusline/statusline.sh`](plugins/statusline/statusline.sh).

## Repo structure

```
claude-marketplace/
├── .claude-plugin/marketplace.json     # Root manifest
├── plugins/
│   ├── php/                            # 13 skills
│   ├── typescript/                     # 8 skills
│   ├── astro/                          # 11 skills
│   ├── nest/                           # 2 skills
│   ├── frontend/                       # 2 skills
│   ├── vitest/                         # 2 skills
│   ├── tooling/                        # 6 skills
│   ├── common/                         # Shared hooks, agents, commands, skills
│   │   ├── hooks/                      # audit trail, file permissions, git tracking, skill reminders, …
│   │   ├── agents/                     # ui-engineer
│   │   └── commands/                   # feature-dev, business-first-dev
│   └── statusline/                     # Statusline script + /statusline:setup
├── setup.sh                            # Symlink installer (dev mode)
└── README.md
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOME` | `~/.claude` | Override the Claude config directory |

## License

MIT
