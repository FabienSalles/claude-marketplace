#!/bin/bash
# PreToolUse hook: remind Claude to run full CI before committing
# Matches Bash commands containing "git commit"

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null)

if echo "$COMMAND" | grep -qE 'git\s+commit'; then
    cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "⚠️ **CI REMINDER BEFORE COMMIT**\n\nDid you run the full quality pipeline BEFORE this commit?\n\n1. **Coding style**: phpcs / php-cs-fixer / eslint / prettier\n2. **Static analysis**: phpstan / typescript strict\n3. **Tests**: phpunit / vitest\n\nIf the project has a Makefile, use `make php/qa` or the equivalent.\nIf the checks have not been run, cancel this commit and run them first."
  }
}
EOF
fi

exit 0
