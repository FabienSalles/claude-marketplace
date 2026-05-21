#!/bin/bash
# PreToolUse hook: warn when a Bash command uses GNU-only flags / bash 4+ syntax
# that silently fails on macOS (BSD coreutils + /bin/bash 3.2).
#
# Detection is best-effort string-matching — exits 0 always (warn-only, never blocks).

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null)

[ -z "$COMMAND" ] && exit 0

WARNINGS=""

add_warning() {
    if [ -z "$WARNINGS" ]; then
        WARNINGS="$1"
    else
        WARNINGS="$WARNINGS\n\n$1"
    fi
}

# 1. grep -P (PCRE): BSD grep has no -P
#    Trigger: grep with a -P flag (alone or combined: -P, -iP, -EP, etc.)
if echo "$COMMAND" | grep -qE '(^|[^A-Za-z_-])grep[[:space:]]+(-[A-Za-z]*P[A-Za-z]*|--perl-regexp)'; then
    add_warning '• \`grep -P\` (PCRE) is GNU-only — BSD grep on macOS will error.\n  Suggest: rewrite the pattern with \`grep -E\` (extended regex), or pipe to \`perl -ne\` / \`rg\`.'
fi

# 2. sed -i without BSD empty-string suffix
#    GNU: sed -i 's/x/y/' file        (works on Linux, errors on BSD)
#    BSD: sed -i '' 's/x/y/' file     (works on both — empty suffix on BSD, ignored on GNU? — actually GNU treats '' as the backup ext)
#    Portable: sed -i.bak 's/x/y/' file && rm file.bak
#    Trigger: `sed -i` immediately followed by a non-quoted token (the script), no empty-string suffix
if echo "$COMMAND" | grep -qE "sed[[:space:]]+(-[A-Za-z]*)?-i[[:space:]]+[^'\"]" \
   && ! echo "$COMMAND" | grep -qE "sed[[:space:]]+(-[A-Za-z]*)?-i[[:space:]]+(''|\"\"|\\.[A-Za-z]+)"; then
    add_warning "• \`sed -i\` without an empty-string suffix is GNU syntax — BSD sed on macOS requires \`sed -i '' 's/…/…/' file\`.\n  Suggest: \`sed -i '' 's/…/…/' file\` (portable BSD+GNU: \`sed -i.bak 's/…/…/' file && rm file.bak\`)."
fi

# 3. readlink -f: GNU; BSD readlink has no -f
if echo "$COMMAND" | grep -qE '(^|[^A-Za-z_-])readlink[[:space:]]+(-[A-Za-z]*f|--canonicalize)'; then
    add_warning '• \`readlink -f\` is GNU-only — BSD readlink on macOS has no -f.\n  Suggest: \`realpath\` (works on macOS via coreutils), or a portable shim: \`cd "$(dirname "$f")" && printf "%s/%s\\n" "$(pwd -P)" "$(basename "$f")"\`.'
fi

# 4. xargs -r: GNU; BSD xargs has no -r (BSD already skips empty input by default… but only in some versions)
if echo "$COMMAND" | grep -qE '(^|[^A-Za-z_-])xargs[[:space:]]+(-[A-Za-z]*r|--no-run-if-empty)'; then
    add_warning '• \`xargs -r\` (skip empty input) is GNU-only on macOS.\n  Suggest: guard the pipeline — \`[ -n "$(producer)" ] && producer | xargs …\` or pipe through \`grep .\` first.'
fi

# 5. date -d "...": GNU; BSD date uses -j -f
if echo "$COMMAND" | grep -qE '(^|[^A-Za-z_-])date[[:space:]]+-[A-Za-z]*d[[:space:]]'; then
    add_warning '• \`date -d "..."\` is GNU-only — BSD date on macOS uses \`-j -f "%Y-%m-%d" "2025-01-31" "+%s"\`.\n  Suggest: install gdate via coreutils, or use the BSD form.'
fi

# 6. realpath with GNU-only flags (--relative-to, -m, --canonicalize-missing)
if echo "$COMMAND" | grep -qE '(^|[^A-Za-z_-])realpath[[:space:]]+(-m|--relative-to|--canonicalize-missing|-s|--strip)'; then
    add_warning '• \`realpath\` with GNU-only flags (\`-m\`, \`--relative-to\`, …) — macOS realpath (since 10.15 it exists) does not support them.\n  Suggest: install coreutils (\`brew install coreutils\` → \`grealpath\`), or compute the relative path manually with \`pwd -P\` + parameter expansion.'
fi

# 7. mapfile / readarray: bash 4+ — only a problem under #!/bin/bash (3.2 on macOS).
#    Not detecting shebang here (we don't have file context), so we only warn if the bare command is used.
if echo "$COMMAND" | grep -qE '(^|[^A-Za-z_-])(mapfile|readarray)([[:space:]]|$)'; then
    add_warning '• \`mapfile\` / \`readarray\` is bash 4+ — fails silently under \`#!/bin/bash\` on macOS (bash 3.2).\n  Suggest: change shebang to \`#!/usr/bin/env bash\` (picks up Homebrew bash 5+), or use a portable \`while IFS= read -r line; do …; done < <(producer)\` loop.'
fi

# 8. ${var,,} / ${var^^} (bash 4+ case modification)
if echo "$COMMAND" | grep -qE '\$\{[A-Za-z_][A-Za-z0-9_]*(\,\,|\^\^|\,|\^)\}'; then
    add_warning '• \`${var,,}\` / \`${var^^}\` (case modification) is bash 4+ — fails under \`#!/bin/bash\` on macOS.\n  Suggest: change shebang to \`#!/usr/bin/env bash\`, or use \`tr "[:upper:]" "[:lower:]"\` for portability.'
fi

if [ -n "$WARNINGS" ]; then
    # shellcheck disable=SC2059
    HEADER='⚠️ **macOS portability — BSD/GNU divergence detected**\n\nThis command uses GNU-only flags or bash 4+ syntax that may fail on macOS (default `/bin/bash` is 3.2, default coreutils are BSD). Review:\n\n'
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "$(printf '%b' "${HEADER}${WARNINGS}")"
  }
}
EOF
fi

exit 0
