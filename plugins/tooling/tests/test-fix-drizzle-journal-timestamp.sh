#!/bin/bash

set -u

PLUGIN=$(cd "$(dirname "$0")/.." && pwd)
. "$PLUGIN/../shell-test/skills/shell-test-conventions/references/harness.sh"

HAND_WIRED_COMMAND="\"$PLUGIN/hooks/fix-drizzle-journal-timestamp.sh\""
GENERATE_OUTPUT='[✓] Your SQL migration file ➜ drizzle/0002_brave_storm.sql 🚀'

journal_with_an_older_last_entry() {
  mkdir -p "$CASE_DIR/drizzle/meta"
  printf '%s\n' '{"version":"7","dialect":"postgresql","entries":[{"idx":0,"when":2000,"tag":"0001_init"},{"idx":1,"when":1000,"tag":"0002_brave_storm"}]}' \
    >"$CASE_DIR/drizzle/meta/_journal.json"
}

expect_last_entry_strictly_latest() {
  if ! jq -e '.entries[-1].when > ([.entries[:-1][].when] | max)' "$CASE_DIR/drizzle/meta/_journal.json" >/dev/null; then
    fail_case "the last journal entry is not strictly the latest: $(cat "$CASE_DIR/drizzle/meta/_journal.json")"
  fi
}

section 'PostToolUse on Bash, wired by hand as the README documents'

begin_case 'a drizzle-kit generate result makes the last journal entry strictly the latest'
journal_with_an_older_last_entry
run_hook_command "$PLUGIN" "$HAND_WIRED_COMMAND" "$(bash_result 'npx drizzle-kit generate' "$GENERATE_OUTPUT")"
expect_status 0
expect_stderr_empty
expect_stdout_json '.hookSpecificOutput.hookEventName == "PostToolUse"'
expect_stdout_json '.hookSpecificOutput.additionalContext | startswith("Drizzle journal timestamp fixed: 1000 → ")'
expect_last_entry_strictly_latest

begin_case 'a drizzle-kit migrate result leaves the journal untouched'
journal_with_an_older_last_entry
cp "$CASE_DIR/drizzle/meta/_journal.json" "$CASE_DIR/journal.before"
run_hook_command "$PLUGIN" "$HAND_WIRED_COMMAND" "$(bash_result 'npx drizzle-kit migrate' '[✓] migrations applied successfully!')"
expect_status 0
expect_stdout_empty
expect_stderr_empty
if ! cmp -s "$CASE_DIR/journal.before" "$CASE_DIR/drizzle/meta/_journal.json"; then
  fail_case 'the journal changed although no migration was generated'
fi

begin_case 'a drizzle-kit generate in a project with no journal is silent'
run_hook_command "$PLUGIN" "$HAND_WIRED_COMMAND" "$(bash_result 'npx drizzle-kit generate' "$GENERATE_OUTPUT")"
expect_status 0
expect_stdout_empty
expect_stderr_empty

finish_suite
