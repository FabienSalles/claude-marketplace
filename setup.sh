#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Claude Marketplace — Setup Script
# Registers this directory as a local Claude Code marketplace and toggles
# packs (plugins) on/off via ~/.claude/settings.json.
#
# No symlinks: Claude Code resolves ${CLAUDE_PLUGIN_ROOT} from the registered
# directory, so edits in plugins/*/ are picked up live.
# ─────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
SETTINGS="$CLAUDE_HOME/settings.json"
MARKETPLACE_KEY="fabien-claude-marketplace"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ─────────────────────────────────────────────
# Available packs
# ─────────────────────────────────────────────
PACKS=(php typescript astro nest frontend vitest tooling common statusline mac craft audit goal)

declare -A PACK_DESCRIPTIONS=(
  [php]="PHP 8.2/8.3, conventions, DDD, TDD, Symfony, Twig, Composer, OOP, refactoring, SQL, security"
  [typescript]="TypeScript conventions, typing, DDD events, functional programming, OOP, refactoring, security"
  [astro]="Astro 5.x — components, routing, collections, i18n, SEO, Tailwind, React islands, transitions"
  [nest]="NestJS architectural conventions, DDD with NestJS"
  [frontend]="Frontend clean architecture (hexagonal), Container/Presentation patterns"
  [vitest]="Vitest TDD workflow, test conventions and patterns"
  [tooling]="Docker, Drizzle ORM, pnpm workspaces, Zod schemas"
  [common]="Shared hooks, agents, commands, skills"
  [statusline]="Claude Code statusline — cwd, git branch, model, context progress bar, 5h rate limit"
  [goal]="Autonomous issue→PR workflow on Claude Code /goal — /draft-issue (spec → GitHub issue), /run-issue (issue → spec → branch → /goal), auto-regenerated execution log shipped in the PR diff"
)

STATUSLINE_CMD="$SCRIPT_DIR/plugins/statusline/statusline.sh"

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

print_header() {
  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║     Claude Marketplace — Setup          ║${NC}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}"
  echo ""
}

print_pack() {
  local pack="$1"
  local desc="${PACK_DESCRIPTIONS[$pack]}"
  local detail
  if [[ "$pack" == "common" ]]; then
    local common_skills
    common_skills="$(find "$SCRIPT_DIR/plugins/common/skills" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
    detail="hooks+agents+commands+${common_skills} skills"
  elif [[ "$pack" == "statusline" ]]; then
    detail="statusline script"
  else
    detail="$(find "$SCRIPT_DIR/plugins/$pack/skills" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ') skills"
  fi
  echo -e "  ${BOLD}$pack${NC} ($detail)"
  echo -e "    ${desc}"
}

ensure_settings() {
  if [[ ! -f "$SETTINGS" ]]; then
    mkdir -p "$CLAUDE_HOME"
    echo '{}' > "$SETTINGS"
  fi
}

backup_settings() {
  cp "$SETTINGS" "${SETTINGS}.bak.$(date +%s)"
}

jq_inplace() {
  local tmp="${SETTINGS}.tmp"
  jq "$@" "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
}

# Register the marketplace once. Idempotent.
ensure_marketplace_registered() {
  ensure_settings
  local current_path
  current_path=$(jq -r --arg k "$MARKETPLACE_KEY" '.extraKnownMarketplaces[$k].source.path // empty' "$SETTINGS")
  if [[ "$current_path" == "$SCRIPT_DIR" ]]; then
    return 0
  fi
  backup_settings
  jq_inplace --arg k "$MARKETPLACE_KEY" --arg p "$SCRIPT_DIR" \
    '.extraKnownMarketplaces[$k] = {"source": {"source": "directory", "path": $p}}'
  echo -e "    ${BLUE}ℹ${NC} Marketplace registered: ${BOLD}$MARKETPLACE_KEY${NC} → $SCRIPT_DIR"
}

# Register skillListingBudgetFraction once. Idempotent.
ensure_skill_budget() {
  if jq -e '.skillListingBudgetFraction' "$SETTINGS" > /dev/null 2>&1; then
    return 0
  fi
  backup_settings
  jq_inplace '. + {"skillListingBudgetFraction": 0.06}'
  echo -e "    ${BLUE}ℹ${NC} skillListingBudgetFraction (0.06) registered"
}

