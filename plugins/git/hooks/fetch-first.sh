#!/bin/bash

# git:fetch-first — PreToolUse guard.
# Block branch creation (git switch -c, git checkout -b) when FETCH_HEAD is
# stale (> 10 min) or absent, so a branch is never cut from a lagging base.
# Escape hatches: no remote configured, a fetch newer than the threshold, or a
# `git fetch` chained with `&&` before the branch creation in the same command —
# `&&` guarantees the fetch ran and succeeded first, which is exactly the property
# the guard asks for.
# Bash 3.2 compatible; BSD/GNU stat handled.
#
# `gh pr create` and `git push` were guarded here too, and should not have been:
# neither reads local tracking refs, so no staleness can change what they do. `gh`
# queries the API, and on a push it is the remote that arbitrates — a stale local ref
# alters neither what is sent nor what is rejected. Guarding them cost real failures:
# an unattended /goal:supervise run landed and pushed its branch, then had its pull request
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

GIT_OPTIONS='([[:space:]]+(-[Cc]|--git-dir|--work-tree|--namespace|--config-env)[[:space:]]+[^[:space:]]+|[[:space:]]+-[^[:space:]]+)*'
GUARDED="git${GIT_OPTIONS}[[:space:]]+switch[[:space:]]+-c|git${GIT_OPTIONS}[[:space:]]+checkout[[:space:]]+-b"
echo "$COMMAND" | grep -qE "$GUARDED" || exit 0

echo "$COMMAND" | python3 -c '
import re, sys

cmd = sys.stdin.read()
options = r"(\s+(-[Cc]|--git-dir|--work-tree|--namespace|--config-env)\s+\S+|\s+-\S+)*"
branch = re.search(r"git" + options + r"\s+(switch\s+-c|checkout\s+-b)", cmd)
if not branch:
    sys.exit(1)
before = cmd[:branch.start()]
fetches = list(re.finditer(r"git" + options + r"\s+fetch\b", before))
if not fetches or not re.search(r"&&\s*$", before):
    sys.exit(1)
sys.exit(1 if re.search(r"[;|]", before[fetches[-1].end():]) else 0)
' && exit 0

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -n "$(git remote 2>/dev/null)" ] || exit 0

FETCH_HEAD_PATH=$(git rev-parse --git-path FETCH_HEAD 2>/dev/null)
if [ -f "$FETCH_HEAD_PATH" ]; then
    FH_MTIME=$(stat -c %Y "$FETCH_HEAD_PATH" 2>/dev/null || stat -f %m "$FETCH_HEAD_PATH" 2>/dev/null)
    if [ -n "$FH_MTIME" ]; then
        AGE=$(( $(date +%s) - FH_MTIME ))
        [ "$AGE" -le "$STALE_SECONDS" ] && exit 0
    fi
fi

cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Refs de suivi périmées (pas de `git fetch` récent). Avant de raisonner sur l'état distant ou de pousser : `git fetch --prune`, puis relance la commande. Échappatoires : aucun remote configuré, un fetch de moins de 10 min, ou un `git fetch` enchaîné avec `&&` avant la création de branche dans la même commande (`git fetch --prune && git checkout -b ma-branche`). Un `;` ne suffit pas : il laisse passer un fetch en échec."
  }
}
EOF
exit 0
