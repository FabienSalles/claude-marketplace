---
description: Add the credential-file deny rules to ~/.claude/settings.json (idempotent, with backup).
---

The hooks in this plugin already block credential files on their own. This command adds a
second, independent layer that `plugin.json` cannot carry: `permissions.deny` rules on the
`Read` tool.

Two reasons to have both:

1. A `deny` rule is enforced by the harness before the hook runs, so it holds even if hooks
   are disabled (`disableAllHooks`, `allowManagedHooksOnly`).
2. Per the settings schema, `sandbox.filesystem.denyRead` is *"merged with paths from
   `Read(...)` deny permission rules"* — so the day the sandbox is enabled, these same rules
   also cover reads performed by sandboxed Bash commands.

Existing `deny` entries are preserved; the rules are unioned, so re-running changes nothing.

The rule list lives in `permissions-deny.json` next to this command, and is read from there
rather than spelled out inline. That is not cosmetic: `secret-file-guard.sh` refuses any Bash
command *mentioning* a credential path, so a command containing the literal patterns would be
blocked by this plugin's own hook. Keeping the list in a data file also makes it the single
place to edit when adding a pattern.

Run exactly the following Bash block and report the resulting output to the user. Do not
modify the commands. Do not ask for confirmation — the user already opted in by invoking
this command.

```bash
set -euo pipefail

settings_file="$HOME/.claude/settings.json"
rules_file="${CLAUDE_PLUGIN_ROOT}/permissions-deny.json"

mkdir -p "$HOME/.claude"

# Ensure settings.json exists with valid JSON
if [ ! -f "$settings_file" ] || ! jq empty "$settings_file" 2>/dev/null; then
  [ -f "$settings_file" ] && cp "$settings_file" "${settings_file}.bak.$(date +%s)"
  echo '{}' > "$settings_file"
fi

cp "$settings_file" "${settings_file}.bak.$(date +%s)"

before=$(jq '(.permissions.deny // []) | length' "$settings_file")

jq --slurpfile rules "$rules_file" \
  '.permissions.deny = (((.permissions.deny // []) + $rules[0]) | unique)' \
  "$settings_file" > "${settings_file}.tmp" && mv "${settings_file}.tmp" "$settings_file"

after=$(jq '.permissions.deny | length' "$settings_file")

echo "✓ permissions.deny: $before → $after rules in $settings_file"
jq -r '.permissions.deny[]' "$settings_file" | sed 's/^/    /'
echo "ℹ the hooks block these files regardless; these rules are the second layer"
```

After it runs, do not edit any other files. Stop and let the user verify.
