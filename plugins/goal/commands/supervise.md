---
description: Launches `node goal-run.ts <plan>` in the background and watches it to the end. On a non-zero exit it classifies before repairing — plan at fault, implementation at fault, or unknown — never the reverse. A plan fault is repaired within a closed set (declared paths, max_diff, a mistyped path, prose) with plan-guard.ts proving no gate or dod line moved, then relaunched; an implementation fault discards the tree and relaunches unchanged; anything else stops and wakes the developer. One relaunch per iteration, then stop. Unproven — two prior halts are the whole evidence this classifier has ever seen.
argument-hint: Optional plan path (.claude/plans/<work-id>-spec.md); omit to auto-discover
---

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

## Phase 3 — `0` or `3`: report, nothing to classify

Neither exit names a fault. `0` → report what landed. `3` → report the boundary the log names
and that relaunching resumes at the first unchecked box; do not relaunch it yourself, that is
the developer's call, not a repair.

## Phase 4 — `2`: nothing was attempted

A refusal exit means the preflight stopped the run before any iteration was handed to an
implementer — there is no work to classify and nothing to discard. Print the log's `STOP` line
verbatim and stop. Wake the developer: the cause (a lock, a dirty tree, a stale branch) is
almost always theirs to fix, and relaunching blind repeats the same refusal.

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
4. Relaunch the same iteration: `node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-run.ts <plan>
   <iteration>`. The implementer's tree from the halted attempt is left as it was; the contract
   it is judged against is what changed.

### Implementation fault → discard the tree, relaunch unchanged

1. Discard exactly what the halted attempt wrote, and nothing that predates it — the preflight
   already required a clean tree, so everything `git status --short` shows now belongs to this
   attempt: `git checkout -- .` for tracked changes, `git clean -fd` for untracked ones. Never
   `-x`: that would also sweep the ignored `.claude/plans/` directory the run itself writes into.
2. Confirm the tree is clean (`git status --short` prints nothing) before relaunching.
3. Relaunch the same iteration, plan untouched:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-run.ts <plan> <iteration>`.

### Unknown → stop, wake the developer

Print the `HALT` block verbatim, say plainly that you could not classify it, and name why —
which detail put it outside the closed set. Do not guess at a repair and do not discard anything.
This is the same halt a human reading the log would have to solve; it stays theirs.

## Phase 6 — One relaunch, then stop

Whichever repair ran, watch the relaunch exactly as in Phase 2, then report Phase 3/4/5 against
*its* exit code — but do not repair a second time. A second halt on the same iteration, of either
kind, means the classification was wrong, the repair was incomplete, or the halt has a cause this
command does not model: print everything (both `HALT` blocks, the repair made in between,
`git status --short`) and stop for the developer. Looping again is exactly the failure the design
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

## Rules for THIS command

- **Classify before repairing, always** — never patch a plan and never discard a tree without
  first naming which fault this is and why.
- **A plan fault may only move inside the closed set**, proven by `plan-guard.ts` before every
  relaunch. A `gateN=`/`dodN=` line moving is never a repair, it is the halt disappearing.
- **It never patches implementation code.** The tree it may touch is discarded, not edited; the
  implementer rewrites under the gate on relaunch, so nothing lands that the bite check never bit.
- **Unknown stops.** No repair is better than a wrong one.
- **One relaunch per iteration, then stop** — no matter which bucket, no matter the second exit.
