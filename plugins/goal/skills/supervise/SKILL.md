---
name: supervise
description: Launches `node goal-run.ts <plan>` in the background and watches it to the end. On a non-zero exit it classifies before repairing — plan at fault, implementation at fault, or unknown — never the reverse. A plan fault is repaired within a closed set (declared paths, max_diff, a mistyped path, prose) with plan-guard.ts proving no gate or dod line moved, then relaunched; an implementation fault discards the tree and relaunches unchanged; anything else stops and wakes the developer. One relaunch per iteration, then stop. Unproven — two prior halts are the whole evidence this classifier has ever seen.
disable-model-invocation: true
---

## Outside Claude Code

This skill is Claude Code only, not portable prose: it launches `node goal-run.ts`, which
spawns `claude -p` and plugin agents (`goal:goal-session-auditor`) to drive the run. Outside
Claude Code there is no `claude -p` to spawn and no agent to invoke. State that reason and
STOP before Phase 0 runs.

# /goal:supervise — Watch a run, classify a halt, repair or relaunch once

You launch `node goal-run.ts` and read what it returns. `goal-run.ts` orders the iterations and
`goal-gate.ts` decides whether each one passed; nothing here reopens either verdict. Your one job
on a non-zero exit is to say **which** of two very different things happened — the plan's contract
was wrong, or the implementation was — because the two halts this command was written after
(`docs/open-questions.md` §8) exited with the same code and the same wall message and needed
opposite responses. Getting that call wrong is worse than not calling it: it either burns the
implementer's real work for nothing, or ships a plan quietly rewritten to stop refusing it.

**This is a hypothesis, not a proven procedure.** The classification rule below was written from
two cases. Read the report at the end as evidence for or against it, not as a verdict on this run.

## Phase 0 — Resolve the plan

Argument: `$ARGUMENTS`

- A path ending in `.md` → that is the plan.
- Empty → the `.claude/plans/*-spec.md` most recently modified, excluding
  `*-cleanup-spec.md`. Several equally plausible candidates → list them
  and ASK. None → STOP: _"No plan found. Run `/goal:run-issue` first."_

## Phase 1 — Launch in the background

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-run.ts <plan>
```

Start it as a background shell. It writes nothing you need to poll for: `<plan>.run.log`
accumulates the same lines it prints, so the transcript survives you looking away.

## Phase 2 — Wait for it to end

Watch the background shell until it exits, without polling in a tight loop. Read its exit code:

| Exit | Meaning |
|---|---|
| `0` | every attempted iteration landed, gate-verified |
| `1` | halted — the gate refused one iteration |
| `2` | refused — the run never started |
| `3` | paused — a clean boundary (quota, an implementer that wrote nothing) |

## The failure report — evidence before diagnosis

Every non-zero exit is reported in one structured block, in this order:

1. **Command** — the exact command the run executed, verbatim from the log (`make php/qa`, the
   `gateN=` line the gate refused…).
2. **Output** — the failing part of that command's output, verbatim from `<plan>.run.log`: the
   error lines plus enough surrounding context to read them (the failing suites, the assertion
   diff, the lint error). Trim the green noise, never the failure.
3. **Reproduce** — the command the developer can run themselves to see the same thing, what it
   prints when healthy, and what it printed here.
4. **Diagnosis** — what you conclude from 1–3, with your confidence.
5. **Next move** — the repair, the relaunch, or the question for the developer.

The same evidence duty covers silent mutations: after any stage that runs project commands
(preflight, DoD), check `git status --short` — a QA command that *fixes* instead of failing
(a mutating cs-fixer, a formatter) leaves a dirty tree nobody reported. Show that diff
verbatim and say which command produced it; never fold it into a commit without showing it.

Never deliver 4–5 without 1–3: a solution whose problem the developer never saw is advice, not
a report — the failure this section was added after was three refusals reported as "jest OOM,
fix Docker" without one line of jest output shown. And the whole block goes in the **final
message of the turn**: text emitted between tool calls is not reliably displayed, so a report
printed mid-turn may never reach the developer at all.

## Phase 3 — `0` or `3`: report, nothing to classify

Neither exit names a fault. `0` → report what landed. `3` → report the boundary the log names
and that relaunching resumes at the first unchecked box; do not relaunch it yourself, that is
the developer's call, not a repair.

## Phase 4 — `2`: nothing was attempted

A refusal exit means the preflight stopped the run before any iteration was handed to an
implementer — there is no work to classify and nothing to discard. Build the failure report:
the `STOP` line names the command (Command), the log holds its output (Output — for a
not-green base, the failing tests/lint lines themselves, not just the summary line). Wake the
developer with it: the cause (a lock, a dirty tree, a stale branch, a red base) is almost
always theirs to fix, and relaunching blind repeats the same refusal.

## Phase 5 — `1`: classify before repairing

Read the log tail back to the gate's own `HALT` block — `REASON:` and `DETAIL:`, written by
`plugins/goal/scripts/gate/halt.ts`. That text is the only evidence there is; do not re-run the
gate to get a second opinion; it will say the same thing.

Sort what it names into exactly one bucket:

- **Plan fault** — the `DETAIL:` names a defect in the iteration's own contract: a declared path
  that does not exist or is misspelled, a `max_diff` too tight for work the iteration's prose
  plainly asked for, an `impl_files`/`test_files` entry missing a file the goal names, prose that
  reads one way and was enforced another. The fix stays inside a closed set: an entry in
  `test_files` or `impl_files`, `max_diff`, a mistyped path, or prose. **It may never touch a
  `gateN=` or `dodN=` line**, nor empty `test_files` — `plan-guard.ts` hashes that field's
  emptiness, not its content, so it disarms the bite check the same way a rewritten gate line
  would: not a smaller iteration, a different one, judged by a bar nobody locked.
- **Implementation fault** — the same gate line is correct and the code it judged is not: a
  wrong file touched, a rule half-implemented, a helper the plan never needed guessed into
  existence. The fix is to try again, not to edit the contract.
- **Unknown** — anything that is not confidently one of the above: the `DETAIL:` names something
  outside the closed repair set, points at more than one iteration, or you cannot tell which side
  of the line it falls on. Guessing here is the failure mode this command exists to avoid.

### Plan fault → repair, prove it, relaunch

1. Hash the plan before touching it: `node ${CLAUDE_PLUGIN_ROOT}/scripts/plan-guard.ts <plan>` →
   keep `guard_hash`.
2. Make the smallest edit inside the closed set above. Nothing else in the plan moves — no
   rewording a goal, no reordering iterations, no touching a checkbox.
3. Prove it: `node ${CLAUDE_PLUGIN_ROOT}/scripts/plan-guard.ts <plan> <guard_hash>` must print
   `OK: no gate or dod line moved.` and exit 0. If it halts instead, the edit reached a guarded
   line — revert it (`git checkout -- <plan>`) and fall through to unknown.
4. Have the gate re-judge the preserved tree **directly**: `node
   ${CLAUDE_PLUGIN_ROOT}/scripts/goal-gate.ts verify <plan> <iteration>`, then on exit 0
   `goal-gate.ts commit <plan> <iteration>`, then `goal-gate.ts dod <plan>` if it was the last
   iteration. Do NOT relaunch via `goal-run.ts` here: its preflight requires a clean tree and
   refuses (exit 2) the very implementer tree this procedure just decided to keep — observed on
   ct-5865 iteration 3. The gate subcommands are the run's own judge/commit path, bite check
   included, so nothing lands unbitten.

### Implementation fault → discard the tree, relaunch unchanged

1. Discard exactly what the halted attempt wrote, and nothing that predates it — the preflight
   already required a clean tree, so everything `git status --short` shows now belongs to this
   attempt: `git checkout -- .` for tracked changes, `git clean -fd` for untracked ones. Never
   `-x`: that would also sweep the ignored `.claude/plans/` directory the run itself writes into.
2. Confirm the tree is clean (`git status --short` prints nothing) before relaunching.
3. Relaunch the same iteration, plan untouched:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-run.ts <plan> <iteration>`.

