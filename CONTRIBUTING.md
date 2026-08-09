# Contributing

This marketplace is a set of independent plugins. Contributing means **adding or editing a plugin**, then keeping the manifest, README, and CI green. This guide covers the mechanics.

## Anatomy of a plugin

Every plugin lives under `plugins/<name>/` and is self-contained:

```
plugins/<name>/
├── .claude-plugin/plugin.json   # required — manifest
├── README.md                    # required — see template below
├── skills/<skill>/SKILL.md      # 0..n skills (with optional references/)
├── commands/<command>.md        # 0..n slash commands
└── hooks/hooks.json + *.sh       # 0..n hooks
```

- Reference bundled files with `${CLAUDE_PLUGIN_ROOT}/...`, never absolute or `~` paths. This is what makes a plugin portable and what `health-check.sh` verifies.
- A plugin can ship any mix of skills / commands / hooks / agents. Single-purpose is fine (`jquery` ships one skill; `self-audit` ships one command).

## `plugin.json`

```json
{
  "name": "<name>",
  "version": "1.0.0",
  "description": "<one line — what it does, framework/scope>",
  "author": { "name": "FabienSalles" },
  "license": "MIT",
  "keywords": ["..."]
}
```

Declare component directories explicitly only when auto-discovery doesn't apply (e.g. `"commands": "./commands/"` in a command-only plugin).

## Register it in the marketplace

Add one entry to `.claude-plugin/marketplace.json` → `plugins[]`:

| Field | Notes |
|---|---|
| `name` | Matches the directory name. |
| `source` | `./plugins/<name>` for local, or a `{ "source": "github", "repo": "owner/name" }` object for a re-export (see `security-audit`). |
| `description` | One line, reused verbatim as the plugin's tagline. |
| `version`, `author`, `license` | Mirror `plugin.json`. |
| `category` | One of `development` · `testing` · `productivity` · `platform` · `security` · `marketing`. |
| `keywords` | For discovery. |

Dev mode needs no extra step: `/plugin marketplace add /path/to/clone` registers the clone as a local marketplace, and the new plugin is installable as soon as it appears in `.claude-plugin/marketplace.json`.

## Write the README

Two conventions, pick the fit:

- **Skills-catalog** (language/skill plugins): `# <name>` → one-line description → `## Install` → `## Skills (N)` table → optional `## When to use`. Model: [`plugins/frontend/README.md`](plugins/frontend/README.md).
- **Overlay/rationale** (vendored or overlay plugins): lead with *why this exists / what's included / how it layers*. Model: [`plugins/audit/README.md`](plugins/audit/README.md).

Keep the `## Skills (N)` count in sync with the actual number of skill directories: it's a convention readers rely on.

## Validate locally

A diagnostic script orchestrates the native `claude plugin` commands:

```bash
./scripts/health-check.sh           # full run (re-syncs upstream marketplaces)
./scripts/health-check.sh --quick   # skip the upstream sync (faster, for dev loops)
```

It (1) re-syncs upstream marketplaces, (2) validates the root `marketplace.json`, (3) validates each plugin manifest, (4) checks every `${CLAUDE_PLUGIN_ROOT}/...` reference in `hooks.json` and command files resolves to a real file (catching renames not propagated to JSON) and (5) lists installed plugins. It exits `1` on any failure, so it's usable in a pre-commit hook or local CI.

`./scripts/validate-skills.sh` checks every `SKILL.md`'s frontmatter (present, `name:` present and matching the directory) and README skill counts: the same checks CI runs, runnable before you push.

## What CI enforces

`.github/workflows/validate.yml` runs on every PR and nightly (`06:00 UTC`), across `ubuntu-latest` and `macos-latest`:

- `marketplace.json` is valid JSON and every plugin has a `plugin.json`.
- Every `SKILL.md` has valid frontmatter (`./scripts/validate-skills.sh`).
- Every `marketplace.json` reference resolves.
- `claude plugin validate` passes for the manifest and each plugin.
- `npx skills` can discover the skills.
- `health-check.sh` passes on both OSes.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOME` | `~/.claude` | Override the Claude config directory. |
