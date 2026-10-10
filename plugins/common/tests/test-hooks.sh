#!/bin/bash

set -u

PLUGIN=$(cd "$(dirname "$0")/.." && pwd)
. "$PLUGIN/../shell-test/skills/shell-test-conventions/references/harness.sh"

expect_silent() {
  expect_status 0
  expect_stdout_empty
  expect_stderr_empty
}

expect_context() {
  expect_status 0
  expect_stderr_empty
  expect_stdout_json '.hookSpecificOutput.hookEventName == "PreToolUse"'
  expect_stdout_json --arg text "$1" '.hookSpecificOutput.additionalContext | contains($text)'
}

expect_blocked() {
  expect_status 0
  expect_stderr_empty
  expect_stdout_json '.hookSpecificOutput.hookEventName == "PreToolUse"'
  expect_stdout_json '.hookSpecificOutput.permissionDecision == "deny"'
  expect_stdout_json --arg text "$1" '.hookSpecificOutput.permissionDecisionReason | contains($text)'
}

a_repository() {
  git init -q "$CASE_DIR"
}

a_tracked_file() {
  mkdir -p "$(dirname "$CASE_DIR/$1")"
  printf 'tracked\n' >"$CASE_DIR/$1"
  HOME="$CASE_HOME" git -C "$CASE_DIR" add -- "$1"
}

COAUTHOR=block-claude-coauthor.sh
NO_AI_TRAILER='Co-Authored-By trailer for an AI assistant is forbidden'

section 'block-claude-coauthor: allowed commits'

begin_case 'a commit with no trailer is allowed'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call 'git commit -m "feat: add the export"')"
expect_silent

begin_case 'a human co-author trailer is allowed'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: add the export\n\nCo-Authored-By: Jane Doe <jane@example.com>"')"
expect_silent

begin_case 'searching the log for an AI trailer is not a commit'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call "git log --grep 'Co-Authored-By: Claude'")"
expect_silent

section 'block-claude-coauthor: one row per AI assistant the trailer rule names'

begin_case 'a Claude co-author trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'a ChatGPT co-author trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nCo-Authored-By: ChatGPT <bot@example.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'a GPT-4 co-author trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nCo-Authored-By: GPT-4 <bot@example.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'a Codex co-author trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nCo-Authored-By: Codex <bot@example.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'a Copilot co-author trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nCo-Authored-By: Copilot <bot@example.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'a Cursor co-author trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nCo-Authored-By: Cursor <bot@example.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'an Anthropic co-author trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nCo-Authored-By: Anthropic <bot@example.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'an OpenAI co-author trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nCo-Authored-By: OpenAI <bot@example.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'a Gemini co-author trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nCo-Authored-By: Gemini <bot@example.com>"')"
expect_blocked "$NO_AI_TRAILER"

section 'block-claude-coauthor: near misses of the same commit'

begin_case 'a lower-case trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "feat: x\n\nco-authored-by: claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'an amended commit with the trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit --amend -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'a heredoc message with the trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git commit -m "$(cat <<\'EOF\'\nfeat: x\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\nEOF\n)"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'git -C <path> commit with the trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git -C /work/app commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'git --no-pager commit with the trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git --no-pager commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'git -c <name>=<value> commit with the trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git -c user.name=dev commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'git --git-dir <path> commit with the trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git --git-dir "/work/app/.git" commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'git --work-tree <path> commit with the trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git --work-tree /work/app commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'git --namespace <name> commit with the trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git --namespace review commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

begin_case 'git --config-env <name>=<envvar> commit with the trailer is blocked'
run_hook "$PLUGIN" "$COAUTHOR" "$(bash_call $'git --config-env user.name=GIT_USER commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')"
expect_blocked "$NO_AI_TRAILER"

GIT_MV=warn-use-git-mv.sh
USE_GIT_MV='Use `git mv` instead of `mv`'

section 'warn-use-git-mv: a tracked path inside a work tree moves with git mv'

begin_case 'moving a tracked file is blocked'
a_repository
a_tracked_file a.txt
run_hook "$PLUGIN" "$GIT_MV" "$(bash_call 'mv a.txt b.txt')"
expect_blocked "$USE_GIT_MV"

