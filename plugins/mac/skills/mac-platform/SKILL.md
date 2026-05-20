---
name: mac-platform
description: "ACTIVATE when writing or modifying shell scripts, setup scripts, hooks, or troubleshooting on macOS. ACTIVATE when commands like `grep -P`, `realpath`, `sed -i`, `mapfile`, `readlink -f`, `date -d`, `xargs -r`, or bash 4+ features are involved. ACTIVATE for shebangs `#!/bin/bash` or `#!/usr/bin/env bash`. Covers /bin/bash 3.2 (Apple-forced) vs Homebrew bash 5.3+, BSD vs GNU command differences, portable alternatives, common macOS pitfalls. DO NOT use for: general code style, non-shell work."
version: "1.0"
---

# macOS / BSD Platform Specifics

## 1. Bash Versions Available on macOS

| Shebang | Version | Constraints |
|---|---|---|
| `#!/bin/bash` | **3.2.57** (Apple-forced, can't be upgraded) | NO bash 4+ features |
| `#!/usr/bin/env bash` | **5.3+** (if Homebrew bash installed) | Bash 5 features OK (requires Homebrew in PATH) |
| `/bin/zsh` | 5.x | Default login shell (`$SHELL`) |

**Bash 3.2 forbids** (will syntax-error or silently misbehave):
- Associative arrays (`declare -A`, `${arr[key]}`)
- `mapfile` / `readarray`
- `${var,,}` / `${var^^}` case modification
- `read -a` for array assignment
- Namerefs (`declare -n`)
- `${parameter@operator}` transformations

If you really need bash 4+ features, switch the shebang to `#!/usr/bin/env bash` and document the Homebrew bash dependency in the script comments.

## 2. BSD vs GNU Commands

macOS ships with **BSD userland**, NOT GNU. Many command flags differ.

| GNU-only (NOT on macOS) | BSD-safe alternative |
|---|---|
| `grep -P "regex"` (Perl regex) | `grep -E "regex"` or `perl -ne 'print if /regex/'` |
| `realpath path` | `python3 -c "import os; print(os.path.realpath('path'))"` or install `coreutils` (`grealpath`) |
| `sed -i 's/a/b/' file` | `sed -i '' 's/a/b/' file` (BSD requires explicit suffix arg) |
| `readlink -f path` | `perl -MCwd -e 'print Cwd::abs_path shift' path` |
| `xargs -r` (no-run-if-empty) | `[ -n "$(...)" ] && echo "..." \| xargs ...` |
| `date -d "yesterday"` | `date -v-1d` |
| `find -printf` | `find -exec printf ... \;` |
| `stat -c '%s' file` | `stat -f '%z' file` |
| `cp --parents` | `rsync -R` or shell loop |
| `tac` (reverse cat) | `tail -r` |

If a GNU-only construct is truly required and no alternative exists, detect and branch:

```bash
if [[ "$(uname -s)" == "Darwin" ]]; then
  # BSD path
else
  # GNU path
fi
```

## 3. Common macOS Pitfalls

- **`mktemp`** : BSD requires `XXXXXX` template explicitly — `mktemp /tmp/foo.XXXXXX` (not `mktemp /tmp/foo`)
- **`cp -r` vs `cp -R`** : on macOS, `cp -r` preserves resource forks. Prefer `cp -R` for portability.
- **`awk`** : default is BSD awk, much less featured than GNU awk (`gawk`). For complex scripts, install `gawk` via Homebrew or use `perl`.
- **`sed` extended regex** : BSD uses `sed -E`, GNU accepts `sed -E` since recent versions but historical scripts use `sed -r`.
- **`echo -n`** : unreliable across shells. Use `printf '%s' "$str"` instead.
- **File system case-insensitivity** : APFS is case-insensitive by default. Don't rely on `file.txt` and `File.txt` being distinct.
- **`/tmp` vs `$TMPDIR`** : on macOS, `$TMPDIR` points to per-user temp, not `/tmp`. Honor `$TMPDIR` for user files.

## 4. Detection Snippets

```bash
# Detect macOS
[[ "$(uname -s)" == "Darwin" ]]

# Detect Homebrew bash availability
command -v /opt/homebrew/bin/bash >/dev/null 2>&1

# Detect Apple Silicon vs Intel
[[ "$(uname -m)" == "arm64" ]]
```

## Quick Reference

| Trigger | Apply |
|---|---|
| Writing `setup.sh` or any `.sh` | Sections 1 + 2 + 3 |
| User reports "command silently fails on Mac" | Section 2 |
| Need bash 4+ feature | Section 1 — switch shebang or rewrite for bash 3.2 |
| File system / temp path bugs | Section 3 |
