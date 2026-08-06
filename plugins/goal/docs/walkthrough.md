# Walkthrough — every step, and why it is that step

This is the plugin explained as a sequence of decisions rather than a set of files. For each
stage: what you do, then everything the machine does, and for every one of those a concrete
reason — the failure it prevents, or the thing it buys you.

No implementation detail and no file paths, deliberately: those go stale on the next commit, and
nothing here should. For *which layer holds what*, see
[`autonomous-architecture.md`](autonomous-architecture.md); for *why the loop has this shape at
all*, see [`adr/0001-shape-of-the-autonomous-loop.md`](adr/0001-shape-of-the-autonomous-loop.md).

**The one sentence that explains the shape of everything below:** a rule written in prose is
obeyed by a model, which is to say sometimes; a rule written in a program is executed; a rule that
is an exit code is a fact. Every guarantee is pushed down to the lowest layer that can hold it,
and the stages below are what is left at each level.

---

## The path

```
too big for one spec?  →  /goal:tickets     an ordered backlog, only the next one detailed
                             ↓
what must become true  →  /goal:spec        the functional contract, grilled
                             ↓
how it is proven       →  /goal:plan        commands, slices, budgets, the mode — then frozen
                             ↓
                     ┌───────┴────────┐
                 manual            commit+pr
            /goal + /goal:next    the runner, watched or not
             one slice at a time   the whole plan, unattended
```

Stages 1 and 2 are deliberately **not** automated. Everything after them is deliberately **not**
left to judgement. That split is the whole design.

---

## Stage 0 — `/goal:tickets`: cut an initiative into pieces

Reach for this only when the work carries several independent outcomes and no single success
signal. One spec for that would freeze guesses about parts nobody has learned anything about yet.

1. **The initiative is cut into outcome-sized pieces, and only the first is written in detail.**
   *Why:* writing acceptance detail for piece five today freezes guesses about work nobody has
   learned anything about yet, and those guesses cost more to unpick later than they would have
   cost to skip.

2. **No question is asked about what happens inside any single piece.** One such question means
   the conversation has moved to the next stage, and you are told so.
   *Why:* mixing "how do we cut this up" with "how should this one behave" turns a two-hour cut
   into a two-day session, and produces a list nobody can reorder afterwards.

3. **After a piece ships, you re-run the same step on the existing list.** It records what
   shipped and what that taught, re-asks whether the remaining order still holds, and details the
   next piece.
   *Why:* re-cutting stays cheap only because everything below the line is still one-liners — so
   the plan absorbs what you learned instead of contradicting it.

4. **Mirroring the backlog as a GitHub milestone and issues is offered, never imposed.**
   *Why:* the run never reads anything from GitHub, so the mirror is for humans. Making it
   mandatory would put a dependency on a service the machine deliberately does not use.

---

## Stage 1 — `/goal:spec`: settle what must become true

1. **Your source is read, and the session refuses to proceed if it never evidenced a real
   problem.** A source that only says "improve X" stops with a question.
   *Why:* an invented problem statement sits at the head of a chain nothing downstream ever
   re-examines. A plausible-sounding guess here becomes an unchallengeable premise for everything
   built afterwards.

2. **You are interrogated about the functional gaps, strictly one question at a time.**
   *Why:* a batch of five questions reliably gets one answer that covers two of them, and the
   three unanswered ones get silently defaulted by whoever writes the next document.

3. **Every business rule leaves with an observable acceptance criterion, and deliberately with no
   project command attached.**
   *Why:* separating *what must be true* from *which command proves it* means changing your test
   runner later never reopens a business decision, and a business decision never quietly depends
   on today's tooling.

4. **An adversarial pass is offered — states, invariants, and what every action does to every
   state. Whether you took it is recorded in the contract.**
   *Why:* an interaction nobody enumerated before the work is cut into pieces resurfaces
   mid-implementation as rework, and by then the pieces are frozen around the wrong shape.
   Recording that you declined is what stops a later reader assuming it was done.

5. **The stage ends with what now exists, an explicit list of what deliberately does not exist
   yet, and one command as the last thing on screen.**
   *Why:* you can tell from a single screen whether the work is ready to plan, without opening
   the file — and the one actionable line is not buried under a summary.

**Why this stage is not automated:** the ambiguity a source leaves cannot be lifted from inside an
unattended run. An implementer with nobody to ask resolves it by guessing, and the guess surfaces
thirty turns later as work to throw away. This is the one place a human is load-bearing.

---

## Stage 2 — `/goal:plan`: turn it into something a machine can judge