begin_case 'moving a tracked file with an option is blocked'
a_repository
a_tracked_file a.txt
run_hook "$PLUGIN" "$GIT_MV" "$(bash_call 'mv -f a.txt b.txt')"
expect_blocked "$USE_GIT_MV"

begin_case 'moving a directory holding tracked files is blocked'
a_repository
a_tracked_file src/a.txt
run_hook "$PLUGIN" "$GIT_MV" "$(bash_call 'mv src lib')"
expect_blocked "$USE_GIT_MV"

section 'warn-use-git-mv: allowed moves'

begin_case 'moving a file outside any work tree is allowed'
printf 'a\n' >"$CASE_DIR/a.txt"
run_hook "$PLUGIN" "$GIT_MV" "$(bash_call 'mv a.txt b.txt')"
expect_silent

begin_case 'moving an untracked file inside a work tree is allowed'
a_repository
printf 'a\n' >"$CASE_DIR/a.txt"
run_hook "$PLUGIN" "$GIT_MV" "$(bash_call 'mv a.txt b.txt')"
expect_silent

begin_case 'moving an untracked file into a tracked directory is allowed'
a_repository
a_tracked_file src/a.txt
printf 'new\n' >"$CASE_DIR/new.txt"
run_hook "$PLUGIN" "$GIT_MV" "$(bash_call 'mv new.txt src/')"
expect_silent

begin_case 'git mv is allowed'
a_repository
a_tracked_file a.txt
run_hook "$PLUGIN" "$GIT_MV" "$(bash_call 'git mv a.txt b.txt')"
expect_silent

ADD_EMPTY=git-add-empty.sh

expect_shown_by_git_diff() {
  local shown
  shown=$(git -C "$CASE_DIR" diff --name-only)
  if [ "$shown" != "$1" ]; then
    fail_case "git diff --name-only shows '$shown', expected '$1'"
  fi
}

section 'git-add-empty: a written file shows in git diff before any commit'

begin_case 'a new file is added to the index with intent to add'
a_repository
printf 'new\n' >"$CASE_DIR/new.txt"
run_hook "$PLUGIN" "$ADD_EMPTY" "$(write_result "$CASE_DIR/new.txt" 'new')"
expect_status 0
expect_stderr_empty
expect_shown_by_git_diff new.txt

begin_case 'a new file in a subdirectory is added under its path from the root'
a_repository
mkdir -p "$CASE_DIR/src/app"
printf 'new\n' >"$CASE_DIR/src/app/new.txt"
run_hook "$PLUGIN" "$ADD_EMPTY" "$(write_result "$CASE_DIR/src/app/new.txt" 'new')"
expect_status 0
expect_stderr_empty
expect_shown_by_git_diff src/app/new.txt

begin_case 'a new file reached through a symlinked directory is added under its real path'
a_repository
ln -s "$CASE_DIR" "$CASE_HOME/project"
printf 'new\n' >"$CASE_DIR/new.txt"
run_hook "$PLUGIN" "$ADD_EMPTY" "$(write_result "$CASE_HOME/project/new.txt" 'new')"
expect_status 0
expect_stderr_empty
expect_shown_by_git_diff new.txt
expect_stdout_has "Added new.txt to git index (intent to add) in $CASE_DIR"

begin_case 'an already tracked file is left as it is'
a_repository
a_tracked_file tracked.txt
run_hook "$PLUGIN" "$ADD_EMPTY" "$(write_result "$CASE_DIR/tracked.txt" 'tracked')"
expect_silent

begin_case 'a file outside any work tree is left alone'
printf 'new\n' >"$CASE_DIR/new.txt"
run_hook "$PLUGIN" "$ADD_EMPTY" "$(write_result "$CASE_DIR/new.txt" 'new')"
expect_silent

REMIND_CI=remind-ci-before-commit.sh
CI_REMINDER='CI REMINDER BEFORE COMMIT'

section 'remind-ci-before-commit: a commit gets the CI reminder as context'

