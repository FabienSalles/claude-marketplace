---
name: claude-plugin-conventions
description: "ACTIVATE when creating a Claude Code plugin, writing plugin.json, marketplace.json, hooks.json, or structuring plugin directories. ACTIVATE for 'Claude plugin', 'plugin.json', 'marketplace.json', 'hooks.json', 'CLAUDE_PLUGIN_ROOT'. Covers: plugin directory structure, plugin.json/marketplace.json schemas, hooks.json format (matcher + hook types), CLAUDE_PLUGIN_ROOT portability, distribution best practices, validation commands. DO NOT use for: SKILL.md writing conventions (see npx-skills-conventions), general Claude Code usage."
version: "1.1"
---

# Claude Code Plugin & Marketplace Conventions

Best practices for creating, structuring, and distributing Claude Code plugins and marketplaces, based on official documentation and the `anthropics/claude-plugins-official` repository.

## Plugin Directory Structure

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Manifest (ONLY this file here)
├── commands/                 # Slash commands (.md)
├── agents/                   # Subagent definitions (.md)
├── skills/                   # Skills (subdirectories with SKILL.md)
│   └── skill-name/
│       ├── SKILL.md
│       ├── scripts/
│       ├── references/
│       └── examples/
├── hooks/
│   ├── hooks.json            # Hook configuration
│   └── scripts/              # Hook scripts
├── .mcp.json                 # MCP server definitions
├── .lsp.json                 # LSP configurations
├── settings.json             # Default settings
├── scripts/                  # Shared utilities
├── LICENSE
└── README.md
```

**Critical rules:**
- `.claude-plugin/` contains ONLY `plugin.json` — never nest components inside it
- All component directories at plugin root level
- Kebab-case for all directory and file names
- Only create directories for components actually used

## plugin.json Schema

### Minimal (auto-discovery handles the rest)

```json
{
  "name": "plugin-name"
}
```

### Recommended

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Brief plugin description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com",
    "url": "https://github.com/author"
  },
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"]
}
```

### Component Paths (optional, supplements auto-discovery)

```json
{
  "skills": "./skills/",
  "agents": "./agents/agent-name.md",
  "hooks": "./hooks/hooks.json",
  "commands": "./commands/command-name.md",
  "mcpServers": "./.mcp.json",
  "lspServers": "./.lsp.json",
  "outputStyles": "./styles/"
}
```

**Path rules:**
- All paths relative to plugin root
- Must start with `./`
- Custom paths supplement default directories, never replace them

## marketplace.json Schema

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "marketplace-name",
  "description": "Brief marketplace description",
  "owner": {
    "name": "Owner Name",
    "email": "owner@example.com"
  },
  "metadata": {
    "version": "1.0.0",
    "description": "Detailed marketplace description"
  },
  "plugins": [
    {
      "name": "plugin-name",
      "source": "./plugins/plugin-name",
      "description": "Plugin description",
      "version": "1.0.0",
      "author": { "name": "Author" },
      "category": "development",
      "license": "MIT",
      "keywords": ["keyword"],
      "tags": ["community-managed"]
    }
  ]
}
```

### Required fields
- `name` — kebab-case, no spaces
- `owner` — object with `name` (required), `email` (optional)
- `plugins` — array of plugin entries, each with `name` and `source`

### Reserved marketplace names
`claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `life-sciences`. Names impersonating official Anthropic marketplaces are blocked.

### Plugin source types

| Type | Format |
|------|--------|
| Local path | `"./plugins/name"` |
| GitHub | `{ "source": "github", "repo": "org/repo", "ref": "main", "sha": "abc" }` |
| Git URL | `{ "source": "url", "url": "https://github.com/org/repo.git" }` |
| Git subdir | `{ "source": "git-subdir", "url": "org/repo", "path": "plugins/name" }` |
| npm | `{ "source": "npm", "package": "name", "version": "^1.0" }` |

### Plugin categories
`development`, `productivity`, `security`, `testing`, `database`, `deployment`, `monitoring`, `design`, `learning`

## hooks.json Format

The official format uses nested `matcher` + `hooks[]` with `type`:

```json
{
  "description": "Human-readable description of hooks purpose",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/validate.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/check.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Hook types

| Type | Field | Description |
|------|-------|-------------|
| `command` | `command` | Shell command, receives JSON on stdin |
| `http` | `url` | HTTP POST to endpoint |
| `prompt` | `prompt` | Single-turn LLM evaluation |
| `agent` | `prompt` | Agentic verifier with Read/Grep/Glob tools |

### Hook events

| Event | Matcher | Can block? |
|-------|---------|------------|
| `SessionStart` | startup, resume, clear, compact | No |
| `UserPromptSubmit` | No | Yes (exit 2) |
| `PreToolUse` | Tool name regex | Yes (exit 2) |
| `PostToolUse` | Tool name regex | No |
| `Stop` | No | Yes (exit 2) |
| `SubagentStart` / `SubagentStop` | Agent type | No / Yes |
| `Notification` | Types | No |
| `PreCompact` / `PostCompact` | manual, auto | No |

## Portability — ${CLAUDE_PLUGIN_ROOT}

Always use `${CLAUDE_PLUGIN_ROOT}` for intra-plugin path references. Never hardcode paths.

**In hooks.json:** `"command": "${CLAUDE_PLUGIN_ROOT}/scripts/tool.sh"`
**In MCP config:** `"args": ["${CLAUDE_PLUGIN_ROOT}/servers/server.js"]`
**In shell scripts:** `source "${CLAUDE_PLUGIN_ROOT}/lib/common.sh"`

## Distribution Best Practices

1. **Version bumps required** — Claude Code caches by version; no bump = no update for users
2. **Version in one place** — avoid setting version in both plugin.json and marketplace.json (plugin.json wins silently)
3. **Pin with `sha`** for reproducible builds in production marketplaces
4. **Test locally** with `claude --plugin-dir ./my-plugin`
5. **Reload without restart** with `/reload-plugins`
6. **Debug loading** with `claude --debug` or `/debug`

## Validation

```bash
# Validate marketplace
claude plugin validate .

# Validate individual plugin
claude plugin validate plugins/my-plugin

# Validate from within Claude Code
/plugin validate .
```

## Naming Conventions

| Component | Convention | Example |
|-----------|-----------|---------|
| Plugin | kebab-case | `code-review-assistant` |
| Skills | kebab-case directories | `api-testing/` |
| Commands | kebab-case .md | `run-tests.md` |
| Agents | kebab-case .md | `code-reviewer.md` |
| Hooks | kebab-case with ext | `validate-input.sh` |
| Config | Standard names | `hooks.json`, `.mcp.json` |

Plugin skills are namespaced as `/plugin-name:skill-name` to prevent conflicts.
