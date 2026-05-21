#!/bin/bash
set -euo pipefail

# Hook PostToolUse for Write: Add newly created file to git (empty) so user can see diff before commit

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ -z "$file_path" ]]; then
    exit 0
fi

# Check if file exists
if [[ ! -f "$file_path" ]]; then
    exit 0
fi

# Find the git repository root for this file (may be different from cwd)
file_dir=$(dirname "$file_path")
git_root=$(git -C "$file_dir" rev-parse --show-toplevel 2>/dev/null) || exit 0

# Get relative path from git root (portable: macOS BSD realpath has no --relative-to;
# pwd -P resolves symlinks so /tmp vs /private/tmp lines up on both sides)
abs_file="$(cd "$file_dir" && pwd -P)/$(basename "$file_path")"
abs_git_root="$(cd "$git_root" && pwd -P)"
relative_path="${abs_file#"$abs_git_root"/}"

# Check if file is new (not tracked by git)
if git -C "$git_root" ls-files --error-unmatch "$relative_path" > /dev/null 2>&1; then
    # File already tracked, skip
    exit 0
fi

# Add the file with intent-to-add so user can see diff
git -C "$git_root" add -N "$relative_path" 2>/dev/null || true

echo "Added $relative_path to git index (intent to add) in $git_root"
