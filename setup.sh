#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────
# Claude Marketplace — Setup Script
# Creates symlinks from marketplace packs to ~/.claude/
# ─────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ─────────────────────────────────────────────
# Available packs
# ─────────────────────────────────────────────
PACKS=(php typescript astro nest frontend vitest tooling common)

declare -A PACK_DESCRIPTIONS=(
  [php]="PHP 8.2/8.3, conventions, DDD, TDD, Symfony, Twig, Composer, OOP, refactoring, SQL, security"
  [typescript]="TypeScript conventions, typing, DDD events, functional programming, OOP, refactoring, security"
  [astro]="Astro 5.x — components, routing, collections, i18n, SEO, Tailwind, React islands, transitions"
  [nest]="NestJS architectural conventions, DDD with NestJS"
  [frontend]="Frontend clean architecture (hexagonal), Container/Presentation patterns"
  [vitest]="Vitest TDD workflow, test conventions and patterns"
  [tooling]="Docker, Drizzle ORM, pnpm workspaces, Zod schemas"
  [common]="Shared hooks, agents, and commands"
)

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
  local skill_count
  if [[ "$pack" == "common" ]]; then
    skill_count="hooks+agents+commands"
  else
    skill_count="$(find "$SCRIPT_DIR/plugins/$pack/skills" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l) skills"
  fi
  echo -e "  ${BOLD}$pack${NC} ($skill_count)"
  echo -e "    ${desc}"
}

is_pack_installed() {
  local pack="$1"
  local found=0

  if [[ "$pack" == "common" ]]; then
    # Check if any common symlink exists
    for f in "$SCRIPT_DIR/plugins/common/hooks/"*.sh "$SCRIPT_DIR/plugins/common/hooks/"*.py; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f")
      if [[ -L "$CLAUDE_HOME/hooks/$name" ]]; then
        found=1
        break
      fi
    done
    for f in "$SCRIPT_DIR/plugins/common/agents/"*.md; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f")
      if [[ -L "$CLAUDE_HOME/agents/$name" ]]; then
        found=1
        break
      fi
    done
    for f in "$SCRIPT_DIR/plugins/common/commands/"*.md; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f")
      if [[ -L "$CLAUDE_HOME/commands/$name" ]]; then
        found=1
        break
      fi
    done
  else
    # Check if any skill symlink from this pack exists
    for skill_dir in "$SCRIPT_DIR/plugins/$pack/skills/"*/; do
      [[ -d "$skill_dir" ]] || continue
      local skill_name
      skill_name=$(basename "$skill_dir")
      if [[ -L "$CLAUDE_HOME/skills/$skill_name" ]]; then
        found=1
        break
      fi
    done
  fi

  return $((1 - found))
}

# ─────────────────────────────────────────────
# Install a pack
# ─────────────────────────────────────────────

install_pack() {
  local pack="$1"
  local count=0

  if [[ "$pack" == "common" ]]; then
    # Install hooks
    mkdir -p "$CLAUDE_HOME/hooks"
    for f in "$SCRIPT_DIR/plugins/common/hooks/"*.sh "$SCRIPT_DIR/plugins/common/hooks/"*.py; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f")
      if [[ -L "$CLAUDE_HOME/hooks/$name" ]]; then
        continue
      fi
      ln -sf "$f" "$CLAUDE_HOME/hooks/$name"
      ((++count))
    done

    # Install hooks.json
    if [[ -f "$SCRIPT_DIR/plugins/common/hooks/hooks.json" ]]; then
      ln -sf "$SCRIPT_DIR/plugins/common/hooks/hooks.json" "$CLAUDE_HOME/hooks/hooks.json"
      ((++count))
    fi

    # Install agents
    mkdir -p "$CLAUDE_HOME/agents"
    for f in "$SCRIPT_DIR/plugins/common/agents/"*.md; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f")
      if [[ -L "$CLAUDE_HOME/agents/$name" ]]; then
        continue
      fi
      ln -sf "$f" "$CLAUDE_HOME/agents/$name"
      ((++count))
    done

    # Install commands
    mkdir -p "$CLAUDE_HOME/commands"
    for f in "$SCRIPT_DIR/plugins/common/commands/"*.md; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f")
      if [[ -L "$CLAUDE_HOME/commands/$name" ]]; then
        continue
      fi
      ln -sf "$f" "$CLAUDE_HOME/commands/$name"
      ((++count))
    done

    echo -e "  ${GREEN}✓${NC} ${BOLD}common${NC}: $count items linked"
  else
    mkdir -p "$CLAUDE_HOME/skills"
    for skill_dir in "$SCRIPT_DIR/plugins/$pack/skills/"*/; do
      [[ -d "$skill_dir" ]] || continue
      local skill_name
      skill_name=$(basename "$skill_dir")
      if [[ -L "$CLAUDE_HOME/skills/$skill_name" ]]; then
        continue
      fi
      # Remove existing non-symlink directory if present
      if [[ -d "$CLAUDE_HOME/skills/$skill_name" && ! -L "$CLAUDE_HOME/skills/$skill_name" ]]; then
        echo -e "    ${YELLOW}⚠${NC} $skill_name exists as directory, skipping (use --remove first)"
        continue
      fi
      ln -sf "$skill_dir" "$CLAUDE_HOME/skills/$skill_name"
      ((++count))
    done
    echo -e "  ${GREEN}✓${NC} ${BOLD}$pack${NC}: $count skills linked"
  fi
}

