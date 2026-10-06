---
name: mac-platform
description: "ACTIVATE when writing or modifying shell scripts, setup scripts, hooks, or troubleshooting on macOS. ACTIVATE when commands like `grep -P`, `realpath`, `sed -i`, `mapfile`, `readlink -f`, `date -d`, `xargs -r`, `mktemp`, `set -u`, or bash 4+ features are involved. ACTIVATE for shebangs `#!/bin/bash` or `#!/usr/bin/env bash`. Covers /bin/bash 3.2 (Apple-forced) vs Homebrew bash 5.3+, BSD vs GNU command differences, portable alternatives, common macOS pitfalls. DO NOT use for: general code style, non-shell work."
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
- `mapfile` / `readarray`: read lines with `arr=(); while IFS= read -r line; do arr+=("$line"); done < <(cmd)` instead. Without `arr=()`, a `cmd` that prints nothing leaves `arr` unset, so `set -u` aborts on `${#arr[@]}`, and an existing `arr` is appended to where `mapfile` would replace it; expand the result with the `set -u` guard below
- `${var,,}` / `${var^^}` case modification
- Namerefs (`declare -n`)
- `${parameter@operator}` transformations

`read -a` is not on this list: `IFS=, read -ra arr <<< "$line"` splits one line into an array on 3.2.

If you really need bash 4+ features, switch the shebang to `#!/usr/bin/env bash` and document the Homebrew bash dependency in the script comments.

**Bash 3.2 traps** (fine on bash 5, broken on 3.2):
- A `case` pattern inside `$( … )` does not parse (`syntax error near unexpected token ';;'`). Open every pattern with its parenthesis: `kind=$(case "$f" in (*.sh) echo shell;; (*) echo other;; esac)`.
- Under `set -u`, expanding an empty array aborts the script (`arr[@]: unbound variable`, fixed in bash 4.4). Expand it as `${arr[@]+"${arr[@]}"}`.
- `printf '%.0f'`, like every `%f`, reads the decimal separator from the locale. Under `fr_FR.UTF-8`, 3.2 prints `0` for `37.5` and bash 5.3 prints `37`, both with an error. On 3.2 no prefix assignment reaches the builtin (`LC_NUMERIC=C printf …` and `LC_ALL=C printf …` both still print `0`), and an exported `LC_ALL` overrides `LC_NUMERIC` on every version: assign `LC_ALL=C` as a statement inside the substitution, `pct=$(LC_ALL=C; printf '%.0f' "$x")`.

Check a `#!/bin/bash` script with `/bin/bash -n script` and by running it with `/bin/bash`. `bash script` picks Homebrew bash 5 when it comes first on `PATH`, and ShellCheck has no bash-version target: it accepts `declare -A`, `mapfile`, `${x,,}` and an empty array under `set -u`.

## 2. BSD vs GNU Commands

macOS ships with **BSD userland**, NOT GNU. Many command flags differ.

| GNU-only (NOT on macOS) | BSD-safe alternative |
|---|---|
| `grep -P "regex"` (Perl regex) | `grep -E "regex"` or `perl -ne 'print if /regex/'` |
| `realpath -m/--relative-to/--canonicalize-missing path` | see §3 pitfall below |
| `sed -i 's/a/b/' file` | `sed -i.bak 's/a/b/' file && rm file.bak` (BSD and GNU); `sed -i '' 's/a/b/' file` works on BSD only |
| `readlink -f path` | `perl -MCwd -e 'print Cwd::abs_path shift' path` |
| `xargs -r` (no-run-if-empty) | `[ -n "$(...)" ] && echo "..." \| xargs ...` |
| `date -d "yesterday"` | `date -v-1d` |
| `find -printf` | `find -exec printf ... \;` |
| `stat -c '%s' file` | `stat -f '%z' file` |
| `cp --parents` | `rsync -R` or shell loop |
| `tac` (reverse cat) | `tail -r` |

**macOS grep is BSD grep, and it exits 2 where GNU grep does not:** on `-P` (`invalid option -- P`), and on a BRE containing `**` such as Markdown bold (`repetition-operator operand invalid`, where GNU grep exits 1). Behind `2>/dev/null`, `if grep -q …` or `|| true`, that error reads as "no match", and the check silently never fires on macOS. Search literal text with `grep -F -- 'text'`. Under `grep -E`, `\|` is a literal pipe: write the alternation as `a|b` (`\|` alternates only in a BRE). How a test asserts with grep lives in `shell-test:shell-test-conventions`.

If a GNU-only construct is truly required and no alternative exists, detect the feature, not the OS. GNU coreutils can come first on a Mac's `PATH`, and a `uname` switch then hands BSD flags to a GNU binary (`stat -f %m` prints file system details instead of an mtime):

```bash
mtime=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f")
```

## 3. Common macOS Pitfalls

- **`realpath`** : macOS's `/usr/bin/realpath` resolves an existing path but rejects GNU-only flags — `-m`/`--canonicalize-missing` (don't require the path to exist) and `--relative-to` (print relative to a base) exit non-zero with "illegal option". `-s` (no-symlink-resolution) is also GNU-only. Install `coreutils` (`grealpath`) or use `python3 -c "import os; print(os.path.realpath('path'))"` when those flags are needed.
- **`mktemp`** : always pass a template with an explicit directory, `mktemp -d "${TMPDIR:-/tmp}/name.XXXXXX"`. On macOS, bare `mktemp -d` and `mktemp -t name` ignore an overridden `TMPDIR` (they use the per-user temp directory first), and `-t` takes a prefix on BSD but a deprecated template on GNU.
- **First exec of a new executable** : macOS assesses a newly written executable the first time it runs, from about 0.1 s on an idle machine to several seconds under load, one file at a time across the system. A re-run, a symlink or hard link to a file that already ran, or `sh file` costs about 10 ms; a `cp` is a new file and pays again, so a suite links one stub per fixture (`craft:test-suite-design` §3). A terminal enabled under Privacy & Security > Developer Tools (after `sudo spctl developer-mode enable-terminal`) skips the scan for its own child processes only, so tmux or an app that launches the runs must be listed too. It is a setting of one Mac, not of the suite.
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
| Works as `bash script`, breaks under `#!/bin/bash` | Section 1 traps; check with `/bin/bash -n` |
| A `grep` check never fires on macOS | Section 2, grep exit 2 |
| GNU-only flag needed anyway | Section 2 — detect the feature, not the OS |
| File system / temp path bugs | Section 3 |
| Test stubs make a suite slow on macOS | Section 3, first exec |
