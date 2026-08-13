#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Anchor validation for markdown docs
#
# An anchor is a backtick-quoted code reference such as `run/close.ts` or
# `gate/plan.ts#iterationHeading`. This checks, for every anchor found under
# <root>/docs:
#   - it carries no line number (`file.ts:NN` or `file.ts:NN-NN`)
#   - the file it names exists
#   - the symbol after a `#`, when present, appears in that file (grep -F,
#     so a symbol still present only in a comment passes)
#
# A bare `.md`/`.json` name with no `/` that resolves nowhere is treated as
# a title reference (a plan or spec name, not a path into this tree) and
# skipped rather than flagged. `.claude/` paths are gitignored by design and
# skipped the same way.
#
# Usage:
#   ./scripts/validate-anchors.sh <root>   # e.g. plugins/goal
# ─────────────────────────────────────────────

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ROOT_ARG="${1:?usage: validate-anchors.sh <root>}"
TARGET_DIR="$REPO_ROOT/$ROOT_ARG"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "✗ no such directory: $ROOT_ARG"
  exit 1
fi

PATTERN='`[A-Za-z0-9_./-]+\.(ts|md|sh|json)(:[0-9]+(-[0-9]+)?)?(#[A-Za-zA-Z0-9_]+)?`'

total=0
verified=0
fileonly=0
errors=0

# resolve_file PATH — echoes a real path on the filesystem and returns 0,
# returns 1 (not found), 2 (skip, not an anchor), or 3 (ambiguous basename)
resolve_file() {
  local path="$1"

  if [[ "$path" == .claude/* ]]; then
    return 2
  fi

  local candidate
  for candidate in \
    "$TARGET_DIR/$path" \
    "$TARGET_DIR/src/$path" \
    "$TARGET_DIR/scripts/$path" \
    "$TARGET_DIR/docs/$path" \
    "$REPO_ROOT/$path"
  do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  local ext="${path##*.}"
  local base
  base="$(basename "$path")"

  if [[ "$path" != */* && ( "$ext" == "md" || "$ext" == "json" ) ]]; then
    return 2
  fi

  if [[ "$ext" == "ts" || "$ext" == "sh" ]]; then
    local found
    found="$(find "$TARGET_DIR" -name "$base" -not -path '*/node_modules/*')"
    local count
    count="$(printf '%s\n' "$found" | grep -c .)"
    if [[ "$count" -eq 1 ]]; then
      echo "$found"
      return 0
    elif [[ "$count" -gt 1 ]]; then
      return 3
    fi
  fi

  return 1
}

while IFS= read -r md_file; do
  while IFS=: read -r line_no match; do
    inner="${match#\`}"
    inner="${inner%\`}"

    total=$((total + 1))

    if [[ "$inner" =~ :[0-9] ]]; then
      echo "✗ $md_file:$line_no — anchor carries a line number: $match"
      errors=$((errors + 1))
      continue
    fi

    symbol=""
    file_part="$inner"
    if [[ "$inner" == *#* ]]; then
      file_part="${inner%%#*}"
      symbol="${inner#*#}"
    fi

    resolved="$(resolve_file "$file_part")"
    rc=$?
    case $rc in
      2)
        continue
        ;;
      1)
        echo "✗ $md_file:$line_no — file not found: $file_part"
        errors=$((errors + 1))
        continue
        ;;
      3)
        echo "✗ $md_file:$line_no — ambiguous file, use a full path: $file_part"
        errors=$((errors + 1))
        continue
        ;;
    esac

    if [[ -n "$symbol" ]]; then
      if grep -qF -- "$symbol" "$resolved"; then
        verified=$((verified + 1))
      else
        echo "✗ $md_file:$line_no — symbol not found in $file_part: $symbol"
        errors=$((errors + 1))
      fi
    else
      fileonly=$((fileonly + 1))
    fi
  done < <(grep -noE "$PATTERN" "$md_file")
done < <(find "$TARGET_DIR/docs" -name '*.md' | sort)

checked=$((verified + fileonly))
echo ""
echo "$checked anchors checked: $verified carry a verified symbol, $fileonly checked on file existence only"

if [[ $errors -gt 0 ]]; then
  echo "✗ $errors anchor error(s)"
  exit 1
fi

echo "✓ all anchors valid"
