#!/bin/bash
# ─────────────────────────────────────────────
# Run one iteration of a locked goal plan
#
# Implements the named iteration through `claude -p`, then hands the tree to the gate, which
# is the only thing that commits. The script orders and reports; it never judges.
#
# It is a shell script rather than a workflow because a workflow has no shell: there, every
# `sed` and every `git status` crosses through a subagent, which is simultaneously the run's
# latency and its notification flood. Here a command is a command.
#
# Written for /bin/bash 3.2, the version macOS forces: no mapfile, no ${var,,}, no associative
# arrays.
#
# Usage:
#   goal-run.sh <plan> <iteration>
#
# Environment:
#   GOAL_GATE  how to invoke the gate (default: node <this dir>/goal-gate.ts)
#
# Exit codes:
#   0 — the iteration landed, gate-verified
#   1 — halted: the gate refused the work
#   2 — refused: the run never started, and nothing needs undoing
#   3 — paused: a clean boundary, relaunch resumes here
# ─────────────────────────────────────────────

set -uo pipefail

LANDED=0
HALTED=1
REFUSED=2
PAUSED=3

log=""

# Every line declares which of the three states the run is in, because a run that merely prints
# is a run you have to read to find out whether it is alive. Subprocess output is captured, never
# echoed raw, so the account stays machine-readable — a halt quotes the gate inside its own block.
say() {
  printf '%s\n' "$1"

  if [ -n "$log" ]; then
    printf '%s\n' "$1" >> "$log"
  fi
}

stop() {
  say "STOP $1"
  exit "$2"
}

plan="${1:-}"
iteration="${2:-}"

if [ -z "$plan" ] || [ -z "$iteration" ]; then
  say "STOP usage: goal-run.sh <plan> <iteration>"
  exit "$REFUSED"
fi

if [ ! -f "$plan" ]; then
  say "STOP the plan is not readable: $plan"
  exit "$REFUSED"
fi

case "$iteration" in
  '' | *[!0-9]*)
    say "STOP the iteration must be a number, got: $iteration"
    exit "$REFUSED"
    ;;
esac

here=$(cd "$(dirname "$0")" && pwd)
GATE="${GOAL_GATE:-node $here/goal-gate.ts}"

log="$plan.run.log"

say "RUN iteration $iteration of $(basename "$plan"), in $(pwd)"

# The hash is published here and carried to the commit call unchanged. Recomputing it there
# would bless a plan that moved between the two, which is the one thing it exists to catch.
checked=$($GATE check "$plan" "$iteration" 2>&1)

if [ $? -ne 0 ]; then
  say "STOP the gate will not run iteration $iteration, so nothing was attempted:"
  say "$checked"
  exit "$REFUSED"
fi

hash=$(printf '%s\n' "$checked" | sed -n 's/^plan_hash=\([0-9a-f]*\)$/\1/p' | head -1)

if [ -z "$hash" ]; then
  say "STOP the gate published no plan_hash, so nothing locks the contract:"
  say "$checked"
  exit "$REFUSED"
fi

locked=""

# A crash is not an exit path anyone writes, which is why it is the one that leaked the lock on a
# real run. INT and TERM are what a developer and a supervisor send; EXIT covers everything else.
release() {
  if [ -n "$locked" ]; then
    locked=""
    $GATE unlock "$plan" >/dev/null 2>&1
  fi
}

trap release EXIT INT TERM

if ! $GATE lock "$plan" >/dev/null 2>&1; then
  say "STOP another run holds this plan. Wait for it, or free it with: $GATE unlock $plan"
  exit "$REFUSED"
fi

locked="yes"

# The section travels as text and the plan's path does not travel at all. Handing that path over
# is what made a real run read the plan in another checkout, take its parent as the repository
# root, and write the whole iteration into the wrong tree with a correct cwd throughout.
section=$(sed -n "/^### Iteration $iteration /,/^### Iteration /p" "$plan")

if [ -z "$section" ]; then
  stop "iteration $iteration has no section in the plan, so there is nothing to implement" "$REFUSED"
fi

brief="Implement iteration $iteration of a plan somebody else locked.

You are working in $(pwd), on branch $(git rev-parse --abbrev-ref HEAD 2>/dev/null). Every path
you read or write lives inside that tree.

The iteration, verbatim from the plan. Its goal, the files to touch, the business rules it
covers, every decision bullet and its gate block.

--- iteration ---
$section
--- end ---

Work test-first, and show the RED: the gate sets your implementation aside and requires gate1 to
fail without it, so a test that passes either way halts the slice.

Load the project convention skills before writing anything.

You do not commit, do not push, do not stage, do not tick a checkbox and do not edit the plan.
The gate does all of that, after it has verified."

head_before=$(git rev-parse HEAD 2>/dev/null || printf 'none')

say "RUN handing iteration $iteration to the implementer"

implemented=$(claude -p --agent goal:goal-run-implementer --permission-mode auto "$brief" 2>&1)
implementer_exit=$?

if [ -n "$implemented" ]; then
  printf '%s\n' "$implemented" >> "$log"
fi

if [ "$implementer_exit" -ne 0 ]; then
  stop "the implementer exited $implementer_exit. The tree holds whatever it wrote and no gate has judged it: review it before relaunching." "$PAUSED"
fi

head_after=$(git rev-parse HEAD 2>/dev/null || printf 'none')
touched=$(git status --porcelain)

# An implementer that commits also leaves a clean tree, so a check reading only `git status` calls
# it "wrote nothing" about work that is right there in HEAD. Asking HEAD is what tells the two
# apart, and the difference matters: one says the work is missing, the other says it exists and
# broke the rule that only the gate commits.
if [ "$head_after" != "$head_before" ]; then
  stop "the implementer committed on its own, which only the gate may do. HEAD moved from $head_before to $head_after. Nothing was gate-verified: review that commit before relaunching." "$PAUSED"
fi

if [ -z "$touched" ]; then
  stop "the implementer wrote nothing in this tree, so no verdict was asked for. The usual cause is a path that left the tree: look for the work in another checkout before assuming it does not exist." "$PAUSED"
fi

say "RUN the tree moved, asking the gate for a verdict"

verdict=$($GATE commit "$plan" "$iteration" "$hash" 2>&1)
gate_exit=$?

if [ -n "$verdict" ]; then
  printf '%s\n' "$verdict" >> "$log"
fi

# The gate exits 0 for a pass and 1 for a halt. Anything else means it never really ran, and
# calling that a refusal reports a verdict nobody reached — on the only channel someone asleep has.
if [ "$gate_exit" -eq 0 ]; then
  release
  say "STOP iteration $iteration landed, gate-verified"
  exit "$LANDED"
fi

if [ "$gate_exit" -ne 1 ]; then
  say "STOP the gate could not be run (exit $gate_exit), so no verdict exists. The tree holds whatever the implementer wrote and nothing was committed."
  say "$verdict"
  exit "$PAUSED"
fi

release
say "STOP iteration $iteration was refused by the gate. Nothing was committed, and the tree is left exactly as the implementer left it."
say "$verdict"
exit "$HALTED"
