#!/bin/bash
set -euo pipefail

# Hook PostToolUse for Write: Fix permissions on created files/directories
# Issue: https://github.com/anthropics/claude-code/issues/12172

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ -z "$file_path" ]]; then
    exit 0
fi

if [[ ! -e "$file_path" ]]; then
    exit 0
fi

# Fix permissions
if [[ -d "$file_path" ]]; then
    # Directory: 755 (rwxr-xr-x)
    chmod 755 "$file_path"
    echo "Fixed directory permissions: $file_path (755)"
elif [[ -f "$file_path" ]]; then
    # File: 644 (rw-r--r--)
    chmod 644 "$file_path"
    echo "Fixed file permissions: $file_path (644)"

    # Also fix parent directories that may have been created with wrong permissions
    parent_dir=$(dirname "$file_path")
    while [[ "$parent_dir" != "/" && "$parent_dir" != "." ]]; do
        current_perms=$(stat -c "%a" "$parent_dir" 2>/dev/null || echo "755")
        if [[ "$current_perms" != "755" ]]; then
            chmod 755 "$parent_dir"
            echo "Fixed parent directory permissions: $parent_dir (755)"
        else
            # Stop when we hit a directory with correct permissions (already existed)
            break
        fi
        parent_dir=$(dirname "$parent_dir")
    done
fi
