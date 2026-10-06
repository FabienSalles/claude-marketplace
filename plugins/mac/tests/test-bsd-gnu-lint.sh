#!/bin/bash

set -u

PLUGIN=$(cd "$(dirname "$0")/.." && pwd)
. "$PLUGIN/../shell-test/skills/shell-test-conventions/references/harness.sh"

LINT=bsd-gnu-lint.sh

expect_silent() {
  expect_status 0
  expect_stdout_empty
  expect_stderr_empty
}

expect_warning() {
  expect_status 0
  expect_stderr_empty
  expect_stdout_json '.hookSpecificOutput.hookEventName == "PreToolUse"'
  expect_stdout_json --arg warning "$1" '.hookSpecificOutput.additionalContext | contains($warning)'
}

section 'Silent: portable commands and the BSD forms'

begin_case 'a grep -E is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call "grep -E 'a|b' notes.txt")"
expect_silent

begin_case "the BSD sed -i '' form is silent"
run_hook "$PLUGIN" "$LINT" "$(bash_call "sed -i '' 's/a/b/' notes.txt")"
expect_silent

begin_case 'the BSD sed -i "" form is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call "sed -i \"\" 's/a/b/' notes.txt")"
expect_silent

begin_case 'the portable sed -i.bak form is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call "sed -i.bak 's/a/b/' notes.txt && rm notes.txt.bak")"
expect_silent

begin_case 'the BSD sed -i .bak form, suffix as its own argument, is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call "sed -i .bak 's/a/b/' notes.txt && rm notes.txt.bak")"
expect_silent

begin_case 'a readlink without -f is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'readlink current')"
expect_silent

begin_case 'an xargs without -r is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'ls | xargs echo')"
expect_silent

begin_case 'a date printing the epoch is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'date +%s')"
expect_silent

begin_case 'a realpath without GNU flags is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'realpath notes.txt')"
expect_silent

begin_case 'a while-read loop is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'while IFS= read -r line; do echo "$line"; done < notes.txt')"
expect_silent

begin_case 'a plain parameter expansion is silent'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'echo "${name}"')"
expect_silent

section 'Warned in valid PreToolUse JSON: one row per rule'

begin_case 'grep -P'
run_hook "$PLUGIN" "$LINT" "$(bash_call "grep -P '\\d+' notes.txt")"
expect_warning '`grep -P` (PCRE) is GNU-only'

begin_case 'an unquoted sed -i script'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'sed -i s/a/b/ notes.txt')"
expect_warning '`sed -i` without a suffix is GNU syntax'

begin_case 'readlink -f'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'readlink -f current')"
expect_warning '`readlink -f` is GNU-only'

begin_case 'xargs -r'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'ls | xargs -r rm')"
expect_warning '`xargs -r` (skip empty input) is GNU-only'

begin_case 'date -d'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'date -d "2025-01-31" +%s')"
expect_warning '`date -d "..."` is GNU-only'

begin_case 'realpath --relative-to'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'realpath --relative-to=. notes.txt')"
expect_warning '`realpath` with GNU-only flags'

begin_case 'mapfile'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'mapfile -t lines < notes.txt')"
expect_warning '`mapfile` / `readarray` is bash 4+'

begin_case 'a case-modifying expansion'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'echo "${name,,}"')"
expect_warning '`${var,,}` / `${var^^}` (case modification) is bash 4+'

section 'Warned: the other spellings and positions each rule names'

begin_case 'grep --perl-regexp after a pipe'
run_hook "$PLUGIN" "$LINT" "$(bash_call "cat app.log | grep --perl-regexp '\\d+'")"
expect_warning '`grep -P` (PCRE) is GNU-only'

begin_case 'readlink --canonicalize'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'readlink --canonicalize current')"
expect_warning '`readlink -f` is GNU-only'

begin_case 'xargs --no-run-if-empty at the start of a command'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'xargs --no-run-if-empty rm < stale.txt')"
expect_warning '`xargs -r` (skip empty input) is GNU-only'

begin_case 'date -d inside a command substitution'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'echo "$(date -d yesterday +%F)"')"
expect_warning '`date -d "..."` is GNU-only'

begin_case 'realpath -m inside a command substitution'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'cd "$(realpath -m build/out)"')"
expect_warning '`realpath` with GNU-only flags'

begin_case 'realpath --canonicalize-missing'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'realpath --canonicalize-missing build/out')"
expect_warning '`realpath` with GNU-only flags'

begin_case 'realpath -s'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'realpath -s notes.txt')"
expect_warning '`realpath` with GNU-only flags'

begin_case 'realpath --strip'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'realpath --strip notes.txt')"
expect_warning '`realpath` with GNU-only flags'

begin_case 'readarray'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'readarray -t lines < notes.txt')"
expect_warning '`mapfile` / `readarray` is bash 4+'

begin_case 'mapfile at the end of a pipeline'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'printf "a\nb\n" | mapfile')"
expect_warning '`mapfile` / `readarray` is bash 4+'

begin_case 'an upper-casing expansion'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'echo "${name^^}"')"
expect_warning '`${var,,}` / `${var^^}` (case modification) is bash 4+'

begin_case 'a first-letter lower-casing expansion'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'echo "${name,}"')"
expect_warning '`${var,,}` / `${var^^}` (case modification) is bash 4+'

begin_case 'a first-letter upper-casing expansion'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'echo "${name^}"')"
expect_warning '`${var,,}` / `${var^^}` (case modification) is bash 4+'

section 'Warned: the quoted GNU sed -i scripts, with the portable fix first'

begin_case 'a single-quoted sed -i script'
run_hook "$PLUGIN" "$LINT" "$(bash_call "sed -i 's/a/b/' notes.txt")"
expect_warning '`sed -i` without a suffix is GNU syntax'

begin_case 'a double-quoted sed -i script'
run_hook "$PLUGIN" "$LINT" "$(bash_call 'sed -i "s/a/b/" notes.txt')"
expect_warning '`sed -i` without a suffix is GNU syntax'

begin_case 'the sed suggestion leads with the portable -i.bak form'
run_hook "$PLUGIN" "$LINT" "$(bash_call "sed -i 's/a/b/' notes.txt")"
expect_warning "Suggest: \`sed -i.bak 's/…/…/' file && rm file.bak\` (portable BSD+GNU)"

section 'Warned: several rules in one command stay one valid JSON object'

begin_case 'grep -P and readlink -f together'
run_hook "$PLUGIN" "$LINT" "$(bash_call "grep -P 'x' \"\$(readlink -f current)\"")"
expect_warning '`grep -P` (PCRE) is GNU-only'
expect_warning '`readlink -f` is GNU-only'

section 'Warned without jq: macOS 14 and earlier ship none'

begin_case 'the warning still reaches stdout when jq is missing'
mkdir -p "$CASE_DIR/bin"
printf '#!/bin/sh\nexit 127\n' >"$CASE_DIR/bin/jq"
chmod +x "$CASE_DIR/bin/jq"
run_in "$CASE_DIR" env PATH="$CASE_DIR/bin:$PATH" /bin/bash -c '"$0" <"$1"' "$PLUGIN/hooks/$LINT" "$(bash_call 'readlink -f current')"
expect_warning '`readlink -f` is GNU-only'

finish_suite
