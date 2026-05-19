#!/usr/bin/env bash
# Plays a macOS system sound depending on the Claude Code event.
# Wired in hooks.json for the Notification (Claude waits for input) and Stop (turn finished) events.
#
# Usage: notify-sound.sh <notification|stop>

set -u

event_type="${1:-stop}"

case "$event_type" in
  notification)
    sound="/System/Library/Sounds/Glass.aiff"
    ;;
  stop)
    sound="/System/Library/Sounds/Funk.aiff"
    ;;
  *)
    sound="/System/Library/Sounds/Pop.aiff"
    ;;
esac

# Drain stdin (Claude Code passes a JSON payload — we don't need it here)
cat > /dev/null

# Play in background so the hook returns immediately and never blocks Claude
if [[ -f "$sound" ]] && command -v afplay > /dev/null 2>&1; then
  (afplay "$sound" >/dev/null 2>&1 &)
fi

exit 0