1. **Functional questions are refused here.** A business hole found at this stage stops the
   session and goes back to Stage 1 rather than being decided inline.
   *Why:* an answer settled inside the planning conversation exists only in that conversation. The
   next session starts cold and will never see it; an answer written into the contract survives.

2. **Each business rule is given the exact command line that proves it, using your project's real
   commands.**
   *Why:* an acceptance verdict produced by a program with an exit code cannot be talked around.
   One produced by a model reading the diff can be, and usually is, when nobody is watching.

3. **You are asked which mode this plan runs in — `manual` or `commit+pr` — before anything is
   split**, along with whether existing behaviour may break and where it may push.
   *Why:* the mode changes the split itself. Slices you will review by hand should be small enough
   to read in one sitting; slices a machine verifies can be fatter, and forcing those thin burns a
   whole session per trivial change. Asking afterwards would mean throwing the split away.

4. **Each slice declares, in advance: the command that proves it done, the exact files it may
   touch, a maximum number of diff lines, and its commit message.**
   *Why:* this is the contract the rest of the system enforces. Declared *after* the work, every
   one of these is a description of whatever happened. Declared *before*, each is a refusal
   condition.

5. **The plan is written to disk on its own branch, and you get one paste-ready handoff whose
   length is measured against a hard cap rather than eyeballed.**
   *Why:* past that cap the next step rejects the whole instruction and the slice never starts — a
   failure that looks exactly like nothing happening.

6. **Under `manual`, the handoff is offered on your clipboard rather than on screen.**
   *Why:* the instruction has to survive you wiping the session's memory before pasting it. A
   clipboard copy survives that; scrollback in a long session often does not.

---

## Stage 3 — the two ways to drive it

The plan is frozen. What happens next depends entirely on the mode you chose, and the two are
genuinely different products sharing a contract.

### 3a — `manual`: you are the judge, one slice at a time

You run one slice, read the diff, correct it, and only then move on. Nothing is committed, pushed
or staged for you at any point.

1. **You paste the handoff, and one slice is implemented in that session.**
   *Why:* the slice is small on purpose under this mode, so what comes back is a diff you can hold
   in your head. The value here is not autonomy — it is that you see the code at the moment
   correcting it is cheap, before anything is built on top of it.

2. **`/goal:next` re-runs the finished slice's acceptance commands from scratch and shows you the
   output, rather than trusting its checkbox.**
   *Why:* the slice verified itself. Without an independent replay, every "pass" is only ever
   self-certified — and this replay is the one thing in this mode that plays the role the gate
   plays in the other.

3. **The plan on disk is reconciled against what actually changed**, including propagating any
   adjustment forward into the slices not yet started.
   *Why:* the next session begins with no memory of this one. Anything you learned and did not
   write down is simply gone when it matters.

4. **The working tree is inspected and reported, and never staged for you.**
   *Why:* staging is your review step. Tidying it up "to make it safe" quietly removes the very
   thing you were about to look at.

5. **You are handed the next slice's instruction, on your clipboard.**
   *Why:* you are expected to clear the session between slices — that is what keeps each one
   starting cold — and the clipboard is what survives that.

6. **When no slices remain you get a merge-day checklist instead of another handoff — printed,
   never executed.**
   *Why:* the merge happens days later in a session with no memory of the run, so whatever is not
   written down now is what gets forgotten. And deleting branches is not the machine's call.

### 3b — `commit+pr`: you hand over the whole plan

One command takes the plan end to end. Everything in Stage 4 happens with nobody watching, which
is precisely why none of it is left to judgement.

1. **The runner is launched against the frozen plan**, either directly or with a session watching
   it.
   *Why:* there is nothing to decide between slices any more. Choosing the next slice is the order
   of the list — putting a model at that point would add a failure mode to the one layer
   deliberately made stupid.

2. **A watched run classifies a non-zero exit before repairing anything:** was the plan's contract
   wrong, or was the code wrong?
   *Why:* the two need opposite responses. Fixing the wrong one either throws away correct work,
   or ships a plan quietly edited until it stops complaining. The two halts this was written after
   exited with the same code and the same message and needed opposite handling.

3. **A repair to the plan is confined to a fixed list of editable things, and must prove — by
   comparing a hash taken beforehand — that no acceptance line moved.**
   *Why:* without that proof, "repairing the plan" is indistinguishable from deleting the check
   that was failing, and the run then passes against a bar nobody agreed to.

4. **It relaunches at most once.** A second failure on the same slice stops everything and wakes
   you, printing both failures and the repair in between.
   *Why:* an agent allowed to keep relaunching is optimising for the run continuing, not for the
   work being correct. A second failure means the diagnosis itself was wrong. Measured elsewhere:
   forcing a second revision drops correctness from 82% to 67%.

