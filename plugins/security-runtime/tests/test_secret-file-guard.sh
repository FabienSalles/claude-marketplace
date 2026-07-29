#!/bin/bash
# Tests for hooks/scripts/secret-file-guard.sh
# Usage: bash tests/test_secret-file-guard.sh

set -u

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/hooks/scripts/secret-file-guard.sh"

PASS=0
FAIL=0

# run_case <expected_exit> <description> <json_payload>
run_case() {
  local expected="$1" desc="$2" payload="$3"
  local out actual
  out=$(printf '%s' "$payload" | bash "$SCRIPT" 2>&1)
  actual=$?
  if [ "$actual" = "$expected" ]; then
    printf '  PASS  %s\n' "$desc"
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %s (expected exit %s, got %s)\n        output: %s\n' "$desc" "$expected" "$actual" "$out"
    FAIL=$((FAIL + 1))
  fi
}

bash_payload() {
  printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$(printf '%s' "$1" | jq -Rs .)"
}

read_payload() {
  printf '{"tool_name":"Read","tool_input":{"file_path":%s}}' "$(printf '%s' "$1" | jq -Rs .)"
}

echo "== Negative cases (should allow, exit 0) =="
run_case 0 "empty input"              ''
run_case 0 "unrelated tool"           '{"tool_name":"Write","tool_input":{"file_path":".env.local"}}'
run_case 0 "read a normal source file" "$(read_payload 'src/Controller/HomeController.php')"
run_case 0 "read the committed .env"  "$(read_payload '.env')"
run_case 0 "grep APP_ENV in .env"     "$(bash_payload 'grep -n "^APP_ENV" .env')"
run_case 0 "git status"               "$(bash_payload 'git status --short')"
run_case 0 "a file merely named environment.ts" "$(read_payload 'src/config/environment.ts')"

echo
echo "== Positive cases (should block, exit 2) =="
run_case 2 "Read .env.local"          "$(read_payload '.env.local')"
run_case 2 "Read a scoped .env local" "$(read_payload 'apps/api/.env.prod.local')"
run_case 2 "Read an ssh private key"  "$(read_payload '/Users/someone/.ssh/id_rsa')"
run_case 2 "Read a composer auth.json" "$(read_payload '/Users/someone/.composer/auth.json')"
run_case 2 "Read a TLS key"           "$(read_payload 'certs/server.pem')"
run_case 2 "cat .env.local"           "$(bash_payload 'cat .env.local')"
run_case 2 "grep through .env.local"  "$(bash_payload 'grep -v "^#" .env.local | head')"
run_case 2 "sed over .env.local"      "$(bash_payload 'sed -n "1,5p" .env.local')"
run_case 2 "cat an ed25519 key"       "$(bash_payload 'cat ~/.ssh/id_ed25519')"
run_case 2 "read an .npmrc"           "$(read_payload '/Users/someone/.npmrc')"
run_case 2 "Grep scoped to .ssh"      '{"tool_name":"Grep","tool_input":{"pattern":"BEGIN","path":"/Users/someone/.ssh/"}}'

echo
printf '\nTotal: %d pass, %d fail\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
