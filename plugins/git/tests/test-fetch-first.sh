#!/bin/bash

set -u

PLUGIN=$(cd "$(dirname "$0")/.." && pwd)
. "$PLUGIN/../shell-test/skills/shell-test-conventions/references/harness.sh"

GUARD=fetch-first.sh
STALE_REFS='Refs de suivi périmées'

mkdir -p "$HARNESS_ROOT/gnu-stat"
cat >"$HARNESS_ROOT/gnu-stat/stat" <<'EOF'
#!/bin/sh
if [ "$1" = -c ] && [ "$2" = %Y ]; then
  exec python3 -c 'import os, sys; print(int(os.stat(sys.argv[1]).st_mtime))' "$3"
fi
printf '  File: "%s"\n    ID: 0 Namelen: 255 Type: apfs\n' "$2"
exit 1
EOF
chmod +x "$HARNESS_ROOT/gnu-stat/stat"

expect_silent() {
  expect_status 0
  expect_stdout_empty
  expect_stderr_empty
}

expect_blocked() {
  expect_status 0
  expect_stderr_empty
  expect_stdout_json '.hookSpecificOutput.hookEventName == "PreToolUse"'
  expect_stdout_json '.hookSpecificOutput.permissionDecision == "deny"'
  expect_stdout_json --arg text "$STALE_REFS" '.hookSpecificOutput.permissionDecisionReason | contains($text)'
}

a_repository_with_a_remote() {
  git init -q "$CASE_DIR"
  git -C "$CASE_DIR" remote add origin https://example.com/app.git
}

a_fresh_fetch() {
  touch "$CASE_DIR/.git/FETCH_HEAD"
}

a_stale_fetch() {
  touch -t 200001010000 "$CASE_DIR/.git/FETCH_HEAD"
}

section 'Blocked: a branch cut from refs that were never fetched or are stale'

begin_case 'git checkout -b with no fetch is blocked'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git checkout -b feat')"
expect_blocked

begin_case 'git switch -c with no fetch is blocked'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git switch -c feat')"
expect_blocked

begin_case 'a fetch older than ten minutes is blocked'
a_repository_with_a_remote
a_stale_fetch
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git checkout -b feat')"
expect_blocked

begin_case 'a fetch chained with ; does not count'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git fetch --prune; git checkout -b feat')"
expect_blocked

begin_case 'a fetch sent to the background with & does not count'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git fetch --prune & git checkout -b feat')"
expect_blocked

section 'Blocked: near misses spelled with git global options'

begin_case 'git -C <path> checkout -b with no fetch is blocked'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git -C . checkout -b feat')"
expect_blocked

begin_case 'git -c <name>=<value> switch -c with no fetch is blocked'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git -c core.pager=cat switch -c feat')"
expect_blocked

begin_case 'git --no-pager checkout -b with no fetch is blocked'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --no-pager checkout -b feat')"
expect_blocked

begin_case 'git --git-dir <path> checkout -b with no fetch is blocked'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --git-dir "$PWD/.git" checkout -b feat')"
expect_blocked

begin_case 'git --work-tree <path> switch -c with no fetch is blocked'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --work-tree . switch -c feat')"
expect_blocked

begin_case 'git --namespace <name> checkout -b with no fetch is blocked'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --namespace review checkout -b feat')"
expect_blocked

begin_case 'git --config-env <name>=<envvar> switch -c with no fetch is blocked'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --config-env core.pager=PAGER switch -c feat')"
expect_blocked

section 'Allowed: fresh refs, the escape hatches, and commands that read no local ref'

begin_case 'a fetch under ten minutes old lets the branch through'
a_repository_with_a_remote
a_fresh_fetch
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git checkout -b feat')"
expect_silent

begin_case 'a fresh fetch lets the branch through when a GNU stat comes first on PATH'
a_repository_with_a_remote
a_fresh_fetch
PATH="$HARNESS_ROOT/gnu-stat:$PATH" run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git checkout -b feat')"
expect_silent

begin_case 'a git fetch chained with && before the branch creation passes'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git fetch --prune && git checkout -b feat')"
expect_silent

begin_case 'a chained fetch spelled with git -C passes'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git -C . fetch --prune && git -C . checkout -b feat')"
expect_silent

begin_case 'a chained fetch spelled with git --no-pager passes'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --no-pager fetch --prune && git --no-pager checkout -b feat')"
expect_silent

begin_case 'a chained fetch spelled with git --git-dir passes'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --git-dir "$PWD/.git" fetch --prune && git --git-dir "$PWD/.git" checkout -b feat')"
expect_silent

begin_case 'a chained fetch spelled with git --work-tree passes'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --work-tree . fetch --prune && git --work-tree . switch -c feat')"
expect_silent

begin_case 'a chained fetch spelled with git --namespace passes'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --namespace review fetch --prune && git --namespace review checkout -b feat')"
expect_silent

begin_case 'a chained fetch spelled with git --config-env passes'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git --config-env core.pager=PAGER fetch --prune && git --config-env core.pager=PAGER switch -c feat')"
expect_silent

begin_case 'a repository without a remote is not guarded'
git init -q "$CASE_DIR"
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git checkout -b feat')"
expect_silent

begin_case 'a directory outside any work tree is not guarded'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git checkout -b feat')"
expect_silent

begin_case 'checking out an existing branch is not guarded'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git checkout main')"
expect_silent

begin_case 'a push is not guarded'
a_repository_with_a_remote
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git push -u origin feat')"
expect_silent

finish_suite
