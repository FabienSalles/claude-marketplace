#!/bin/bash

# Hook to warn about using 'mv' instead of 'git mv' in git repositories

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command from the JSON input
COMMAND=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null)

# Check if command starts with 'mv ' (not 'git mv')
if echo "$COMMAND" | grep -qE '^mv\s+' && ! echo "$COMMAND" | grep -qE '^git\s+mv'; then
    # Output JSON to block the command
    cat << 'EOF'
{
  "decision": "block",
  "reason": "Utilise `git mv` au lieu de `mv` pour renommer/déplacer des fichiers dans un repo git.\n\nProblème : Le fichier ne sera pas tracké correctement par git.\n\nSolution : git mv source destination"
}
EOF
    exit 0
fi

# Allow the command
echo '{"decision": "allow"}'
