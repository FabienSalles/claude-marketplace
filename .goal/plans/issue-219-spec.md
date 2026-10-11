# Spec: Run locks live outside the repository, not beside the plan

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/219
Source plan: /Users/fabiensalles/projects/github/claude-marketplace/.claude/plans/goal-multi-provider-backlog.md
Work-id: issue-219
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
---

Adversarial grill: ran (in /goal:spec)

## Business intent

**Problem.** A run creates its two locks beside the plan it runs: `${plan}.run.lock` (`plugins/goal/src/gate/scope.ts:114`, `plugins/goal/src/run/preflight.ts:151`) and `${plan}.tick.lock` (`scope.ts:154`). A plan kept in the repository therefore needs its own `.gitignore` exclusions, and all five goal skills (spec, plan, next, tickets, supervise) tell the developer to prepare `<plan>.run.lock/` and `<plan>.tick.lock/` entries for every plan. PR #218 carried two such per-plan lines until review; this repository carries the generic `*.run.lock/` and `*.tick.lock/` patterns (`.gitignore:7-8`) only to absorb them. A lock lives exactly as long as the process that holds it, so it never needed to sit in the repository at all.

**Objective.** A run's locks live outside the repository, in a fixed per-user directory of the machine's temp space (`/tmp/goal-locks-<uid>/`), so a plan needs no `.gitignore` entry of its own and the goal skills stop asking for one, while the locks keep guaranteeing exactly what they guarantee today.

**Success signal.** In a project that has never run a goal, a new plan's first run leaves `<runs>/` as the only goal line in `.gitignore`, and nothing appears beside the plan while the run is in progress or after it ends.

**Affected.** The developer, who stops adding two lines to `.gitignore` per plan and stops reading that instruction in five skills; the run and the gate, whose exclusivity guarantees must survive the move; the repository's own `node scripts/verify.ts`, which detects a goal run through its lock.

The locks exist so that two runs never implement the same iteration twice and two writers never tick the same box from different trees. Moving them is worth nothing if either guarantee weakens, so the contract below restates both, and covers the cases the move creates: a lock left beside a plan by an earlier version, the same plan reached through different path spellings, a lock directory that does not exist yet, and a temp directory that differs from one environment to the next.

## Reproduction

- `grep -rn "\.run\.lock\|\.tick\.lock" plugins/goal/src` →
  - `plugins/goal/src/gate/scope.ts:114:  const path = \`${plan}.run.lock\`;`
  - `plugins/goal/src/gate/scope.ts:154:  takeLock(\`${plan}.tick.lock\`, iteration);`
  - `plugins/goal/src/run/preflight.ts:151:  const lockPath = \`${plan}.run.lock\`;`
- `grep -rln "<plan>.run.lock/" plugins/goal/skills | wc -l` → `5`
- `grep -n "lock" .gitignore` → `7:*.run.lock/` and `8:*.tick.lock/`
- `grep -n "check-ignore" plugins/goal/src/run/preflight.ts` → `110:  const goalRunsResult = goalRunsIgnored(isExternal || git('check-ignore', '-q', '--', runs).status === 0, goalRunsDir);`

Measured on `823c6ef`, whose tree equals `origin/main@d3160b4`.

## Scope IN

- Where a run's run lock and tick lock are created, for every verb that takes one: the runner's launch, and the gate's `lock` and `commit` (including a `commit` invoked directly, as `/goal:supervise` does on a plan fault).
- What a run or a gate verb does when it finds a lock at the old location beside the plan.
- What `goal-gate.ts unlock <plan>` releases.
- The `GOAL_LOCK_ROOT` setting that relocates the lock directory, for hermetic tests.
- The repository verify's goal-run detection (`scripts/verify/holder.ts`), which follows the locks.
- The ignore-preparation paragraph of the five goal skills (spec, plan, next, tickets, supervise), and the README lines that document the old location.

## Scope OUT

- Removing `*.run.lock/` and `*.tick.lock/` from this repository's `.gitignore`: ticket 0h (#220), after this one is live.
- Removing any lock line from any project's `.gitignore`: the skills leave existing lines alone.
- Exclusivity between two containers that mount the same repository but each have their own `/tmp`: accepted, they do not see each other's locks.
- Stale-lock detection (a lock whose holder is gone): unchanged, a lock is released by hand as today.
- Dropping the old-location check (R6): it stays; removing it would need its own ticket once no old lock can remain anywhere.

## Business rules (each must map to a command in the DoD)