**This classifier is explicitly unproven.** Its own description says so: two halts are the entire
evidence behind it. The prover of the two guarantees in steps 3 and 4 is also, today, a script the
command asks a model to run rather than something that runs on its own.

---

## Stage 4 — inside the run

Everything below happens only under `commit+pr`, once per slice, with nobody watching.

### 4a — Before a byte is written

1. **A timestamped folder for this launch's records is created first, and every line the run will
   print is written into it as well.**
   *Why:* everything after this point can refuse, and a refusal that exists only as terminal
   output scrolls away. Creating the record first means the very first refusal is already durable.
   The timestamp means two launches of the same plan never overwrite each other's evidence.

2. **Nine refusals are checked, and each is a refusal rather than a warning:** the plan must name a
   mode and a remote; the checkout must stand on this plan's branch; nothing may be uncommitted;
   the folder holding the plan must be invisible to version control; a feature plan must not
   contain a cleanup slice; and no other run may hold this plan.
   *Why:* each prevents a specific, unrecoverable mess. Uncommitted work would be swept into the
   first automatic commit unreviewed. A plan folder that version control can see makes the run's
   own log and its ticked checkbox look like unauthorised changes — to the very check that polices
   scope. Guessing the remote would push, and open a pull request, on somebody else's repository,
   unattended.

3. **Every distinct check the plan will ever hold a slice to is run once, right now, against the
   untouched code** — deduplicated, so a six-slice plan reusing four commands runs four, not
   fifteen. The one check each slice is supposed to fail without its implementation is excluded.
   *Why:* two things at once. A plan that would fail on its third slice never spends the first
   two. And once this passes, any later failure of the same command is caused by the work that
   just happened — which is what makes an automatic verdict trustworthy at all.
   *This has fired for real:* one attempt stopped here with the base suite failing 35 of 202 tests
   for a machine-permission reason, and never entered a slice.

4. **The branch is fetched and compared against what it forked from.**
   *Why:* a green result from step 3 means nothing if it was measured against a base the branch has
   since fallen behind. The work would be certified against code nobody will merge into, and the
   change would conflict on arrival.

5. **Every unfinished slice is put through the judge in inspection-only mode, before any is
   implemented.** Each must declare what it will change, an acceptance command, and a commit
   message. Each hands back a fingerprint of the whole plan.
   *Why:* a slice that cannot be judged unattended must be discovered while nothing has been
   written, not after two slices are already committed. The fingerprint captured here is what later
   proves the plan was not quietly rewritten mid-run to soften the terms it is judged by.

6. **An exclusive lock on the plan is taken, and released on every way out** — finished, refused,
   paused, interrupted or crashed.
   *Why:* two runs on the same plan implement the same slice twice from different working copies,
   and the second commits over the first. Releasing on every exit path means a run that dies
   mid-slice does not block the next launch until somebody finds the stale lock by hand.

### 4b — One slice, implemented

7. **The slice's own text is copied verbatim into a prompt and handed to a brand-new session, told
   the working folder and the branch by name. The plan's location on disk is never passed.**
   *Why:* handing over that location once caused a real run to open the plan in a different copy of
   the project, treat that copy's parent as the project root, and write an entire slice into the
   wrong place — while every command it ran looked correct throughout. A fresh session per slice
   also means the plan's checkboxes, not an accumulated conversation, are the only memory of
   progress.

8. **A failure is classified before anything is concluded from it:** a process shutdown gets a
   short fixed pause, a burst rate limit gets a doubling pause capped in seconds, an exhausted
   usage allowance gets a long pause reported in slices. Anything else stops the run. Retries are
   capped.
   *Why:* running out of allowance is not a defect in the work and must not be reported as one. But
   the three causes need very different waits — treating a burst limit as an exhausted allowance
   used to sleep half an hour for something that clears in seconds, measured at 4% of the session's
   usage. The cap means a window that never reopens ends in a clean pause rather than a process
   spinning until the machine is switched off.

9. **Whether the session succeeded or failed, the attempt is recorded:** its full output, the tail
   of its own session log, and whether the tool it was running was replaced underneath it mid-work.
   *Why:* a killed unattended session used to take half a day to explain after the fact. Capturing
   the evidence at the moment of death — including an auto-updater swapping the binary mid-run —
   turns that into a line in the log.

### 4c — What the implementer is checked against, before any verdict

10. **The commit pointer must not have moved.**
    *Why:* only the judge may commit. A session that commits its own work has bypassed every check
    below, and nothing about the resulting tree would show it.

