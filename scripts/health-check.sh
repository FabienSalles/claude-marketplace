#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Marketplace health check
#
# Quick local diagnostic for the Claude Code marketplace. Runs the
# native `claude plugin` commands and reports per-plugin status.
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more plugins failed validation, or a sub-command failed
#
# Usage:
#   ./scripts/health-check.sh           # default: full run, human output
#   ./scripts/health-check.sh --quick   # skip the upstream marketplace sync
# ─────────────────────────────────────────────

set -uo pipefail

# Colors (only if stdout is a TTY)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' BOLD='' NC=''
fi

# Move to repo root regardless of where the script was invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

QUICK=0
if [[ "${1:-}" == "--quick" ]]; then
  QUICK=1
fi

# Require the claude CLI
if ! command -v claude >/dev/null 2>&1; then
  echo -e "${RED}✗ claude CLI not found in PATH${NC}" >&2
  echo "  Install: npm install -g @anthropic-ai/claude-code" >&2
  exit 1
fi

errors=0

section() {
  echo ""
  echo -e "${BOLD}${CYAN}== $* ==${NC}"
}

# ─────────────────────────────────────────────
# 1. Sync upstream marketplaces
# ─────────────────────────────────────────────
if [[ $QUICK -eq 0 ]]; then
  section "1. Re-sync upstream marketplaces"
  if claude plugin marketplace update 2>&1 | sed 's/^/  /'; then
    echo -e "  ${GREEN}✓${NC} marketplaces re-synced"
  else
    echo -e "  ${RED}✗${NC} marketplace update reported errors"
    errors=$((errors + 1))
  fi
else
  echo -e "${YELLOW}(skipping upstream sync — --quick)${NC}"
fi

# ─────────────────────────────────────────────
# 2. Validate the root marketplace manifest
# ─────────────────────────────────────────────
section "2. Validate marketplace manifest"
if claude plugin validate . 2>&1 | sed 's/^/  /'; then
  : # output already includes the ✔
else
  errors=$((errors + 1))
fi

# ─────────────────────────────────────────────
# 3. Validate each local plugin
# ─────────────────────────────────────────────
section "3. Validate each plugin"
plugin_errors=0
for plugin_dir in plugins/*/; do
  name=$(basename "$plugin_dir")
  if claude plugin validate "$plugin_dir" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $name"
  else
    echo -e "  ${RED}✗${NC} $name"
    claude plugin validate "$plugin_dir" 2>&1 | sed 's/^/      /'
    plugin_errors=$((plugin_errors + 1))
  fi
done
errors=$((errors + plugin_errors))

# ─────────────────────────────────────────────
# 4. Validate ${CLAUDE_PLUGIN_ROOT} references resolve to existing files
#
# Scans runtime files (hooks.json + slash-command .md) for any
# ${CLAUDE_PLUGIN_ROOT}/<path> reference and confirms the target
# file exists. Skips SKILL.md and README.md (they contain
# documentation examples that are not runtime refs).
# ─────────────────────────────────────────────
section "4. Validate \${CLAUDE_PLUGIN_ROOT} references"
ref_errors=0
ref_total=0

# Build the file list: hooks.json files + plugins/*/commands/*.md
ref_files=()
while IFS= read -r f; do
  ref_files+=("$f")
done < <(find plugins -type f \( -name "hooks.json" -o -path "plugins/*/commands/*.md" \) 2>/dev/null)

for src in "${ref_files[@]}"; do
  # Determine the plugin root for this file: plugins/<plugin_name>
  plugin_root=$(echo "$src" | sed -nE 's|^(plugins/[^/]+)/.*|\1|p')
  [[ -z "$plugin_root" ]] && continue

  # Extract each ${CLAUDE_PLUGIN_ROOT}/<path> reference
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    rel_path="${ref#\$\{CLAUDE_PLUGIN_ROOT\}/}"
    # Strip arguments after first space (e.g. "notify-sound.sh notification")
    rel_path="${rel_path%% *}"
    # Strip trailing quotes / punctuation
    rel_path="${rel_path%[\"\`\'\,]}"
    full_path="$plugin_root/$rel_path"
    ref_total=$((ref_total + 1))
    if [[ -e "$full_path" ]]; then
      echo -e "  ${GREEN}✓${NC} $src → $rel_path"
    else
      echo -e "  ${RED}✗${NC} $src → $rel_path (resolves to $full_path, NOT FOUND)"
      ref_errors=$((ref_errors + 1))
    fi
  done < <(grep -oE '\$\{CLAUDE_PLUGIN_ROOT\}/[^"`'"'"' ]+' "$src" 2>/dev/null)
done

if [[ $ref_total -eq 0 ]]; then
  echo -e "  ${YELLOW}(no \${CLAUDE_PLUGIN_ROOT} references found)${NC}"
else
  echo -e "  ${BOLD}$ref_total references checked, $ref_errors broken${NC}"
fi
errors=$((errors + ref_errors))

# ─────────────────────────────────────────────
# 5. Installed plugins overview
# ─────────────────────────────────────────────
section "5. Installed plugins overview"
claude plugin list 2>&1 | sed 's/^/  /'

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo ""
if [[ $errors -gt 0 ]]; then
  echo -e "${RED}${BOLD}✗ Health check failed: $errors issue(s)${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}✓ Health check passed${NC}"
fi
