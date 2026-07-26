#!/usr/bin/env bash
# ─────────────────────────────────────────────
# SKILL.md structure validation
#
# Local, reusable equivalent of the two SKILL.md-focused CI steps in
# .github/workflows/validate.yml: frontmatter shape and README skill counts.
# Manifest-level checks (marketplace.json, plugin.json, marketplace references)
# stay in the workflow — they are already covered locally by health-check.sh.
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more violations found
#
# Usage:
#   ./scripts/validate-skills.sh
# ─────────────────────────────────────────────

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

errors=0

# ─────────────────────────────────────────────
# 1. SKILL.md frontmatter
# ─────────────────────────────────────────────
total=0
for skill_md in $(find plugins -name "SKILL.md" | sort); do
  total=$((total + 1))
  skill_dir=$(dirname "$skill_md")
  skill_name=$(basename "$skill_dir")

  # Check frontmatter exists (starts with ---)
  if ! head -1 "$skill_md" | grep -q '^---$'; then
    echo "✗ Missing frontmatter: $skill_md"
    errors=$((errors + 1))
    continue
  fi

  # Extract frontmatter (only first --- block, using awk to avoid matching code blocks)
  frontmatter=$(awk '/^---$/{if(++n==2) exit; next} n==1' "$skill_md")

  # Check name field
  fm_name=$(echo "$frontmatter" | grep '^name:' | sed 's/^name: *//')
  if [[ -z "$fm_name" ]]; then
    echo "✗ Missing name in frontmatter: $skill_md"
    errors=$((errors + 1))
    continue
  fi

  # Validate name format: lowercase alphanumeric + hyphens, max 64 chars
  if ! echo "$fm_name" | grep -qE '^[a-z0-9.-]+$'; then
    echo "✗ Invalid name format '$fm_name': $skill_md (must match ^[a-z0-9.-]+$)"
    errors=$((errors + 1))
  fi
  if [[ ${#fm_name} -gt 64 ]]; then
    echo "✗ Name too long (${#fm_name} > 64): $skill_md"
    errors=$((errors + 1))
  fi

  # Check description field
  fm_desc=$(echo "$frontmatter" | grep '^description:' | sed 's/^description: *//')
  if [[ -z "$fm_desc" ]]; then
    echo "✗ Missing description in frontmatter: $skill_md"
    errors=$((errors + 1))
    continue
  fi

  # Validate name matches directory name (Agent Skills spec requirement)
  if [[ "$fm_name" != "$skill_name" ]]; then
    echo "✗ Name mismatch: frontmatter '$fm_name' != directory '$skill_name': $skill_md"
    errors=$((errors + 1))
  fi

  echo "✓ $skill_name — frontmatter valid"
done

echo ""
echo "Validated $total skills, $errors errors so far"

# ─────────────────────────────────────────────
# 2. README skill counts match actual files
# ─────────────────────────────────────────────
while IFS='|' read -r _ pack count _; do
  pack=$(echo "$pack" | sed 's/[* ]//g')
  count=$(echo "$count" | tr -d ' ')
  # Skip non-numeric (common pack uses —)
  if ! echo "$count" | grep -qE '^[0-9]+$'; then
    continue
  fi
  actual=$(find "plugins/$pack" -name "SKILL.md" 2>/dev/null | wc -l)
  if [[ "$actual" -ne "$count" ]]; then
    echo "✗ README says $pack has $count skills, but found $actual"
    errors=$((errors + 1))
  else
    echo "✓ $pack: $count skills (matches)"
  fi
done < <(grep -E '^\| \*\*' README.md)

echo ""
if [[ $errors -gt 0 ]]; then
  echo "✗ Validation failed: $errors error(s)"
  exit 1
fi
echo "✓ All skill checks passed"
