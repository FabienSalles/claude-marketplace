#!/usr/bin/env bash
input=$(cat)

# Single jq pass extracts every field we need (one per line).
# Avoids @tsv + `IFS=$'\t' read`, which collapses consecutive tabs since tab
# is whitespace in IFS — that silently shifts every field after an empty one.
{
  IFS= read -r cwd
  IFS= read -r model
  IFS= read -r used_pct
  IFS= read -r git_worktree
  IFS= read -r five_pct
  IFS= read -r five_resets_at
} < <(jq -r '
  .workspace.current_dir // .cwd // "",
  .model.display_name // "",
  (.context_window.used_percentage // "" | tostring),
  .workspace.git_worktree // "",
  (.rate_limits.five_hour.used_percentage // "" | tostring),
  (.rate_limits.five_hour.resets_at // "" | tostring)
' <<< "$input")

# Shorten home directory to ~
short_cwd="${cwd/#$HOME/\~}"

# Get git branch from the cwd
branch=""
if [ -n "$cwd" ] && git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
  branch=$(git -C "$cwd" -c core.fsmonitor="" symbolic-ref --short HEAD 2>/dev/null \
           || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
fi

# Build the status line
parts=()

# Directory part
parts+=("$(printf '\033[34m%s\033[0m' "$short_cwd")")

# Git branch
if [ -n "$branch" ]; then
  parts+=("$(printf '\033[33m %s\033[0m' "$branch")")
elif [ -n "$git_worktree" ]; then
  parts+=("$(printf '\033[33m %s\033[0m' "$git_worktree")")
fi

# Model
if [ -n "$model" ]; then
  parts+=("$(printf '\033[36m%s\033[0m' "$model")")
fi

# Context usage (visual progress bar)
if [ -n "$used_pct" ]; then
  used_int=$(printf '%.0f' "$used_pct")
  if [ "$used_int" -ge 80 ]; then
    ctx_color='\033[31m'
  elif [ "$used_int" -ge 50 ]; then
    ctx_color='\033[33m'
  else
    ctx_color='\033[32m'
  fi
  bar_width=10
  filled=$(( used_int * bar_width / 100 ))
  [ "$filled" -gt "$bar_width" ] && filled=$bar_width
  empty=$(( bar_width - filled ))
  bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=0; i<empty; i++)); do bar+="░"; done
  parts+=("$(printf "${ctx_color}ctx:[%s] %d%%\033[0m" "$bar" "$used_int")")
fi

# Rate limits (with time-until-reset when resets_at is provided)
if [ -n "$five_pct" ]; then
  five_int=$(printf '%.0f' "$five_pct")
  five_time=""
  if [ -n "$five_resets_at" ]; then
    diff=$(( five_resets_at - $(date +%s) ))
    if [ "$diff" -gt 0 ]; then
      five_time=$(printf '%dh%02d' "$(( diff / 3600 ))" "$(( (diff % 3600) / 60 ))")
    fi
  fi
  if [ -n "$five_time" ]; then
    parts+=("$(printf '\033[35m5h:%d%% · %s\033[0m' "$five_int" "$five_time")")
  else
    parts+=("$(printf '\033[35m5h:%d%%\033[0m' "$five_int")")
  fi
fi

# Join parts with separator
printf '%s' "${parts[0]}"
for part in "${parts[@]:1}"; do
  printf ' \033[2m|\033[0m %s' "$part"
done
printf '\n'
