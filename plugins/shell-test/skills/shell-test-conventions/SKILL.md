---
name: shell-test-conventions
description: "ACTIVATE when writing, reviewing or fixing a bash test suite (test-*.sh, test_*.sh) or a Claude Code hook test. ACTIVATE for 'shell test', 'bash suite', 'hook test', 'harness.sh', 'run_hook', 'begin_case', 'fake binary on PATH'. Covers the sourced harness API, hermetic cases, hooks run through hooks.json, stdout and stderr asserted apart, grep exit statuses, one row per pattern, near misses, zero-case refusal. DO NOT use for: node:test files (see node-test:node-test-conventions), the hook contract (see skills:plugin-conventions), bash 3.2 and BSD traps (see mac:mac-platform), a suite's sizes and wiring (see craft:test-suite-design), cross-language principles (see craft:testing-principles)."
---

# Test Conventions — bash suites and Claude Code hooks

> The **cross-language testing principles** (DAMP, AAA, spy over mock, what NOT to test, the level a rule is tested at) are defined in `craft:testing-principles`; a suite's size, where it runs and how it is wired, in `craft:test-suite-design`. This skill keeps the bash mechanics: one harness, hermetic cases, hooks run the way Claude Code runs them, assertions that can fail.

Examples that run: `references/harness.sh` (sourced, never executed) and, in the claude-marketplace repository, the suites that source it, for instance `bash plugins/security-runtime/tests/test_secret-file-guard.sh` and `bash plugins/common/tests/test-hooks.sh`.

## 1. What a bash suite is for