- **R1 — nothing beside the plan:** a run creates its locks in `/tmp/goal-locks-<uid>/` (or `GOAL_LOCK_ROOT`) and nothing beside the plan or anywhere in the repository → observed when: during and after a run, whatever its outcome (landed, halted, paused, refused, interrupted), the plan's directory holds no file or directory the run created, and a tracked plan's repository shows no new untracked path beside it. → verified by `gate1` of iteration 1 (`plugins/goal/tests/gate-locks.test.ts`)
- **R2 — one run per plan:** while a run holds a plan, a second launch of that plan is refused → observed when: the second launch stops before any iteration, naming the held lock's path and `goal-gate.ts unlock <plan>`. → `gate1` of iteration 1
- **R3 — one tick writer per plan:** while a commit holds a plan's tick lock, another commit on that plan is refused → observed when: the second commit leaves no commit and no tick, and names the held lock. → `gate1` of iteration 1
- **R4 — a lock belongs to one plan file:** two distinct plan files never block each other, even when they share a work-id (the same file name in two directories) → observed when: both take their run lock at the same time. → `gate1` of iteration 1
- **R5 — one plan file, one lock, however its path is written:** a plan reached through a relative path, an absolute path or a symlink maps to the same lock → observed when: while a run holds the plan under one spelling, a launch under another spelling is refused as in R2. → `gate1` of iteration 1
- **R6 — an old lock blocks:** a lock left beside the plan by an earlier version (`<plan>.run.lock/` or `<plan>.tick.lock/`) refuses a launch and a gate `commit` → observed when: the refusal names the old path and `goal-gate.ts unlock <plan>`, and nothing is implemented, committed or ticked. → `gate1` of iteration 1
- **R7 — one release command:** `goal-gate.ts unlock <plan>` releases the plan's lock in the lock directory and any run or tick lock left beside the plan → observed when: after it, a launch that R2 or R6 refused proceeds; with nothing held, it succeeds and changes nothing. → `gate1` of iteration 1
- **R8 — a refused run leaves no lock:** a run the preflight refuses (dirty tree, `<runs>` not ignored, red base…) holds no lock afterwards → observed when: right after the refusal, no lock exists for that plan in the lock directory or beside the plan. → `gate1` of iteration 1
- **R9 — the first run works:** when the lock directory does not exist yet (first run ever, or after a reboot), the first run takes its lock and runs → observed when: with `GOAL_LOCK_ROOT` pointing at a directory that does not exist, a lock is taken and the directory is created. → `gate1` of iteration 1
- **R10 — the temp variable does not split a lock:** the lock directory is the same whatever `$TMPDIR` a session runs under → observed when: while a plan is locked, a lock attempt from a process with a different `$TMPDIR` is refused as in R2. → `gate1` of iteration 1
- **R11 — the skills stop asking:** the goal skills prepare only the `<runs>/` exclusion → observed when: none of the five skills and the README names `<plan>.run.lock`, `<plan>.tick.lock`, `*.run.lock` or `*.tick.lock`, and the README names the lock directory. → `gate1` of iteration 2
- **R12 — existing lines stay:** lock lines already in a project's `.gitignore` are left untouched → observed when: this repository keeps `*.run.lock/` and `*.tick.lock/` byte for byte throughout the plan. → `dod5`
- **R13 — release on every exit, unchanged:** the run lock is released on every exit path (landed, refused, paused, interrupted by INT or TERM, uncaught error); only a SIGKILL leaves it → observed when: after each of those exits but SIGKILL, an immediate relaunch is not refused for a held lock. → `gate4` of iteration 1 (`plugins/goal/tests/goal-run-lock-signals.test.ts` and the run tests it lists)
- **R14 — the repository's verify still sees a goal run:** `node scripts/verify.ts` still refuses while a goal run holds a plan of this checkout, and still reports a lock whose run is gone as stale with its release command → observed when: with a run holding a plan of the checkout, verify refuses naming that plan; with only a stale lock left, verify proceeds and prints the stale-lock note naming `goal-gate.ts unlock <plan>`. → `gate1` of iteration 1 (`scripts/tests/verify-holder.test.ts`)
- **R15 — the lock directory can be relocated, only on purpose:** `GOAL_LOCK_ROOT`, when set, is the lock directory; a value that is empty or not an absolute path refuses every lock-taking verb with exit 2 before anything runs → observed when: a relative `GOAL_LOCK_ROOT` refuses `goal-gate.ts lock` and a launch with exit 2, naming the variable. → `gate1` of iteration 1

