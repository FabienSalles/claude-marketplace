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
#   goal-run.sh <plan> [iteration]
#
# With <iteration> given, that one alone runs — the form that makes a halted plan resumable
# by hand. Omitted, the plan's unchecked boxes are surveyed and run in order, stopping dead
# at the first one the gate refuses.
#
# Environment:
#   GOAL_GATE  how to invoke the gate (default: node <this dir>/goal-gate.ts)
#
# Exit codes:
#   0 — every iteration attempted landed, gate-verified
#   1 — halted: the gate refused one of them
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

if [ -z "$plan" ]; then
  say "STOP usage: goal-run.sh <plan> [iteration]"
  exit "$REFUSED"
fi

if [ ! -f "$plan" ]; then
  say "STOP the plan is not readable: $plan"
  exit "$REFUSED"
fi

if [ -n "$iteration" ]; then
  case "$iteration" in
    '' | *[!0-9]*)
      say "STOP the iteration must be a number, got: $iteration"
      exit "$REFUSED"
      ;;
  esac
fi

here=$(cd "$(dirname "$0")" && pwd)
GATE="${GOAL_GATE:-node $here/goal-gate.ts}"

log="$plan.run.log"

# The conditions below are the ones `/goal:auto`'s own preflight names in commands/auto.md that
# a shell script can prove without a model's judgment and without a pull request already open —
# that half of the list (`gh` reachable on the declared remote, and everything after) lands with
# the iteration that opens one. Every check is a refusal, never a warning, and every one runs
# before the lock is taken: a run that starts wrong is worse than one that never starts.
preflight() {
  plan_base=$(basename "$plan")

  case "$plan_base" in
    *-cleanup-spec.md) work_id=${plan_base%-cleanup-spec.md}; cleanup=1 ;;
    *-spec.md)         work_id=${plan_base%-spec.md}; cleanup=0 ;;
    *)                 work_id=${plan_base%.md}; cleanup=0 ;;
  esac

  # 1. Policy — unattended execution needs somewhere to put the work; manual means nothing may
  # be committed, so there is nothing here to chain.
  policy=$(sed -n 's/^Policy: *//p' "$plan" | head -1)
  case "$policy" in
    '') stop "the plan declares no Policy line" "$REFUSED" ;;
    manual)
      stop "Policy is manual, so nothing may be committed and there is nothing to run unattended. Change the Policy line in the spec, or run the manual loop with /goal and /goal:next." "$REFUSED"
      ;;
  esac

  # 2. Remote — never defaulted to origin. A bare push on a fork lands on the fork; guessing here
  # means a run pushes and opens its pull request on somebody else's repository, unattended.
  remote=$(sed -n 's/^Remote: *//p' "$plan" | head -1)
  [ -n "$remote" ] || stop "the plan declares no Remote line" "$REFUSED"

  # 3. Branch — the checkout must stand on the branch this run is meant to advance, or it
  # publishes the wrong one.
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || stop "not a git repository" "$REFUSED"
  case "$branch" in
    "feature/$work_id" | "feature/$work_id"-*) : ;;
    *)
      stop "the checkout stands on $branch, not feature/$work_id (or feature/$work_id-...)" "$REFUSED"
      ;;
  esac

  # 4. Clean tree — uncommitted work would end up in the first iteration's commit, unreviewed.
  dirty=$(git status --short 2>&1)
  [ -z "$dirty" ] || stop "the tree is not clean:
$dirty" "$REFUSED"

  # 5. What the run writes must be out of git's sight, or the spec, the ticked box and this
  # run's own log become an undeclared modification the gate reads as a scope leak.
  plan_dir=$(dirname "$plan")
  git check-ignore -q "$plan_dir" ||
    stop "the plan's directory is visible to git: $plan_dir. Ignore it, untracking any spec already committed." "$REFUSED"

  # 6. No cleanup iteration hiding inside a feature plan: its Trigger asserts something about
  # production this run cannot observe, and running it here deletes the fallback in the same PR
  # that introduces what falls back to it.
  if [ "$cleanup" -eq 0 ] && grep -q '\*\*Trigger:\*\*' "$plan"; then
    stop "the plan carries a cleanup iteration (a Trigger: line) inside a feature plan. Move it out with /goal:run-issue, or run the *-cleanup-spec.md plan directly." "$REFUSED"
  fi

  # 7. No run already holds the plan.
  [ -e "$plan.run.lock" ] &&
    stop "another run holds this plan: $plan.run.lock. Wait for it, or free it with: $GATE unlock $plan" "$REFUSED"

  # 8. The base is already green — the highest-return check in the whole preflight. Every
  # command the plan will hold every iteration to, run once now, against the untouched tree.
  # gate1 is excluded: it is the bitten criterion, supposed to fail without the implementation.
  bootstrap=$(sed -n 's/^Bootstrap: *//p' "$plan" | head -1)
  skip_sweep=0

  if [ -n "$bootstrap" ]; then
    bootstrap_checked=$(awk -v want="$bootstrap" '
      /^#{2,3} / { cur = ""; seen = 0 }
      /^### Iteration [0-9]+/ { n = $0; sub(/^### Iteration /, "", n); sub(/[^0-9].*/, "", n); cur = n }
      cur == want && seen == 0 && /^- \[/ { seen = 1; print ($0 ~ /^- \[x\]/) ? "yes" : "no" }
    ' "$plan")
    [ "$bootstrap_checked" = "yes" ] || skip_sweep=1
  fi

  if [ "$skip_sweep" -eq 1 ]; then
    say "RUN base sweep skipped: Bootstrap iteration $bootstrap is not built yet"
  else
    sweep_cmds=$(awk '
      /^```gate/ { infence = 1; next }
      /^```/     { infence = 0 }
      infence && /^dod[0-9]+=/ { sub(/^dod[0-9]+=/, ""); print; next }
      infence && /^gate[0-9]+=/ {
        n = $0
        sub(/^gate/, "", n)
        sub(/=.*/, "", n)
        if (n + 0 >= 2) { line = $0; sub(/^gate[0-9]+=/, "", line); print line }
      }
    ' "$plan")

    while IFS= read -r cmd; do
      [ -n "$cmd" ] || continue
      out=$(eval "$cmd" 2>&1)
      rc=$?
      if [ "$rc" -ne 0 ]; then
        stop "the base is not green: \`$cmd\` exited $rc before this run wrote a line:
$out" "$REFUSED"
      fi
    done <<PREFLIGHT_SWEEP
$sweep_cmds
PREFLIGHT_SWEEP
  fi

  # 9. The branch must be caught up with what it forked from — implementing against a base the
  # branch has since moved past ships a diff that conflicts, and certifies check 8 green against
  # a base nobody will merge into.
  git fetch --prune --quiet 2>/dev/null || true
  origin_base=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null) || origin_base=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

  if ! git merge-base --is-ancestor "$origin_base" HEAD 2>/dev/null; then
    missing=$(git log --oneline "HEAD..$origin_base" 2>&1)
    stop "the branch is behind $origin_base:
$missing

Fetch and rebase before relaunching." "$REFUSED"
  fi

  # 10. Deny — the implementer runs as an ordinary Claude Code session; without a settings rule
  # denying it `git commit`, `git push` and `git add`, "only the gate commits" is a sentence in
  # the plan and not a fact this run can stand behind. goal-deny-setup.sh installs the rule once;
  # this only reads for it.
  deny_file=".claude/settings.local.json"
  deny_missing=""
  for verb in commit push add; do
    grep -q "git $verb" "$deny_file" 2>/dev/null || deny_missing="$deny_missing $verb"
  done

  [ -z "$deny_missing" ] ||
    stop "the implementer is not denied git$deny_missing. Run: $here/goal-deny-setup.sh" "$REFUSED"
}

preflight

publishes=0
[ "$policy" = "commit+pr" ] && publishes=1

pr_base=$(sed -n 's/^PR base: *//p' "$plan" | head -1)
case "$pr_base" in
  *[!A-Za-z0-9._/-]*) pr_base="" ;;
esac

