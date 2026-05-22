#!/bin/bash
# CLAUDE.md injection scanner (SessionStart)
# Scans CLAUDE.md files for prompt injection patterns before they're loaded.
# Non-blocking: warns on stderr, exits 0 unconditionally (SessionStart must not abort).

set -eu

# Read JSON payload from STDIN (Claude Code SessionStart format).
# We only need cwd to locate the project CLAUDE.md.
INPUT="$(cat || true)"
CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)"
[ -z "$CWD" ] && CWD="$(pwd)"

# CLAUDE.md candidate files
CANDIDATES=(
  "$HOME/.claude/CLAUDE.md"
  "$CWD/CLAUDE.md"
  "$CWD/.claude/CLAUDE.md"
)

# Patterns to flag. Single-quoted to avoid shell substitution surprises.
# Each pattern is an extended-regex (grep -E).
PATTERNS=(
  # System role injection / AI delimiters
  '<\|im_start\|>'
  '<\|im_end\|>'
  '\[INST\]'
  '\[/INST\]'
  '<<SYS>>'
  '<</SYS>>'
  '### System:'
  '### Assistant:'
  '```system'
  # Authority override
  'ignore (all )?previous instructions'
  'disregard (all )?(previous|prior) instructions'
  'you are now [a-zA-Z]'
  'new instructions:'
  'override previous'
  'forget everything'
  # Exfiltration hints embedded in instructions
  'curl [^|]*\|[ ]*(bash|sh|zsh)'
  'wget [^|]*\|[ ]*(bash|sh|zsh)'
  'base64 -d[ ]*\|[ ]*(bash|sh|zsh)'
)

FINDINGS=0
REPORT=""

scan_file() {
  local file="$1"
  [ -r "$file" ] || return 0

  # Zero-width characters (U+200B, U+200C, U+200D, U+FEFF) — common in invisible injection
  if LC_ALL=C grep -qP '[\xe2\x80\x8b\xe2\x80\x8c\xe2\x80\x8d\xef\xbb\xbf]' "$file" 2>/dev/null; then
    REPORT="${REPORT}  - ${file}: zero-width characters detected\n"
    FINDINGS=$((FINDINGS + 1))
  fi

  local pattern
  for pattern in "${PATTERNS[@]}"; do
    if grep -qEi "$pattern" "$file" 2>/dev/null; then
      REPORT="${REPORT}  - ${file}: pattern match '${pattern}'\n"
      FINDINGS=$((FINDINGS + 1))
    fi
  done
}

for f in "${CANDIDATES[@]}"; do
  scan_file "$f"
done

if [ "$FINDINGS" -gt 0 ]; then
  {
    printf '\n[security-runtime/claudemd-scanner] %d finding(s):\n' "$FINDINGS"
    printf '%b' "$REPORT"
    printf 'Review the file(s) above before trusting their contents.\n\n'
  } >&2
fi

exit 0