# ─────────────────────────────────────────────
# Remove a pack
# ─────────────────────────────────────────────

remove_pack() {
  local pack="$1"
  local count=0

  if [[ "$pack" == "common" ]]; then
    for f in "$SCRIPT_DIR/plugins/common/hooks/"*.sh "$SCRIPT_DIR/plugins/common/hooks/"*.py; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f")
      if [[ -L "$CLAUDE_HOME/hooks/$name" ]]; then
        rm "$CLAUDE_HOME/hooks/$name"
        ((++count))
      fi
    done
    if [[ -L "$CLAUDE_HOME/hooks/hooks.json" ]]; then
      rm "$CLAUDE_HOME/hooks/hooks.json"
      ((++count))
    fi
    for f in "$SCRIPT_DIR/plugins/common/agents/"*.md; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f")
      if [[ -L "$CLAUDE_HOME/agents/$name" ]]; then
        rm "$CLAUDE_HOME/agents/$name"
        ((++count))
      fi
    done
    for f in "$SCRIPT_DIR/plugins/common/commands/"*.md; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f")
      if [[ -L "$CLAUDE_HOME/commands/$name" ]]; then
        rm "$CLAUDE_HOME/commands/$name"
        ((++count))
      fi
    done
    echo -e "  ${RED}✗${NC} ${BOLD}common${NC}: $count items removed"
  else
    for skill_dir in "$SCRIPT_DIR/plugins/$pack/skills/"*/; do
      [[ -d "$skill_dir" ]] || continue
      local skill_name
      skill_name=$(basename "$skill_dir")
      if [[ -L "$CLAUDE_HOME/skills/$skill_name" ]]; then
        rm "$CLAUDE_HOME/skills/$skill_name"
        ((++count))
      fi
    done
    echo -e "  ${RED}✗${NC} ${BOLD}$pack${NC}: $count skills removed"
  fi
}

# ─────────────────────────────────────────────
# Show status
# ─────────────────────────────────────────────

show_status() {
  print_header
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

  # Show symlink details
  echo -e "${BOLD}Symlinks in $CLAUDE_HOME/skills/:${NC}"
  local symlink_count=0
  if [[ -d "$CLAUDE_HOME/skills" ]]; then
    while IFS= read -r link; do
      [[ -L "$link" ]] || continue
      local target
      target=$(readlink "$link")
      local pack_name
      pack_name=$(echo "$target" | grep -oP 'plugins/\K[^/]+' || echo "unknown")
      echo -e "  $(basename "$link") ${BLUE}→${NC} ...plugins/${pack_name}/..."
      ((++symlink_count))
    done < <(find "$CLAUDE_HOME/skills" -maxdepth 1 -type l | sort)
  fi
  echo -e "  ${BOLD}Total: $symlink_count symlinks${NC}"
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
  echo -e "${GREEN}Done!${NC} Run ${BOLD}./setup.sh --status${NC} to verify."
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
  echo "  --status           Show installed packs and symlinks"
  echo "  --list             List available packs"
  echo "  --help             Show this help"
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

# ─────────────────────────────────────────────
# Resolve pack name (supports short aliases)
# ─────────────────────────────────────────────

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

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

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
      echo -e "${GREEN}Done!${NC}"
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
      echo -e "${GREEN}Done!${NC}"
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
      echo -e "${GREEN}Done!${NC}"
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
