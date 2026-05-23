#!/bin/bash
# Stop hook — regenerate the per-issue execution log when, and ONLY when,
# the current branch is `feature/issue-<N>-…` AND a matching spec file
# exists in `.claude/plans/`. Silent no-op everywhere else, so the hook
# adds zero overhead to normal sessions.
#
# Output: `.claude/plans/issue-<N>-execution-log.md` (overwritten on each
# Stop event). Always exits 0 so it never interferes with the session.

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

# Only proceed inside a git repo
git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0

# Branch must match feature/issue-<N>-...
branch=$(git branch --show-current 2>/dev/null || true)
issue_num=$(printf '%s' "$branch" | sed -n 's|^feature/issue-\([0-9][0-9]*\).*|\1|p')
[ -z "$issue_num" ] && exit 0

# Spec must exist
spec_file=".claude/plans/issue-${issue_num}-spec.md"
[ ! -f "$spec_file" ] && exit 0

SCRIPT="${CLAUDE_PLUGIN_ROOT}/scripts/extract-execution-log.py"
[ ! -f "$SCRIPT" ] && exit 0

# Pass the explicit transcript_path so the extractor doesn't have to guess.
# Stderr suppressed — failures here must not pollute the user's session.
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
    python3 "$SCRIPT" "$issue_num" "$TRANSCRIPT" >/dev/null 2>&1 || true
else
    python3 "$SCRIPT" "$issue_num" >/dev/null 2>&1 || true
fi

exit 0
