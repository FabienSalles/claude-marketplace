#!/bin/bash

# git:fetch-first — PreToolUse guard.
# Block remote-reasoning / mutating commands (gh pr create, git push,
# git switch -c, git checkout -b) when FETCH_HEAD is stale (> 10 min) or
# absent, so decisions never run on perimed tracking refs.
# Escape hatches: no remote configured, or a fetch newer than the threshold.
# Bash 3.2 compatible; BSD/GNU stat handled.

STALE_SECONDS=600

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_input', {}).get('command', ''))" 2>/dev/null)

[ -z "$COMMAND" ] && exit 0

GUARDED='gh +pr +create|git([[:space:]]+-[^[:space:]]+)*[[:space:]]+push([[:space:]]|$)|git([[:space:]]+-[^[:space:]]+)*[[:space:]]+switch[[:space:]]+-c|git([[:space:]]+-[^[:space:]]+)*[[:space:]]+checkout[[:space:]]+-b'
echo "$COMMAND" | grep -qE "$GUARDED" || exit 0

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -n "$(git remote 2>/dev/null)" ] || exit 0

FETCH_HEAD_PATH=$(git rev-parse --git-path FETCH_HEAD 2>/dev/null)
if [ -f "$FETCH_HEAD_PATH" ]; then
    if [ "$(uname -s)" = "Darwin" ]; then
        FH_MTIME=$(stat -f %m "$FETCH_HEAD_PATH" 2>/dev/null)
    else
        FH_MTIME=$(stat -c %Y "$FETCH_HEAD_PATH" 2>/dev/null)
    fi
    if [ -n "$FH_MTIME" ]; then
        AGE=$(( $(date +%s) - FH_MTIME ))
        [ "$AGE" -le "$STALE_SECONDS" ] && exit 0
    fi
fi

cat << 'EOF'
{
  "decision": "block",
  "reason": "Refs de suivi périmées (pas de `git fetch` récent). Avant de raisonner sur l'état distant ou de pousser : `git fetch --prune`, puis relance la commande. Échappatoires : aucun remote configuré, ou un fetch de moins de 10 min."
}
EOF
exit 2