### Unknown → stop, wake the developer

Build the failure report — the `HALT` block verbatim is its Command/Output — say plainly that
you could not classify it, and name why — which detail put it outside the closed set. Do not
guess at a repair and do not discard anything.
This is the same halt a human reading the log would have to solve; it stays theirs.

## Phase 6 — One relaunch, then stop

Whichever repair ran, watch the relaunch exactly as in Phase 2, then report Phase 3/4/5 against
*its* exit code — but do not repair a second time. A second halt on the same iteration, of either
kind, means the classification was wrong, the repair was incomplete, or the halt has a cause this
command does not model: build the failure report with everything (both `HALT` blocks, the repair
made in between, `git status --short`) and stop for the developer. Looping again is exactly the failure the design
guards against — an agent that keeps relaunching optimizes for the run continuing, not for the
work being right.

## Phase 7 — Audit the session, unless nothing was attempted

Skip this phase on exit `2`: the preflight refused before any iteration reached an implementer,
so there is no implementer transcript and nothing was driven — auditing how work was done when
none was is waste by construction. Print the Phase 4 report and stop.

Otherwise — landed, paused, halted, or a relaunch that itself landed or stopped — invoke the
`goal:goal-session-auditor` agent exactly once before you finish, passing it the plan's path and
`$(pwd)`. It reads the transcripts a run left behind, including this supervising session's own,
and reports findings anchored to a tool-call sequence: an edit reverted, the same command failing
twice, a file read five times, a brief that named a convention skill with no `Skill` call to
match. Print what it returns; nothing it finds changes the exit you already reported.

Once the audit returns, fold its highlights into the PR's run report as a `### Session audit`
section — but only when the plan's policy is `commit+pr` and a pull request is open: `gh pr edit
<branch> --repo <repo> --body "$(gh pr view <branch> --repo <repo> --json body -q .body)

### Session audit

<highlights>"`. Outside `commit+pr`, or with no PR open yet, there is nowhere to fold it: the
highlights stay in this session's own final message instead.

## Duration table

