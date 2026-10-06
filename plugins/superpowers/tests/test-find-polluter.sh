#!/bin/bash

set -u

PLUGIN=$(cd "$(dirname "$0")/.." && pwd)
. "$PLUGIN/../shell-test/skills/shell-test-conventions/references/harness.sh"

SCRIPT="$PLUGIN/skills/systematic-debugging/find-polluter.sh"

mkdir -p "$HARNESS_ROOT/bin"
cat >"$HARNESS_ROOT/bin/npm" <<'EOF'
#!/bin/bash
if [[ "$*" == *dirty* ]]; then
  touch "$PWD/.git"
fi
exit 0
EOF
chmod +x "$HARNESS_ROOT/bin/npm"

a_clean_and_a_dirty_test() {
  mkdir -p "$CASE_DIR/src/a" "$CASE_DIR/src/b"
  printf 'console.log("clean")\n' >"$CASE_DIR/src/a/clean.test.ts"
  printf 'console.log("dirty")\n' >"$CASE_DIR/src/b/dirty.test.ts"
}

section 'Finds the polluter'

begin_case 'the invocation documented in root-cause-tracing.md names the polluting test and exits non-zero'
a_clean_and_a_dirty_test
run_in "$CASE_DIR" env PATH="$HARNESS_ROOT/bin:$PATH" bash "$SCRIPT" '.git' 'src/**/*.test.ts'
expect_status 1
expect_stdout_has 'Test: ./src/b/dirty.test.ts'

begin_case 'a pattern selecting only the clean test reports no polluter and exits zero'
a_clean_and_a_dirty_test
run_in "$CASE_DIR" env PATH="$HARNESS_ROOT/bin:$PATH" bash "$SCRIPT" '.git' 'src/a/*.test.ts'
expect_status 0
expect_stdout_has 'No polluter found'

section 'Fails loudly on a glob matching no test'

begin_case 'a glob matching no test file exits non-zero and says so'
a_clean_and_a_dirty_test
run_in "$CASE_DIR" env PATH="$HARNESS_ROOT/bin:$PATH" bash "$SCRIPT" '.git' 'src/**/*.nomatch.ts'
expect_status 1
expect_stdout_has 'No test file matches pattern: src/**/*.nomatch.ts'

finish_suite
