# Claude Marketplace

Collection de skills, hooks, agents et commands pour [Claude Code](https://claude.ai/claude-code), organisés en packs thématiques.

## Packs disponibles

| Pack | Skills | Description |
|------|--------|-------------|
| **php** | 13 | PHP 8.2/8.3, conventions, DDD, TDD, Symfony, Twig, Composer, OOP, refactoring, SQL |
| **typescript** | 8 | Conventions, typing, DDD events, functional programming, OOP, refactoring, security |
| **astro** | 11 | Astro 5.x — components, routing, collections, i18n, SEO, Tailwind, React islands, transitions |
| **nest** | 2 | NestJS architectural conventions, DDD with NestJS |
| **frontend** | 2 | Clean architecture (hexagonal), Container/Presentation patterns |
| **vitest** | 2 | TDD workflow, test conventions and patterns |
| **tooling** | 6 | Docker, Drizzle ORM, pnpm workspaces, Zod schemas, Claude Code plugin conventions, npx skills conventions |
| **common** | — | Hooks, agents, commands partagés, skills partagés (planning, contexte, research, etc.) + `skillListingBudgetFraction` à 0.06 dans `~/.claude/settings.json` |
| **statusline** | — | Statusline Claude Code — cwd, branche git, modèle, barre de progression du contexte, quota rate limit 5h |
| **security-audit** *(externe)* | — | [netresearch/security-audit-skill](https://github.com/netresearch/security-audit-skill) — OWASP, CWE, CVSS |

## Installation

### Mode utilisateur (`/plugin`)

Méthode recommandée pour les utilisateurs finaux. Aucun clone, aucun script.

```text
# Dans Claude Code
/plugin marketplace add FabienSalles/claude-marketplace
/plugin install common@fabien-claude-marketplace
/plugin install php@fabien-claude-marketplace
# etc.
```

Chaque plugin est indépendant — installe uniquement ce dont tu as besoin. **Cas particulier `statusline`** : Claude Code ne supporte pas la clé `statusLine` dans `plugin.json`, donc après `/plugin install statusline` il faut activer la barre avec `/statusline:setup` (slash command livrée par le plugin) — voir [section Statusline](#statusline).

### Mode développeur (symlinks)

Méthode recommandée pour le développement actif du marketplace. Les modifications sont immédiatement actives.

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

## Statusline

Plugin dédié, installable sans rien d'autre. Deux chemins selon que tu veux la config automatique ou manuelle :

**Avec `setup.sh` (auto-config recommandée)** — crée le symlink ET enregistre `statusLine` dans `~/.claude/settings.json` :

```bash
git clone https://github.com/FabienSalles/claude-marketplace.git
cd claude-marketplace
./setup.sh --pack statusline
```

**Avec `/plugin install` + `/statusline:setup` (auto-config via slash command)** — Claude Code ne supporte pas la clé `statusLine` dans `plugin.json`, mais le plugin livre une slash command qui crée un symlink stable et écrit `settings.json` automatiquement (même résultat que `setup.sh --pack statusline`, mais sans cloner le repo) :

```text
/plugin marketplace add FabienSalles/claude-marketplace
/plugin install statusline@fabien-claude-marketplace
/statusline:setup
```

Le symlink `~/.claude/statusline-command.sh` pointe vers `${CLAUDE_PLUGIN_ROOT}/statusline.sh` ; après une mise à jour du plugin (le path du cache change), relance `/statusline:setup` pour rafraîchir le symlink.

**Config 100 % manuelle** — si tu préfères pointer ton `settings.json` directement vers le script du cache :

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/plugins/cache/FabienSalles-claude-marketplace/plugins/statusline/statusline.sh"
  }
}
```

Ce qu'il affiche (séparé par ` | `) :

| Segment | Couleur | Contenu |
|---|---|---|
| `~/path` | bleu | répertoire courant (HOME remplacé par `~`) |
|  `branch` | jaune | branche git (fallback : nom du worktree) |
| `Model name` | cyan | modèle Claude actif |
| `ctx:[████░░░░░░] 42%` | vert / jaune / rouge | progression du contexte (vert <50 %, jaune ≥50 %, rouge ≥80 %) |
| `5h:67% · 1h42` | magenta | quota rate limit 5h + temps restant avant reset (le `· HhMM` n'apparaît que si `rate_limits.five_hour.resets_at` est fourni) |

Exemple de rendu :

```
~/projects/foo |  main | Opus 4.7 | ctx:[████░░░░░░] 42% | 5h:67% · 1h42
```

Astuce : ajoute `"refreshInterval": 60` à côté de `statusLine` dans ton `~/.claude/settings.json` pour rafraîchir la barre toutes les minutes (sinon elle ne se met à jour qu'aux événements — le temps restant peut alors paraître figé).

Pré-requis : `jq` (déjà présent sur la plupart des Mac via Homebrew). Source : [`plugins/statusline/statusline.sh`](plugins/statusline/statusline.sh).

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
│   ├── php/                            # 13 skills PHP
│   ├── typescript/                     # 8 skills TypeScript
│   ├── astro/                          # 11 skills Astro 5.x
│   ├── nest/                           # 2 skills NestJS
│   ├── frontend/                       # 2 skills Frontend
│   ├── vitest/                         # 2 skills Vitest
│   ├── tooling/                        # 6 skills (Docker, Drizzle, pnpm, Zod, plugin conventions, npx skills)
│   ├── common/                         # Hooks, agents, commands, skills partagés
│   │   ├── hooks/
│   │   │   ├── audit-trail.sh          # Append tool calls to audit log
│   │   │   ├── fix-drizzle-journal-timestamp.sh
│   │   │   ├── fix-permissions.sh      # Fix file permissions after Write
│   │   │   ├── git-add-empty.sh        # Auto git add -N new files
│   │   │   ├── remind-ci-before-commit.sh
│   │   │   ├── remind-skills.py        # Remind skills on PHP/Twig edits
│   │   │   ├── warn-clock-bypass.py
│   │   │   ├── warn-test-file-edit.sh
│   │   │   └── warn-use-git-mv.sh      # Block mv, suggest git mv
│   │   ├── agents/
│   │   │   └── ui-engineer.md          # UI/Frontend specialist agent
│   │   └── commands/
│   │       └── feature-dev.md          # TDD feature development workflow
│   └── statusline/                     # Plugin statusline autonome
│       ├── .claude-plugin/plugin.json  # Déclare le champ statusLine
│       └── statusline.sh               # Script (cwd, git, modèle, ctx, rate limit)
├── setup.sh                            # Script d'installation (symlinks, mode dev)
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
