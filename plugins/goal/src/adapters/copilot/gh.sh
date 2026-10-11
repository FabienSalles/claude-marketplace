#!/bin/sh
here=$(cd "$(dirname "$0")" && pwd -P)
rest=
IFS=:
for dir in $PATH; do
  [ "$(cd "$dir" 2>/dev/null && pwd -P)" = "$here" ] || rest="$rest${rest:+:}$dir"
done
unset IFS
PATH=$rest

refuse() {
  echo "goal-run: gh $* refused: the reviewer may read a pull request, and post a comment review only under a Review: comment header" >&2
  exit 1
}

case "$1 $2" in
  "pr view" | "pr diff") exec gh "$@" ;;
  "pr review") [ "$GOAL_RUN_REVIEW" = comment ] || refuse "$@" ;;
  *) refuse "$@" ;;
esac

comment=
for arg in "$@"; do
  case "$arg" in
    --comment | -c) comment=1 ;;
    --request-changes* | --approve* | -r* | -a*) refuse "$@" ;;
  esac
done
[ -n "$comment" ] || refuse "$@"
exec gh "$@"
