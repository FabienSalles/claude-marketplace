#!/bin/bash
set -euo pipefail

# Hook PostToolUse for Bash: intent-to-add every new untracked file so the user can see its diff before commit

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // empty')

if [[ -z "$cwd" || ! -d "$cwd" ]]; then
    exit 0
fi

git_root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0

git -C "$git_root" ls-files --others --exclude-standard -z | while IFS= read -r -d '' relative_path; do
    git -C "$git_root" add -N -- "$relative_path" 2>/dev/null || continue

    echo "Added $relative_path to git index (intent to add) in $git_root"
done
