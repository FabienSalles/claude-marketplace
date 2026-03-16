# Skills Ecosystem Reference

## Table of Contents
- [CLI Reference](#cli-reference)
- [Environment Variables](#environment-variables)
- [SkillKit Compatibility](#skillkit-compatibility)
- [Writing Style Rules](#writing-style-rules)
- [Validation Checklist](#validation-checklist)
- [Key Repos to Study](#key-repos-to-study)
- [Description Examples](#description-examples)

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
- [ ] `name` is kebab-case, <=64 chars, `[a-z0-9-]` only
- [ ] `description` is single-line, <=1024 chars, third person
- [ ] `description` includes specific trigger phrases
- [ ] SKILL.md body <=2000 words (detailed content in references/)
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

## Description Examples

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
