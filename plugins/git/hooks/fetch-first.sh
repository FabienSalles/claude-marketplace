#!/bin/bash

# git:fetch-first — PreToolUse guard.
# Block branch creation (git switch -c, git checkout -b) when FETCH_HEAD is
# stale (> 10 min) or absent, so a branch is never cut from a lagging base.
# Escape hatches: no remote configured, or a fetch newer than the threshold.
# Bash 3.2 compatible; BSD/GNU stat handled.
#
# `gh pr create` and `git push` were guarded here too, and should not have been:
# neither reads local tracking refs, so no staleness can change what they do. `gh`
# queries the API, and on a push it is the remote that arbitrates — a stale local ref
# alters neither what is sent nor what is rejected. Guarding them cost real failures:
# an unattended /goal:auto run landed and pushed its branch, then had its pull request
# refused here and stopped without one. FETCH_HEAD is per-worktree, so the tree a run
# stands in has never fetched however fresh the main checkout is — the block was
# certain, not occasional.
#
# What remains is the case where staleness genuinely changes an outcome: the base of a
# new branch is what everything after it is built on, and cutting from a lagging one is
# silent. The broader rule — fetch before reasoning on remote state — stays in the `git`
# skill, where it belongs as advice rather than as a wall.

STALE_SECONDS=600

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_input', {}).get('command', ''))" 2>/dev/null)

[ -z "$COMMAND" ] && exit 0

GUARDED='git([[:space:]]+-[^[:space:]]+)*[[:space:]]+switch[[:space:]]+-c|git([[:space:]]+-[^[:space:]]+)*[[:space:]]+checkout[[:space:]]+-b'
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
