#!/bin/bash
# PreToolUse hook: warn when editing test files without being explicitly asked
# Matches Write|Edit on files in tests/ directories or *Test.php/*test.ts files

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('file_path', ''))" 2>/dev/null)

# Check if the file is a test file
IS_TEST=false
if echo "$FILE_PATH" | grep -qE '(/tests/|/test/|/__tests__/|\.test\.[jt]sx?$|\.spec\.[jt]sx?$|Test\.php$)'; then
    IS_TEST=true
fi

if [ "$IS_TEST" = true ]; then
    cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "⚠️ **ATTENTION : Modification d'un fichier de test**\n\nTu t'apprêtes à modifier un fichier de test. L'utilisateur t'a-t-il explicitement demandé de modifier les tests ?\n\n- Si NON : concentre-toi sur le code de production uniquement.\n- Si OUI (TDD, fix test, ajout test) : continue."
  }
}
EOF
fi

exit 0
