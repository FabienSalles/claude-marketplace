#!/bin/bash
# PostToolUse hook: log all Bash commands to audit trail
# Always exits 0 to never interfere with workflow

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null)

if [ -n "$COMMAND" ]; then
    LOG_DIR="$HOME/.claude/audit"
    mkdir -p "$LOG_DIR"
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    CWD=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('cwd', 'unknown'))" 2>/dev/null)
    echo "[$TIMESTAMP] [$CWD] $COMMAND" >> "$LOG_DIR/commands.log"
fi

exit 0
