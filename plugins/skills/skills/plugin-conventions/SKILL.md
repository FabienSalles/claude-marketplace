---
name: plugin-conventions
description: "ACTIVATE when creating a Claude Code plugin, writing plugin.json, marketplace.json, hooks.json, a hook script, or an evals/evals.json file. ACTIVATE for 'Claude plugin', 'plugin.json', 'marketplace.json', 'hooks.json', 'CLAUDE_PLUGIN_ROOT', 'permissionDecision', 'evals.json'. Covers: plugin directory structure, plugin.json/marketplace.json schemas, hooks.json format, the hook output contract (exit codes, which channel reaches Claude), CLAUDE_PLUGIN_ROOT portability, distribution best practices, the evals/evals.json format for a skill's routing and behaviour test cases, validation commands. DO NOT use for: SKILL.md writing conventions (see skill-authoring), agent .md format (see agent-authoring)."
metadata:
  version: "1.0"
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
│       ├── examples/
│       └── evals/
│           └── evals.json    # Routing + behaviour test cases (see below)
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
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/scripts/validate.sh\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Hook types

| Type | Field | Description |
|------|-------|--------------|
| `command` | `command` | Shell command, receives JSON on stdin |
| `http` | `url` | HTTP POST to endpoint |
| `prompt` | `prompt` | Single-turn LLM evaluation |
| `agent` | `prompt` | Agentic verifier with Read/Grep/Glob tools |

### Hook events

Full reference: https://docs.claude.com/en/docs/claude-code/hooks

| Event | Matcher | Can block? |
|-------|---------|------------|
| `SessionStart` | `startup`, `resume`, `clear`, `compact`, `fork` | No |
| `SessionEnd` | `clear`, `resume`, `logout`, `prompt_input_exit`, `other` | No |
| `UserPromptSubmit` | None | Yes (exit 2) |
| `PreToolUse` | Tool name | Yes (exit 2) |
| `PostToolUse` | Tool name | No |
| `Stop` | None | Yes (exit 2) |
| `SubagentStop` | Agent type | Yes (exit 2) |
| `Notification` | Notification type | No |
| `PreCompact` | `manual`, `auto` | Yes (exit 2) |

An empty, `*` or absent matcher fires on every occurrence. A matcher written with letters, digits, `_`, `-` and spaces alone, its names separated by `|` or `,`, compares exact names: `Edit|Write` fires on those two tools and never on `NotebookEdit`. Any other character makes it a JavaScript regular expression that may match anywhere in the value, so `Edit.*` also fires on `NotebookEdit`: anchor it as `^Edit$`. A `matcher` on an event marked None is ignored silently.

### Hook output contract

Output on the wrong channel fails silently: the action proceeds and the message reaches nobody. Five rules decide it:

- On most events, exit 2 is the only code that blocks by itself (`WorktreeCreate` and `WorktreeRemove` fail on any non-zero exit). Without a schema-valid JSON object on stdout, any other non-zero exit is a non-blocking error and the action proceeds, so `exit 1` enforces nothing. Such an object is read on every exit code: at exit 1 a JSON `deny` still decides, and no JSON overrides the block of exit 2.
- At exit 0, stderr goes to the debug log only: neither Claude nor the user sees it.
- Plain stdout reaches Claude's context only on `SessionStart`, `UserPromptSubmit`, `UserPromptExpansion` and `PostModelSwitch`; on other events, speak through exit 2 or JSON.
- A `PreToolUse` decision is `hookSpecificOutput.permissionDecision` (`allow`, `deny`, `ask` or `defer`) with `permissionDecisionReason`. The top-level `decision`/`reason` pair is deprecated for that event.
- JSON stdout is exactly one object built with an encoder (`jq -n --arg …`, Python's `json.dumps`): an unparsable one is dropped as a hook error, and a field at the wrong level is ignored.

The stdin fields per event, the effect of exit 2 per event and the JSON fields are tabled in `references/hook-output-contract.md`. How to test a hook (a sourced harness, payload files, one assertion per channel) lives in `shell-test:shell-test-conventions`.

## Portability — ${CLAUDE_PLUGIN_ROOT}

Always use `${CLAUDE_PLUGIN_ROOT}` for intra-plugin path references. Never hardcode paths.

**In hooks.json:** `"command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/tool.sh\""`. Quote the whole path: a shell-form command runs through `sh -c`, and an unquoted root containing a space splits into several words, exits 127 and silently disables the hook. `claude plugin validate` only warns about an unquoted placeholder; `--strict` turns the warning into exit 1.
**In MCP config:** `"args": ["${CLAUDE_PLUGIN_ROOT}/servers/server.js"]`
**In shell scripts:** `source "${CLAUDE_PLUGIN_ROOT}/lib/common.sh"`

## evals/evals.json Format

A skill's `evals/evals.json` pins the test cases that prove it triggers on the right prompts and
produces the right behaviour once loaded. This marketplace's convention (see
`plugins/career/evals/evals.json` for a worked example):

```json
{
  "$comment": "One object per case; `skills` names what should load, `expected_behavior` lists what a passing run must do.",
  "routing": [
    {
      "query": "A prompt a real user would type",
      "skills": ["plugin-name:skill-name"],
      "expected_behavior": [
        "loads plugin-name:skill-name, not a sibling skill",
        "the specific guardrail that makes this skill different from its neighbours"
      ]
    }
  ]
}
```

- **`routing` cases** test discovery from the description alone: does the right skill load, and
  not a sibling that could plausibly match the same query?
- **`skills`** is an array of `plugin:skill-name` refs, same shape as an agent's `skills:` field.
- **`expected_behavior`** lists assertions in plain language, not a machine-checked schema — a
  human or an agent replays the case and checks each line.
- Keep at least one case per skill that has caused a real false-positive or false-negative
  activation; that is the evidence a routing rule was worth writing.

## Distribution Best Practices

1. **Version bumps required** — Claude Code caches by version; no bump = no update for users
2. **Version in one place** — avoid setting version in both plugin.json and marketplace.json (plugin.json wins silently)
3. **Pin with `sha`** for reproducible builds in production marketplaces
4. **Test locally** with `claude --plugin-dir ./my-plugin`
5. **Reload without restart** with `/reload-plugins`
6. **Debug loading** with `claude --debug` or `/debug`

## Validation

```bash
# Validate marketplace (--strict turns every warning into exit 1: the CI form)
claude plugin validate --strict .

# Validate individual plugin
claude plugin validate --strict plugins/my-plugin

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

See also: `skill-authoring` for the SKILL.md format itself, `agent-authoring` for the agent .md
format referenced by `agents/`.
