---
name: agent-authoring
description: "ACTIVATE when creating a Claude Code subagent .md file, a VS Code Copilot custom agent/chat mode, or comparing agent formats across platforms. ACTIVATE for 'subagent', 'agent frontmatter', 'custom agent', 'chat mode', 'agent tools list', 'agent model field'. Covers: Claude Code agent frontmatter (name/description/tools/model/color), the `skills` preload field and its certification rules, VS Code Copilot's custom agent format (chat modes, tool lists, model pinning). DO NOT use for: SKILL.md conventions (see skill-authoring), plugin.json/marketplace.json (see plugin-conventions)."
metadata:
  version: "1.0"
---

# Agent Authoring Conventions

Formats for defining an autonomous agent, sourced across the two platforms this marketplace ships
agents for: Claude Code subagents and VS Code Copilot custom agents.

## Claude Code Subagents

Source: `platform.claude.com/docs/en/agents-and-tools/agent-skills/subagents`.

```markdown
---
name: agent-name
description: "One paragraph the orchestrator uses to decide when to delegate to this agent. Third
person, with <example> blocks showing Context/assistant/commentary when helpful."
tools: Read, Grep, Glob, Bash
model: sonnet
color: purple
skills: ["plugin-name:skill-name"]
---

Agent instructions in the body, same conventions as a SKILL.md body: imperative, no second person.
```

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | **Yes** | Kebab-case, must match the file's own purpose (not the filename, but convention keeps them equal) |
| `description` | **Yes** | The orchestrator's only signal for when to delegate — write it as a routing decision, not a summary |
| `tools` | No | Comma-separated allowlist; omit to inherit the caller's tools |
| `model` | No | One of `sonnet`, `opus`, `haiku`, `inherit` — any other value fails certification |
| `color` | No | UI hint, no functional effect |
| `skills` | No | Array of `plugin:skill-name` refs to preload; each ref must resolve to an existing `SKILL.md` and must not carry `disable-model-invocation: true`, or the agent cannot actually load it |

Agents live at `<plugin>/agents/<agent-name>.md`, one file per agent, discovered automatically —
no manifest entry needed unless `plugin.json` supplements the default path.

## VS Code Copilot Custom Agents

Source: `code.visualstudio.com/docs/copilot/customization/custom-chat-modes` (custom agents, also
called chat modes).

```markdown
---
description: "One-line summary shown in the agent picker."
tools: ["codebase", "terminal"]
model: gpt-4.1
---

Agent instructions in the body: scope, constraints, and the workflow this agent follows.
```

| Field | Required | Constraints |
|-------|----------|-------------|
| `description` | Recommended | Shown in the picker; no hard length limit documented, keep it a single sentence |
| `tools` | No | Array of tool names or tool-set names; unlisted tools are unavailable to the agent |
| `model` | No | Any model identifier the editor's model picker exposes; unset inherits the active chat model |

Custom agents live under `.github/chatmodes/*.chatmode.md` (workspace) or the user profile
equivalent — there is no plugin-relative path, unlike Claude Code subagents.

## Cross-Platform Differences That Matter

| Aspect | Claude Code | VS Code Copilot |
|---|---|---|
| File location | `<plugin>/agents/*.md`, plugin-relative | `.github/chatmodes/*.chatmode.md`, workspace-relative |
| Tool restriction | `tools:` allowlist, comma-separated | `tools:` allowlist, array of tool/tool-set names |
| Model pinning | `sonnet`/`opus`/`haiku`/`inherit` enum | free-form model identifier from the editor's picker |
| Preloading skills | `skills:` array, certified for resolvability and preloadability | no equivalent field |

Do not port one platform's field names to the other verbatim — `tools` exists on both but takes a
different shape, and `skills:` has no VS Code counterpart at all.

See also: `plugin-conventions` for where the agent file sits inside a Claude plugin directory,
`skill-authoring` for the SKILL.md body conventions an agent's instructions should follow.
