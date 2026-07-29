#!/bin/bash
# Secret file guard (PreToolUse: Read, Grep, Bash)
# Refuses to open credential files at all, rather than relying on the model
# to notice a secret after it has already been read into the transcript.
# Exit 0 = allow, exit 2 = block (stderr message shown to Claude).

set -eu

INPUT="$(cat || true)"

TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)"

case "$TOOL_NAME" in
  Read)  TARGET="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)" ;;
  Grep)  TARGET="$(printf '%s' "$INPUT" | jq -r '[.tool_input.path, .tool_input.glob] | map(select(. != null)) | join(" ")' 2>/dev/null || true)" ;;
  Bash)  TARGET="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)" ;;
  *)     exit 0 ;;
esac

[ -z "$TARGET" ] && exit 0

# Deliberately coarse: any mention of these paths is refused, not just a read.
# Shell is not parseable with a regex, so narrowing to `cat`/`head`/`sed` would
# leak through every construct not enumerated. A false positive costs one
# rephrased command; a miss costs a credential in the transcript.
PATTERNS=(
  '\.env\.local'
  '\.env\.[A-Za-z0-9_-]+\.local'
  '(^|/)auth\.json'
  '\.pem($|[^A-Za-z0-9])'
  '(^|/)id_rsa'
  '(^|/)id_ed25519'
  '(^|/)\.npmrc'
  '(^|/)\.pgpass'
  '(^|/)\.ssh/'
  '(^|/)credentials\.json'
  '(^|/)\.netrc'
)

for pattern in "${PATTERNS[@]}"; do
  if printf '%s' "$TARGET" | grep -qE "$pattern"; then
    printf 'BLOCKED by security-runtime/secret-file-guard: %s targets a credential file (%s).\nDo not work around this. If a value is needed, ask the user for it.\n' "$TOOL_NAME" "$pattern" >&2
    exit 2
  fi
done

exit 0
