---
name: npx-skills-conventions
description: "ACTIVATE when creating SKILL.md files, writing frontmatter (name/description/version), structuring skill packages for discovery, or publishing to the Agent Skills ecosystem. ACTIVATE for 'SKILL.md', 'npx skills', 'skillkit', 'skill frontmatter', 'skill discovery'. Covers: SKILL.md frontmatter schema (name constraints, description as routing mechanism), progressive disclosure (metadata/body/references), directory structure, discovery mechanics (npx skills add, skills.sh, Claude Code), installation scopes, validation checklist. DO NOT use for: Claude plugin structure (see claude-plugin-conventions), general markdown writing."
version: "1.1"
---

# Agent Skills & npx skills Conventions

Best practices for creating skills compatible with `npx skills add`, skills.sh leaderboard, and skillkit, based on the Agent Skills specification and ecosystem analysis.

## SKILL.md Frontmatter Schema

### Agent Skills Standard (cross-platform)

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | **Yes** | Max 64 chars, `[a-z0-9-]` only, no leading/trailing/consecutive hyphens, **must match parent directory name** |
| `description` | **Yes** | Max 1024 chars, no angle brackets, single-line string |
| `license` | No | SPDX identifier (MIT, Apache-2.0) |
| `compatibility` | No | Max 500 chars, platform/dependency requirements |
| `metadata` | No | Arbitrary string->string key-value map |
| `allowed-tools` | No | Space-delimited pre-approved tools |

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
php-8.3/          <- directory name
└── SKILL.md
    name: php-8.3  <- must match exactly
```

## Description -- The Most Important Field

The `description` is the **primary routing mechanism** for both skills.sh indexing and Claude activation. Write it as activation triggers.

**Rules:**
- Third person: "This skill should be used when..."
- Include specific trigger phrases users would say
- Single-line string (Claude Code indexer doesn't parse YAML multiline)
- Under 1024 characters
- No angle brackets (`<` or `>`)

## Skill Directory Structure

### Standard skill (recommended)
```
skill-name/
├── SKILL.md              # Core instructions (<2000 words)
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

> **When looking up CLI commands, environment variables, SkillKit compatibility, or the validation checklist**, read `references/skills-ecosystem-reference.md` for the complete reference.

> **When writing descriptions or body text**, read `references/skills-ecosystem-reference.md` for good/bad examples and writing style rules.