## States, invariants & transitions

- **States (per plan file):**
  - S0 free: no lock anywhere
  - S1 run lock held, new location
  - S2 tick lock held, new location: inside S1, or during a direct gate `commit`
  - S3 old run lock or old tick lock beside the plan
  - S4 lock directory absent
  - S5 `<runs>` not ignored
  - S6 orphan lock: its holder was SIGKILLed
- **Invariants:**
  - I1 at most one run per plan file (owner: the run lock; R2, R5) — iteration 1
  - I2 at most one tick writer per plan file (owner: the tick lock; R3) — iteration 1
  - I3 the current version creates nothing beside a plan (owner: lock creation; R1) — iteration 1, transverse through `gate1`'s regression wall
  - I4 a run that ended, other than by SIGKILL, holds no lock, and a refused run never took one (owner: the runner; R8, R13) — iteration 1
  - I5 a lock's identity is the plan file itself, for one user on one machine, whatever `$TMPDIR` or `GOAL_ROOT_PATH` says (owner: lock resolution; R4, R5, R10) — iteration 1
  - I6 nothing a lock needs is written in the repository (owner: lock placement; R1) — transverse
  - I7 a lock at the old location is honoured as held (owner: every lock-taking verb; R6, R7) — iteration 1
- **Transition matrix:**

| State \ Action | launch | gate `commit` | gate `unlock` | 2nd plan, same work-id | another path spelling or `$TMPDIR` |
|---|---|---|---|---|---|
| S0 | → S1, runs | → S2, then S0 | no-op, S0 | runs alongside (I5) | same lock as S1 |
| S1 | refused (I1) | tick taken inside the run | → S0 | runs alongside | refused (I1) |
| S2 | refused (I1) if in S1 | refused (I2) | → S0 | runs alongside | refused |
| S3 | refused, names old path (I7) | refused, names old path (I7) | → S0, old removed | runs alongside | refused |
| S4 | creates the lock directory, → S1 (R9) | creates it, → S2 | no-op | runs alongside | — |
| S5 | refused at preflight, no lock (I4) | — | no-op | — | — |
| S6 | refused as S1 | refused as S2 | → S0 | runs alongside | refused |

- Each invariant is a **sequence test** in `plugins/goal/tests/gate-locks.test.ts` (drive the verbs in order, assert the lock state after each), owned by iteration 1; I3 and I6 are re-verified by every later `verify` through iteration 1's `gate1`.

## Delivery strategy

Additive, no flag. The new location replaces the old one in one slice, and the old location stays honoured as held (R6) and released by `unlock` (R7), so a session still running the previous plugin version and a new-version session never run the same plan at once. The goal-gate command line (`lock`, `unlock <plan>`) is unchanged. The one consumer of the old path, `scripts/verify/holder.ts`, follows the move in the same slice (R14), and keeps reading old-location locks too. Nothing is removed, so there is no cleanup plan.

## Blast radius

- `<plan>.run.lock` beside a plan → read by `scripts/verify/holder.ts:10,53` (the repository verify refuses while a goal run holds the checkout, and reports stale locks); breaks silently if the lock moves without it → moved in iteration 1 (R14).
- `plugins/goal/README.md:215,225,261` → documents the old location and its exclusions; nothing breaks, the text goes stale → iteration 2.
- A session still running the previous plugin version → covered by R6 (old locks block) and R7 (`unlock` clears both).
- `goal-gate.ts lock|unlock <plan>` → unchanged interface.

## Files NOT to touch

- `.gitignore` — its lock lines stay (R12; 0h removes them later).
- `plugins/goal/src/artifacts.ts` — the lock directory does not depend on the artifact root.
- `plugins/goal/src/run/lock.ts` — the release-on-every-exit lifecycle is unchanged (R13); it reaches the locks through the gate adapter.

## Definition of Done (global, command-line verifiable)

```gate
# rule: the whole goal suite stays green, every business rule's test included
dod1=node scripts/verify.ts goal-gate
# rule: the goal plugin and scripts remain type-safe
dod2=node node_modules/typescript/bin/tsc --noEmit
# rule: structure, lint, doc anchors and module headers hold
dod3=node scripts/verify.ts structure
# rule: R14 — the repository's script tests, verify-holder included, stay green
dod4=node scripts/verify.ts unit
# rule: R12 — this repository's existing lock lines stay untouched
dod5=grep -qxF '*.run.lock/' .gitignore && grep -qxF '*.tick.lock/' .gitignore
```

