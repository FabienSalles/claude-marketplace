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
    "additionalContext": "⚠️ **HEADS-UP: Editing a test file**\n\nYou are about to modify a test file. Did the user explicitly ask you to modify tests?\n\n- If NO: focus on production code only.\n- If YES (TDD, fix test, add test): proceed."
  }
}
EOF
fi

exit 0
