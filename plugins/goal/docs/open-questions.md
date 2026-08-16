# Open questions

Things noticed while running the harness for real, parked rather than acted on. Each says what
was observed, what it would change, and what has to be measured before deciding, so picking one
up later does not start from the intuition again.

A question that got answered stays here with its answer: what it cost and what it revealed is the
part worth reading twice, and deleting it would leave the next reader with the same intuition and
no record of where it led. Three questions below were answered by building something that has never
run once, which is a third state and is said so where it applies.

## 1. The current chain has no isolation layer at all

**Observed.** This opened as *"is tmux still the right isolation layer"*, after the launcher's own
justification turned out to be false: it claimed a run living in an interactive session "dies from
a keystroke", where backgrounding kills nothing and the real cause was a permission prompt nobody
answered. That correction stands. What changed since is bigger than the correction. The chain that
runs today has no isolation layer: `/goal:supervise` starts the runner as a plain background shell
(`skills/supervise/SKILL.md`, Phase 1), in the developer's own checkout, with no worktree and no named
session to reattach to. The earlier launcher that opened tmux for a run has since been deleted; it
launched the abandoned generation.

So the table of candidates below never had a row for what is actually in use, and the layer was
not replaced by a better one. It was dropped along the way.

**What tmux buys**, once the false premise is removed: surviving the terminal that opened it, and
a stable reattach point. **What it does not buy:** a free checkout. That comes from the worktree,
and the worktree is what the current chain gave up with it, silently.

| Option | Buys | Costs |
|---|---|---|
| Background shell under `/goal:supervise` (today) | the supervising session reads the exit code and can act on it, which is the whole of §8 | tied to the session that launched it, untested against that session ending; runs in the developer's own tree, so a halt leaves that tree dirty |
| tmux + worktree (the deleted launcher) | terminal-independent, stable name, a tree of its own | invisible while detached, and only reachable through the abandoned generation |
| Claude Code on the web (claude.ai/code) | the run lives in the cloud; the machine may sleep | never tested against a full run |
| Native backgrounding (`/bg`, `claude agents`) | integrates with notifications and Remote Control, so question 2 mostly dissolves | believed not to survive the terminal closing: **unverified** |

**To settle:** whether a supervising session watching the run *is* the isolation answer (it buys
something tmux never could, a reader for the exit code) or merely the thing that made the
question invisible. And separately, whether a run should ever write in the developer's own
checkout at all: the tree is exactly where a halt leaves the implementer's partial work, and §8's
repair path has to reason about that tree.

## 2. Surfacing a blocked run while nobody is attached

**Observed.** A run that stalls with nobody watching is indistinguishable from one that is
working. Nothing reaches the developer.

**The gap is wider than this question first stated it.** *"The workflow already posts a halt report
to the GitHub issue when one exists"* was true of the abandoned Workflow and of nothing else. The
current runner's only GitHub calls are `pr view`, `pr edit`, `pr create` (`src/run/publish.ts`)
and `pr ready` (`src/run/close.ts`). It never comments on an issue, and on a halt it never
reaches the closing stage at all (§15). Its entire account of itself is a log file under
`.claude/goal-runs/<work-id>/<run-id>/` and an exit code.

**What partly covers it now.** `--permission-mode auto` is passed at every agent invocation, which
removes most permission prompts; and `/goal:supervise` puts a live session in front of the run,
which is a channel of a kind: it reads the exit code and acts on it. That is why the question
stopped feeling urgent rather than being answered. An unwatched run still has nothing.