begin_case 'a git commit gets the reminder'
run_hook "$PLUGIN" "$REMIND_CI" "$(bash_call 'git commit -m "feat: add the export"')"
expect_context "$CI_REMINDER"

begin_case 'an amended commit gets the reminder'
run_hook "$PLUGIN" "$REMIND_CI" "$(bash_call 'git commit --amend --no-edit')"
expect_context "$CI_REMINDER"

begin_case 'a git status gets no reminder'
run_hook "$PLUGIN" "$REMIND_CI" "$(bash_call 'git status --short')"
expect_silent

begin_case 'a git log gets no reminder'
run_hook "$PLUGIN" "$REMIND_CI" "$(bash_call 'git log --oneline -5')"
expect_silent

TEST_EDIT=warn-test-file-edit.sh
TEST_HEADS_UP='HEADS-UP: Editing a test file'

section 'warn-test-file-edit: one row per test-file shape the rule names'

begin_case 'a file under tests/ gets the heads-up'
run_hook "$PLUGIN" "$TEST_EDIT" "$(write_call /work/app/tests/fixtures/users.json '[]')"
expect_context "$TEST_HEADS_UP"

begin_case 'a file under test/ gets the heads-up'
run_hook "$PLUGIN" "$TEST_EDIT" "$(edit_call /work/app/test/user.js 'a' 'b')"
expect_context "$TEST_HEADS_UP"

begin_case 'a file under __tests__/ gets the heads-up'
run_hook "$PLUGIN" "$TEST_EDIT" "$(write_call /work/app/src/__tests__/user.js 'x')"
expect_context "$TEST_HEADS_UP"

begin_case 'a .test.ts file gets the heads-up'
run_hook "$PLUGIN" "$TEST_EDIT" "$(edit_call /work/app/src/user.test.ts 'a' 'b')"
expect_context "$TEST_HEADS_UP"

begin_case 'a .spec.tsx file gets the heads-up'
run_hook "$PLUGIN" "$TEST_EDIT" "$(write_call /work/app/src/Button.spec.tsx 'x')"
expect_context "$TEST_HEADS_UP"

begin_case 'a *Test.php file outside tests/ gets the heads-up'
run_hook "$PLUGIN" "$TEST_EDIT" "$(write_call /work/app/src/UserTest.php '<?php')"
expect_context "$TEST_HEADS_UP"

section 'warn-test-file-edit: production files that merely look like tests'

begin_case 'a production source file gets nothing'
run_hook "$PLUGIN" "$TEST_EDIT" "$(edit_call /work/app/src/user.ts 'a' 'b')"
expect_silent

begin_case 'a file named latest.ts gets nothing'
run_hook "$PLUGIN" "$TEST_EDIT" "$(write_call /work/app/src/latest.ts 'x')"
expect_silent

begin_case 'a testing helpers directory gets nothing'
run_hook "$PLUGIN" "$TEST_EDIT" "$(write_call /work/app/src/testing/helpers.ts 'x')"
expect_silent

begin_case 'a contest.php file gets nothing'
run_hook "$PLUGIN" "$TEST_EDIT" "$(write_call /work/app/src/contest.php '<?php')"
expect_silent

REMIND_SKILLS=remind-skills.py

section 'remind-skills: the reminder follows the file type'

begin_case 'a PHP class edit gets the PHP skills reminder'
run_hook "$PLUGIN" "$REMIND_SKILLS" "$(edit_call /work/app/src/Service/UserService.php 'a' 'b')"
expect_context "**SKILLS - PHP file: LOAD, don't just recall**"

begin_case 'a PHPUnit test write gets the test skills reminder'
run_hook "$PLUGIN" "$REMIND_SKILLS" "$(write_call /work/app/tests/Unit/UserServiceTest.php '<?php')"
expect_context "**SKILLS - PHP test file: LOAD, don't just recall**"

begin_case 'a Twig template edit gets the Twig skills reminder'
run_hook "$PLUGIN" "$REMIND_SKILLS" "$(edit_call /work/app/templates/user/show.html.twig 'a' 'b')"
expect_context "**SKILLS - Twig template: LOAD, don't just recall**"

