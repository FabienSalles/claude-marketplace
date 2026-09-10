---
name: skill-authoring
description: "ACTIVATE when creating SKILL.md files, writing frontmatter (name/description), structuring skill packages for discovery, or publishing to the Agent Skills ecosystem. ACTIVATE for 'SKILL.md', 'npx skills', 'skill frontmatter', 'skill discovery', 'skill description length'. Covers: SKILL.md frontmatter schema, description as routing mechanism, hard platform limits sourced across three loaders (Anthropic's agentskills.io spec, VS Code Copilot's agent-skills docs, the OpenAI Codex parser), progressive disclosure, directory structure, discovery mechanics. DO NOT use for: plugin.json/marketplace.json/hooks.json (see plugin-conventions), agent .md format (see agent-authoring)."
metadata:
  version: "1.0"
---

# Skill Authoring Conventions

Best practices for writing `SKILL.md`, based on the specification and on the hard limits enforced by the three loaders this marketplace certifies against: `agentskills.io/specification`, `code.visualstudio.com/docs/agent-customization/agent-skills` (VS Code Copilot), and the OpenAI Codex parser (`openai/codex` `codex-rs/skills/src/parser.rs`, constant `MAX_DESCRIPTION_LEN`).

## Frontmatter Schema

### Agent Skills Standard (cross-platform, agentskills.io/specification)

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | **Yes** | Max 64 chars, `[a-z0-9-]` only, no leading/trailing/consecutive hyphens, **must match parent directory name** |
| `description` | **Yes** | Max 1024 chars (the limit shared by agentskills.io, VS Code Copilot and the Codex parser — see Platform Limits below), no angle brackets, single-line string |
| `license` | No | SPDX identifier (MIT, Apache-2.0) |
| `compatibility` | No | Max 500 chars, platform/dependency requirements |
| `metadata` | No | Arbitrary string->string key-value map |
| `allowed-tools` | No | Space-delimited pre-approved tools |

A top-level `version` key is a de-facto convention — Anthropic's own template ships it, but
the spec's reference validator rejects unlisted keys. The spec-compliant location is
`metadata.version`. Claude Code itself ignores both.

### Claude Code Extensions (Claude-specific)

| Field | Description |
|-------|-------------|
| `disable-model-invocation` | `true` prevents Claude from auto-loading (manual `/name` only) |
| `user-invocable` | `false` hides from `/` menu |
| `context` | `fork` to run in isolated subagent |
| `agent` | Subagent type for `context: fork` (Explore, Plan, general-purpose) |
| `model` | Model override when active |

### Critical: name must match directory

```
php-8-3/          <- directory name
└── SKILL.md
    name: php-8-3  <- must match exactly
```

## Platform Limits — Sourced Across Three Loaders

The `description` hard cap is 1024 characters on all three platforms this repo certifies against:

| Platform | Source |
|----------|--------|
| Agent Skills spec | `agentskills.io/specification` |
| VS Code Copilot | `code.visualstudio.com/docs/agent-customization/agent-skills` |
| OpenAI Codex | `openai/codex` `codex-rs/skills/src/parser.rs`, constant `MAX_DESCRIPTION_LEN` |

Beyond that shared hard limit, treat **300 characters as the advisory target**: a description that
still fits in 300 chars stays legible in a `/` menu and in narrow routing UIs, while the 1024 cap
exists to accommodate the trigger-phrase-heavy style this marketplace uses. Certification (level 4,
non-blocking) does not enforce the 300-char target — it is prose guidance for authors, not a gate.

## Description -- The Most Important Field

The `description` is the **primary routing mechanism** for both skills.sh indexing and Claude activation. Write it as activation triggers.

**Rules:**
- Third person: "This skill should be used when..." or an `ACTIVATE when...` imperative
- Include specific trigger phrases users would say
- Single-line string (Claude Code indexer doesn't parse YAML multiline)
- Under 1024 characters (hard), aim for under 300 (advisory)
- No angle brackets (`<` or `>`)

## Skill Directory Structure

```
skill-name/
├── SKILL.md              # Core instructions (<2000 words, <=500 lines)
├── references/           # Detailed docs (loaded on demand)
│   └── patterns.md
└── examples/             # Working examples
    └── sample.sh
```

## Progressive Disclosure

Skills use 3-level loading for context efficiency:

1. **Metadata** (~100 tokens) -- always in context (name + description)
2. **SKILL.md body** (<5000 tokens) -- loaded when skill triggers
3. **Bundled resources** (unlimited) -- loaded on demand by Claude

**Keep SKILL.md under 2000 words.** Move detailed content to `references/`.

## Discovery Mechanics

### CLI discovery (`npx skills add`)

The CLI searches these directories in order: `skills/`, `.claude/skills/`, `.agents/skills/`, and 30+ agent-specific paths.

### Leaderboard discovery (skills.sh)

Skills appear **automatically** when users install them via `npx skills add`. No registration step needed.

### Agent-side discovery (Claude Code)

1. Metadata loaded at startup for all installed skills
2. Claude reads descriptions to match tasks
3. Full SKILL.md body loaded only on activation
4. Resources loaded only when referenced

## Installation Scopes

| Scope | Path | Command |
|-------|------|---------|
| Project | `.claude/skills/` | `npx skills add repo` |
| Personal | `~/.claude/skills/` | `npx skills add repo --global` |
| Plugin | `<plugin>/skills/` | `claude plugin install` |

See also: `agent-authoring` for the agent `.md` format (VS Code Copilot custom agents, Claude Code subagents), `plugin-conventions` for `plugin.json`/`marketplace.json`/`hooks.json` and `evals/evals.json`.
