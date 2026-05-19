#!/bin/bash

# Hook to warn about using 'mv' instead of 'git mv' in git repositories

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command from the JSON input
COMMAND=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null)

# Check if command starts with 'mv ' (not 'git mv')
if echo "$COMMAND" | grep -qE '^mv\s+' && ! echo "$COMMAND" | grep -qE '^git\s+mv'; then
    cat << 'EOF'
{
  "decision": "block",
  "reason": "Use `git mv` instead of `mv` to rename/move files in a git repo.\n\nProblem: the file will not be tracked correctly by git.\n\nSolution: git mv source destination"
}
EOF
    exit 2
fi

exit 0
