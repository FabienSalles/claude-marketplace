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
