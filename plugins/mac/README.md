# mac

macOS / BSD platform discipline for Claude Code.

## What's included

- **`mac-platform` skill**: activated automatically when working on shell scripts, setup scripts, or troubleshooting macOS-specific issues. Covers:
  - `/bin/bash` 3.2 (Apple-forced) vs Homebrew `bash` 5.3+
  - BSD vs GNU command portability (`grep -P`, `realpath`, `sed -i`, `readlink`, `date -d`, etc.)
  - Common macOS pitfalls (`mktemp`, `awk`, `$TMPDIR`, APFS case-insensitivity)

- **`bsd-gnu-lint` hook** (PreToolUse, matcher `Bash`): warns (never blocks) before Claude executes a Bash command that uses GNU-only flags or bash 4+ syntax which would silently fail on macOS. Patterns detected:
  - `grep -P` (PCRE)
  - `sed -i 's/…/…/' file` without the BSD empty-string suffix
  - `readlink -f`
  - `xargs -r` / `--no-run-if-empty`
  - `date -d "…"`
  - `realpath -m` / `--relative-to` / `--canonicalize-missing` / `-s`
  - `mapfile` / `readarray` (bash 4+)
  - `${var,,}` / `${var^^}` (bash 4+ case modification)

  Each detection emits a `hookSpecificOutput.additionalContext` warning with a portable suggestion, leaving the command free to run.

## When it activates

The skill loads automatically when keywords like `setup.sh`, `grep -P`, `realpath`, `mapfile`, or shebangs (`#!/bin/bash`, `#!/usr/bin/env bash`) appear in the conversation or files being edited. The lint hook runs on every Bash tool invocation; it stays silent on portable commands.

## Companion

For universal (cross-language, cross-platform) discipline rules (verification before claiming, anti-over-engineering, git/worktree discipline), install the universal `~/.claude/CLAUDE.md` via the `common` plugin's `/common:install-global-claude-md` command.