11. **No branch, tag, stash or remote pointer anywhere may have shifted.**
    *Why:* a push, a stash left behind, or a side branch leaves the ordinary "what changed" view
    completely clean, so none of it would be noticed until much later. The check compares two
    snapshots, so a stash pushed *and popped* inside the same session nets out and is invisible to
    it — what stops that is the deny rule, which is a setting, not this check.

12. **The project's configuration and hook area must be byte-identical to a snapshot taken before
    the session started** — and this is checked *before* the did-anything-happen check.
    *Why:* a session that writes a commit hook or redirects the hook path has installed code that
    runs on every future commit, and version control shows nothing. Ordering matters: a session
    that wrote *only* there would otherwise be reported as having done nothing at all.

13. **The working copy must actually have changed**; if nothing moved, the run pauses and names the
    likely cause as work written outside this folder.
    *Why:* an unchanged tree gives the judge nothing to rule on, and continuing silently would
    advance the plan on an empty slice. Naming the likely cause matters because this looks identical
    to "the session did nothing", and the two need opposite responses.

### 4d — The judgement, in a fixed order

The order is the contract: everything cheap and mechanical runs before any command is spawned, so a
slice that already broke its budget does not first pay the wall-clock of a suite it will be refused
on anyway.

14. **Every changed file must have been declared.**
    *Why:* the declared list is what makes the change reviewable. A slice that quietly tidied up
    next door is no longer the slice that was frozen, and the cleanup arrives inside a commit whose
    message describes something else.

15. **The size of the change must fit the slice's stated budget.**
    *Why:* a slice that outgrows its own estimate is no longer the slice that was reviewed. This is
    the one bound in the whole system that is a number rather than a judgement, and it is what
    turns "keep it small" from advice into a refusal.

16. **Nothing pre-existing may be deleted or renamed, unless the plan explicitly allows breaking
    changes.**
    *Why:* under the default mode, every consumer of those paths must keep working. Adding beside
    the old path is a decision; removing it is a decision too, and it should be the plan's, taken in
    advance.

17. **No later slice may be left declaring a location that no longer exists.**
    *Why:* checked before the commit on purpose — committing first would leave a commit whose own
    plan is already broken, and the run would only discover it three slices later.

18. **The acceptance commands run, in order.**
    *Why:* this is the verdict. Not a reading of the diff, not a summary from the session that wrote
    it: the project's own commands, run against the tree they are judging.

19. **The first acceptance command is then run twice more, and must pass all three times.**
    *Why:* a command that passes once and fails on a replay depends on the leftovers of its own
    previous run, or on something outside the tree. An unattended loop cannot tell that apart from a
    real failure, so it stops here rather than landing a coin-flip.

20. **Every already-finished slice's commands are replayed against this tree.**
    *Why:* so the slice that *broke* something halts, instead of the innocent slice that merely runs
    after it. Without this, a regression is attributed to whichever slice next happens to run the
    affected command.

21. **Last, the implementation is set aside and the acceptance command re-run — it must fail.**
    *Why:* this is the check that separates "the tests are green" from "the tests are green *and*
    they were red without this code". A test that passes with the implementation out of the tree
    asserts nothing about this slice. It matters more than it sounds: when the only stop condition
    is *the test passes*, editing the test is a valid path to stopping. This makes rewriting the
    test useless as a strategy rather than merely forbidden.

22. **The restore is itself verified** — the tree is fingerprinted before setting the
    implementation aside and again after putting it back, and a mismatch halts. The backup location
    is printed before the command runs, and an interrupt restores the tree on its way out.
    *Why:* the acceptance command might write state — a snapshot, a migration, a generated file. A
    destructive check that trusts its own rollback is exactly how a verification step becomes the
    thing that broke the tree. The trade: during this window the judge cannot be stopped promptly,
    because finishing is what puts your work back.

### 4e — The commit, and the tick

23. **Only if all of that passed does the judge stage exactly the declared files, commit them under
    the message the slice declared, and tick that slice's checkbox.** All three happen in one
    process, in that order.
    *Why:* the checkbox is the entire durable memory of the run, so one tick must mean exactly one
    verified commit — otherwise a relaunch resumes in the wrong place. Verifying and committing in
    the same process is what stops an orchestrator that misread a result from producing a bad commit.

24. **Generated files the project cannot help producing are staged too, not merely tolerated.**
    *Why:* a lockfile waved through but left uncommitted turns the next slice red on a file missing
    from the repository — a deferred failure in place of an honest halt.