Every final report — Phase 3, 4, or the end of Phase 5/6 — that attempted at least one
iteration prints the same two tables the auditor writes into `report.md`, built from the run's
own `.run.jsonl` (one JSON line per `RUN stage=<name> duration_ms=<n> exit=<n>` event
`goal-run.ts` already emits): extend those tables with this session's own rows, never reshape
them into a differently-shaped one of your own. Skip both only on exit `2`: Phase 4 already
covers that case, and there is no per-iteration row to print when nothing was attempted.

**Durations**, one row per step: `preflight` and the base-must-already-be-green sweep stand alone
at the top (they run once, before any iteration); one row per iteration, in order; `dod` at the
end. Each step's own duration goes under the stage that ran it, `push` collapsing `push` and
`pull-request-update` into one publication figure on the row of the iteration that triggered it:

| Step | Implementer | Gate | Push |
|---|---|---|---|
| Preflight/sweep | — | — | — |
| 1 | `<duration>` | `<duration>` | — |
| … | … | … | … |
| Dod | — | — | — |
| **Total** | `<sum>` | `<sum>` | `<sum>` |

Show every duration in minutes once it passes 60 s (`1m 12s`, not `72000`); below that,
milliseconds are fine. Print an exit code only on the rows whose stage failed; a row that landed
carries no exit code at all. `Total` sums the displayed rows, not a re-scan of every
`duration_ms` in the file — a step this table does not show never enters the total.

**Attribution**, one row per Claude-session stage — `implementer` per iteration, `lens`,
`reviewer`, `auditor` — read off that stage's own `RUN tokens stage=<name> input_tokens=<n>
output_tokens=<n> cache_creation_input_tokens=<n> cache_read_input_tokens=<n>` line, right after
its `stage=` line:

| Stage | Model | Context peak | Total tokens | % cache read | Cost (list) |
|---|---|---|---|---|---|
| Iteration 1 — Implementer | `<model>` | `<pct>` | `<n>` | `<pct>` | `<$>` |
| … | … | … | … | … | … |
| **Runner subtotal** | — | — | `<sum>` | — | `<sum>` |
| Lens | `<model>` | `<pct>` | `<n>` | `<pct>` | `<$>` |
| Reviewer | `<model>` | `<pct>` | `<n>` | `<pct>` | `<$>` |
| Auditor | `<model>` | `<pct>` | `<n>` | `<pct>` | `<$>` |
| Supervising session | `<model>` | `<pct>` | `<n>` | `<pct>` | `<$>` |
| **Total** | — | — | `<sum>` | — | `<sum>` |

`Total tokens` is the four token classes summed for the row. `Context peak` is the percentage
only, never the token count, and never the effective window itself, which is named once in a
note under the table (`Effective window: <model> <n> tokens`) together with the run's own
compaction count, `0` stated rather than left blank, rather than repeated cell by cell — a model
absent from that note shows its tokens instead of a percentage. `Cost (list)` is priced at the
model's list rate, computed by you, the writer, from the four token classes — never read off the
transcript. The `Runner subtotal` row sums the `implementer` rows above it — what driving the
plan itself cost — and is not summed again into `Total`, which sums every other displayed row.
Under the table, one line naming the run's own per-class totals, summed straight off the `RUN
tokens` lines: `Input: <n> · Output: <n> · Cache creation: <n> · Cache read: <n>` — enough to
price the run without opening `.run.jsonl`.

**The supervising session counts itself.** Everything above measures what `goal-run.ts` spawned;
it never measures the session reading this skill and watching it. After the run ends, locate
this session's own transcript under `~/.claude/projects/<encoded-cwd>/` (the working directory
with every `/` turned into a `-`). A transcript repeats one message's `usage` on every
content-block entry it produced, so before summing, deduplicate by message id — keep one usage
per id — to land on the envelope-exact figure rather than an inflated one; the peak needs no such
rule, `max` is immune to a repeated value. Sum the per-class usage that survives deduplication
across the transcript, and add the `Supervising session` row to the attribution table with those
four numbers, and — read the same way off that transcript's own events — its served model, its
context peak (percentage against the note's effective window, or tokens if the model is
unknown), and its compaction count folded into the note alongside the rest. `Total`, and the
per-class totals line beneath the attribution table, include that row like any other — a token
total that leaves out the session that spent them is not a total.

## Closing paths

Every closing report names the plan and the run directories it produced, so the developer can
open them without hunting: the plan path, then each run directory under `.claude/goal-runs/`,
one path per line — never a single `·`-joined line. A developer copy-pasting a path off a run
that used commas or middle dots as separators is the failure this rule exists to avoid.

## Rules for THIS command

- **Classify before repairing, always** — never patch a plan and never discard a tree without
  first naming which fault this is and why.
- **A plan fault may only move inside the closed set**, proven by `plan-guard.ts` before every
  relaunch. A `gateN=`/`dodN=` line moving is never a repair, it is the halt disappearing.
- **It never patches implementation code.** The tree it may touch is discarded, not edited; the
  implementer rewrites under the gate on relaunch, so nothing lands that the bite check never bit.
- **Unknown stops.** No repair is better than a wrong one.
- **One relaunch per iteration, then stop** — no matter which bucket, no matter the second exit.
