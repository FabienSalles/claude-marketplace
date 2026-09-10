# skills

Certifies any skill directory against the Agent Skills spec, hard platform limits, and
non-blocking authoring advisories, and ships the authoring conventions those checks enforce.

## Install

```text
/plugin install skills@fabien-claude-marketplace
```

## Skills (3)

| Skill | Purpose |
|---|---|
| [`skill-authoring`](skills/skill-authoring/SKILL.md) | `SKILL.md` frontmatter schema, description as routing mechanism, platform limits sourced across agentskills.io/VS Code Copilot/Codex, progressive disclosure, directory structure |
| [`agent-authoring`](skills/agent-authoring/SKILL.md) | Claude Code subagent frontmatter (`tools`/`model`/`skills`), VS Code Copilot custom agent format, cross-platform differences |
| [`plugin-conventions`](skills/plugin-conventions/SKILL.md) | Plugin directory structure, `plugin.json`/`marketplace.json`/`hooks.json` schemas, `${CLAUDE_PLUGIN_ROOT}` portability, `evals/evals.json` format |

## Certification

```bash
# Certify one skill
node plugins/skills/scripts/certify.ts <skill-dir>

# Certify every skill under a plugin
node plugins/skills/scripts/certify.ts <plugin-dir>

# Certify a single agent
node plugins/skills/scripts/certify.ts <plugin>/agents/<agent>.md

# Repo-wide stock report (coherence: README counters, see-also pointers)
node plugins/skills/scripts/certify.ts --stock

# Certify only what changed since a base ref
node plugins/skills/scripts/certify.ts --diff <base-ref>

# Verify a skill installs cleanly (files present, skills-lock.json entry)
node plugins/skills/scripts/certify.ts --install <skill-dir>
```