- A bash suite tests a shell program as a black box: a hook or a script, started through its real entry (the hooks.json command, the documented command line) and judged only on what can be observed: exit status, stdout, stderr, files written, calls a fake received.
- A hook or a script runs top to bottom on its stdin and argv, with no function a test could call in-process, so each row runs it once: the medium size of `craft:test-suite-design`.
- A check over the repository's own files (prose pins, doc anchors, manifest wiring) is not a shell program under test: write it in-process, in the repository's test language (TypeScript under node:test here; the marketplace's bash coherence suite predates this rule, and its move to node:test is tracked in [#111](https://github.com/FabienSalles/claude-marketplace/issues/111)). Why: the bash coherence harness spent about 7 s on 145 whole-tree greps (13 to 25 s under load) where an in-process prototype took 0.35 s, and grep's regex reading of literals, its newline alternation and its error exit let several of its assertions pass on nothing.
- The level a rule is tested at (an in-process function, the CLI, a golden file) is chosen with `craft:testing-principles`, not here.

## 2. The suite file

```bash
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

section 'Allowed: near neighbours of a credential file'

begin_case 'the committed .env stays readable'
run_hook "$PLUGIN" "$GUARD" "$(read_call /work/app/.env)"
expect_allowed

finish_suite
```

- Source the harness; never execute it, never copy its helpers into a suite. Why: before it existed, each suite re-implemented its own framework, and the repository ended up with three summary formats, four `run_case` signatures and no suite able to tell a run of zero cases from a green one.
- A plugin suite of this marketplace sources it as a sibling plugin, as above. In another repository, copy `references/harness.sh` next to the suites and source the copy: a CI runner has no plugin installed, and the installed path changes with every plugin update.
- `set -u`, never `set -e`: a program that exits non-zero would end the suite at the runner, silently, with no case line and no summary.
- Name the file `tests/test-<subject>.sh` beside what it tests, and wire it into exactly one check (`craft:test-suite-design`). In this marketplace, verify runs each suite as `bash <path>` (`/bin/bash <path>` on macOS) and accepts it only when its summary line reads at least one pass and 0 fail.
- One block per row (`begin_case`, arrange, act, assert), readable top to bottom: `craft:testing-principles` §4. Arrange steps and expectations many rows share become named helpers called in the row (`a_repository`, `expect_refused_by`); the act stays in the row, and there is no per-case setup hook. This is the bash form of a parameterized test (§7 there): bash has no data provider, and a table loop can lose rows without a trace (§8 here).
- The case name states the rule in domain words (`craft:testing-principles` §7): `'the committed .env stays readable'`, never `'case 3'`.
- `section` groups the rows by outcome: allowed, refused, near misses.
- A check the `expect_*` helpers do not cover ends in `fail_case` with the expected and the actual value, inside a case. A `fail_case` while no case is open (before the first `begin_case`, or after a `section` and before the next `begin_case`) is dropped, and the suite stays green.
- Files a suite creates go under `$CASE_DIR` or `$HARNESS_ROOT`. Never set a `trap ... EXIT` of your own: it replaces the harness's, and the temp root stays behind.
- The last line is `finish_suite`.

## 3. Harness API

Sourcing `references/harness.sh` (bash 3.2 or later, safe under `set -u`):

- stops the suite with exit 1 and `shell-test harness: jq is required ...` when jq is missing, so a missing parser never reads as an allowed call;
- creates `HARNESS_ROOT` with `mktemp -d "${TMPDIR:-/tmp}/shell-test.XXXXXX"`, resolves it with `pwd -P` (on macOS `/var` and `/tmp` are symlinks into `/private`, and a program prints the physical path), and removes it in its EXIT trap;
- exports `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1` and `GIT_CEILING_DIRECTORIES=$HARNESS_ROOT`: git reads no global or system config file, and a case directory sits outside any work tree until the case runs `git init`. It leaves `HOME` and the XDG variables as the developer set them; only the runners change `HOME` (§4).

| Cases | Behaviour |
|---|---|
| `section TITLE` | Closes the open case, prints `== TITLE` |
| `begin_case NAME` | Closes the open case and opens NAME: an empty `CASE_DIR` (the payload's `cwd`, the program's working directory), an empty `CASE_HOME` (the `HOME` of every runner), empty `CASE_STDOUT` and `CASE_STDERR` capture files, no `CASE_STATUS` yet |
| `fail_case MESSAGE` | Records MESSAGE as a failure of the open case |
| `finish_suite` | Closes the open case, prints `Total: N pass, M fail`; exits 1 when M > 0 or N = 0 (`no case ran, which proves nothing`), 0 otherwise |

| Payload builders | Event and tool |
|---|---|
| `bash_call COMMAND` | PreToolUse, Bash |
| `read_call ABS_PATH` | PreToolUse, Read; refuses a relative path, which Claude Code never sends |
| `grep_call PATTERN PATH GLOB` | PreToolUse, Grep; `''` leaves PATH or GLOB out |
| `write_call ABS_PATH CONTENT` | PreToolUse, Write |
| `edit_call ABS_PATH OLD NEW` | PreToolUse, Edit |
| `bash_result COMMAND STDOUT` | PostToolUse, Bash; `tool_response` is `{stdout, stderr, interrupted, isImage}` |
| `write_result ABS_PATH CONTENT` | PostToolUse, Write; `tool_response` is `{filePath, type}` |
| `session_start SOURCE` | SessionStart (`startup`, `resume`, ...) |

Each builder writes its payload with `jq -n` into a file under `HARNESS_ROOT` and prints the path. Every payload carries `session_id`, `transcript_path`, `cwd`, `permission_mode` and `hook_event_name`; its `cwd` is the open case's `CASE_DIR`, so call the builder inside `$( )` after `begin_case`.

| Runners | Behaviour |
|---|---|
| `run_hook PLUGIN_DIR SCRIPT PAYLOAD` | Looks in `PLUGIN_DIR/hooks/hooks.json`, under the payload's event, for a matcher that accepts its `tool_name` (its `source` for SessionStart) and a `type: command` entry whose command contains SCRIPT; fails the case when the payload file is missing or empty, hooks.json is unreadable, or no entry or several entries match; then runs that command as `run_hook_command` does |
| `run_hook_command PLUGIN_DIR COMMAND PAYLOAD` | `sh -c COMMAND` in the payload's `cwd`, with `CLAUDE_PLUGIN_ROOT=PLUGIN_DIR`, `HOME=$CASE_HOME` and stdin from the payload file |
| `run_in DIR CMD [ARG...]` | CMD in DIR with `HOME=$CASE_HOME` and stdin from `/dev/null` |

Each runner writes stdout to `CASE_STDOUT`, stderr to `CASE_STDERR` and the exit status to `CASE_STATUS`.

| Assertions | Fails the case when |
|---|---|
| `expect_status CODE` | The status differs; the message carries both channels |
| `expect_stdout_empty`, `expect_stderr_empty` | The channel is not empty |
| `expect_stdout_has TEXT`, `expect_stderr_has TEXT` | `grep -F -- TEXT` finds nothing (exit 1) or fails (2 or more); a TEXT holding a newline is refused |
| `expect_stdout_json [JQ_OPTION...] FILTER` | stdout is not exactly one JSON object, or `jq -e FILTER` yields false, null or an error |

Limits of `run_hook`: a matcher that is empty, `*` or absent matches everything; one made only of letters, digits, `_`, `-`, spaces, `,` and `|` is a list of exact names; anything else is an unanchored regex run by jq's `test()`, not by Claude Code's JavaScript RegExp (the same result on exact-name lists). Only tool events (PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, PermissionDenied) and SessionStart are routed. Shell-form commands only, no exec-form `args`, and the hooks.json `timeout` is not enforced. Everything else in the file (`harness_*` functions, the other `HARNESS_*` variables) is internal.

## 4. Hermetic cases

Each case gets its own directory, its own HOME inside the runners, and no global or system git config. The suite owns the rest:

- Outside the runners, the suite keeps the developer's HOME. An arrange step that runs git, or another program that reads HOME, gets `HOME=$CASE_HOME` in front, in a helper as in a row: `HOME=$CASE_HOME git -C "$CASE_DIR" add -- notes.txt`. Why: `GIT_CONFIG_GLOBAL=/dev/null` keeps out a config file, not `~/.config/git/ignore` or `~/.config/git/attributes`; a developer's `*.txt` ignore rule makes that `git add` refuse the file, and the row turns red on that machine alone.
- A path the suite spells itself is `$CASE_HOME/...`, never `~`: the suite's shell expands `~` from the developer's HOME before a `HOME=` prefix applies, so `HOME=$CASE_HOME mkdir ~/.claude` writes into the real HOME.
- A program that reads `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME` or `XDG_CACHE_HOME`, git included: unset them at the top of the suite, or set them per row in front of the runner (`XDG_CONFIG_HOME=$CASE_HOME/.config run_hook ...`). A set XDG variable takes precedence over HOME, so a developer's value bypasses the case HOME.
- A case that commits runs `git init -q -b main`, and the suite exports once, at its top, the author and committer identity and `maintenance.auto=false`. The variables, and why each one matters: `node-test:node-test-conventions` (its hermetic environment for git).
- A variable one row needs goes in front of its runner (`LC_ALL=C TZ=UTC run_hook ...`, `PATH="$HARNESS_ROOT/gnu-stat:$PATH" run_hook ...`): it reaches the program and ends with the call.
- A row that compares formatted output pins `LC_ALL=C` and `TZ=UTC` that way; a program that prints decimals also gets one row under a comma-decimal locale, where `printf %f` changes (`mac:mac-platform`).
- Any other directory is a fixed name under `$CASE_DIR`, or comes from `mktemp -d "$HARNESS_ROOT/name.XXXXXX"`: never a `$RANDOM` name (32768 values, collisions possible), never a bare `mktemp -d` (`mac:mac-platform`).
- Assert on what the case controls (its `CASE_DIR`, its `CASE_HOME`), never on the developer's real HOME: a red that depends on the machine says nothing about the program.

## 5. Feeding the program, capturing what it says

- Stdin is a file: the builders write the payload, `run_hook` and `run_hook_command` redirect it, `run_in` gives `/dev/null`. Never pipe a payload in (`printf ... | hook`): under pipefail the status can be printf's SIGPIPE rather than the hook's. A hook that reads stdin hangs in an interactive run when a test gives it none; the runners always give one.
- Trigger strings (an injection phrase, a credential file name) stay in the committed suite, run by path. In an agent session the live guards block an ad-hoc command that spells them out; never reshape a command to slip past a guard.
- A payload carries what production sends and nothing else: a tool the hook's matcher routes (`run_hook` fails the row otherwise), an absolute `file_path`, the event's documented field names. Build it with the builders, never by hand: the drizzle hook read `tool_result.stdout`, a field Claude Code never sends (it sends `tool_response`), so it never fired; a payload built from the documented shape catches that, a hand-guessed one repeats it.
- An event with no builder (`UserPromptSubmit`, `Stop`, `PostToolUse` on Edit) gets one in the harness (here `references/harness.sh`, elsewhere the repository's copy), written with `jq -n` like the others from the event's input fields: `skills:plugin-conventions` and the hooks reference it links.
- Capture stdout and stderr apart and assert both on every row. Why: the CLAUDE.md scanner's suite stayed green on merged `2>&1` output while the hook wrote its findings to stderr at exit 0, where Claude never sees them.
- An allowing row asserts status 0 and both channels empty. A refusing or warning row asserts its status, the text on the channel that carries the reason, and the other channel empty.

## 6. Matching output

- `expect_stdout_has` and `expect_stderr_has` match a literal (`grep -F --`), one line per call. grep reads a pattern holding a newline as "any one of these lines", so a two-line needle passes when one of its lines is present: assert each line on its own.
- A custom check matches a literal with `grep -F --`, and uses `-E` only for a regex meant as one. Read as a regex, a literal can miss its own text (a `*` repeats the character before it) or match more than it says (a BRE `.` matches any character); how `**` breaks BSD and GNU grep differently is in `mac:mac-platform`. `--` stops a needle that starts with `-` from reading as an option.
- Branch on grep's status explicitly: 0 found, 1 absent, 2 or more an error that fails the case. `if grep -q ...; then fail; else pass` reads a missing file or an unsupported flag as "absent". Check that a target exists before asserting it lacks something: `git grep` exits 1, not 2, on a path that does not exist.
- In a helper, declare the local first and assign it on its own line: `local out=$(cmd)` returns the status of `local`, not of `cmd`.
- JSON output goes through `expect_stdout_json` and a jq filter, never a grep over its text: `expect_stdout_json --arg text "$1" '.hookSpecificOutput.additionalContext | contains($text)'`. Plain-text stdout goes through `expect_stdout_has`, since `expect_stdout_json` refuses anything but one object.

## 7. Hooks: through hooks.json, against the contract

- The hook contract (stdin fields per event, what exit 0, exit 2 and any other status do, which channel each event reads, JSON built with an encoder, PreToolUse's `hookSpecificOutput.permissionDecision` and the deprecated top-level `decision`/`reason`) is owned by `skills:plugin-conventions`. A row asserts that contract; this skill never restates it.
- Run a wired hook with `run_hook`, never by calling its script. It takes the route Claude Code takes: event, matcher, then the declared command through `sh -c` with `CLAUDE_PLUGIN_ROOT` set. A direct call stays green when the matcher loses a tool, and runs the script under the test's bash rather than the interpreter production uses (its shebang, or the program the command names).
- A hook with no plugin hooks.json entry (wired by hand, or declared in a settings file) runs through `run_hook_command` and its exact configured command (`plugins/tooling/tests/test-fix-drizzle-journal-timestamp.sh`); so does a hook on an event `run_hook` does not route (§3), with the command its hooks.json declares. A variable that command reads besides `CLAUDE_PLUGIN_ROOT`, such as `CLAUDE_PROJECT_DIR`, goes in front of the call.

## 8. Rows that can fail

- One row per pattern, on an input only that pattern catches, asserting the name of the pattern that fired. Why: with rows that pinned the patterns as a group, 28 of the 43 patterns of three hooks could be deleted with every suite green.
- A row reaches its rule only through the alternative it is named for. `git --git-dir /work/app/.git commit` matched through the path's `.git commit`, the plain spelling, and stayed green with the `--git-dir` alternative deleted: quote such a path (`--git-dir "/work/app/.git"`), so that only the `--git-dir` alternative can match.
- Near misses in both directions. Spellings a rule must still catch: git global options (`-C`, `-c name=value`, `--no-pager`, `--git-dir`), chained commands (`&&`, `;`, `cd dir &&`), case variants (APFS opens `.ENV.LOCAL` as `.env.local`), Grep globs. Neighbours it must leave alone: the trigger words outside a command position (`git log --grep 'Co-Authored-By: Claude'`), a file merely named like a secret (`environment.ts`), the same command where the rule does not apply (a move outside any work tree).
- A branch only one platform takes gets a row that drives it on every platform, with the other platform's tool faked first on PATH: the fetch-first suite's GNU-style `stat` runs its GNU branch on macOS too. The macOS CI leg itself: `tooling:github-actions-conventions`.
- Prove each new row bites once: break the rule it pins (delete the pattern, change the exit status) in a scratch copy of the program and its suite (here, of the plugin and of `plugins/shell-test`, which the suite sources as a sibling), see the rows that pin that rule turn red and every other row stay green, then discard the copy. The method beyond this one break, and what makes a red the right one, is [#159](https://github.com/FabienSalles/claude-marketplace/issues/159)'s.
- `finish_suite` refuses a run of zero cases; it cannot see a loop that ran fewer rows than were written. Keep rows explicit. A table loop, if any, reads its rows on fd 3 (`while IFS='|' read -r name expected input <&3; do ...; done 3<<'ROWS'`): a command in the body that reads stdin swallows the rest of the table, and a reproduction ran 1 row of 3 and ended green. Never pipe a table into `while`: the loop runs in a subshell, and the harness counters it updates are lost.

## 9. Fake binaries on PATH

- Write each fake (a stub `npm`, `git`, `stat`) once per suite under `$HARNESS_ROOT/bin`, or commit it under `tests/`, and put that directory first on PATH for the run. A case that needs the fake in a directory of its own gets an `ln -s` to it, and removes that link before writing a different fake in its place, since a write through the link rewrites the fake every case shares. Why once, and why a link: `craft:test-suite-design` §3 and `mac:mac-platform`.
- A fake appends its argv to a log the case owns, and the case reads the log after the act: a spy, `craft:testing-principles` §6. When to replace a process with a double at all, and contract suites for those doubles, belong to [#160](https://github.com/FabienSalles/claude-marketplace/issues/160).

```bash
mkdir -p "$HARNESS_ROOT/bin"
cat >"$HARNESS_ROOT/bin/npm" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >>"$FAKE_CALLS"
EOF
chmod +x "$HARNESS_ROOT/bin/npm"

expect_called() {
  if [ ! -f "$CASE_DIR/calls" ]; then
    fail_case 'the fake was never called'
    return 0
  fi
  grep -qxF -- "$1" "$CASE_DIR/calls"
  case $? in
    0) ;;
    1) fail_case "no call '$1'; calls were: $(cat "$CASE_DIR/calls")" ;;
    *) fail_case "grep failed reading $CASE_DIR/calls" ;;
  esac
}

begin_case 'each test file runs on its own'
run_in "$CASE_DIR" env PATH="$HARNESS_ROOT/bin:$PATH" FAKE_CALLS="$CASE_DIR/calls" bash "$SCRIPT" a.test.ts b.test.ts
expect_status 0
expect_stdout_empty
expect_stderr_empty
expect_called 'test -- a.test.ts'
expect_called 'test -- b.test.ts'
```

## 10. bash 3.2

- Write a suite for bash 3.2, like the hooks it tests: a hook started through its `#!/bin/bash` shebang runs under it on every Mac, and so does `bash` on the macOS CI image. The traps, and how to check a script under 3.2, are in `mac:mac-platform`. Why: the coherence harness once failed to parse under bash 3.2 while CI on bash 5 stayed green.

## Quick Reference

| Rule | Principle |
|------|-----------|
| Scope | A shell program as a black box, through its real entry; checks over the repository's files go in-process |
| One harness | Source `references/harness.sh` (copy it into another repository); never re-implement its helpers |
| Suite file | `#!/bin/bash`, `set -u` and never `set -e`, no EXIT trap of its own, `finish_suite` last |
| Rows | One explicit block per row, named for the rule in domain words, grouped by `section` |
| Custom checks | `fail_case` with the expected and the actual value, inside an open case |
| Hermetic | Per-case `CASE_DIR` and `CASE_HOME`; `HOME=$CASE_HOME` in front of an arrange step that runs git or reads HOME; XDG unset; `-b main`, identity and no maintenance when a case commits |
| Stdin | A payload file from the builders, shaped like production's; never a pipe |
| Channels | stdout and stderr captured apart, both asserted on every row |
| Matching | `grep -F --`, `-E` only on purpose, exit 0/1/2+ branched, one line per pattern; JSON through `expect_stdout_json` |
| Hooks | `run_hook` through hooks.json, `run_hook_command` for an event it does not route; the contract is owned by `skills:plugin-conventions` |
| Rows that bite | One row per pattern, near misses both ways, a platform branch driven everywhere, each new row broken once ([#159](https://github.com/FabienSalles/claude-marketplace/issues/159)) |
| Zero cases | Refused by `finish_suite`; a table loop reads fd 3 |
| Fakes | Written once, linked not copied, argv logged and read after the act ([#160](https://github.com/FabienSalles/claude-marketplace/issues/160)) |
| bash 3.2 | A suite runs where its hooks run; traps and the 3.2 check in `mac:mac-platform` |
