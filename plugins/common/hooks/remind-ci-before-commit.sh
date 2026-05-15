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
    "additionalContext": "⚠️ **RAPPEL CI AVANT COMMIT**\n\nAs-tu lancé la pipeline qualité complète AVANT ce commit ?\n\n1. **Coding style** : phpcs / php-cs-fixer / eslint / prettier\n2. **Analyse statique** : phpstan / typescript strict\n3. **Tests** : phpunit / vitest\n\nSi un projet a un Makefile, utilise `make php/qa` ou équivalent.\nSi les checks n'ont pas été lancés, annule ce commit et lance-les d'abord."
  }
}
EOF
fi

exit 0