Also true, and not expressible as a command of its own:
- Every business rule above has a passing covering test (proven by `dod1` and `dod4`)

## Functional iterations

### Iteration 1 — Run and tick locks are taken in the per-user temp directory, old locks still block
- [x] Not done yet
- **Goal:** A run's locks are created outside the repository, in a per-user temp directory, while an old lock beside the plan still blocks and unlock clears both.
- **Shippable after it:** every run and every gate commit locks in `/tmp/goal-locks-<uid>/` (or `GOAL_LOCK_ROOT`); nothing lock-related appears beside a plan; an old-version lock still blocks and `unlock` clears it; the repository verify still detects a goal run. The skills still mention the old exclusions, harmlessly.
- **Files to touch:** `plugins/goal/src/gate/locks.ts` (new: the lock directory, a lock's paths from the plan's real path, the old-location paths), `plugins/goal/src/gate/scope.ts`, `plugins/goal/src/run/preflight.ts`, `plugins/goal/src/core/preflight.ts`, `plugins/goal/src/core/settings.ts`, `plugins/goal/scripts/goal-gate.ts`, `scripts/verify/holder.ts` (+ `plugins/goal/tests/gate-locks.test.ts` (new), `scripts/tests/verify-holder.test.ts`, and the tests that pin `${plan}.run.lock`: `plugins/goal/tests/support/goal-run-harness.ts`, `tracked-plan`, `gate-commit`, `core-run`, `goal-run-events-smoke`, `goal-run-halt-log`)
- **Business rules covered:** R1–R10, R13, R14, R15
- **Delivery:** additive; the old location stays honoured (R6, R7)
- **Not machine-verifiable:** none
- **Implementation notes:**
  - The lock directory is `GOAL_LOCK_ROOT` when set, else `/tmp/goal-locks-<process.getuid()>`; never `os.tmpdir()`, which follows `$TMPDIR` (R10). It is created on first use (R9).
  - A lock's name is the plan's file name without `.md`, a dash, and the first 12 hex characters of the sha256 of the plan's `realpath`, then `.run.lock` or `.tick.lock` (R4, R5). It stays a `mkdir` lock.
  - The run lock directory records the plan's real path in a `plan` file, which `holder.ts` reads to keep only the plans of its checkout (R14); `holder.ts` keeps reading old-location locks beside `.goal/plans` too.
  - `GOAL_LOCK_ROOT` joins the gate's settings: an empty or relative value is a fault reported with exit 2 before any command, like `GOAL_CMD_TIMEOUT` (R15).
  - Every test that takes a lock sets `GOAL_LOCK_ROOT` to its own temp directory and never touches the real `/tmp/goal-locks-<uid>/` (hermetic, `craft:test-suite-design` §1).
  - Lesson from #221 and #222: run `plugins/goal/tests/suite-guards.test.ts` before handing back (`gate5`), and keep the added cost per gate command near zero: the goal suite's CI ceiling is 80 s.

```gate
test_files=plugins/goal/tests/gate-locks.test.ts scripts/tests/verify-holder.test.ts plugins/goal/tests/support/goal-run-harness.ts plugins/goal/tests/tracked-plan.test.ts plugins/goal/tests/gate-commit.test.ts plugins/goal/tests/core-run.test.ts plugins/goal/tests/goal-run-events-smoke.test.ts plugins/goal/tests/goal-run-halt-log.test.ts plugins/goal/tests/gate-settings.test.ts plugins/goal/tests/core-settings.test.ts
impl_files=plugins/goal/src/gate/locks.ts plugins/goal/src/gate/scope.ts plugins/goal/src/run/preflight.ts plugins/goal/src/core/preflight.ts plugins/goal/src/core/settings.ts plugins/goal/scripts/goal-gate.ts scripts/verify/holder.ts
max_diff=700
commit_msg=feat(goal): take run and tick locks in a per-user temp directory
# rule: R1–R10, R14, R15 — locks live in the lock directory, keep every exclusivity guarantee, honour old locks, and stay visible to the repository verify
gate1=node --test plugins/goal/tests/gate-locks.test.ts scripts/tests/verify-holder.test.ts
# rule: the goal plugin and scripts remain type-safe
gate2=node node_modules/typescript/bin/tsc --noEmit
# rule: the project lint holds
gate3=node node_modules/eslint/bin/eslint.js --config eslint.config.js plugins scripts
# rule: R13 — the run and gate tests that take locks stay green, release on every exit included
gate4=node --test plugins/goal/tests/tracked-plan.test.ts plugins/goal/tests/gate-commit.test.ts plugins/goal/tests/core-run.test.ts plugins/goal/tests/goal-run-events-smoke.test.ts plugins/goal/tests/goal-run-halt-log.test.ts plugins/goal/tests/goal-run-lock-signals.test.ts plugins/goal/tests/gate-settings.test.ts plugins/goal/tests/core-settings.test.ts
# rule: the suite's own guards hold (fixed waits, frozen names, orphan files)
gate5=node --test plugins/goal/tests/suite-guards.test.ts
```

