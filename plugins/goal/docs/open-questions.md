# Open questions

Things noticed while running the harness for real, parked rather than acted on. Each says what
was observed, what it would change, and what has to be measured before deciding — so picking one
up later does not start from the intuition again.

## 1. Is tmux still the right isolation layer?

**Observed.** The launcher's own justification was wrong. It claimed a run living in an
interactive session "dies from a keystroke", while `README.md`'s troubleshooting table — written
later, from a real case — says backgrounding kills nothing and names the actual cause: a
permission prompt nobody answered. Both texts have been corrected, but the correction narrows
what tmux buys, and that is the open part.

**What tmux still buys**, once the false premise is removed:

- surviving the terminal that opened it (window closed, SSH dropped)
- a stable, named reattach point

**What it does not buy**, contrary to what the docs implied: a free checkout. That comes from the
worktree, and would with or without tmux.

**What it costs.** A detached session is invisible: no notification reaches you, and the machine
must stay awake and online. That cost is the whole of question 2.

**Candidates**, roughly in order of how well they fit "I leave and want to be told if it jams":

| Option | Buys | Costs |
|---|---|---|
| Claude Code on the web (claude.ai/code) | the run lives in the cloud; the machine may sleep | not yet tested against a full `/goal:auto` |
| Native backgrounding (`/bg`, `claude agents`) | integrates with notifications and Remote Control, so question 2 mostly dissolves | believed not to survive the terminal closing — **unverified** |
| tmux (today) | terminal-independent, stable name | invisible while detached |

**To measure before deciding:** whether a web or backgrounded session sustains a complete
`/goal:auto` run, and whether a backgrounded run survives closing the terminal. Both are one
experiment each, and neither has been run.

## 2. Surfacing a blocked run while the session is detached

**Observed.** A detached run that stalls is indistinguishable from one that is working. Nothing
reaches the developer.

