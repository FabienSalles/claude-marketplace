# mac

macOS / BSD platform discipline for Claude Code.

## What's included

- **`mac-platform` skill** — Activated automatically when working on shell scripts, setup scripts, or troubleshooting macOS-specific issues. Covers:
  - `/bin/bash` 3.2 (Apple-forced) vs Homebrew `bash` 5.3+
  - BSD vs GNU command portability (`grep -P`, `realpath`, `sed -i`, `readlink`, `date -d`, etc.)
  - Common macOS pitfalls (`mktemp`, `awk`, `$TMPDIR`, APFS case-insensitivity)

## When it activates

The skill loads automatically when keywords like `setup.sh`, `grep -P`, `realpath`, `mapfile`, or shebangs (`#!/bin/bash`, `#!/usr/bin/env bash`) appear in the conversation or files being edited.

## Companion

For universal (cross-language, cross-platform) discipline rules — verification before claiming, anti-over-engineering, git/worktree discipline — install the universal `~/.claude/CLAUDE.md` via the `common` plugin's `/common:install-global-claude-md` command.
