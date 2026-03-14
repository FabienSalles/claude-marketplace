---
name: npx-skills-conventions
description: This skill should be used when creating skills for the Agent Skills ecosystem (npx skills add, skillkit), writing SKILL.md frontmatter, or structuring skill packages for discovery. Covers the specification, frontmatter schema, and discovery mechanics.
version: "1.0"
---

# Agent Skills & npx skills Conventions

Best practices for creating skills compatible with `npx skills add`, skills.sh leaderboard, and skillkit, based on the Agent Skills specification and ecosystem analysis.

## SKILL.md Frontmatter Schema

### Agent Skills Standard (cross-platform)

```yaml
---
name: skill-name
description: This skill should be used when the user asks to "specific action 1", "specific action 2", or mentions keyword. Provides detailed guidance on topic.
version: "1.0"
license: MIT
compatibility: Requires Python 3.9+
metadata:
  author: org-name
  version: "1.0"
  category: development
---
```

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | **Yes** | Max 64 chars, `[a-z0-9-]` only, no leading/trailing/consecutive hyphens, **must match parent directory name** |
| `description` | **Yes** | Max 1024 chars, no angle brackets, single-line string |
| `license` | No | SPDX identifier (MIT, Apache-2.0) |
| `compatibility` | No | Max 500 chars, platform/dependency requirements |
| `metadata` | No | Arbitrary string→string key-value map |
| `allowed-tools` | No | Space-delimited pre-approved tools |

### Claude Code Extensions (Claude-specific)

| Field | Description |
|-------|-------------|
| `disable-model-invocation` | `true` prevents Claude from auto-loading (manual `/name` only) |
| `user-invocable` | `false` hides from `/` menu |
| `context` | `fork` to run in isolated subagent |
| `agent` | Subagent type for `context: fork` (Explore, Plan, general-purpose) |
| `model` | Model override when active |
| `argument-hint` | Autocomplete hint (e.g., `[issue-number]`) |
| `hooks` | Hooks scoped to skill lifecycle |

### Critical: name must match directory

```
php-8.3/          ← directory name
└── SKILL.md
    name: php-8.3  ← must match exactly
```

## Description — The Most Important Field

The `description` is the **primary routing mechanism** for both skills.sh indexing and Claude activation. Write it as activation triggers:

**Good:**
```yaml
description: This skill should be used when writing PHP code. Provides PHP 8.3 specific features and conventions including typed constants, json_validate(), Override attribute, and Randomizer additions.
version: "1.0"
```

**Bad:**
```yaml
description: Helps with PHP.
version: "1.0"
description: PHP 8.3 features.
version: "1.0"
description: Use this skill for PHP development.
version: "1.0"
```

**Rules:**
- Third person: "This skill should be used when..."
- Include specific trigger phrases users would say
- Single-line string (Claude Code indexer doesn't parse YAML multiline)
- Under 1024 characters
- No angle brackets (`<` or `>`)

## Skill Directory Structure

### Minimal skill
```
skill-name/
└── SKILL.md
```

### Standard skill (recommended)
```
skill-name/
├── SKILL.md              # Core instructions (<2000 words)
├── references/           # Detailed docs (loaded on demand)
│   └── patterns.md
└── examples/             # Working examples
    └── sample.sh
```

### Complete skill
```
skill-name/
├── SKILL.md
├── scripts/              # Executable helpers (Python/Bash/JS)
│   └── validate.py
├── references/           # Documentation
│   ├── patterns.md
│   └── advanced.md
├── examples/
│   └── sample.md
└── assets/               # Templates, images, data files
    └── template.html
```

## Progressive Disclosure

Skills use 3-level loading for context efficiency:

1. **Metadata** (~100 tokens) — always in context (name + description)
2. **SKILL.md body** (<5000 tokens) — loaded when skill triggers
3. **Bundled resources** (unlimited) — loaded on demand by Claude

**Keep SKILL.md under 2000 words.** Move detailed content to `references/`.

## Skill Package (Repository) Layout

```
my-skills-repo/
├── skills/
│   ├── skill-one/
│   │   └── SKILL.md
│   ├── skill-two/
│   │   ├── SKILL.md
│   │   └── references/
│   └── skill-three/
│       └── SKILL.md
├── LICENSE
└── README.md
```

## Discovery Mechanics

### CLI discovery (`npx skills add`)

The CLI searches these directories in order:
- `skills/`
- `.claude/skills/`
- `.agents/skills/`, `.agent/skills/`, `.augment/skills/`
- 30+ agent-specific paths
- Falls back to recursive search if nothing found

If `.claude-plugin/marketplace.json` or `plugin.json` exists, declared skills are also discovered.

### Leaderboard discovery (skills.sh)

Skills appear **automatically** when users install them via `npx skills add`. Anonymous telemetry tracks aggregate install counts. No registration step needed.

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

## CLI Reference

```bash
# Install from GitHub
npx skills add owner/repo

# Install specific skill
npx skills add owner/repo --skill skill-name

# Install globally (all projects)
npx skills add owner/repo --global

# List available skills
npx skills add owner/repo --list

# Install all skills to all agents
npx skills add owner/repo --all

# Skip confirmation
npx skills add owner/repo --yes

# Copy files instead of symlinking
npx skills add owner/repo --copy

# Other commands
npx skills list              # View installed
npx skills find [query]      # Search
npx skills remove [skills]   # Uninstall
npx skills check             # Check updates
npx skills update            # Upgrade all
npx skills init [name]       # Scaffold new SKILL.md
```

## Environment Variables

| Variable | Effect |
|----------|--------|
| `INSTALL_INTERNAL_SKILLS=1` | Show skills with `metadata.internal: true` |
| `DISABLE_TELEMETRY=1` | Disable anonymous usage tracking |
| `DO_NOT_TRACK=1` | Alternative telemetry disable |

## SkillKit Compatibility

[SkillKit](https://github.com/rohitg00/skillkit) supports 44+ agents and auto-translates between formats (SKILL.md for Claude Code, .mdc for Cursor, etc.). Compatible with the same SKILL.md format and GitHub repos as `npx skills add`.

```bash
npx skillkit@latest install owner/repo
npx skillkit@latest recommend
npx skillkit@latest sync
```

## Writing Style Rules

### Imperative form in body
```
# Good
Parse the configuration file.
Validate input before processing.
Use grep to search patterns.

# Bad
You should parse the configuration file.
You need to validate input.
```

### Third person in description
```yaml
# Good
description: This skill should be used when creating Zod schemas...
version: "1.0"

# Bad
description: Use this skill when creating Zod schemas...
version: "1.0"
```

## Validation Checklist

- [ ] `name` matches parent directory name exactly
- [ ] `name` is kebab-case, ≤64 chars, `[a-z0-9-]` only
- [ ] `description` is single-line, ≤1024 chars, third person
- [ ] `description` includes specific trigger phrases
- [ ] SKILL.md body ≤2000 words (detailed content in references/)
- [ ] Body uses imperative form, not second person
- [ ] Referenced files exist
- [ ] `npx skills add . --list` discovers the skill
- [ ] Skill triggers correctly on expected user queries

## Key Repos to Study

| Repo | Stars | Notable |
|------|-------|---------|
| [anthropics/skills](https://github.com/anthropics/skills) | ~93k | Canonical spec + template |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | ~23k | Polished skill examples |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | ~10k | CLI source code |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | ~11k | Official plugin directory |
