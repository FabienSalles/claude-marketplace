#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Open an isolated goal run
#
# Creates the worktree, then opens a tmux session inside it running /goal:auto on
# the plan you named, in a permission mode that never prompts. Three gestures become one.
#
# The session is dedicated so it outlives the terminal that opened it: closing the window
# or dropping an SSH connection does not reach it, and it has a stable name to reattach to.
#
# It is NOT because backgrounding kills a run. It does not — see the troubleshooting table in
# README.md, which diagnosed the case: the supervisor keeps the workflow, its subagents and
# their shells running, and what looked like a dead run was a permission prompt nobody
# answered. That is now handled by the mode below, not by tmux.
#
# Your checkout staying free comes from the worktree, not from tmux. The two are independent.
#
# Relaunching is the same command. A worktree and branch left by a previous launch are
# reclaimed, up to the point where something would be lost.
#
# Exit codes:
#   0 — the session was opened
#   1 — refused: no plan named, plan unreadable, or leftovers holding work that
#       exists nowhere else (uncommitted changes, or commits on no other branch)
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

# Fetch here and nowhere else, because here is the only place staleness changes an outcome: the
# base is the commit the whole run is built on, and branching from a lagging one means every
# iteration works against a tree that moved. Later commands do not need it — pushing a new branch
# decides nothing on remote state, and `gh` reads the API rather than local refs.
git -C "$root" fetch --prune --quiet 2>/dev/null || true

# The default branch when there is one, the current commit otherwise — a fresh clone with no
# origin still gets a worktree rather than a refusal.
base=$(git -C "$root" rev-parse --abbrev-ref origin/HEAD 2>/dev/null) || base=$(git -C "$root" rev-parse --abbrev-ref HEAD)

branch_exists() { git -C "$root" show-ref --verify --quiet "refs/heads/$branch"; }

# Reclaim what a previous launch left. A run that refuses at preflight — an absent `Remote:`
# line, a policy the mode forbids — writes nothing and leaves both behind, so refusing on them
# would make every preflight refusal cost a manual `worktree remove` + `branch -D` before the
# developer can retype the same command.
#
# Reclaiming stops at what cannot be recovered: uncommitted work in the tree, and commits no
# remote carries. Everything else is reproducible from the plan.
if [ -e "$tree" ] || branch_exists; then
  if [ -e "$tree" ]; then
    dirty=$(git -C "$tree" status --porcelain 2>&1) ||
      die "$tree exists but is not a readable worktree. Remove it by hand, then relaunch."

    [ -z "$dirty" ] || die "the worktree at $tree holds uncommitted work:

$dirty

Review it, then remove it yourself: git -C $root worktree remove $tree"
  fi

  # The question is whether a commit exists anywhere else, not whether it was pushed: a branch
  # sitting exactly on `main` loses nothing, and a halted run has already pushed its own. So the
  # set to fear is what is reachable from this branch and from no other ref.
  #
  # Exclusions are fed as `^ref` on stdin rather than with `--exclude --branches`, which silently
  # excludes nothing on git 2.54 — a check that always finds zero commits would reclaim the branch
  # it exists to protect. With no other ref at all, every commit is listed, which is the honest
  # answer: nothing else holds them.
  if branch_exists; then
    unpushed=$(git -C "$root" for-each-ref --format='^%(refname)' refs/heads refs/remotes |
      grep -vFx "^refs/heads/$branch" |
      git -C "$root" rev-list --stdin --oneline "$branch" 2>/dev/null)

    [ -z "$unpushed" ] || die "$branch carries commits that exist on no other branch:

$unpushed

Deleting it would lose them. Push the branch, or delete it yourself:
  git -C $root branch -D $branch"
  fi

  if [ -e "$tree" ]; then
    git -C "$root" worktree remove "$tree" >/dev/null 2>&1 ||
      die "could not remove the stale worktree at $tree"
  fi

  git -C "$root" worktree prune

  if branch_exists; then
    git -C "$root" branch -D "$branch" >/dev/null 2>&1 ||
      die "could not delete the stale branch $branch"
  fi

  printf 'reclaimed a worktree and branch left by a previous launch\n'
fi

git -C "$root" worktree add "$tree" -b "$branch" "$base" >/dev/null 2>&1 ||
  die "could not create the worktree at $tree on $branch"

printf 'worktree %s\nbranch   %s\nplan     %s\n' "$tree" "$branch" "$plan_abs"

# The plan is passed absolute: `.claude/` is gitignored, so it does not exist inside the
# worktree that was just created, and a relative path would resolve against a tree holding
# no plans at all.
# `--permission-mode auto` because nobody is watching. A prompt nobody answers is not a stalled
# run, it is a run that looks alive and advances no iteration — the session sits in `Needs input`
# until someone attaches. Leaving the mode to a `Shift+Tab` before every launch means losing a
# night to the one launch that forgot it.
exec tmux new-session -s "$work_id" -c "$tree" "claude --permission-mode auto '/goal:auto $plan_abs'"
