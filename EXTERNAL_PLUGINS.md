# External plugins to install

This file lists Claude Code plugins coming from marketplaces **external** to this repo. It serves as a checklist for reproducing the setup on a new machine.

> Skills from this repo (`plugins/php/`, `plugins/typescript/`, etc.) are installed via `./setup.sh`. The plugins below are **independent** and must be installed through the Claude Code `/plugin` command.

## Step 1 — Register the marketplaces

In Claude Code:

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin marketplace add atournayre/claude-marketplace
```

> Note the resolved marketplace names used in Step 2: `anthropics/claude-plugins-official` registers as `claude-plugins-official`, but `atournayre/claude-marketplace` registers as **`atournayre-claude-plugin-marketplace`** (declared in its `marketplace.json`, not the repo basename) — so installs use `@atournayre-claude-plugin-marketplace`, not `@claude-marketplace`.

## Step 2 — Install the plugins

### Marketplace: `claude-plugins-official` (Anthropic)

```
/plugin install feature-dev@claude-plugins-official
/plugin install figma@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install hookify@claude-plugins-official
/plugin install php-lsp@claude-plugins-official
/plugin install plugin-dev@claude-plugins-official
/plugin install security-guidance@claude-plugins-official
/plugin install skill-creator@claude-plugins-official
/plugin install typescript-lsp@claude-plugins-official
```

> `github@claude-plugins-official` is deliberately **not** installed: the only thing it ships is a GitHub Copilot MCP pointing at `api.githubcopilot.com/mcp/`, which never connects without a Copilot subscription. See the Done section of [`BACKLOG.md`](BACKLOG.md).

### Marketplace: `atournayre-claude-plugin-marketplace`

```
/plugin install doc@atournayre-claude-plugin-marketplace
/plugin install qa@atournayre-claude-plugin-marketplace
/plugin install symfony@atournayre-claude-plugin-marketplace
```

## Step 3 — Additional components installed manually

These items do not come from any marketplace and are placed directly under `~/.claude/`:

| Component | Location | Source / Provenance |
|---|---|---|
| BMAD (method + agents) | `~/.claude/commands/bmad/` (subdirs: `bmm/`, `cis/`, `core/`) | To document — non-marketplace external source |
| `eres-sync.md` | `~/.claude/commands/eres-sync.md` | Personal Eres sync script |

## Step 4 — Verification

After installation, verify:

```bash
cat ~/.claude/plugins/installed_plugins.json | jq 'keys'
cat ~/.claude/plugins/known_marketplaces.json | jq 'keys'
```

Expected count: **2 marketplaces**, **13 plugins** (10 from `claude-plugins-official` + 3 from `atournayre`).

## Maintenance

To refresh this file after adding/removing a plugin:

```bash
jq -r '.plugins | keys[]' ~/.claude/plugins/installed_plugins.json | sort
```

The output lets you diff the live list against this document and detect drift.