**Mechanism, still available.** The `Notification` hook takes a matcher on the notification type,
alongside `Stop` and `SessionEnd` ([hooks reference](https://code.claude.com/docs/en/hooks)).

**Scope trap.** `.claude/` is gitignored, so it is absent from any worktree a launcher creates. A
hook declared in a project's `.claude/settings.json` would never see those runs. It has to live in
`~/.claude/settings.json`, which every `claude` session inherits.

**Undecided:** the channel. ntfy.sh reaches a phone and is the only option that works when you are
away from the machine; `osascript` is local-only; a log file gives history but only on reattach.
Still downstream of question 1: a run watched by a supervising session wants a very different
channel from one nobody is attached to, and the harness now has both shapes.

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

**Observed.** A run launched by the earlier launcher (which always passed `--permission-mode
auto`) still stopped at preflight 11 to ask the developer which permission mode the session was
in. It
read as mistrust: the first reaction was *"why is it asking permission again, do I need to merge
something?"*, when nothing was wrong at all. The check inspects `permissions.defaultMode` in the
settings files, which reflects neither a CLI flag nor a `Shift+Tab` override, so it cannot see the
mode it is running under and falls back to asking.

**Answered by a third option nobody proposed here.** The current preflight is ten refusals and not
one of them inspects a permission mode (`src/run/preflight.ts`). The runner states the mode
instead, at every single agent invocation. A check that *sets* the condition it wanted to verify
does not need to verify it, and that is strictly better than both candidates this question weighed
(read a variable the launcher exported, or keep asking). The question survived only on the
abandoned chain, and that chain is gone.

**What stays worth reading.** The framing was the useful part and it generalises: when a check
cannot observe what it asks about, decide whether it exists to *know* the answer or to make the
developer *accept* it. Only the second survives being blind. And if the answer is neither, the
check should be replaced by an assertion of the thing it wanted.

## 5. `/goal:next` offers a command whose preflight always refuses: settled by deletion

**Observed.** On 2026-08-01, `/goal:next` closed iteration 1 of `goal-run-script-spec.md` and
offered the abandoned generation's autonomous command for the remaining six, which refused on its
own preflight: a pull request was already open on the branch, and that command's cleanup logic
retried `gh pr create` on it forever rather than adopting it. The developer read the refusal as
their own omission (*"you told me I could run auto, not that I had to merge the PR first"*), and
nothing was omitted.

**Why it was systematic, not a one-off.** `/goal:next` Phase 5 offered that command whenever
`Policy:` was `commit` / `commit+pr` and every remaining iteration carried a `gate1`, without ever
checking whether a pull request already existed. And under `commit+pr` one always does from
iteration 1 onward, since that policy opens the draft PR at the first commit. So after any first
iteration, the two commands contradicted each other by construction.

**Settled.** The abandoned command is deleted, `src/run/publish.ts` asks `gh` whether a pull
request exists before creating one and adopts it rather than retrying blindly, and
`skills/next/SKILL.md` now offers `/goal:supervise` (whose preflight has no such check) instead.

## 6. The orchestrator is bash, and that was never a decision: settled, and closed

**Settled: the port landed, then the loser was deleted.** The earlier bash orchestrator was ported
to Node/TypeScript across three runs, kept for a time as a frozen A/B reference, and has since been
removed outright. The Workflow it had itself replaced is unreferenced from any command but still
checked in. `plugins/goal/tests/run.sh` now runs the suite once, under Node; there is nothing left
to compare it against.

**The argument, unchanged.** Bash was never weighed against Node. The reasoning went "a `Workflow`
script has no shell, therefore a shell script", but the missing shell belonged to the *Workflow
runtime*, not to JavaScript. The decisive column was never the language, it was the file count: one
594-line file with eight functions holding argument parsing, ten preflight checks, the loop,
publication, the quota wait and the closing stage, against a gate split one module per group of
business rules, each with its matching test file, a convention `goal-gate.ts` states in its own
header and that the bash script was the one place in the plugin unable to follow.

**What it cost, re-measured.** `scripts/goal-run.ts` + `src/run/` now stands at 1641 lines
over 15 files, against `scripts/goal-gate.ts` + `src/gate/` at 1120 over 12; all of
`scripts/` + `src/` is 3945 lines over 48 `.ts` files, covered by 53 test files and 442 passing tests.
Most of the distance from the 594-line bash original is not the split: it is the mechanisms
added since (`gitwatch.ts`, `postmortem.ts`, `quota.ts`), each of which is one of the modules the
convention asked for. The second defect this question named (the orchestrator re-reading
the plan in `sed`/`awk` where `gate/plan.ts` already exported the same accessors) did go, but not
the way proposed: the runner imports `gate/plan.ts` directly instead of the gate gaining `section`
and `survey` verbs.

**What the one A/B run showed, before the loser was retired.** The bash run published a
`## Landed` section that was empty for all six of its landed iterations: `landed` accumulated from
an empty string, carried a leading space, and the resulting regex alternation had an empty branch
BSD `grep` refuses outright. The Node run listed all seven of its own, because the body is built
from an array of iteration numbers resolved through `run/publish.ts#goalOf` rather than from a
string spliced into a grep alternation. One observed defect, in the one place where the two
languages' handling of a list actually differed, found on the first real use of either runner.

**Honest reservation, unchanged and still true.** The suite covers the eighteen business rules, not
every behaviour: exact log wording, argument ordering and the edges of the preflight checks are not
all asserted. The port was far safer than a bare rewrite, not free of new defects.

## 7. A run is invisible for minutes at a time, by construction

**Observed.** On the first real run of the bash orchestrator (2026-08-01,
`goal-run-node-port-spec.md`), the developer asked twice whether anything was happening. Twice it was. Two distinct silences: a
preflight that printed nothing at all unless it refused, and an implementer whose output was
captured by command substitution and therefore could not stream by construction.

**Both were answered, in the expensive variant, and the wait is unchanged.** The preflight now
narrates each check as it passes (`src/run/preflight.ts`), and `narrate()` renders one line per
tool use (`RUN implementer: Edit run/publish.ts`) from `--output-format stream-json`
(`src/run/iteration.ts`), which was the right choice: it shows what the agent *does* rather
than what it says, so the developer's output style stops mattering. But the implementer is spawned
with `spawnSync`, which returns only when the child exits, so every narrated line is printed after
the fact. The log is complete; the minutes of silence are exactly as long as before.

**What that leaves open is a design decision, not a bug.** Live rendering needs `spawn` and a
line-by-line reader, which would also remove the 1 MiB buffer ceiling on the harness's single
largest call. That turns the iteration step asynchronous: the one place where the synchronous
shape makes every state transition trivially readable, and where every test in the suite currently
asserts against a returned result rather than a stream. Worth deciding on purpose.

**To measure before deciding:** whether the stream-json event shape is stable enough to render from
without re-parsing at every Claude Code release, and whether a per-tool-use line is the right
granularity or already too much for a fifteen-iteration run. Still unmeasured: the only run since
narration landed printed no narration at all, for the reason §12 gives.

## 8. Could a supervisor diagnose a halt and relaunch by itself?

**Observed.** A run halted at iteration 5. The developer pasted the output into a session, which
diagnosed it in one pass: the plan was at fault, iteration 3's `gate1` asserted
`! grep -rq '### Iteration' …` while publication legitimately needs that literal, and `gate/plan.ts`
published no accessor for an iteration heading. The repair (add an `iterationHeading` accessor to
`gate/plan.ts`, declare it in iteration 5's `impl_files`) was mechanical once stated, and so was
everything after it. None of it needed a human except to authorize destroying the implementer's
partial work.

**The loop is obvious**: run, and on a non-zero exit hand the exit code and the log tail to a
doctor which classifies, repairs, cleans and relaunches.

**And the loop is dangerous, for a reason this incident demonstrates exactly.** Two repairs were
available: delete the offending `gate1` clause (the run resumes immediately), or add the accessor
(more work, and the correct one). An agent whose objective is *make the run continue* takes the
first every time. The port would have finished green carrying precisely the duplication the plan
existed to remove, and nothing would have said so. A supervisor optimizing for green is a
supervisor that deletes the rules.

**The guardrail was built, and it closes the sharpest version of the hole.** `plan-guard.ts`
hashes the `gateN=` and `dodN=` lines of every block it resolves, and beside them, per block,
whether `test_files` is empty. An empty `test_files=` makes the gate skip the bite
check outright (`src/gate/bite.ts`, *"declares no test_files, so there is nothing to set
aside"*), so that is the one edit inside the closed repair set that could disarm the invariant
that a test must fail without its implementation, and it now moves the hash. `skills/supervise/SKILL.md`
forbids it in prose as well: *"It may never touch a `gateN=` or `dodN=` line, nor empty
`test_files`"*. What is still unhashed is the rest of the set (an `impl_files` entry, `max_diff`,
prose), each of which can widen what an iteration is judged against without moving anything.

**And the classification, which this question correctly said had to come first, reads one block and
no more.** The same plan halted again at iteration 6 and needed the opposite response: nothing in the plan
was wrong, the implementation was, and the repair was to discard it and have it redone. From the
outside the two halts are indistinguishable, so the doctor's first act must be to classify, not to
repair. It classifies from the run log, which does carry the gate's verdict (§15). What it does
not carry is any synthesis around that verdict, because a halt never reaches the closing stage.

**Built, never run.** `skills/supervise/SKILL.md` and `src/plan-guard.ts` shipped in one commit and
have not been exercised once. The measurement this question demanded (*what share of real halts
fall inside the closed repair set*) was never taken; `skills/supervise/SKILL.md` opens, verbatim,
with (*"two prior halts are the whole evidence"*). Building before measuring is a defensible choice on a
cheap component; recording that it was made is not optional.

**Still unresolved:** whether the doctor may discard an implementer's partial work without asking,
which is the one destructive step in the loop.

## 9. Nothing harvests what a session learns

**Observed.** The session that planned and drove the run above produced findings no artifact
recorded: the `pr_body` defect of §6, a plan assertion that was too broad in a way only executing
it revealed, a preflight replaying fifteen commands without de-duplicating identical ones. Each
surfaced because a human was reading. The run's own auditor measures elapsed time and recurring
failures and is explicitly told not to judge the work. Nothing looked at the *session*: the
instructions given, what the assistant did with them, where it guessed wrong.

**Built, never run.** `agents/goal-session-auditor.md` exists, `src/transcripts.ts` locates a
run's transcripts, and `skills/supervise/SKILL.md` invokes the auditor once per invocation, with the
bar this question called the hard part actually written down (a finding must be anchored to a
tool-call sequence). None of it has executed once, and it shows: no run has ever produced the
`<plan>.run.session` file the locator prefers, and its fallback turns `/` into `-` and stops there,
where Claude Code also turns `.` into `-`, so any run launched into the launcher's own
`.worktrees/` directory resolves to a path that does not exist, and the auditor is handed nothing.
Neither defect could have survived one real invocation.

**Open, and it is still the hard part:** a transcript is long and mostly uneventful, so an agent
reading it will find *something* every time, which is how continuous improvement becomes a backlog
nobody reads. The written bar is a hypothesis, not a result; whether it holds is the measurement,
and nothing has measured it.

Also undecided: whether a verbose output style helps or hurts. Its prose states reasoning the
transcript would otherwise only imply, which is exactly what such an auditor reads, and it is also
the noise §7 wanted removed. The two may want opposite settings.

## 10. Nothing reviews what the gate accepted

**Observed.** PR #24 carries six commits, every one gate-verified. What the gate verifies is
declared scope, diff budget, removals, acceptance commands, the bite check, and secrets. What it
does not verify is whether the code is *good*: naming, design, error handling, security posture,
whether an abstraction leaks. The gate was built to refuse the failures an unattended agent
produces mechanically, not to hold an opinion. So a plan can land complete and green with nobody
having read a line (the intended economy), leaving the review debt where attention is scarcest.

**Built and decided, never fired.** `agents/goal-run-reviewer.md` is invoked at the one moment
publication can no longer be blocked behind it: right after the pull request goes ready
(`src/run/close.ts`). Both open sub-questions were settled in the code and its brief: inline
comments rather than one summary, and never `REQUEST_CHANGES`: pushed work is already shipped, so
a review that cannot block would only add friction to clear by hand. The reviewer has not run once:
the run that added it could not use it (§12), and no run has closed since.

**What that leaves genuinely open** is the one this question raised and did not answer: whether
twenty inline comments make a pull request unreadable, which is a cap and not a design, and is
unmeasurable until the reviewer actually posts something.

## 11. The advisory lens only ever sees the last run's landings

**Observed.** `goal-run-node-port-spec.md` was delivered across three runs: run 1 landed
iterations 1–4 and halted at 5, run 2 landed 5 and halted at 6, run 3 landed 6. The lens fired
once, at the end of run 3, and its own verdict named its scope: *"I reviewed iteration 6's Goal,
its business rules (R8, R9, R10)"*. Five of the six iterations were never looked at. The defect was
that `landed` is a per-process variable used as if it were a per-plan one: a halt skips the closing
stage entirely, and the relaunch starts the accumulator empty. So the coverage of the only review
step in the harness was inversely proportional to how much the plan resisted.

**Settled, by two of the three candidates at once.** The lens is now briefed from the plan re-read
on disk: every box the gate ticked, this run's or an earlier run's (`src/run/close.ts`). So
the last run of a plan reviews the whole plan. And the review also moved to the pull request, where
the diff is the whole branch and the question of which run landed what disappears (§10). The third
candidate, firing per landing, was not taken: it multiplies the calls to solve a problem the first
two already close.

**The measurement it asked for was taken and thrown away.** *Whether a lens handed six iterations
at once still anchors its findings, or dilutes into a summary*: the run of 2026-08-01 handed its
lens all seven of its landed iterations, and that verdict exists nowhere. The version of the
closing stage that ran spawned the lens and discarded its output while announcing *"lens findings
recorded, advisory only"*. Capturing it is now in the code; the datapoint is lost, and the question
still has exactly one observation, from a lens given a single iteration, which did anchor.

## 12. A plan that improves the runner cannot use its own improvements

**Observed, 2026-08-01.** Seven iterations of runner improvements landed, gate-verified, in a single
run, and not one of them acted on the run that produced them. The run's own log is the proof, and
every line of it can be checked against the plan it executed:

- iteration 2 made the preflight narrate each passing check; the log holds no preflight line;
- iteration 3 made the implementer narrate one line per tool use, and record its session id beside
  the run; the log holds no `RUN implementer:` line, and no `.run.session` file was ever written;
- iteration 4 added the reviewer at close; the log goes straight from *"the pull request was marked
  ready"* to *"lens findings recorded"*;
- the log holds nothing but `RUN` and `STOP` lines, though those same iterations added the recording
  of every advisory agent's answer into it.

**The cause is not a bug and cannot be fixed by a better plan.** Node resolves an import once, at
load. `goal-run.ts` resolves its whole import graph at startup (eight direct imports that pull in
eighteen modules in all), so the process runs the code as it stood when it was launched, whatever
the implementer writes to those files afterwards. Iterations 5 to 7
landed outside the import graph and could not have acted either, for the mirror reason: nothing in
the runner imports `plan-guard.ts` or `transcripts.ts`: only the `/goal:supervise` chain reaches
them, and it was not what launched this run.

**The boundary is exact, and it cuts both ways.** What the runner *imports* is frozen at launch.
What it *spawns* is re-read at every call: the gate is `node goal-gate.ts` invoked per iteration,
and each agent is a fresh `claude -p`. So the harness has the property nobody chose: a plan cannot
improve the process running it, **and** a plan can rewrite its own judge mid-run. An iteration that
edits `gate/bounds.ts` is judged by the old bounds; iteration N+1 is judged by the new ones, as is
every earlier iteration the regression wall replays. Nothing pins the gate's own source the way
`plan-guard.ts` pins the plan's command lines.

**What it changes, and it applies to every plan on this harness from here.** A self-improving plan
must be written knowing that the first run proves the code compiles, passes its gates and ships,
and proves *nothing* about whether the improvement works. Verification is a second run, on a
different plan. That is a planning rule, not a code change: an iteration whose Definition of Done
is "the log shows X" cannot be satisfied by the run that writes it, and declaring it that way makes
the plan lie.

**To settle:** whether the runner should refuse a plan that declares any of its own modules in
`impl_files` (cheap, honest, and blocks the harness from ever improving itself in one pass), or
whether the frozen-process property should simply be stated in the plan template so the author
budgets a proving run. And separately, whether the gate being mutable mid-run is acceptable at all:
it is the one component the whole design says must not be influenced by what it judges.

## 13. The confinement axis is empty, and that was never a decision either

**Observed.** The harness is built entirely on *detection*: the gate reads `git status`, compares
HEAD before and after, replays declared commands, refuses undeclared paths. There is no
*confinement* anywhere: no sandbox, no container, no filesystem boundary, no egress control. The
implementer is an ordinary `claude -p` holding `Read, Write, Edit, Grep, Glob, Bash` under
`--permission-mode auto`, and no fence stands around it: the four deny prefixes on git verbs
were opt-in, and their installer has since been removed.

**Two of the blind spots this question was written around have since been closed by more
detection, which is worth recording precisely because it is the cheaper answer winning again.**
`run/iteration.ts` now fingerprints the git directory's executable surface and every ref
around the implementer (`run/gitwatch.ts`), so a planted hook, a rewritten `config` and a push all
halt the run named for what they are, none of them visible to `git status --porcelain -uall`.

**What still costs, and it is structural rather than a list of bugs.** Detection is bounded by
what its author thought to snapshot, and confinement is not:

- nothing denies the implementer anything at run time: the deny-rule installer and the preflight
  check that read its rules are both gone (`run/preflight.ts`), detection having replaced
  them;
- `docs/steering-and-injection.md` already names network egress from the implementer as untreated,
  and says why it stayed untreated: *"That is a sandbox question, not an orchestration one."*;
- every check above compares a *before* to an *after*, so anything the implementer does and undoes
  inside one iteration leaves no trace at all.

**And that sentence is the question.** It was written as a scoping decision and has been read ever
since as a resolution. Nobody has decided whether this harness should acquire a confinement layer,
which is a different kind of answer from adding an eleventh check: a sandbox constrains what the
implementer *can* do, where every mechanism currently shipped only observes what it *did*, and
observation is bounded by the imagination of whoever wrote the observer.

**To measure before deciding:** what a run actually needs. The implementer's real requirements are
narrow (read the repository, write declared paths, run the project's test commands), and if that
set is small enough to enumerate, a container or a per-run user account is cheaper than the growing
list of blind spots it would retire wholesale. If it is not enumerable (a project whose tests need
the network, a `make` that pulls images), confinement is a per-project setting and the question
becomes who declares it. That is the fork, and nothing has explored either branch.

## 14. The port dropped every quantitative ceiling, and nobody noticed for a generation

**Observed.** The abandoned Workflow carried two numbers the current runner does not: a token
floor per iteration, below which the run refused to start a slice it could not finish (inert
unless the run declared a budget, and the legacy said so in its own log), and a per-iteration token
count written into the run's report. Neither survived either port. The current runner has no turn
cap, no iteration cap, and no cost measurement at all.

One ceiling did get built, and it covers the wrong half. Every **declared command** (sweep, gate,
Definition of Done) runs under a wall clock: `gate/bounded.ts#GOAL_CMD_TIMEOUT` reads `GOAL_CMD_TIMEOUT`,
default 900 seconds, and applies it as `spawnSync`'s `timeout` with
`killSignal: 'SIGKILL'`, since the default `SIGTERM` is the signal a hung process is already
ignoring. A test waiting on a port cannot hold an unattended run open. The **implementer session**
is spawned with no `timeout` at all (`run/iteration.ts`), and it is the one that can loop.
Its only brake is the quota wait (thirty minutes, three times), which arms only when the output
matches a rate-limit string.

**The consequence that matters here.** An implementer looping on an impossible slice runs to quota
exhaustion, sleeps, and repeats, with nothing anywhere saying *this slice is not converging*.

**Why it is a question and not a plan item.** A turn cap is one flag and would have been written by
now if the answer were only *add a cap*: the declared-command clock above proves the mechanism is
one option away. The open part is what a ceiling on the *implementer* should be a ceiling *on*.
Tokens are what the legacy counted and are the wrong unit for a harness whose iterations vary by an
order of magnitude in size. Wall-clock is honest and punishes a slow machine. Turns are cheap to
cap and easy to game by an agent that does more per turn. And whatever the unit, hitting the
ceiling has to leave a signal §8's classifier can act on. The gate already collapses every
refusal it makes into one exit code whatever caused it (`src/gate/halt.ts`), so a fifth
stopping reason joins a contract that already conflates two.

**To measure before deciding:** the real distribution. No run on record was instrumented: the
auditor is handed elapsed seconds per iteration and nothing about cost. Recording both per
iteration blocks no decision and is the prerequisite for every version of this question.

## 15. A halt leaves the verdict, and nothing around it

**Settled half.** The gate's own verdict does reach the log. On a refusal `run/iteration.ts`
concatenates the gate's stdout and stderr and hands them to `reporter.record()`, which appends
them to the run's own log, `.claude/goal-runs/<work-id>/<run-id>/.run.log`
(`run/report.ts#record`); `tests/goal-run-halt-log.test.ts` asserts it,
including the case where the block is split across both streams. The block naming which check
failed and on what is therefore on disk before the runner exits.

**Open half.** What is still missing is everything around that block. The runner exits on the
refusal, so the closing stage is not reached: no run report, no lens, no auditor. A refusal is the
single most information-dense event a run generates, and it produces one block and no synthesis.

**What that still blocks.** §14's ceiling needs a stop tellable apart from a gate refusal, on a
gate that collapses every refusal it makes into one exit code. And §9's session auditor is meant
to learn from what went wrong, on a harness whose closing artifacts only ever describe what went
right.

**Why the remainder is structural rather than a missing log line.** The question underneath it is
what a run owes the outside world when it stops: today the closing stage (report, lens, audit)
is conditioned on every requested iteration landing, which means the runs that most deserve a
post-mortem are precisely the ones that get none. Inverting that (always close, and let the
closing artifacts describe a halt) changes what the lens and auditor are for, since both are
currently briefed on landed work. That is a design decision about whether this harness reports on
plans or on runs.

**To measure before deciding:** what a real halt actually needs, beyond the verdict, in order to
be classified. The two recorded halts were both diagnosed by a human reading a pasted terminal.
Nobody has established which parts of that paste were load-bearing, and building the artifact
before knowing repeats exactly what §8 did.
