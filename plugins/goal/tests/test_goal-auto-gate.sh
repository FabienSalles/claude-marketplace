#!/bin/bash
# Tests for scripts/goal-auto-gate.sh
# Usage: bash tests/test_goal-auto-gate.sh

set -u

GATE="$(cd "$(dirname "$0")/.." && pwd)/scripts/goal-auto-gate.sh"

PASS=0
FAIL=0

TMPROOT="$(mktemp -d)"
trap 'rm -rf "$TMPROOT"' EXIT

REPO=""
SPEC=""
STATE=""

# A fresh repo per case, shaped like a real one: the plan and the state file live in
# a gitignored .claude/, which is why neither shows up as a parasitic artifact.
mk_repo() {
  REPO="$TMPROOT/$1"
  SPEC="$REPO/.claude/plans/w-spec.md"
  STATE="$REPO/.claude/plans/w-auto-state"
  rm -rf "$REPO"
  mkdir -p "$REPO/src" "$REPO/.claude/plans"
  git -C "$REPO" init -q .
  git -C "$REPO" config user.email t@t.t
  git -C "$REPO" config user.name t
  printf '.claude/\n' > "$REPO/.gitignore"
  printf 'old\n' > "$REPO/src/existing.php"
  printf '## Functional iterations\n\n### Iteration 1\n- [ ] Not done yet\n' > "$SPEC"
  git -C "$REPO" add -A
  git -C "$REPO" commit -qm init
}

mk_state() {
  {
    printf 'spec=%s\n' "$SPEC"
    printf 'iteration=1\n'
    printf '%s\n' "$@"
  } > "$STATE"
}

spec_hash() {
  sed 's/^- \[x\]/- [ ]/' "$SPEC" | shasum | cut -d' ' -f1
}

# Runs the gate from inside the repo and reports its exit code.
run_gate() {
  ( cd "$REPO" && bash "$GATE" "$@" >"$TMPROOT/out" 2>&1 )
  printf '%s' "$?"
}

check() {
  local desc="$1" expected="$2" got="$3"
  if [ "$expected" = "$got" ]; then
    printf '  PASS  %s\n' "$desc"
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %s (expected exit %s, got %s)\n        output: %s\n' \
      "$desc" "$expected" "$got" "$(cat "$TMPROOT/out")"
    FAIL=$((FAIL + 1))
  fi
}

echo "== Green path =="

mk_repo green
mk_state 'iteration_files=src/existing.php' 'gate1=true'
printf 'new\n' > "$REPO/src/existing.php"
before=$(git -C "$REPO" status --porcelain -uall)
check "declared file changed, command exits 0" 0 "$(run_gate "$STATE")"
after=$(git -C "$REPO" status --porcelain -uall)
check "the gate mutated nothing" "$before" "$after"

mk_repo green_subtree
mk_state 'iteration_files=src/' 'gate1=true'
printf 'x\n' > "$REPO/src/added.php"
check "a declared subtree (trailing slash) covers a new file in it" 0 "$(run_gate "$STATE")"

mk_repo green_tick
mk_state "spec_hash=$(spec_hash)" 'iteration_files=src/existing.php' 'gate1=true'
sed -i.bak 's/^- \[ \]/- [x]/' "$SPEC" && rm -f "$SPEC.bak"
printf 'new\n' > "$REPO/src/existing.php"
check "ticking [x] does not trip the spec hash" 0 "$(run_gate "$STATE")"

echo
echo "== Failures that must halt =="

mk_repo failing_cmd
mk_state 'iteration_files=src/existing.php' 'gate1=true' 'gate2=false'
printf 'new\n' > "$REPO/src/existing.php"
check "a failing acceptance command halts" 1 "$(run_gate "$STATE")"

mk_repo leak
mk_state 'iteration_files=src/existing.php' 'gate1=true'
printf 'new\n' > "$REPO/src/existing.php"
printf 'leaked\n' > "$REPO/src/other.php"
git -C "$REPO" add src/other.php
check "a tracked file outside the declared list halts" 1 "$(run_gate "$STATE")"

mk_repo parasite
mk_state 'iteration_files=src/existing.php' 'gate1=true'
printf 'new\n' > "$REPO/src/existing.php"
printf 'junk\n' > "$REPO/debug.log"
check "an undeclared untracked artifact halts" 1 "$(run_gate "$STATE")"

mk_repo tampered
mk_state "spec_hash=$(spec_hash)" 'iteration_files=src/existing.php' 'gate1=true'
printf 'rewritten contract\n' >> "$SPEC"
check "rewriting the spec halts" 1 "$(run_gate "$STATE")"

mk_repo renamed
mk_state 'iteration_files=src/renamed.php' 'gate1=true'
git -C "$REPO" mv src/existing.php src/renamed.php
check "a rename whose source is undeclared halts" 1 "$(run_gate "$STATE")"

echo
echo "== A check that cannot run must never pass =="

mk_repo no_gate
mk_state 'iteration_files=src/existing.php'
printf 'new\n' > "$REPO/src/existing.php"
check "an iteration with no acceptance command halts" 1 "$(run_gate "$STATE")"

mk_repo no_dod
mk_state 'iteration_files=src/existing.php'
check "a global DoD with no check halts" 1 "$(run_gate "$STATE" --dod)"

mk_repo no_git
mk_state 'iteration_files=src/existing.php' 'gate1=true'
rm -rf "$REPO/.git"
check "git status failing halts instead of reporting success" 1 "$(run_gate "$STATE")"

echo
echo "== A state file that cannot be trusted =="

mk_repo no_files
mk_state 'gate1=true'
check "an empty declared list halts" 1 "$(run_gate "$STATE")"

mk_repo markdown_noise
mk_state 'iteration_files=`src/existing.php` (+ `src/new.php` (test))' 'gate1=true'
check "a declared list still carrying markdown halts" 1 "$(run_gate "$STATE")"

mk_repo glob_declared
mk_state 'iteration_files=src/**' 'gate1=true'
check "a glob in the declared list halts" 1 "$(run_gate "$STATE")"

mk_repo dupe_keys
mk_state 'iteration_files=src/existing.php' 'gate1=true' 'gate1=false'
printf 'new\n' > "$REPO/src/existing.php"
check "a state file appended instead of rewritten halts" 1 "$(run_gate "$STATE")"

echo
echo "== Global DoD =="

mk_repo dod_ok
mk_state 'dod1=true' 'dod2=true'
check "every DoD check green exits 0" 0 "$(run_gate "$STATE" --dod)"

mk_repo dod_ko
mk_state 'dod1=true' 'dod2=false'
check "a failing DoD check halts" 1 "$(run_gate "$STATE" --dod)"

echo
echo "== Misuse =="

mk_repo misuse
check "no argument exits 2" 2 "$(run_gate)"
check "an unreadable state file exits 2" 2 "$(run_gate "$REPO/absent")"
mk_state 'iteration_files=src/existing.php' 'gate1=true'
printf "spec=%s/absent.md\n" "$REPO" > "$STATE"
check "a state file pointing at no spec halts" 1 "$(run_gate "$STATE")"

echo
printf '\n%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