begin_case 'a TypeScript file gets no reminder'
run_hook "$PLUGIN" "$REMIND_SKILLS" "$(write_call /work/app/src/user.ts 'x')"
expect_silent

begin_case 'a Markdown note about PHP gets no reminder'
run_hook "$PLUGIN" "$REMIND_SKILLS" "$(write_call /work/app/docs/upgrade.php.md 'x')"
expect_silent

CLOCK=warn-clock-bypass.py

section 'warn-clock-bypass: one row per raw clock call the rule names'

begin_case 'new Date() in a TypeScript service is flagged'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/services/billing.ts 'const now = new Date();')"
expect_context '`new Date()` detected in production code (JS/TS)'

begin_case 'new DateTimeImmutable() in a PHP service is flagged'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/Service/Billing.php '$now = new \DateTimeImmutable();')"
expect_context '`new DateTime() / new DateTimeImmutable()` detected in production code (PHP)'

begin_case 'Carbon::now() in a PHP controller is flagged'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/Controller/Billing.php '$now = Carbon::now();')"
expect_context '`Carbon::now() / Carbon::today()` detected in production code (PHP)'

begin_case 'new Date() in a JavaScript service is flagged'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/services/billing.js 'const now = new Date();')"
expect_context '`new Date()` detected in production code (JS/TS)'

begin_case 'new DateTime() in a PHP service is flagged'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/Service/Billing.php '$now = new DateTime();')"
expect_context '`new DateTime() / new DateTimeImmutable()` detected in production code (PHP)'

begin_case 'Carbon::today() in a PHP controller is flagged'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/Controller/Billing.php '$today = Carbon::today();')"
expect_context '`Carbon::now() / Carbon::today()` detected in production code (PHP)'

begin_case 'an Edit introducing new Date() is flagged'
run_hook "$PLUGIN" "$CLOCK" "$(edit_call /work/app/src/services/billing.ts 'const now = clock.now();' 'const now = new Date();')"
expect_context '`new Date()` detected in production code (JS/TS)'

section 'warn-clock-bypass: the allowlist and near neighbours'

begin_case 'new Date() in a test file is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/billing.test.ts 'const now = new Date();')"
expect_silent

begin_case 'new Date() under tests/ is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/tests/billing.ts 'const now = new Date();')"
expect_silent

begin_case 'new Date() under test/ is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/test/billing.js 'const now = new Date();')"
expect_silent

begin_case 'new Date() under __tests__/ is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/__tests__/billing.ts 'const now = new Date();')"
expect_silent

begin_case 'new Date() in a .spec.ts file is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/billing.spec.ts 'const now = new Date();')"
expect_silent

begin_case 'new DateTime() in a *Test.php file is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/BillingTest.php '$now = new DateTime();')"
expect_silent

begin_case 'new DateTime() in a .test.php file is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/billing.test.php '$now = new DateTime();')"
expect_silent

begin_case 'new Date() in the clock implementation is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/infrastructure/SystemClock.ts 'return new Date();')"
expect_silent

begin_case 'new Date() under a clock/ directory is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/clock/system.ts 'return new Date();')"
expect_silent

begin_case 'new Date() in a value object is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/domain/value-objects/period.ts 'const start = new Date();')"
expect_silent

begin_case 'new Date() in a model is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/models/invoice.ts 'const issuedAt = new Date();')"
expect_silent

begin_case 'new Date() in a DTO is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/dto/invoice.ts 'const issuedAt = new Date();')"
expect_silent

begin_case 'new Date() in an entity is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/entity/invoice.ts 'const issuedAt = new Date();')"
expect_silent

begin_case 'new Date() in an entities directory is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/entities/invoice.ts 'const issuedAt = new Date();')"
expect_silent

begin_case 'new Date() in an enum is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/enums/status.ts 'const since = new Date();')"
expect_silent

begin_case 'new Date(timestamp) with an argument is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/src/services/billing.ts 'const at = new Date(timestamp);')"
expect_silent

begin_case 'a Markdown file mentioning new Date() is allowed'
run_hook "$PLUGIN" "$CLOCK" "$(write_call /work/app/docs/time-rules.md 'Never call new Date() in a service.')"
expect_silent

finish_suite
