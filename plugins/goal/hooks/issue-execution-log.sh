#!/bin/bash
# Stop hook — regenerate the per-work-item execution log on every turn end,
# but ONLY when ALL three preconditions hold:
#
#   1. Current branch matches `feature/<work-id>-…` for some `<work-id>` whose
#      spec file exists (work-id is `issue-<N>` for GitHub, a Jira key like
#      `ct-1234`, or a slug for a file/inline source)
#   2. `.claude/plans/<work-id>-spec.md` exists at the repo root
#   3. The current session's transcript contains at least one `/goal` user
#      command (i.e. the autonomous loop has been engaged at some point)
#
# Precondition #3 is what guarantees this hook stays a no-op when you just
# open `claude` on the branch for a quick read-through, a manual tweak, or
# anything that isn't a real autonomous /goal cycle.
#
# Output: `.claude/plans/<work-id>-execution-log.md` (overwritten each Stop).
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

# (b)+(c) Branch must be feature/<work-id>-… for a work-id whose spec exists.
#         We derive the work-id by matching existing spec files against the
#         branch, so ids containing hyphens (issue-42, ct-1234) are handled
#         without ambiguous "id vs slug" parsing.
branch=$(git branch --show-current 2>/dev/null || true)
case "$branch" in
    feature/*) : ;;
    *) exit 0 ;;
esac

work_id=""
for spec in .claude/plans/*-spec.md; do
    [ -f "$spec" ] || continue
    base=$(basename "$spec")
    id=${base%-spec.md}
    case "$branch" in
        "feature/$id"|"feature/$id-"*) work_id="$id"; break ;;
    esac
done
[ -z "$work_id" ] && exit 0

spec_file=".claude/plans/${work_id}-spec.md"
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
python3 "$SCRIPT" "$work_id" "$TRANSCRIPT" >/dev/null 2>&1 || true

exit 0
