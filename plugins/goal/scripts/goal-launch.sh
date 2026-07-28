#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Open an isolated goal run
#
# Creates the worktree, then opens a tmux session inside it running /goal:auto on
# the plan you named. Three gestures become one.
#
# The session is dedicated on purpose. A run living in your interactive session dies
# from a keystroke — navigating out of its progress view interrupts it — which makes
# looking at the run the gesture that kills it. It also leaves your checkout free.
#
# Exit codes:
#   0 — the session was opened
#   1 — refused: no plan named, plan unreadable, or a worktree already holds it
#
# Usage:
#   ./plugins/goal/scripts/goal-launch.sh .claude/plans/<work-id>-spec.md
# ─────────────────────────────────────────────

set -uo pipefail

die() {
  printf 'goal-launch: %s\n' "$1" >&2
  exit 1
}

plan="${1:-}"

# Named, never resolved by recency: a bare /goal:auto takes the most recently modified
# *-spec.md, which is ambiguous the moment a split produced several.
[ -n "$plan" ] || die "name the plan to run: goal-launch.sh .claude/plans/<work-id>-spec.md"
[ -f "$plan" ] || die "plan not readable: $plan"

root=$(git rev-parse --show-toplevel 2>/dev/null) || die "not a git repository"

# `readlink -f` is GNU and absent from macOS, so the directory is resolved by entering it.
plan_dir=$(cd "$(dirname "$plan")" && pwd) || die "cannot resolve: $plan"
plan_abs="$plan_dir/$(basename "$plan")"

work_id=$(basename "$plan" -spec.md)
branch="feature/$work_id"
tree="$root/.worktrees/$work_id"

[ -e "$tree" ] && die "a worktree already holds $work_id: $tree"

# The default branch when there is one, the current commit otherwise — a fresh clone with no
# origin still gets a worktree rather than a refusal.
base=$(git -C "$root" rev-parse --abbrev-ref origin/HEAD 2>/dev/null) || base=$(git -C "$root" rev-parse --abbrev-ref HEAD)

git -C "$root" worktree add "$tree" -b "$branch" "$base" >/dev/null 2>&1 ||
  die "could not create the worktree at $tree on $branch"

printf 'worktree %s\nbranch   %s\nplan     %s\n' "$tree" "$branch" "$plan_abs"

# The plan is passed absolute: `.claude/` is gitignored, so it does not exist inside the
# worktree that was just created, and a relative path would resolve against a tree holding
# no plans at all.
exec tmux new-session -s "$work_id" -c "$tree" "claude '/goal:auto $plan_abs'"