is_pack_installed() {
  local pack="$1"
  ensure_settings
  if [[ "$pack" == "statusline" ]]; then
    local cmd
    cmd=$(jq -r '.statusLine.command // empty' "$SETTINGS")
    [[ "$cmd" == "$STATUSLINE_CMD" ]]
    return $?
  fi
  local key="${pack}@${MARKETPLACE_KEY}"
  local val
  val=$(jq -r --arg k "$key" '.enabledPlugins[$k] // empty' "$SETTINGS")
  [[ "$val" == "true" ]]
}

install_pack() {
  local pack="$1"
  ensure_settings

  if [[ "$pack" == "statusline" ]]; then
    if [[ ! -f "$STATUSLINE_CMD" ]]; then
      echo -e "  ${RED}✗${NC} ${BOLD}statusline${NC}: $STATUSLINE_CMD missing"
      return
    fi
    local current
    current=$(jq -r '.statusLine.command // empty' "$SETTINGS")
    if [[ "$current" != "$STATUSLINE_CMD" ]]; then
      backup_settings
      jq_inplace --arg c "$STATUSLINE_CMD" \
        '.statusLine = {"type": "command", "command": $c}'
    fi
    echo -e "  ${GREEN}✓${NC} ${BOLD}statusline${NC}: settings.statusLine → $STATUSLINE_CMD"
    return
  fi

  ensure_marketplace_registered
  if [[ "$pack" == "common" ]]; then
    ensure_skill_budget
  fi

  local key="${pack}@${MARKETPLACE_KEY}"
  local current
  current=$(jq -r --arg k "$key" '.enabledPlugins[$k] // empty' "$SETTINGS")
  if [[ "$current" != "true" ]]; then
    backup_settings
    jq_inplace --arg k "$key" '.enabledPlugins[$k] = true'
  fi
  echo -e "  ${GREEN}✓${NC} ${BOLD}$pack${NC}: enabled (${key})"
}

remove_pack() {
  local pack="$1"
  ensure_settings

  if [[ "$pack" == "statusline" ]]; then
    if jq -e '.statusLine' "$SETTINGS" > /dev/null 2>&1; then
      backup_settings
      jq_inplace 'del(.statusLine)'
      echo -e "  ${RED}✗${NC} ${BOLD}statusline${NC}: settings.statusLine removed"
    else
      echo -e "  ${YELLOW}⚠${NC} ${BOLD}statusline${NC}: was not installed"
    fi
    return
  fi

  local key="${pack}@${MARKETPLACE_KEY}"
  if jq -e --arg k "$key" '.enabledPlugins[$k]' "$SETTINGS" > /dev/null 2>&1; then
    backup_settings
    jq_inplace --arg k "$key" 'del(.enabledPlugins[$k])'
    echo -e "  ${RED}✗${NC} ${BOLD}$pack${NC}: disabled (${key})"
  else
    echo -e "  ${YELLOW}⚠${NC} ${BOLD}$pack${NC}: was not installed"
  fi
}

# ─────────────────────────────────────────────
# Show status
# ─────────────────────────────────────────────

show_status() {
  print_header
  ensure_settings

  echo -e "${BOLD}Marketplace:${NC}"
  local path
  path=$(jq -r --arg k "$MARKETPLACE_KEY" '.extraKnownMarketplaces[$k].source.path // "(not registered)"' "$SETTINGS")
  echo -e "  ${BOLD}$MARKETPLACE_KEY${NC} → $path"
  echo ""

  echo -e "${BOLD}Pack status:${NC}"
  echo ""
  for pack in "${PACKS[@]}"; do
    if is_pack_installed "$pack"; then
      echo -e "  ${GREEN}●${NC} ${BOLD}$pack${NC} — installed"
    else
      echo -e "  ${RED}○${NC} $pack — not installed"
    fi
  done
  echo ""
}

# ─────────────────────────────────────────────
# Interactive mode
# ─────────────────────────────────────────────

