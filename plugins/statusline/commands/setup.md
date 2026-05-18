---
description: Register the statusline in ~/.claude/settings.json (creates a stable symlink and writes the statusLine entry, with backup).
---

Configure Claude Code to use this plugin's statusline by:

1. Creating a stable symlink `~/.claude/statusline-command.sh` → `${CLAUDE_PLUGIN_ROOT}/statusline.sh`. The symlink shields `settings.json` from the plugin cache path, which changes on every plugin update.
2. Backing up the existing `~/.claude/settings.json` to `*.bak.<timestamp>`.
3. Writing the `statusLine` entry to `~/.claude/settings.json` pointing to the symlink. Any pre-existing `statusLine` is overwritten.

Run exactly the following Bash block and report the resulting output to the user. Do not modify the commands. Do not ask for confirmation — the user already opted in by invoking this command.

```bash
set -euo pipefail

settings_file="$HOME/.claude/settings.json"
symlink="$HOME/.claude/statusline-command.sh"
script_path="${CLAUDE_PLUGIN_ROOT}/statusline.sh"

mkdir -p "$HOME/.claude"

# (Re)create the stable symlink
if [ -L "$symlink" ] || [ -f "$symlink" ]; then
  rm -f "$symlink"
fi
ln -s "$script_path" "$symlink"

# Ensure settings.json exists with valid JSON
if [ ! -f "$settings_file" ] || ! jq empty "$settings_file" 2>/dev/null; then
  [ -f "$settings_file" ] && cp "$settings_file" "${settings_file}.bak.$(date +%s)"
  echo '{}' > "$settings_file"
fi

# Back up the file before writing
cp "$settings_file" "${settings_file}.bak.$(date +%s)"

# Write the statusLine entry pointing to the stable symlink
jq '. + {"statusLine": {"type": "command", "command": "~/.claude/statusline-command.sh"}}' \
  "$settings_file" > "${settings_file}.tmp" && mv "${settings_file}.tmp" "$settings_file"

echo "✓ symlink: $symlink → $(readlink "$symlink")"
echo "✓ statusLine registered in $settings_file"
echo "ℹ restart Claude Code (or refresh the session) to see the bar at the bottom"
echo "ℹ optional: add \"refreshInterval\": 60 next to statusLine for the 5h-counter to tick every minute"
```

After it runs, do not edit any other files. Stop and let the user verify.
