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