interactive_mode() {
  print_header
  echo -e "${BOLD}Available packs:${NC}"
  echo ""
  for i in "${!PACKS[@]}"; do
    local pack="${PACKS[$i]}"
    local status=""
    if is_pack_installed "$pack"; then
      status="${GREEN}[installed]${NC}"
    fi
    echo -e "  ${BOLD}$((i + 1))${NC}. ${pack} $status"
    echo -e "     ${PACK_DESCRIPTIONS[$pack]}"
    echo ""
  done

  echo -e "${BOLD}Enter pack numbers to install (space-separated), 'a' for all, or 'q' to quit:${NC}"
  read -r choice

  if [[ "$choice" == "q" ]]; then
    echo "Bye!"
    exit 0
  fi

  if [[ "$choice" == "a" ]]; then
    echo ""
    echo -e "${BOLD}Installing all packs...${NC}"
    for pack in "${PACKS[@]}"; do
      install_pack "$pack"
    done
  else
    echo ""
    echo -e "${BOLD}Installing selected packs...${NC}"
    for num in $choice; do
      local idx=$((num - 1))
      if [[ $idx -ge 0 && $idx -lt ${#PACKS[@]} ]]; then
        install_pack "${PACKS[$idx]}"
      else
        echo -e "  ${YELLOW}⚠${NC} Invalid choice: $num"
      fi
    done
  fi

  echo ""
  echo -e "${GREEN}Done!${NC} Restart Claude Code to pick up new plugins. Run ${BOLD}./setup.sh --status${NC} to verify."
}

# ─────────────────────────────────────────────
# Usage
# ─────────────────────────────────────────────

usage() {
  echo "Usage: ./setup.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  (no args)          Interactive mode — choose packs to install"
  echo "  --all              Install all packs"
  echo "  --pack <names>     Install specific packs (space-separated)"
  echo "  --remove <names>   Remove specific packs (space-separated)"
  echo "  --status           Show marketplace registration and pack status"
  echo "  --list             List available packs"
  echo "  --help             Show this help"
  echo ""
  echo "Mechanism:"
  echo "  Packs are registered as plugins in a local Claude Code marketplace"
  echo "  pointing at this directory ($SCRIPT_DIR). No symlinks. Edits in"
  echo "  plugins/*/ are picked up live on next Claude Code session."
  echo ""
  echo "Environment:"
  echo "  CLAUDE_HOME        Override ~/.claude (default: \$HOME/.claude)"
  echo ""
  echo "Examples:"
  echo "  ./setup.sh                    # Interactive"
  echo "  ./setup.sh --all              # Install everything"
  echo "  ./setup.sh --pack php ts      # Install PHP + TypeScript"
  echo "  ./setup.sh --remove php       # Remove PHP pack"
  echo "  ./setup.sh --status           # Check what's installed"
}

resolve_pack() {
  local input="$1"
  case "$input" in
    ts) echo "typescript" ;;
    *) echo "$input" ;;
  esac
}

validate_pack() {
  local pack="$1"
  for p in "${PACKS[@]}"; do
    if [[ "$p" == "$pack" ]]; then
      return 0
    fi
  done
  return 1
}

main() {
  if [[ $# -eq 0 ]]; then
    interactive_mode
    exit 0
  fi

  case "$1" in
    --all)
      print_header
      echo -e "${BOLD}Installing all packs...${NC}"
      echo ""
      for pack in "${PACKS[@]}"; do
        install_pack "$pack"
      done
      echo ""
      echo -e "${GREEN}Done!${NC} Restart Claude Code to pick up new plugins."
      ;;

    --pack)
      shift
      if [[ $# -eq 0 ]]; then
        echo -e "${RED}Error:${NC} --pack requires at least one pack name"
        exit 1
      fi
      print_header
      echo -e "${BOLD}Installing selected packs...${NC}"
      echo ""
      for name in "$@"; do
        local pack
        pack=$(resolve_pack "$name")
        if validate_pack "$pack"; then
          install_pack "$pack"
        else
          echo -e "  ${RED}✗${NC} Unknown pack: $name"
        fi
      done
      echo ""
      echo -e "${GREEN}Done!${NC} Restart Claude Code to pick up new plugins."
      ;;

    --remove)
      shift
      if [[ $# -eq 0 ]]; then
        echo -e "${RED}Error:${NC} --remove requires at least one pack name"
        exit 1
      fi
      print_header
      echo -e "${BOLD}Removing packs...${NC}"
      echo ""
      for name in "$@"; do
        local pack
        pack=$(resolve_pack "$name")
        if validate_pack "$pack"; then
          remove_pack "$pack"
        else
          echo -e "  ${RED}✗${NC} Unknown pack: $name"
        fi
      done
      echo ""
      echo -e "${GREEN}Done!${NC} Restart Claude Code to apply."
      ;;

    --status)
      show_status
      ;;

    --list)
      print_header
      echo -e "${BOLD}Available packs:${NC}"
      echo ""
      for pack in "${PACKS[@]}"; do
        print_pack "$pack"
        echo ""
      done
      ;;

    --help|-h)
      usage
      ;;

    *)
      echo -e "${RED}Unknown option:${NC} $1"
      usage
      exit 1
      ;;
  esac
}

main "$@"
