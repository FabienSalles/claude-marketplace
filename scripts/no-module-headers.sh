#!/usr/bin/env bash
# Refuses any `.ts` module under <root>/src or <root>/scripts that opens on a comment — a
# purpose statement or a refactor history a reader has to take on faith — unless the file is
# named in <root>/tests/headers-allowlist.txt, the versioned record of which openers were judged
# to state a constraint the code itself cannot carry.
#
# Usage:
#   ./scripts/no-module-headers.sh <root>   # e.g. plugins/goal

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ROOT_ARG="${1:?usage: no-module-headers.sh <root>}"
TARGET_DIR="$REPO_ROOT/$ROOT_ARG"
ALLOWLIST="$TARGET_DIR/tests/headers-allowlist.txt"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "✗ no such directory: $ROOT_ARG"
  exit 1
fi

if [[ ! -f "$ALLOWLIST" ]]; then
  echo "✗ no allowlist: $ROOT_ARG/tests/headers-allowlist.txt"
  exit 1
fi

# opens_on_comment PATH — line 1, or line 2 when line 1 is a shebang, starts with `//`
opens_on_comment() {
  local first second
  first="$(sed -n '1p' "$1")"
  if [[ "$first" == '#!'* ]]; then
    second="$(sed -n '2p' "$1")"
    [[ "$second" == '//'* ]]
  else
    [[ "$first" == '//'* ]]
  fi
}

errors=0
checked=0

while IFS= read -r ts_file; do
  checked=$((checked + 1))
  rel="${ts_file#"$REPO_ROOT"/}"

  if opens_on_comment "$ts_file" && ! grep -qxF "$rel" "$ALLOWLIST"; then
    echo "✗ $rel opens on a comment and is not in $ROOT_ARG/tests/headers-allowlist.txt"
    errors=$((errors + 1))
  fi
done < <(find "$TARGET_DIR/src" "$TARGET_DIR/scripts" -name '*.ts' | sort)

while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  path="$REPO_ROOT/$rel"

  if [[ ! -f "$path" ]]; then
    echo "✗ $ALLOWLIST names a file that does not exist: $rel"
    errors=$((errors + 1))
  elif ! opens_on_comment "$path"; then
    echo "✗ $ALLOWLIST names $rel, which no longer opens on a comment — drop the entry"
    errors=$((errors + 1))
  fi
done < "$ALLOWLIST"

if [[ $errors -gt 0 ]]; then
  echo "✗ $errors module header violation(s)"
  exit 1
fi

echo "✓ $checked module(s) checked, none open on an undeclared header"
