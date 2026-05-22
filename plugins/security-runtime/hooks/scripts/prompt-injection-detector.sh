#!/bin/bash
# Prompt injection detector for Bash commands (PreToolUse)
# Inspects the command string for AI-instruction-override patterns.
# Exit 0 = allow, exit 2 = block (stderr message shown to Claude).

set -eu

INPUT="$(cat || true)"

TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)"
[ "$TOOL_NAME" != "Bash" ] && exit 0

COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[ -z "$COMMAND" ] && exit 0

# Patterns that signal prompt-injection content in the command string itself.
# Each entry is an extended regex (grep -E -i).
PATTERNS=(
  # AI role delimiters
  '<\|im_start\|>'
  '<\|im_end\|>'
  '\[INST\]'
  '\[/INST\]'
  '<<SYS>>'
  '<</SYS>>'
  '```system'
  # Authority override (must be reasonably specific to avoid false positives on docs)
  'ignore (all )?previous instructions'
  'disregard (all )?(previous|prior) instructions'
  'you are now (a |an )?[a-zA-Z]+ (assistant|agent|model)'
  'forget (all )?(previous|prior) (instructions|context)'
  'override (previous|system) instructions'
  # Direct system-prompt impersonation
  '^system:[[:space:]]'
  '\bSYSTEM PROMPT:'
)

for pattern in "${PATTERNS[@]}"; do
  if printf '%s' "$COMMAND" | grep -qEi "$pattern"; then
    printf 'BLOCKED by security-runtime/prompt-injection-detector: pattern matched (%s)\n' "$pattern" >&2
    exit 2
  fi
done

# Null byte injection
if printf '%s' "$COMMAND" | LC_ALL=C grep -qP '\x00' 2>/dev/null; then
  printf 'BLOCKED by security-runtime/prompt-injection-detector: null byte in command\n' >&2
  exit 2
fi

exit 0
