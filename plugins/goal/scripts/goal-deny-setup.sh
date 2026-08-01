#!/bin/bash
# ─────────────────────────────────────────────
# Deny the implementer the verbs the gate owns
#
# `goal-run.sh` hands each iteration to `goal-run-implementer`, a Claude Code session with
# nobody watching it. The brief tells it never to commit, push or stage — but a brief is a
# sentence, not a mechanism. This script installs the mechanism: a `permissions.deny` rule on
# `git commit`, `git push` and `git add`, in the tree's own `.claude/settings.local.json`.
# `goal-run.sh`'s preflight refuses to start an implementer until the rule is there.
#
# The merge is additive and idempotent, the same shape `security-runtime:setup` already uses
# for credential paths: existing rules are kept, the three verbs are unioned in, and a second
# run changes nothing.
#
# Usage:
#   goal-deny-setup.sh [tree]
#
# <tree> defaults to the current directory.
# ─────────────────────────────────────────────

set -euo pipefail

tree="${1:-.}"
settings_file="$tree/.claude/settings.local.json"

mkdir -p "$tree/.claude"

if [ ! -f "$settings_file" ] || ! jq empty "$settings_file" 2>/dev/null; then
  echo '{}' > "$settings_file"
fi

before=$(jq '(.permissions.deny // []) | length' "$settings_file")

jq '.permissions.deny = (((.permissions.deny // []) + ["Bash(git commit:*)", "Bash(git push:*)", "Bash(git add:*)"]) | unique)' \
  "$settings_file" > "$settings_file.tmp" && mv "$settings_file.tmp" "$settings_file"

after=$(jq '.permissions.deny | length' "$settings_file")

echo "permissions.deny: $before -> $after rule(s) in $settings_file"