### Iteration 2 — The goal skills and the README stop asking for lock exclusions
- [x] Not done yet
- **Goal:** The goal skills prepare only the runs exclusion, the README documents where locks now live, and the goal plugin ships as 3.4.0.
- **Shippable after it:** a developer running any goal skill is no longer told to add `<plan>.run.lock/` or `<plan>.tick.lock/` to `.gitignore`; the README's troubleshooting row names the lock directory and the unlock command; the plugin version moves from 3.3.5 to 3.4.0, so installed copies pick up this change and #221 and #222.
- **Files to touch:** `plugins/goal/skills/spec/SKILL.md`, `plugins/goal/skills/plan/SKILL.md`, `plugins/goal/skills/next/SKILL.md`, `plugins/goal/skills/tickets/SKILL.md`, `plugins/goal/skills/supervise/SKILL.md`, `plugins/goal/README.md`, `plugins/goal/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (the goal entry's version only)
- **Business rules covered:** R11
- **Delivery:** additive (documentation only)
- **Not machine-verifiable:** the reworded paragraph still reads clearly in each skill

```gate
test_files=
impl_files=plugins/goal/skills/spec/SKILL.md plugins/goal/skills/plan/SKILL.md plugins/goal/skills/next/SKILL.md plugins/goal/skills/tickets/SKILL.md plugins/goal/skills/supervise/SKILL.md plugins/goal/README.md plugins/goal/.claude-plugin/plugin.json .claude-plugin/marketplace.json
max_diff=120
commit_msg=docs(goal): stop asking for per-plan lock exclusions
# rule: R11 — no goal skill or README line asks for a lock exclusion, the README names the lock directory, and the plugin ships as 3.4.0 in both manifests
gate1=! grep -rnE '<plan>\.(run|tick)\.lock|\*\.(run|tick)\.lock' plugins/goal/skills plugins/goal/README.md && grep -q 'goal-locks' plugins/goal/README.md && node -e "const m=require('./.claude-plugin/marketplace.json'),p=require('./plugins/goal/.claude-plugin/plugin.json');process.exit(m.plugins.find((e)=>e.name==='goal').version==='3.4.0'&&p.version==='3.4.0'?0:1)"
# rule: the goal plugin and scripts remain type-safe
gate2=node node_modules/typescript/bin/tsc --noEmit
# rule: skill coherence, doc anchors and the lint hold
gate3=node scripts/verify.ts structure
```

## Out-of-band decisions captured during grill
- Q: Where do the locks live?
  A: `/tmp/goal-locks-<uid>/`, a fixed path, instead of `<runs>`: nothing lock-related touches the repository, the gate needs no artifact root, and different artifact roots no longer split a lock. Accepted loss: two containers with their own `/tmp` on one repository; a macOS `/tmp` purge of entries untouched for 3 days.
- Q: How do tests avoid the real lock directory?
  A: `GOAL_LOCK_ROOT`, an absolute path validated like the other gate settings (R15).
- Q: A lock left beside the plan by an earlier version?
  A: It blocks, naming its path and `goal-gate.ts unlock <plan>`, which clears both locations (R6, R7).
- Q: Two plans sharing a work-id?
  A: Never block each other; a lock belongs to one plan file (R4).
- Q: Existing `.gitignore` lock lines?
  A: Left untouched; this repository's lines go in 0h (R12).
- Q: The repository verify's goal-run detection (`scripts/verify/holder.ts`)?
  A: Follows the locks in iteration 1, through the plan path recorded in the run lock (R14). Delivery mode `no-bc-break`.
- Q: Version bump?
  A: Yes, in iteration 2: `plugins/goal` 3.3.5 → 3.4.0 in `plugin.json` and `marketplace.json` (#221 and #222 shipped without one).
- `GOAL_ROOT_PATH` stays unset in this repository; the default `.goal/` was confirmed. The security hook blocks writing `.env` files from a session.
