---
description: Install or refresh ~/.claude/CLAUDE.md with the canonical universal rules (verification, anti-over-engineering, git discipline) bundled with this plugin
---

# /common:install-global-claude-md

Install (or update) the global `~/.claude/CLAUDE.md` from the canonical template bundled with this plugin.

## Source

Template: `${CLAUDE_PLUGIN_ROOT}/templates/global-claude-md.template`

Target: `~/.claude/CLAUDE.md`

## Steps

1. Read the template at `${CLAUDE_PLUGIN_ROOT}/templates/global-claude-md.template`.
2. Check if `~/.claude/CLAUDE.md` already exists:
   - If **no**, write the template content directly to `~/.claude/CLAUDE.md`.
   - If **yes**, compute and show the diff between the existing file and the template. Ask the user before overwriting.
3. Once the file is written, confirm with the user and show the final path.
4. Suggest the user add the file to `chezmoi` for portability across Macs:
   ```bash
   chezmoi add ~/.claude/CLAUDE.md
   ```

## Behavior

- **Never overwrite without showing the diff first** when an existing file is found.
- **Preserve user customizations** : if the user has added custom sections not present in the template, append the template sections rather than replace the whole file. Ask explicitly.
- **Idempotent** : running the command twice should be a no-op when the file already matches the template.

## Companion

This template carries the UNIVERSAL rules (cross-language, cross-platform). For macOS-specific shell rules, the `mac-platform` skill from the `mac` plugin loads automatically on shell/setup work.
