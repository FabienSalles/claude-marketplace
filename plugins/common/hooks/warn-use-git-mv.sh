#!/bin/bash

# Hook to warn about using 'mv' instead of 'git mv' in git repositories

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command from the JSON input
COMMAND=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null)

if echo "$COMMAND" | grep -qE '^mv\s+' && ! echo "$COMMAND" | grep -qE '^git\s+mv' && echo "$COMMAND" | python3 -c '
import shlex, subprocess, sys
lexer = shlex.shlex(sys.stdin.read(), posix=True, punctuation_chars=True)
lexer.whitespace_split = True
words = []
for word in lexer:
    if all(c in ";&|<>()" for c in word):
        break
    words.append(word)
sources = [word for word in words[1:] if not word.startswith("-")][:-1]
tracked = subprocess.run(["git", "ls-files", "--"] + sources, capture_output=True, text=True).stdout
sys.exit(0 if sources and tracked else 1)
' 2>/dev/null; then
    cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Use `git mv` instead of `mv` to rename/move files in a git repo.\n\nProblem: the file will not be tracked correctly by git.\n\nSolution: git mv source destination"
  }
}
EOF
    exit 0
fi

exit 0