plan_title=$(sed -n 's/^# Spec: //p' "$plan" | head -1)
[ -n "$plan_title" ] || plan_title="Exécution de $(basename "$plan")"

# `gh` needs owner/name, git gives a URL: SSH, HTTPS, with or without the `.git` suffix.
repo_of() {
  git remote get-url "$1" 2>/dev/null | sed -E 's#\.git$##; s#^.*[:/]([^/]+/[^/]+)$#\1#'
}

pr_body() {
  numbers=$(printf '%s' "$landed" | tr ' ' '|')
  printf '## Landed\n\n'
  grep -E "^### Iteration ($numbers) " "$plan" | sed -E 's/^### /- /'
  printf '\nEach iteration was judged by the gate before its commit: declared scope, diff budget, removals, acceptance commands, and the bite check that requires the test to fail without the implementation. No commit exists that a gate did not verify.\n'
}

landed=""
shipped=""
pr_open=""
pr_blocked=""
elapsed=""

# The pull request is opened as a draft at the **first** landed commit, and its body rewritten
# after every one after it, so a run that halts at 3 of 15 still leaves something a human can
# read instead of a local branch nobody can see. `pr_blocked` is sticky: once publication fails
# for any reason it stays failed for the rest of this run rather than retried every iteration.
mirror() {
  [ -n "$pr_blocked" ] && return 0

  if [ "$publishes" -ne 1 ]; then
    pr_blocked="Policy is ${policy:-unreadable}, not commit+pr, so nothing is pushed and no pull request is opened. The commits are on the branch, where the developer asked them to stay."
    return 0
  fi

  # Reshaping happens once, before anything is pushed, and never again: after the first push
  # folding a commit would need a force.
  if [ "$shipped" != "yes" ]; then
    count=$(printf '%s\n' "$landed" | wc -w | tr -d ' ')
    fixups=$(git log --format=%s -"$count" 2>/dev/null | grep -cE '^(fixup|squash)!' || true)

    if [ "$fixups" != "0" ]; then
      pr_blocked="The run carries a fixup or squash commit, so the history is not the sequence a reviewer should read. Nothing was pushed: fold them yourself, then push."
      say "RUN $pr_blocked"
      return 0
    fi
  fi

  scan_out=$($GATE scan 2>&1)

  if [ $? -ne 0 ]; then
    pr_blocked="The secret scanner refused this tree, so nothing was pushed:
$scan_out"
    say "RUN $pr_blocked"
    return 0
  fi

  push_out=$(git push -u "$remote" HEAD 2>&1)

  if [ $? -ne 0 ]; then
    pr_blocked="The push failed:
$push_out"
    say "RUN $pr_blocked"
    return 0
  fi

  shipped="yes"
  say "RUN pushed to $remote"

  case "$plan_title" in
    *"'"* | *'\'*)
      pr_blocked="The plan's title cannot be safely quoted for a pull request — it contains a quote or a backslash: $plan_title. Rename its \"# Spec:\" line, then relaunch; the branch is already pushed."
      say "RUN $pr_blocked"
      return 0
      ;;
  esac

  repo=$(repo_of "$remote")
  branch=$(git branch --show-current)
  body=$(pr_body)

  # Asked, not assumed, unless already confirmed this run: a run resumed by hand on a single
  # iteration has no memory of what an earlier invocation already opened, so whether a pull
  # request exists is read from `gh` itself the first time this process needs to know.
  if [ "$pr_open" != "yes" ]; then
    number=$(gh pr view "$branch" --repo "$repo" --json number 2>/dev/null | sed -n 's/.*"number":\([0-9]*\).*/\1/p')
    [ -n "$number" ] && pr_open="yes"
  fi

  if [ "$pr_open" = "yes" ]; then
    gh_out=$(gh pr edit "$branch" --repo "$repo" --body "$body" 2>&1)
    gh_exit=$?
    [ "$gh_exit" -eq 0 ] && say "RUN rewrote the pull request body"
  elif [ -n "$pr_base" ]; then
    gh_out=$(gh pr create --repo "$repo" --draft --base "$pr_base" --title "$plan_title" --body "$body" 2>&1)
    gh_exit=$?
    [ "$gh_exit" -eq 0 ] && { pr_open="yes"; say "RUN opened a draft pull request against $pr_base"; }
  else
    gh_out=$(gh pr create --repo "$repo" --draft --title "$plan_title" --body "$body" 2>&1)
    gh_exit=$?
    [ "$gh_exit" -eq 0 ] && { pr_open="yes"; say "RUN opened a draft pull request"; }
  fi

  if [ "$gh_exit" -ne 0 ]; then
    pr_blocked="$gh_out"
    say "RUN $pr_blocked"
  fi
}

