# Plugins externes à installer

Ce fichier liste les plugins Claude Code provenant de marketplaces **externes** à ce repo. Il sert de checklist pour reproduire la configuration sur un nouvel environnement.

> Les skills de ce repo (`plugins/php/`, `plugins/typescript/`, etc.) sont installés via `./setup.sh`. Les plugins listés ici sont **indépendants** et doivent être installés via la commande `/plugin` de Claude Code.

## Étape 1 — Enregistrer les marketplaces

Dans Claude Code :

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin marketplace add atournayre/claude-marketplace
/plugin marketplace add jarrodwatts/claude-hud
```

## Étape 2 — Installer les plugins

### Marketplace : `claude-plugins-official` (Anthropic)

```
/plugin install atlassian@claude-plugins-official
/plugin install autofix-bot@claude-plugins-official
/plugin install coderabbit@claude-plugins-official
/plugin install feature-dev@claude-plugins-official
/plugin install figma@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install github@claude-plugins-official
/plugin install hookify@claude-plugins-official
/plugin install php-lsp@claude-plugins-official
/plugin install plugin-dev@claude-plugins-official
/plugin install security-guidance@claude-plugins-official
/plugin install skill-creator@claude-plugins-official
/plugin install typescript-lsp@claude-plugins-official
```

### Marketplace : `atournayre-claude-plugin-marketplace`

```
/plugin install doc@atournayre-claude-plugin-marketplace
/plugin install qa@atournayre-claude-plugin-marketplace
/plugin install symfony@atournayre-claude-plugin-marketplace
```

### Marketplace : `claude-hud`

```
/plugin install claude-hud@claude-hud
```

## Étape 3 — Composants additionnels installés manuellement

Ces éléments ne viennent d'aucun marketplace et sont placés directement dans `~/.claude/` :

| Composant | Emplacement | Source / Provenance |
|---|---|---|
| BMAD (méthode + agents) | `~/.claude/commands/bmad/` (sous-dirs : `bmm/`, `cis/`, `core/`) | À documenter — provenance externe non-marketplace |
| `eres-sync.md` | `~/.claude/commands/eres-sync.md` | Script perso de synchronisation Eres |

## Étape 4 — Vérification

Après installation, vérifier :

```bash
cat ~/.claude/plugins/installed_plugins.json | jq 'keys'
cat ~/.claude/plugins/known_marketplaces.json | jq 'keys'
```

Le nombre attendu : **3 marketplaces**, **17 plugins**.

## Maintenance

Pour mettre à jour ce fichier après ajout/suppression d'un plugin :

```bash
jq -r '.plugins | keys[]' ~/.claude/plugins/installed_plugins.json | sort
```

La sortie permet de comparer la liste vivante avec ce document et de détecter une dérive.
