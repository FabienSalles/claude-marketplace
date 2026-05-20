#!/bin/bash
# PreToolUse hook on Bash: block any `git commit` whose message contains an
# AI-assistant co-author trailer (Co-Authored-By: Claude/ChatGPT/Copilot/…).
#
# The user does not want AI co-authorship visible in commit history. This
# hook enforces the policy at the tool-call boundary so it cannot be skipped
# by forgetting to remove the trailer from a HEREDOC commit message.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null)

# Only inspect git commit commands (covers `git commit`, `git commit --amend`, etc.)
if ! echo "$COMMAND" | grep -qE 'git[[:space:]]+commit\b'; then
    exit 0
fi

# Look for AI co-author trailers (case-insensitive). Matches:
#   Co-Authored-By: Claude
#   Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
#   Co-Authored-By: ChatGPT / GPT-4 / Codex / Copilot / Cursor / Anthropic / OpenAI / Gemini
if echo "$COMMAND" | grep -qiE 'Co-Authored-By:[[:space:]]*(Claude|ChatGPT|GPT-?[0-9]|Codex|Copilot|Cursor|Anthropic|OpenAI|Gemini)'; then
    cat << 'EOF'
{
  "decision": "block",
  "reason": "Co-Authored-By trailer for an AI assistant is forbidden in this user's commits.\n\nFix: rewrite the commit message to drop the `Co-Authored-By: …` line entirely (and its preceding blank line). Do NOT replace it with a `Generated-By:`, `Assistant:`, or any equivalent — the trailer must be removed, not renamed.\n\nThen retry the same `git commit` command without that line."
}
EOF
    exit 2
fi

exit 0
