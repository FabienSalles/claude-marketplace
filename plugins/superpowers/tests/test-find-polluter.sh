#!/bin/bash
# Tests for skills/systematic-debugging/find-polluter.sh
# Usage: bash tests/test-find-polluter.sh

set -u

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/skills/systematic-debugging/find-polluter.sh"

PASS=0
FAIL=0
LAST_OUT=""

TMPROOT="$(mktemp -d)"
trap 'rm -rf "$TMPROOT"' EXIT

# Fake `npm` on PATH: `npm test <file>` pollutes .git only for the file
# whose name contains "dirty".
mkdir -p "$TMPROOT/bin"
cat > "$TMPROOT/bin/npm" <<'EOF'
#!/bin/bash
if [[ "$*" == *dirty* ]]; then
  touch "$PWD/.git"
fi
exit 0
EOF
chmod +x "$TMPROOT/bin/npm"

# run_case <desc> <expected_exit> <pattern>
run_case() {
  local desc="$1" expected="$2" pattern="$3"
  local repo out actual
  repo="$TMPROOT/repo-$RANDOM"
  mkdir -p "$repo/src/a" "$repo/src/b"
  printf 'console.log("clean")\n' > "$repo/src/a/clean.test.ts"
  printf 'console.log("dirty")\n' > "$repo/src/b/dirty.test.ts"

  out=$(cd "$repo" && PATH="$TMPROOT/bin:$PATH" bash "$SCRIPT" '.git' "$pattern" 2>&1)
  actual=$?
  if [ "$actual" != "$expected" ]; then
    printf '  FAIL  %s (expected exit %s, got %s)\n        output: %s\n' "$desc" "$expected" "$actual" "$out"
    FAIL=$((FAIL + 1))
    return
  fi
  printf '  PASS  %s\n' "$desc"
  PASS=$((PASS + 1))
  LAST_OUT="$out"
}

echo "== Finds the polluter =="
# Documented invocation, plugins/superpowers/skills/systematic-debugging/root-cause-tracing.md:104
run_case "polluter test is named, exit non-zero" 1 'src/**/*.test.ts'
if ! printf '%s' "$LAST_OUT" | grep -q 'dirty.test.ts'; then
  printf '  FAIL  polluter test named in output\n        output: %s\n' "$LAST_OUT"
  FAIL=$((FAIL + 1))
else
  printf '  PASS  polluter test named in output\n'
  PASS=$((PASS + 1))
fi

echo
echo "== Fails loudly on a glob matching no test =="
run_case "no matching test file, exit non-zero" 1 'src/**/*.nomatch.ts'

printf '\nTotal: %d pass, %d fail\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