**Mechanism, already available.** The `Notification` hook takes a matcher on the notification
type — `permission_prompt`, `idle_prompt`, `agent_needs_input`, `elicitation_dialog`,
`agent_completed` — alongside `Stop` and `SessionEnd`
([hooks reference](https://code.claude.com/docs/en/hooks)).

**Scope trap.** `.claude/` is gitignored, so it is absent from the worktrees the launcher
creates. A hook declared in a project's `.claude/settings.json` would never see these runs. It
has to live in `~/.claude/settings.json`, which every `claude` session inherits.

**Already covered, partly.** `--permission-mode auto` removes most of `permission_prompt`, and
the workflow already posts a halt report to the GitHub issue when one exists. The gap is the
blockage that is neither a permission prompt nor a gate halt: a genuine question, an error, a
rate limit.

**Undecided:** the channel. ntfy.sh reaches a phone and is the only option that works when you
are away from the machine; `osascript` is local-only; a tmux marker plus a log file gives
history but only on reattach. Deferred because it depends on question 1 — a different isolation
layer changes what needs a channel at all.

## 3. The fetch-first guard matches command text, not command effect

**Observed.** `plugins/git/hooks/fetch-first.sh` greps the command string, so a read-only command
that merely *mentions* a guarded verb is blocked exactly like the real thing. Hit three times
while investigating the guard itself, the last time by the very command written to test it.

**Largely defused, not fixed.** The guard was narrowed to `git switch -c` / `git checkout -b`
(see the file's own header for why `gh pr create` and `git push` left), so the surface is now
small enough that a false block is rare. The flaw itself is untouched: a command mentioning
either remaining verb is still refused.

**Not fixed** because the safe direction is not obvious: tightening the pattern to leading
position would miss real invocations inside `&&` chains and subshells, which is a worse failure
than an occasional false block. Wants a deliberate pass, not a quick regex edit.

## 4. Preflight 11 asks the developer what the session already knows

**Observed.** A run launched by `goal-launch.sh` — which now always passes
`--permission-mode auto` — still stops at preflight 11 to ask the developer which permission
mode the session is in. It reads mistrust: the first reaction to the question was "why is it
asking permission again, do I need to merge something?", when nothing was wrong at all.

**Why it asks.** The check inspects `permissions.defaultMode` in the settings files, which
reflects neither a CLI `--permission-mode` flag nor a `Shift+Tab` override. So it cannot see the
mode it is actually running under, and falls back to asking.

**What changed.** The launcher now sets the mode itself, so for launcher-started runs the answer
is known at launch time. An environment variable exported alongside the flag would let the
preflight read what the launcher did, and ask only when the variable is absent — which is
exactly the hand-started case the question is for.

**Care needed:** the variable records the launcher's intent, not the live mode, so a `Shift+Tab`
during the run would make it lie. Whether that matters depends on whether the check exists to
know the mode or to make the developer accept it — worth settling before writing anything.

## 5. `/goal:next` offers a command whose preflight always refuses

**Observed.** On 2026-08-01, `/goal:next` closed iteration 1 of `goal-run-script-spec.md` and
offered `/goal:auto` for the remaining six. `/goal:auto` refused on preflight check 9: a pull
request was already open on the branch. The developer read the refusal as their own omission —
"you told me I could run auto, not that I had to merge the PR first" — and nothing was omitted.

**Why it is systematic, not a one-off.** `/goal:next` Phase 5 offers `/goal:auto` whenever
`Policy:` is `commit` / `commit+pr` and every remaining iteration carries a `gate1`. It never
looks at whether a pull request exists. Under `commit+pr` one **always** does from iteration 1
onward, because that policy opens the draft PR at the first commit. So after any first
iteration, the two commands contradict each other by construction.

**The check is not merely conservative.** `goal-auto.js:671` initialises `shipping.pr` to
`false`, so the first `mirror()` runs `gh pr create` on a branch that already has one. It fails,
`shipping.pr` stays false, every later iteration retries `create` and fails again, the body is
never rewritten, and `gh pr ready` (`:908`) never fires. Removing check 9 would trade a clean
refusal for a run that lands its work and silently fails to publish any of it.

**Three fixes, and they are not equivalent:**

1. **`/goal:next` learns the check** — run `gh pr list --head <branch>` before offering, and when
   one is open, emit only the manual handoff. Cheapest, and it makes the two commands agree. But
   it concedes that a `commit+pr` plan is never autonomous past iteration 1, which is backwards:
   that policy exists precisely to be left alone.
2. **`/goal:auto` narrows check 9** — refuse only on a pull request that is not this run's own.
   The branch is named after the plan, so any open PR on `feature/<work-id>` is arguably this
   plan's. Needs the rule written down, or it becomes a hole someone widens later.
3. **The orchestrator adopts an existing PR** — seed `shipping.pr` from `gh pr view --json
   number` before the first `mirror()`. Fixes the cause rather than the symptom.

**What to settle first:** whether `goal-auto.js` survives at all (`unattended-run-spec.md` §9).
If it is replaced by `goal-run.sh`, fix 3 belongs in that script's iteration 4 instead — and
**R14 has to say so explicitly**, because as written ("a draft pull request exists from the
first commit and its body is rewritten after each landing") it describes a PR the run itself
opened and says nothing about one that was already there. That gap is what this incident
exposed, and it would reproduce in the replacement.

## 6. The orchestrator is bash, and that was never a decision

**Observed.** `goal-run.sh` shipped across seven iterations without bash ever being weighed
against Node. The reasoning went "a `Workflow` script has no shell, therefore a shell script" —
but the missing shell belonged to the *Workflow runtime*, not to JavaScript. `node` has
`spawnSync`, and `goal-gate.ts` is already TypeScript executed natively, no build step and no
dependency.

**What it costs, and the second column is the argument:**

| | Lines | Files |
|---|---|---|
| `goal-run.sh` | 594 | **1**, eight functions |
| `goal-gate.ts` + `gate/` | 903 | **10**, largest 158 |

The gate does more work than the script and is split one module per group of business rules,
each with its matching test file — a convention `goal-gate.ts` states in its own header.
`goal-run.sh` is the one place in this plugin that cannot follow it: argument parsing, twelve
preflight checks, the loop, publication, the quota wait and the closing stage all live in one
file. That is the maintainability cost, and it is what decided this — not a taste in languages.

**A second defect, and this one is language-independent.** The script re-implements in
`sed`/`awk` what `scripts/gate/plan.ts` already exports: `iterationSection()` (`plan.ts:56`) is
`sed -n "/^### Iteration $n /,/^### Iteration /p"` (`goal-run.sh:418`), `iterationNumbers()`
(`:138`) is the survey's `awk`, and five header reads have their equivalent too. `goal-auto.js`
carried the same duplication and admitted it in a comment. **The orchestrator should not read
the plan at all**: the gate hashes it, reads its blocks and refuses when it moved, so it is the
authority — a second reader is a drift waiting to happen. Giving the gate `section <plan> <n>`
and `survey <plan>` verbs, as `check` already publishes `plan_hash`, removes it in either
language and costs tens of lines rather than a rewrite.

**The port is guarded, not blind.** `goal-run-harness.ts:237` spawns the script by path —
`spawnSync('bash', [RUN, ...args])` — so switching to `node` is two lines and the forty-odd
tests now on `main` become a parity harness. They already encode the eighteen business rules.

1. Port `goal-run.sh` to Node, same tests, two lines of harness. Green means parity proven.
2. Split into modules on the gate's convention. Tests stay green.
3. Convert what no longer needs a subprocess to imports; most of the 253-line harness goes, and
   the plan-parsing duplication with it.

**Honest reservation.** The suite covers the eighteen rules, not every behaviour: exact log
wording, argument ordering and the edge cases of the twelve preflight checks are not all
asserted. A port held by this suite is far safer than a bare rewrite, not free of new bugs.

**What is not settled: when.** The port is its own plan. Running it is the first genuine use of
`goal-run.sh`, which also makes it the first time an advisory lens ever runs — `goal-auto.js`
never enabled them.

## 7. A run is invisible for minutes at a time, by construction

**Observed.** On the first real run of `goal-run.sh` (2026-08-01, `goal-run-node-port-spec.md`),
the developer asked twice whether anything was happening. Twice it was. Two distinct silences:

- **The preflight.** Measured at 2 min 50 s on this plan, during which nothing is printed and no
  log file exists. `say()` writes to `$plan.run.log`, but the ten checks call it only to *refuse*
  — a passing preflight says nothing at all. A healthy run and a jammed one are indistinguishable
  for the longest stretch before the first iteration.
- **The implementer.** `goal-run.sh:457` is `implemented=$(claude -p … 2>&1)`. Command
  substitution captures, so nothing can stream by construction, and the text reaches the log at
  `:460` only once the call has returned. That is minutes per iteration.

**Not a missing flag.** `claude --help` publishes `--output-format stream-json`, `--verbose` and
`--include-partial-messages`. The capture is the cause, not the CLI.

**Two fixes, and they differ in kind.** `… 2>&1 | tee -a "$log"` with `PIPESTATUS` for the exit
code shows the raw stream — cheap, but it hands the developer the sub-agent's full prose, which
under a `learning` output style is mostly noise about work they are not steering. Parsing
`--output-format stream-json` and printing one line per tool use (`RUN implementer: Edit
run/publish.ts`) shows what the agent *does* rather than what it says, and makes the output style
irrelevant because its prose is never consumed.

**Where it can land.** `goal-run.sh` is frozen for the duration of the A/B (see §6), so this is a
deliberate divergence in the Node runner or nothing. Note that the run loop landed in that plan's
iteration 3, so it fits no remaining slice: it is a follow-up plan, not an amendment.

**To measure before deciding:** whether the stream-json event shape is stable enough to render
from without re-parsing at every Claude Code release, and whether a per-tool-use line is the right
granularity or already too much for a fifteen-iteration run.

## 8. Could a supervisor diagnose a halt and relaunch by itself?

**Observed.** The same run halted at iteration 5. The developer pasted the output into a session,
which diagnosed it in one pass: the plan was at fault, iteration 3's `gate1` asserted
`! grep -rq '### Iteration' …` while publication legitimately needs that literal, and `plan.ts`
published no accessor for an iteration heading. The repair — add `iterationHeading` to `plan.ts`,
declare it in iteration 5's `impl_files` — was mechanical once stated. Everything after it was
too: restore the tree, relaunch. None of it needed a human except to authorize destroying the
implementer's partial work.

**So the loop is obvious**: run, and on a non-zero exit hand the exit code and the log tail to a
`goal-run-doctor`, which classifies, repairs, cleans and relaunches.

**And the loop is dangerous, for a reason this incident demonstrates exactly.** There were two
repairs available:

1. delete `! grep -rq '### Iteration'` from iteration 3's `gate1` — the run resumes immediately;
2. add the accessor — more work, and the correct one.

An agent whose objective is *make the run continue* takes the first every time. The port would
have finished green carrying precisely the duplication the plan existed to remove, and nothing
would have said so. A supervisor optimizing for green is a supervisor that deletes the rules.

**The guardrail, and it is mechanically checkable.** The doctor may never touch a `gateN=` or
`dodN=` line. It may add a path to `impl_files`, raise a `max_diff`, correct a mistyped path,
rewrite prose. Hash the plan's command lines before and after its pass: different hash, refuse and
wake the human. Everything it cannot classify halts too.

**And the guardrail is necessary, not sufficient.** The same plan halted again at iteration 6, and
that halt needed the opposite response: `close.ts` guarded PR-readiness on the policy alone and
asked `gh` where `goal-run.sh:544` reads the run's own state. Nothing in the plan was wrong. The
repair was to discard the implementation and have it redone. From the outside the two halts are
indistinguishable — same exit code, same regression-wall message, same shape of failing command —
so the doctor's **first** act cannot be to repair, it has to be to classify: plan at fault, or
implementation at fault. A doctor that only knows how to amend a plan will go looking for
something to amend, and will widen an `impl_files` or raise a `max_diff` for a defect that is
neither.

**To measure before deciding:** what share of real halts fall inside the closed repair set, and
whether the classification is reliable at all — two cases are an anecdote, not a measurement. If
the repair set turns out small, the supervisor buys little and adds a component that can itself be
wrong. Also unresolved: whether it may discard an implementer's partial work without asking, which
is the one destructive step in the loop.

## 9. Nothing harvests what a session learns

**Observed.** The session that planned and drove the run above produced findings no artifact
records:

- `goal-run.sh:235` builds `landed` as `landed="$landed $iteration"` from an empty string, so it
  always carries a leading space; `tr ' ' '|'` makes the `pr_body` regex `^### Iteration (|1) `,
  an empty alternative BSD grep refuses outright. PR #24's `## Landed` section was empty for every
  landed iteration. A real bug in a script that had shipped across seven iterations, found the
  first time anyone ran it.
- The plan's own R4 assertion was too broad, in a way only executing it revealed.
- The preflight replays fifteen commands without de-duplicating identical ones.

Each surfaced because a human was reading. The run's own auditor (`goal-run-auditor`) measures
elapsed time and recurring failures; it is explicitly told not to judge the work. Nothing looks at
the *session* — the instructions given, what the assistant did with them, where it guessed wrong.

**What it would be.** An agent reading a finished session's transcript and proposing improvements
in three buckets, because they have three different owners: the **codebase** (a bug like
`pr_body`), the **workflow** (a command that asks what the session already knows — see §4), and
the **marketplace** (a skill that failed to trigger, a convention that should have been stated).

**Open, and it is the hard part:** a transcript is long and mostly uneventful, so an agent reading
it will find *something* every time — which is how continuous improvement becomes a backlog nobody
reads. It needs a bar for what counts as a finding, and that bar is what has to be designed, not
the agent. A candidate: only findings that can name a file and line, or a specific exchange where
a decision went wrong.

Also undecided: whether a verbose output style helps or hurts here. Its prose states reasoning the
transcript would otherwise only imply, which is exactly what such an auditor reads — but it is
also the noise the developer wanted removed in §7. The two may want opposite settings.

## 10. Nothing reviews what the gate accepted

**Observed.** PR #24 carries six commits, every one gate-verified. What the gate verifies is
declared scope, diff budget, removals, acceptance commands, the bite check, and secrets. What it
does not verify is whether the code is *good*: naming, design, error handling, security posture,
whether an abstraction leaks. The gate was built to refuse the failures an unattended agent
produces mechanically, not to hold an opinion.

So a plan can land complete and green with nobody having read a line, which is the intended
economy — and it leaves the review debt exactly where the developer's attention is scarcest.

**What it would be.** A reviewer agent invoked at the closing stage, alongside the advisory lens
and the auditor, posting its findings as review comments on the pull request rather than into a
local log — best practices, security, and the project's own convention skills as the yardstick.
The lens already occupies the neighbouring slot but asks a narrower question (does what landed
implement the iteration's stated goal, or a comfortable reading of it) and writes only to the log.

**Open:** whether it comments inline or posts one summary. Inline comments are actionable and
also the fastest way to make a pull request unreadable when an agent finds twenty of them. And
whether it may block: it should not — the work is already landed and pushed by the time it runs,
so like the lens it can only advise. If blocking is wanted, the check belongs in the gate, which
is a different and much stricter design conversation.

## 11. The advisory lens only ever sees the last run's landings

**Observed.** `goal-run-node-port-spec.md` was delivered across three runs: run 1 landed
iterations 1–4 and halted at 5, run 2 landed 5 and halted at 6, run 3 landed 6. The lens fired
once, at the end of run 3, and its own verdict names its scope: *"I reviewed iteration 6's Goal,
its business rules (R8, R9, R10)"*. Five of the six iterations were never looked at.

**Why, mechanically.** The closing stage runs only when every requested iteration landed, and its
brief is built from `$landed` (`goal-run.sh:558`), which accumulates within one process. A halt
skips the closing stage entirely, and the relaunch that follows starts `landed` empty. So the
coverage of the only review step in the harness is inversely proportional to how much the plan
resisted — the plans that most deserve a second pair of eyes get the least.

**Not a bug in the lens.** It reviewed exactly what it was handed. The defect is that `landed` is
a per-process variable being used as if it were a per-plan one.

**Candidates:** brief the lens from the plan's ticked iterations rather than from `$landed`, which
makes the last run of a plan review the whole plan; or fire it per landing rather than at the
close, which spreads the cost but multiplies the calls; or move the review to the pull request
(§10), where the diff is the whole branch and the question of which run landed what disappears.
The third also survives a plan delivered across three runs without any bookkeeping, which is the
case that produced this.

**To measure before deciding:** whether a lens handed six iterations at once still anchors its
findings, or dilutes into a summary. The one real datapoint is a lens given a single iteration,
and it did anchor.
