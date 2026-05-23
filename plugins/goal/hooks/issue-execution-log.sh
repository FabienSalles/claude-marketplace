#!/bin/bash
# Stop hook — regenerate the per-issue execution log on every turn end,
# but ONLY when ALL three preconditions hold:
#
#   1. Current branch matches `feature/issue-<N>-…`
#   2. `.claude/plans/issue-<N>-spec.md` exists at the repo root
#   3. The current session's transcript contains at least one `/goal` user
#      command (i.e. the autonomous loop has been engaged at some point)
#
# Precondition #3 is what guarantees this hook stays a no-op when you just
# open `claude` on the issue branch for a quick read-through, a manual
# tweak, or anything that isn't a real autonomous /goal cycle.
#
# Output: `.claude/plans/issue-<N>-execution-log.md` (overwritten each Stop).
# Always exits 0 so it never interferes with the user's session.

set -eu

INPUT=$(cat)

TRANSCRIPT=$(printf '%s' "$INPUT" \
    | python3 -c "import sys, json; print(json.load(sys.stdin).get('transcript_path', ''))" 2>/dev/null \
    || true)
CWD=$(printf '%s' "$INPUT" \
    | python3 -c "import sys, json; print(json.load(sys.stdin).get('cwd', ''))" 2>/dev/null \
    || true)

[ -z "$CWD" ] && exit 0
[ ! -d "$CWD" ] && exit 0

cd "$CWD" || exit 0

# (a) Inside a git repo
git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0

# (b) Branch must match feature/issue-<N>-...
branch=$(git branch --show-current 2>/dev/null || true)
issue_num=$(printf '%s' "$branch" | sed -n 's|^feature/issue-\([0-9][0-9]*\).*|\1|p')
[ -z "$issue_num" ] && exit 0

# (c) Spec must exist
spec_file=".claude/plans/issue-${issue_num}-spec.md"
[ ! -f "$spec_file" ] && exit 0

# (d) /goal must have been engaged in this session.
#     Without this guard, the hook would also fire when you open `claude`
#     on the branch just to read code, which defeats the purpose.
#     The transcript_path is provided by Claude Code in the Stop event input;
#     a missing or unreadable transcript means we cannot verify the guard,
#     so we bail rather than guess.
[ -z "$TRANSCRIPT" ] && exit 0
[ ! -f "$TRANSCRIPT" ] && exit 0
grep -qE '"content"[[:space:]]*:[[:space:]]*"/goal' "$TRANSCRIPT" || exit 0

SCRIPT="${CLAUDE_PLUGIN_ROOT}/scripts/extract-execution-log.py"
[ ! -f "$SCRIPT" ] && exit 0

# Pass the explicit transcript_path so the extractor doesn't have to guess.
# Stderr suppressed — failures here must not pollute the user's session.
python3 "$SCRIPT" "$issue_num" "$TRANSCRIPT" >/dev/null 2>&1 || true

exit 0
