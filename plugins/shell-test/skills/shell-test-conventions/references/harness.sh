# shellcheck shell=bash

if ! command -v jq >/dev/null 2>&1; then
  printf 'shell-test harness: jq is required to build payloads and route hooks; install jq and rerun\n' >&2
  exit 1
fi

HARNESS_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/shell-test.XXXXXX") || exit 1
trap 'rm -rf "$HARNESS_ROOT"' EXIT
HARNESS_ROOT=$(cd "$HARNESS_ROOT" && pwd -P) || exit 1

export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_NOSYSTEM=1
export GIT_CEILING_DIRECTORIES="$HARNESS_ROOT"

HARNESS_PASS=0
HARNESS_FAIL=0
HARNESS_CASES=0
CASE_NAME=''
CASE_ERRORS=''

HARNESS_ROUTE='(.hooks[$event] // [])[]
  | select((.matcher // "") as $m
      | if $m == "" or $m == "*" then true
        elif ($m | test("^[A-Za-z0-9_ ,|-]+$")) then ($m | [splits("[|,]")] | map(gsub("^ +| +$"; "")) | any(. == $value))
        else ($value | test($m)) end)
  | .hooks[]
  | select(.type == "command" and (.command | contains($script)))
  | .command'

HARNESS_COMMON='{session_id: "shell-test", transcript_path: "/dev/null", cwd: $cwd, permission_mode: "default"}'

begin_case() {
  end_case
  HARNESS_CASES=$((HARNESS_CASES + 1))
  CASE_NAME=$1
  CASE_ERRORS=''
  CASE_STATUS=''
  CASE_DIR="$HARNESS_ROOT/case-$HARNESS_CASES"
  CASE_HOME="$HARNESS_ROOT/home-$HARNESS_CASES"
  CASE_STDOUT="$HARNESS_ROOT/stdout-$HARNESS_CASES"
  CASE_STDERR="$HARNESS_ROOT/stderr-$HARNESS_CASES"
  mkdir -p "$CASE_DIR" "$CASE_HOME"
  : >"$CASE_STDOUT"
  : >"$CASE_STDERR"
}

end_case() {
  if [ -z "$CASE_NAME" ]; then
    return 0
  fi
  if [ -z "$CASE_ERRORS" ]; then
    printf '  PASS  %s\n' "$CASE_NAME"
    HARNESS_PASS=$((HARNESS_PASS + 1))
  else
    printf '  FAIL  %s\n%s' "$CASE_NAME" "$CASE_ERRORS"
    HARNESS_FAIL=$((HARNESS_FAIL + 1))
  fi
  CASE_NAME=''
}

fail_case() {
  CASE_ERRORS="$CASE_ERRORS        $1"$'\n'
}

section() {
  end_case
  printf '\n== %s\n' "$1"
}

finish_suite() {
  end_case
  printf '\nTotal: %d pass, %d fail\n' "$HARNESS_PASS" "$HARNESS_FAIL"
  if [ "$HARNESS_FAIL" -gt 0 ]; then
    exit 1
  fi
  if [ "$HARNESS_PASS" -eq 0 ]; then
    printf 'shell-test harness: no case ran, which proves nothing\n' >&2
    exit 1
  fi
  exit 0
}

harness_payload() {
  local file
  file=$(mktemp "$HARNESS_ROOT/payload.XXXXXX") || return 1
  jq -n --arg cwd "$CASE_DIR" "$@" >"$file" || return 1
  printf '%s\n' "$file"
}

harness_absolute() {
  case "$1" in
    /*) return 0 ;;
  esac
  printf 'shell-test harness: Claude Code always sends an absolute file_path, got %s\n' "$1" >&2
  return 1
}

bash_call() {
  harness_payload --arg command "$1" \
    "$HARNESS_COMMON"' + {hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: $command}, tool_use_id: "toolu_shell_test"}'
}

read_call() {
  harness_absolute "$1" || return 1
  harness_payload --arg path "$1" \
    "$HARNESS_COMMON"' + {hook_event_name: "PreToolUse", tool_name: "Read", tool_input: {file_path: $path}, tool_use_id: "toolu_shell_test"}'
}

grep_call() {
  harness_payload --arg pattern "$1" --arg path "$2" --arg glob "$3" \
    "$HARNESS_COMMON"' + {hook_event_name: "PreToolUse", tool_name: "Grep", tool_input: ({pattern: $pattern} + (if $path == "" then {} else {path: $path} end) + (if $glob == "" then {} else {glob: $glob} end)), tool_use_id: "toolu_shell_test"}'
}

write_call() {
  harness_absolute "$1" || return 1
  harness_payload --arg path "$1" --arg content "$2" \
    "$HARNESS_COMMON"' + {hook_event_name: "PreToolUse", tool_name: "Write", tool_input: {file_path: $path, content: $content}, tool_use_id: "toolu_shell_test"}'
}

edit_call() {
  harness_absolute "$1" || return 1
  harness_payload --arg path "$1" --arg old "$2" --arg new "$3" \
    "$HARNESS_COMMON"' + {hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: {file_path: $path, old_string: $old, new_string: $new, replace_all: false}, tool_use_id: "toolu_shell_test"}'
}

bash_result() {
  harness_payload --arg command "$1" --arg stdout "$2" \
    "$HARNESS_COMMON"' + {hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {command: $command}, tool_response: {stdout: $stdout, stderr: "", interrupted: false, isImage: false}, tool_use_id: "toolu_shell_test", duration_ms: 1}'
}

write_result() {
  harness_absolute "$1" || return 1
  harness_payload --arg path "$1" --arg content "$2" \
    "$HARNESS_COMMON"' + {hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {file_path: $path, content: $content}, tool_response: {filePath: $path, type: "create"}, tool_use_id: "toolu_shell_test", duration_ms: 1}'
}

session_start() {
  harness_payload --arg source "$1" \
    "$HARNESS_COMMON"' + {hook_event_name: "SessionStart", source: $source}'
}

run_hook() {
  local plugin=$1 script=$2 payload=$3 event field value commands
  if [ ! -s "$payload" ]; then
    fail_case "run_hook: no payload file for $script"
    return 0
  fi
  event=$(jq -r '.hook_event_name // empty' "$payload")
  case "$event" in
    PreToolUse | PostToolUse | PostToolUseFailure | PermissionRequest | PermissionDenied) field=tool_name ;;
    SessionStart) field=source ;;
    *)
      fail_case "run_hook: no matcher field known for event '$event'"
      return 0
      ;;
  esac
  value=$(jq -r --arg field "$field" '.[$field] // empty' "$payload")
  if ! commands=$(jq -r --arg event "$event" --arg value "$value" --arg script "$script" "$HARNESS_ROUTE" "$plugin/hooks/hooks.json"); then
    fail_case "run_hook: cannot read $plugin/hooks/hooks.json"
    return 0
  fi
  case "$commands" in
    '')
      fail_case "no $event matcher in $plugin/hooks/hooks.json routes '$value' to $script"
      return 0
      ;;
    *$'\n'*)
      fail_case "more than one $event command in $plugin/hooks/hooks.json runs $script for '$value'"
      return 0
      ;;
  esac
  run_hook_command "$plugin" "$commands" "$payload"
}

run_hook_command() {
  local plugin=$1 command=$2 payload=$3 cwd
  cwd=$(jq -r '.cwd // empty' "$payload")
  (
    cd "$cwd" || exit 1
    CLAUDE_PLUGIN_ROOT=$plugin HOME=$CASE_HOME sh -c "$command"
  ) <"$payload" >"$CASE_STDOUT" 2>"$CASE_STDERR"
  CASE_STATUS=$?
}

run_in() {
  local dir=$1
  shift
  (
    cd "$dir" || exit 1
    HOME=$CASE_HOME "$@"
  ) </dev/null >"$CASE_STDOUT" 2>"$CASE_STDERR"
  CASE_STATUS=$?
}

expect_status() {
  if [ "$CASE_STATUS" != "$1" ]; then
    fail_case "expected status $1, got ${CASE_STATUS:-none}"
    fail_case "stdout: $(cat "$CASE_STDOUT")"
    fail_case "stderr: $(cat "$CASE_STDERR")"
  fi
}

harness_expect_empty() {
  if [ -s "$2" ]; then
    fail_case "expected an empty $1, got: $(cat "$2")"
  fi
}

expect_stdout_empty() {
  harness_expect_empty stdout "$CASE_STDOUT"
}

expect_stderr_empty() {
  harness_expect_empty stderr "$CASE_STDERR"
}

harness_expect_has() {
  local rc
  case "$3" in
    *$'\n'*)
      fail_case "expect_$1_has takes one line; grep -F would accept any of its lines"
      return 0
      ;;
  esac
  grep -qF -- "$3" "$2"
  rc=$?
  if [ "$rc" -eq 1 ]; then
    fail_case "$1 lacks '$3'; $1 was: $(cat "$2")"
  elif [ "$rc" -ne 0 ]; then
    fail_case "grep failed with status $rc reading $1"
  fi
}

expect_stdout_has() {
  harness_expect_has stdout "$CASE_STDOUT" "$1"
}

expect_stderr_has() {
  harness_expect_has stderr "$CASE_STDERR" "$1"
}

expect_stdout_json() {
  local rc
  jq -e -s 'length == 1 and (.[0] | type) == "object"' "$CASE_STDOUT" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -ne 0 ]; then
    fail_case "stdout is not exactly one JSON object (jq -s status $rc); stdout was: $(cat "$CASE_STDOUT")"
    return 0
  fi
  jq -e "$@" "$CASE_STDOUT" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -ne 0 ]; then
    fail_case "stdout fails jq -e $* (status $rc); stdout was: $(cat "$CASE_STDOUT")"
  fi
}
