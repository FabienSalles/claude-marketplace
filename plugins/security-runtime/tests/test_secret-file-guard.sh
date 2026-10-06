#!/bin/bash

set -u

PLUGIN=$(cd "$(dirname "$0")/.." && pwd)
. "$PLUGIN/../shell-test/skills/shell-test-conventions/references/harness.sh"

GUARD=secret-file-guard.sh

expect_allowed() {
  expect_status 0
  expect_stdout_empty
  expect_stderr_empty
}

expect_refused_by() {
  expect_status 2
  expect_stdout_empty
  expect_stderr_has 'BLOCKED by security-runtime/secret-file-guard'
  expect_stderr_has "($1)"
}

section 'Allowed: near neighbours of a credential file'

begin_case 'a source file stays readable'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/src/Controller/HomeController.php)"
expect_allowed

begin_case 'the committed .env stays readable'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/.env)"
expect_allowed

begin_case 'grepping APP_ENV in the committed .env is allowed'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'grep -n "^APP_ENV" .env')"
expect_allowed

begin_case 'git status is allowed'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'git status --short')"
expect_allowed

begin_case 'a file merely named environment.ts stays readable'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/src/config/environment.ts)"
expect_allowed

begin_case 'a direnv .envrc stays readable'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/.envrc)"
expect_allowed

begin_case 'a Grep over TypeScript files is allowed'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'TODO' /work/app '*.ts')"
expect_allowed

begin_case 'a Grep restricted to the committed .env.example is allowed'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'API_URL' /work/app '.env.example')"
expect_allowed

section 'Refused: one row per credential pattern, on an input only that pattern catches'

begin_case 'Read of a local env file is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/.env.local)"
expect_refused_by '\.env\.local'

begin_case 'Read of a scoped local env file is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/apps/api/.env.prod.local)"
expect_refused_by '\.env\.[A-Za-z0-9_-]+\.local'

begin_case 'Read of a composer auth.json is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /home/dev/.composer/auth.json)"
expect_refused_by '(^|/)auth\.json'

begin_case 'Read of a TLS key is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/certs/server.pem)"
expect_refused_by '\.pem($|[^A-Za-z0-9])'

begin_case 'Read of an RSA key outside .ssh is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/deploy/id_rsa)"
expect_refused_by '(^|/)id_rsa'

begin_case 'Read of an ed25519 key outside .ssh is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/deploy/id_ed25519)"
expect_refused_by '(^|/)id_ed25519'

begin_case 'Read of an .npmrc is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /home/dev/.npmrc)"
expect_refused_by '(^|/)\.npmrc'

begin_case 'Read of a .pgpass is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /home/dev/.pgpass)"
expect_refused_by '(^|/)\.pgpass'

begin_case 'Read of an ssh client config is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /home/dev/.ssh/config)"
expect_refused_by '(^|/)\.ssh/'

begin_case 'Read of a credentials.json is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/credentials.json)"
expect_refused_by '(^|/)credentials\.json'

begin_case 'Read of a .netrc is refused'
run_hook "$PLUGIN" "$GUARD" "$(read_call /home/dev/.netrc)"
expect_refused_by '(^|/)\.netrc'

section 'Refused: the same files reached through Bash and Grep'

begin_case 'cat of a local env file is refused'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'cat .env.local')"
expect_refused_by '\.env\.local'

begin_case 'a grep through a local env file is refused'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'grep -v "^#" .env.local | head')"
expect_refused_by '\.env\.local'

begin_case 'a sed over a local env file is refused'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'sed -n "1,5p" .env.local')"
expect_refused_by '\.env\.local'

begin_case 'cat of an ed25519 key under .ssh is refused'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'cat ~/.ssh/id_ed25519')"
expect_refused_by '(^|/)id_ed25519'

begin_case 'a Grep scoped to .ssh is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'BEGIN' /home/dev/.ssh/ '')"
expect_refused_by '(^|/)\.ssh/'

section 'Refused: near misses of the same rules'

begin_case 'an upper-case spelling of a local env file is refused, APFS opens the same file'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/.ENV.LOCAL)"
expect_refused_by '\.env\.local'

begin_case 'cat of a mixed-case key name is refused'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'cat deploy/ID_RSA')"
expect_refused_by '(^|/)id_rsa'

begin_case 'a Grep glob naming a local env file is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'API_KEY' /work/app '**/.env.local')"
expect_refused_by '\.env\.local'

begin_case 'a local env file read after a chained cd is refused'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'cd /work/app && cat .env.local')"
expect_refused_by '\.env\.local'

begin_case 'a TLS key passed to openssl is refused'
run_hook "$PLUGIN" "$GUARD" "$(bash_call 'openssl x509 -in certs/server.pem -noout -text')"
expect_refused_by '\.pem($|[^A-Za-z0-9])'

begin_case 'a Grep glob naming auth.json, with no path, is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'token' '' 'auth.json')"
expect_refused_by '(^|/)auth\.json'

begin_case 'a Grep glob naming an RSA key, with no path, is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'BEGIN' '' 'id_rsa*')"
expect_refused_by '(^|/)id_rsa'

begin_case 'a Grep glob naming an ed25519 key, with no path, is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'BEGIN' '' 'id_ed25519*')"
expect_refused_by '(^|/)id_ed25519'

begin_case 'a Grep glob naming .npmrc, with no path, is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call '_authToken' '' '.npmrc')"
expect_refused_by '(^|/)\.npmrc'

begin_case 'a Grep glob naming .pgpass, with no path, is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'prod' '' '.pgpass')"
expect_refused_by '(^|/)\.pgpass'

begin_case 'a Grep glob under .ssh/, with no path, is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'Host' '' '.ssh/*')"
expect_refused_by '(^|/)\.ssh/'

begin_case 'a Grep glob naming credentials.json, with no path, is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'client_secret' '' 'credentials.json')"
expect_refused_by '(^|/)credentials\.json'

begin_case 'a Grep glob naming .netrc, with no path, is refused'
run_hook "$PLUGIN" "$GUARD" "$(grep_call 'machine' '' '.netrc')"
expect_refused_by '(^|/)\.netrc'

finish_suite