if [ -n "$iteration" ]; then
  iterations="$iteration"
else
  # The same reading the gate uses: an `### Iteration N` heading, then the first checkbox in
  # its section. Keeping the survey mechanical is what stops it becoming an interpretation of
  # the plan.
  iterations=$(awk '
    /^#{2,3} / { cur = ""; seen = 0 }
    /^### Iteration [0-9]+/ {
      n = $0
      sub(/^### Iteration /, "", n)
      sub(/[^0-9].*/, "", n)
      cur = n
    }
    cur != "" && seen == 0 && /^- \[/ {
      seen = 1
      if ($0 ~ /^- \[ \]/) print cur
    }
  ' "$plan")

  if [ -z "$iterations" ]; then
    say "STOP no unchecked iteration remains in $(basename "$plan")"
    exit "$LANDED"
  fi
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

# Every iteration in the list is proven runnable before any of them is implemented, so a plan
# that would fail on its third iteration never spends the first two.
hashes=""

for n in $iterations; do
  checked=$($GATE check "$plan" "$n" 2>&1)

  if [ $? -ne 0 ]; then
    say "STOP the gate will not run iteration $n, so nothing was attempted:"
    say "$checked"
    exit "$REFUSED"
  fi

  hash=$(printf '%s\n' "$checked" | sed -n 's/^plan_hash=\([0-9a-f]*\)$/\1/p' | head -1)

  if [ -z "$hash" ]; then
    say "STOP the gate published no plan_hash for iteration $n, so nothing locks the contract:"
    say "$checked"
    exit "$REFUSED"
  fi

  hashes="$hashes$n:$hash
"
done

# `run_iteration` halts the whole script itself on anything but a landed verdict, via `stop`.
# Reaching the end of its body is the only path that returns, which is what lets the loop below
# move on to the next iteration instead of guessing whether this one succeeded.
run_iteration() {
  iteration="$1"
  hash="$2"
  iter_start=$(date +%s)

  say "RUN iteration $iteration of $(basename "$plan"), in $(pwd)"

  if ! $GATE lock "$plan" >/dev/null 2>&1; then
    say "STOP another run holds this plan. Wait for it, or free it with: $GATE unlock $plan"
    exit "$REFUSED"
  fi

  locked="yes"

  # The section travels as text and the plan's path does not travel at all. Handing that path
  # over is what made a real run read the plan in another checkout, take its parent as the
  # repository root, and write the whole iteration into the wrong tree with a correct cwd
  # throughout.
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

  # A quota window is not a failure, so it is not diagnosed like one: it is detected from the
  # shape of a failed call, slept through, and retried against the same iteration — bounded, so a
  # window that never reopens still ends in a pause rather than a run spinning until the machine
  # is switched off.
  quota_sleep="${GOAL_RUN_QUOTA_SLEEP:-1800}"
  quota_max="${GOAL_RUN_QUOTA_MAX_RETRIES:-3}"
  attempt=1

  while :; do
    say "RUN handing iteration $iteration to the implementer"

    implemented=$(claude -p --agent goal:goal-run-implementer --permission-mode auto "$brief" 2>&1)
    implementer_exit=$?

    if [ -n "$implemented" ]; then
      printf '%s\n' "$implemented" >> "$log"
    fi

    [ "$implementer_exit" -eq 0 ] && break

    if ! printf '%s' "$implemented" | grep -qiE 'usage limit|rate.limit|rate_limit_error'; then
      stop "the implementer exited $implementer_exit. The tree holds whatever it wrote and no gate has judged it: review it before relaunching." "$PAUSED"
    fi

    if [ "$attempt" -ge "$quota_max" ]; then
      stop "the quota still looks exhausted after $attempt attempt(s) on iteration $iteration. Pausing rather than spinning through a window that is not reopening: relaunch resumes here." "$PAUSED"
    fi

    attempt=$((attempt + 1))
    say "RUN the implementer looks quota-exhausted, sleeping ${quota_sleep}s before relaunching iteration $iteration (attempt $attempt of $quota_max)"
    sleep "$quota_sleep"
  done

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
    say "RUN iteration $iteration landed, gate-verified"
    landed="$landed $iteration"
    elapsed="$elapsed$iteration: $(( $(date +%s) - iter_start ))s
"
    mirror
    return "$LANDED"
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
}

for n in $iterations; do
  hash=$(printf '%s' "$hashes" | sed -n "s/^$n:\(.*\)\$/\1/p")
  run_iteration "$n" "$hash"
done

# Every requested iteration landed, gate-verified — against its own commands alone. The global
# Definition of Done is the barrier that replays against the whole plan, and "shipped" means the
# pull request is marked ready on the far side of it, mechanically, never by this script's own
# say-so. `hash` still holds the last iteration's plan_hash: unaffected by ticking a box, it is
# the same hash for every iteration of this plan.
dod_out=$($GATE dod "$plan" "$hash" 2>&1)
dod_exit=$?
[ -n "$dod_out" ] && printf '%s\n' "$dod_out" >> "$log"

if [ "$dod_exit" -eq 0 ]; then
  say "RUN the global Definition of Done passed"

  if [ "$publishes" -eq 1 ] && [ "$pr_open" = "yes" ] && [ -z "$pr_blocked" ]; then
    ready_out=$(gh pr ready --repo "$(repo_of "$remote")" "$(git branch --show-current)" 2>&1)
    ready_exit=$?
    [ -n "$ready_out" ] && printf '%s\n' "$ready_out" >> "$log"
    if [ "$ready_exit" -eq 0 ]; then
      say "RUN the pull request was marked ready"
    else
      say "RUN marking the pull request ready failed: $ready_out"
    fi
  fi

  # A lens is a model, not an exit code: it is asked, its finding is logged beside the run, and
  # nothing about its answer changes what this script does next — it cannot, the work is already
  # landed and pushed.
  lens_brief="Refute the iteration(s)$landed of $(basename "$plan") that this run just landed.

Does what landed implement each iteration's stated Goal and business rules, or a comfortable
reading of them that happened to make the checks pass? Read the plan's own declarations for
each iteration and the commits on this branch; change nothing.

Answer with a verdict of one sentence per finding and a path:line anchor. Nothing you say blocks
this run: it is advisory only."

  lens_out=$(claude -p --agent goal:goal-run-lens --permission-mode auto "$lens_brief" 2>&1)
  [ -n "$lens_out" ] && printf '%s\n' "$lens_out" >> "$log"
  say "RUN lens findings recorded, advisory only"
fi

sha=$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')

audit_brief="Audit the run that just ended on plan $(basename "$plan") and write its report to
.claude/goal-runs/$sha.md.

Elapsed seconds per iteration entered:
$elapsed
Read the reports already in .claude/goal-runs/ and say which failures recur across runs rather
than describing this one twice. Do not edit a single line of code, do not stage anything, and do
not judge whether the work was correct — the gate already did that."

audit_out=$(claude -p --agent goal:goal-run-auditor --permission-mode auto "$audit_brief" 2>&1)
[ -n "$audit_out" ] && printf '%s\n' "$audit_out" >> "$log"
say "RUN audit recorded"

if [ "$dod_exit" -ne 0 ]; then
  say "STOP the global Definition of Done refused this run:"
  say "$dod_out"
  exit "$HALTED"
fi

say "STOP $(printf '%s' "$iterations" | wc -w | tr -d ' ') iteration(s) landed, gate-verified"
exit "$LANDED"