25. **The set of already-ticked slices is compared against what was recorded before the run
    started. Any un-ticking refuses the commit.**
    *Why:* the plan fingerprint deliberately ignores ticks, so un-ticking a finished slice would
    leave the contract looking untouched while quietly dropping that slice out of the replay in step
    20. This is the only thing that notices.

### 4f — Publication

26. **Every slice except the last pushes as it lands, opening a draft pull request or rewriting the
    existing one's description.**
    *Why:* a run that halts at 3 of 15 still leaves something a person can open and read, instead of
    a local branch nobody can see.

27. **Before the first push, the history is checked for fix-up commits.**
    *Why:* reshaping has to happen before the first push, because afterwards folding a commit would
    need a force-push. This is the last moment the history can still be made into the sequence a
    reviewer should read.

28. **The committed content is scanned for secrets — and if no scanner is installed at all, the
    push is refused rather than skipped.**
    *Why:* a halted branch gets pushed too, and that is exactly how a credential reaches a remote.
    The scan reads *commits*, not the working directory, because a push carries commits — so a
    secret committed three slices ago still refuses, which is the correct answer.

29. **Publication failure is sticky: once it fails for any reason, it stays failed for the rest of
    the run rather than being retried every slice.**
    *Why:* retrying a failing publish on every slice turns one clear error into fifteen identical
    ones and buries the cause.

### 4g — Closing

30. **Once every requested slice has landed, the plan's whole-project Definition of Done is
    replayed against the whole branch. Only if it passes is the final slice's commit pushed and the
    pull request marked ready.**
    *Why:* every per-slice check only ever saw its own slice against its own commands; nothing so
    far ran the full suite against the finished branch. Holding the last push behind this is the one
    point where a failure can still stop work from reaching the remote.

31. **Two or three model-driven passes run at the end, and none can change the outcome:** one argues
    the delivered work only *appears* to satisfy the plan, one reviews the pull request in prose,
    one audits the run's own timings and compares them against earlier runs.
    *Why:* they are asked at the one moment they cannot hold anything up — the work is already
    verified and shipped, so a blocking opinion would only add friction to clear by hand. A false
    positive that kills a provably-green run at 3am costs more than the finding is worth. They still
    contribute the reading a program cannot give: whether the letter of the plan was met but not its
    intent. *This has paid off:* one such pass caught a business rule whose own test could not
    distinguish satisfaction from violation.

32. **The audit report is folded into the pull request description, replacing any earlier one rather
    than stacking beside it.**
    *Why:* costs, halts and recurring failures belong where the reviewer already is, and a second
    run on the same pull request should replace that section, not append a duplicate.

33. **The run exits with one of four codes:** everything landed; the judge refused a slice; the run
    never started so nothing needs undoing; or it stopped at a clean boundary and relaunching
    resumes there.
    *Why:* an automated supervisor has to choose between repairing the plan, discarding the work and
    retrying, and waking a human — and those are opposite responses. Collapsing them into pass/fail
    makes every stop look the same.

---

## What none of this protects against

Stated here so nobody plans against a guarantee that is narrower than its slogan.

- **The blast radius is bounded per slice, not per run.** Each slice is held to its declared paths
  and its diff ceiling. Nothing bounds the total.
- **Nothing counts assertions.** The set-aside check proves the *new* test bites. It does not prove
  a pre-existing test inside the same declared files was not quietly weakened — three assertions
  removed of four, keeping the one that fails without the implementation, passes every check here.
- **There is no iteration ceiling and no clock on the implementer.** Declared commands are bounded
  by a wall clock; the session writing the code is not. A session circling an impossible slice
  circles until the usage allowance runs out.
- **The acceptance commands are in the plan, and the plan is the implementer's brief.** The bar is
  handed to the thing being measured. The bet is that an explicit contract plus the set-aside check
  makes that knowledge harmless. It is a bet, not a proof.
- **A run that halts leaves no report.** The audit pass runs only at the close, which a halted run
  never reaches — so the evidence about failures is exactly the evidence that is missing.
- **The plan-repair guard is a script the supervising command asks a model to run**, not something
  that runs on its own. It is sound; it is simply not wired to anything that must invoke it.
- **There is no sandbox.** This runs in your working tree, pointed at a repository you trust. It
  protects the repository from the agent, not the machine from the agent.

---

## See also

- [`adr/0001-shape-of-the-autonomous-loop.md`](adr/0001-shape-of-the-autonomous-loop.md) — why this
  shape, and the three that were built and deleted before it
- [`comparison.md`](comparison.md) — what the rest of the field does, and where this loses
- [`autonomous-architecture.md`](autonomous-architecture.md) — which layer holds which guarantee
- [`open-questions.md`](open-questions.md) — what is still undecided, and what would settle it
