# Claude Marketplace

Collection de **43 skills**, **4 hooks**, **1 agent** et **1 command** pour [Claude Code](https://claude.ai/claude-code), organisés en packs thématiques.

## Packs disponibles

| Pack | Skills | Description |
|------|--------|-------------|
| **php** | 14 | PHP 8.2/8.3, conventions, DDD, TDD, Symfony, Twig, Composer, OOP, refactoring, SQL, security |
| **typescript** | 8 | Conventions, typing, DDD events, functional programming, OOP, refactoring, security |
| **astro** | 11 | Astro 5.x — components, routing, collections, i18n, SEO, Tailwind, React islands, transitions |
| **nest** | 2 | NestJS architectural conventions, DDD with NestJS |
| **frontend** | 2 | Clean architecture (hexagonal), Container/Presentation patterns |
| **vitest** | 2 | TDD workflow, test conventions and patterns |
| **tooling** | 4 | Docker, Drizzle ORM, pnpm workspaces, Zod schemas |
| **common** | — | Hooks, agents et commands partagés |

## Installation

### Mode développeur (symlinks)

Méthode recommandée pour le développement actif. Les modifications sont immédiatement actives.

```bash
git clone https://github.com/FabienSalles/claude-marketplace.git
cd claude-marketplace

# Mode interactif
./setup.sh

# Tout installer
./setup.sh --all

# Installer des packs spécifiques
./setup.sh --pack php typescript

# Alias supportés : ts → typescript
./setup.sh --pack php ts
```

### Via `npx skills add`

```bash
# Lister les skills disponibles
npx skills add FabienSalles/claude-marketplace --list

# Installer
npx skills add FabienSalles/claude-marketplace
```

### Via `claude plugin install`

```bash
# Installer un plugin complet
claude plugin install FabienSalles/claude-marketplace/plugins/php

# Valider un plugin
claude plugin validate plugins/php
```

### Via `skillkit`

Compatible nativement (même format `SKILL.md`).

```bash
skillkit install FabienSalles/claude-marketplace
```

## Gestion des packs

```bash
# Voir les packs installés
./setup.sh --status

# Désinstaller un pack
./setup.sh --remove php

# Lister les packs disponibles
./setup.sh --list
```

## Structure

```
claude-marketplace/
├── .claude-plugin/marketplace.json     # Manifest racine
├── plugins/
│   ├── php/                            # 14 skills PHP
│   ├── typescript/                     # 8 skills TypeScript
│   ├── astro/                          # 11 skills Astro 5.x
│   ├── nest/                           # 2 skills NestJS
│   ├── frontend/                       # 2 skills Frontend
│   ├── vitest/                         # 2 skills Vitest
│   ├── tooling/                        # 4 skills (Docker, Drizzle, pnpm, Zod)
│   └── common/                         # Hooks, agents, commands
│       ├── hooks/
│       │   ├── fix-permissions.sh      # Fix file permissions after Write
│       │   ├── git-add-empty.sh        # Auto git add -N new files
│       │   ├── remind-skills.py        # Remind skills on PHP/Twig edits
│       │   └── warn-use-git-mv.sh      # Block mv, suggest git mv
│       ├── agents/
│       │   └── ui-engineer.md          # UI/Frontend specialist agent
│       └── commands/
│           └── feature-dev.md          # TDD feature development workflow
├── setup.sh                            # Script d'installation (symlinks)
└── README.md
```

## Workflow quotidien

```bash
# Éditer → actif immédiatement (grâce aux symlinks)
vim plugins/php/skills/php-8.3/SKILL.md

# Versionner
git add -A && git commit -m "update php-8.3" && git push
```

## Environnement

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOME` | `~/.claude` | Override le répertoire Claude |

## License

MIT
