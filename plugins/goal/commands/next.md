---
description: Checkpoint between two /goal iterations — verify the finished iteration's Definition of Done, reconcile the plan with what actually changed in the codebase, verify the working tree is safe for a fresh session (in manual mode never stage — the tree is left intact for the developer's review; staging/committing is their job), confirm the next iteration is doable cold with no context loss, then print the exact ready-to-run /goal handoff for it. Does not write code, stage, commit, clear context, or launch /goal.
argument-hint: Optional plan path (.claude/plans/<work-id>-spec.md); omit to auto-discover the active plan
---

# /goal:next — Iteration checkpoint + next-/goal handoff

You are the **handoff between two `/goal` iterations**. An iteration just ran in
this session; before the developer clears the context and starts the next one in
a **fresh session**, you guarantee three things and then hand off:

1. the finished iteration **really is done** (re-run its checks, don't trust the box);
2. the **plan on disk reflects reality** (every adjustment made while coding is in it);
3. **nothing will be lost** across the clear (work committed, or left intact on disk and reported — in **manual** mode you never stage, that is the developer's review);

then you print the **exact `/goal` prompt** for the next iteration.

You do **not** write production code, and you **cannot** clear the context or launch
`/goal` yourself — Claude Code has no way to self-clear or self-chain commands. Your
final act is to print the next `/goal` prompt for the developer to paste in a fresh
session.

## Resolve the plan

Plan: `$ARGUMENTS`
- A path → use it.
- Empty → find it: the `.claude/plans/*-spec.md` most recently modified, or the one
  referenced by the active goal. Ambiguous (several candidates) → list them and ASK.
  None → STOP: _"No plan found — run `/goal:plan` first."_

Read the plan and locate:
- **the finished iteration** = the last `[x]` before the first `[ ]`.
  (No `[x]` at all → nothing has run yet: skip Phase 1, go straight to Phase 5 and
  emit the iteration-1 handoff.)
- **the next iteration** = the first `[ ]`.
- **No `[ ]` left** → all iterations done: run the plan's **global** Definition of
  Done, report completion and (per policy) the commit/PR guidance, then STOP. There
  is no next handoff to emit.

## Phase 1 — Verify the finished iteration is actually done

Run the **finished iteration's own acceptance commands** from the plan (its test
command, lint/QA) and show the **real output**. Never trust the `[x]` or memory.

Open the verification with the iteration's **intent**: one line restating its *Goal* —
what it was meant to make true, and for whom — and, for each command you replay, the
business rule it proves (the plan already maps rule → command; read the mapping back,
never invent it). A green command only means something attached to the rule it covers.

If anything fails → **restore `[ ]` on that iteration in the plan, then STOP**. Report
what failed: the iteration is not done, so there is nothing to hand off. The un-tick
matters because `/goal` implements the next *unchecked* iteration: leaving `[x]` on a
failed slice makes the next run skip it and build on top of broken work. Fix it (or let
the developer) before re-running `/goal:next`.

## Phase 2 — Reconcile the plan with the codebase

The plan is the contract; any drift makes the next cold session act on lies. Verify
and **edit the plan in place** so every statement is true:

- **Files:** `git status` + `git diff --stat` — do the changed files match the
  finished iteration's declared *Files to touch*? Renamed / added / removed files
  mean the plan's list is stale or scope leaked. Update the list to reality, or flag
  a genuine scope leak and ask.
- **Claims:** scan the finished iteration's *Goal*, decisions and acceptance for
  anything the code no longer backs (renamed file, changed approach, dropped
  attribute/field, a helper that moved). Grep the repo for each name the plan still
  uses to confirm it exists. Correct every stale claim.
- **Durable vs volatile:** a plan statement must stay true as long as the **iteration**
  has not changed. If an event outside the iteration's scope can falsify it, it has no
  place in the plan — delete it rather than update it.
  - **Durable, record it:** the branch, the commit's **subject** (its conventional
    message), which business rules are covered, which gates are green and which are red,
    which files were touched, the decisions and trade-offs, the implementation traps.
  - **Volatile, never record it as a plan claim:** the hash of a commit on the working
    branch (upstream hashes already pushed stay citable — they are not rewritten), test
    counts, assertion counts, coverage percentages, and test method names cited as proof
    that a rule is covered. One rebase rewrites the hash; a commit from another feature
    adding a test to the same file moves the counts; both have happened, and each left the
    plan asserting something false about work nobody had touched.
- **Ripple:** an adjustment in the finished iteration often invalidates *later*
  iterations (a rename, a moved data source, a new island/format). Propagate it into
  iterations 2..N and the global DoD so they stay executable.

- **Delivery:** if the plan carries a `## Delivery strategy` (or the iteration a
  **Delivery** line), check the diff honoured it — the flag exists with the declared name
  and defaults to off, an expand step added rather than replaced, nothing existing was
  removed in a slice that was supposed to only add. A slice that quietly dropped the old
  path took the rollback with it, and a checkpoint is the last cheap moment to notice.
  Load `product:delivery` if the strategy needs re-deciding rather than just verifying.

Summarize every edit you made to the plan.

## Phase 3 — Account for the working tree (in manual mode, never stage)

The next iteration runs in a new session whose only durable memory is **the repo +
the plan**. This iteration's work must not be lost — but **how** the tree is made
safe depends on the commit policy, and in **manual** mode staging is the
**developer's** job, not yours.

- If the iteration was **committed** (policy `commit+pr`) → verify the tree is
  clean. If it is not, the commit is incomplete: report it, don't paper over it.
- Otherwise (**manual** — the default, nothing committed) → **do NOT stage. Never run
  `git add`, `git reset`, or otherwise touch the index on your own initiative.**
  Staging is the developer's review step: they alone decide what is OK and add it
  manually. Your job is only to **verify and report**:
  ```bash
  git status --short      # report what is modified / staged / untracked
  git diff --stat         # show the shape of the change
  ```
  Confirm nothing is lost (every piece of the iteration's work is present on disk —
  staged or not), then **list plainly what remains for the developer to review and
  stage manually**. `.claude/plans/` is gitignored, so the plan file stays on disk — that is
  fine, it is durable there.
  - If a prior step (or you) already staged something in manual mode, you may
    **unstage only what was wrongly added** (`git restore --staged <files>`) — never
    disturb staging the developer set up, and never `git reset` wholesale unless the
    developer explicitly asks.

Nothing is destroyed by leaving changes unstaged: they live in the working tree and
the plan lives on disk. In manual mode, safety = **work-on-disk + plan-on-disk + a
clear report**, not a staged index.

The commit **policy comes from the plan / the original `/goal` handoff, not from you**
— if you cannot determine it, **assume manual** (the safe default: verify and report,
never stage), and note which policy you assumed.

## Phase 4 — Confirm the next iteration is doable cold

Read the next `[ ]` iteration and confirm it is **fully self-contained** for a
context-free start:
- *Goal*, *Files to touch*, *Business rules covered*, and its `gate` block are all
  present and concrete in the plan.
- Nothing it needs exists **only in this conversation** — a decision, a value, a name
  you introduced but never wrote into the plan or the code. If you find such a thing,
  write it into the plan now.
- Its `gate` commands run as-is (paths/targets exist), and `test_files` + `impl_files`
  still match what the slice really touches after the ripple you just reconciled.

Under-specified for a cold start → fix the plan (add the missing detail) before
emitting the handoff; if it needs a human decision, say so and ASK.

## Phase 5 — Pick the continuation, then emit it

The plan's `Policy:` decides how the rest of the work runs, and this is the moment to say
so — a developer who chose `commit+pr` chose autonomy, and handing them a
per-iteration prompt anyway makes them drive a loop they asked to be driven for them.

Read `Policy:` from the spec header, then check the **remaining unchecked** iterations for
any that cannot be gated: a missing `gate` block, a block with no `gate1`, or a **Not
machine-verifiable** line carrying the slice's core deliverable. `/goal:supervise` halts on the
first of these rather than run, so naming them now saves a run that would stop at iteration
one.

| `Policy:` | Remaining iterations | Emit |
|---|---|---|
| `manual` | any | the per-iteration handoff **only** — `/goal:supervise` refuses `manual` |
| `commit+pr` | all gateable | **`/goal:supervise <plan path>` first**, per-iteration handoff below it as the fallback |
| `commit+pr` | one or more not gateable | the per-iteration handoff first, and name the iterations that block a clean autonomous run |

**Always pass the plan path explicitly** in the `/goal:supervise` line. Bare `/goal:supervise`
resolves the most recently modified `*-spec.md`, which is whichever plan was last touched —
a follow-up tracks plan, a plan for another work-id. The path removes the guess.

When you offer `/goal:supervise`, state in one line what it will do: how many iterations remain,
that it halts hard on the first failing gate without attempting the rest, and — under
`commit+pr` — that the first green iteration already pushes and opens a draft PR the rest
keep updating, so a halt is still reviewable. The developer is choosing to walk away; they
should know where it stops.

Emit the canonical `/goal` handoff from `templates/goal-handoff.template`, filled
per that file's **"How to fill it"** section: `<plan path>` = the resolved plan path,
« Done » line 1 = the **next iteration's** acceptance test command, line 2 = the
project lint/QA command, `<policy>` = the plan's policy verbatim, `<delivery-mode>` =
the plan's `Delivery mode:` line verbatim. Fold the policy and delivery-mode blocks to
the single active branch of each. Respect its **≤ 4000-character hard limit**: write
the filled block to a file, run `wc -m < <file>`, compress and re-count while it
exceeds 4000, and print the count with the block. **That file is only a counter** —
`cat`-ing it in a tool call does not count as having shown the block, since tool output
goes to the model and not reliably to the developer. The filled block goes **in full into
your final message**, as one copy-paste block.

**Under `manual`, offer the clipboard before printing.** The counter file already holds
the exact block, so ask with `AskUserQuestion`: _"Copy the `/goal` handoff to the
clipboard?"_

- **yes** (recommended) → `pbcopy < <file>` (macOS; `xclip -selection clipboard` or
  `wl-copy` where `pbcopy` does not exist). The block is in the clipboard, so do **not**
  print it again: emit the context-hygiene reminder alone — run `/context`, `/clear` if
  usage is non-trivial, then paste from the clipboard — and name the counter file, the
  recovery copy if the clipboard is overwritten before the paste.
- **no**, or the policy is not `manual` → print it: prepend the context-hygiene reminder
  (you cannot run these — the developer does), then the filled template as **one
  copy-paste block**:

```text
# In THIS session first: run /context; if usage is non-trivial, run /clear.
# Then paste the following into the fresh session:

<filled templates/goal-handoff.template>
```

Expand the placeholder: what you print is the filled text itself, never a reference to it
nor a path to the file you measured. The clipboard branch is the one exception: there the
paste buffer carries the block, and the file is named only for recovery.

**When no unchecked iteration remains**, there is no handoff to emit and the plan is done.
Emit the checklist from `templates/post-merge.template` instead, filled per that file's
**"How to fill it"** section, and say plainly which of its lines are already true. Under
`commit+pr` the PR still has to be merged by the developer, so the checklist describes what
that merge will leave behind; under `manual` the same leftovers exist minus the remote
branch. This is the only moment the workflow reaches the end of a plan, so it is the only
place the leftovers can be named before the context is gone.

Then close, métier first: one line on what the finished iteration **made true** for the
domain (its *Goal*, the business rules it covered), one on what the next iteration
**will make true**. Only then the bookkeeping: the finished iteration is **verified**
(name it), the plan is **reconciled** (list the edits you made), the tree is **safe**
(clean / staged — say which), and the next iteration is **cold-start ready** — clear
and paste the block above or from the clipboard (or run the `/goal:supervise` line,
when you offered one).

## Rules for THIS command

- **No production code.** This is a checkpoint, not an implementation step.
- **Lead with the business intent.** Every synthesis this command prints opens with
  what the iteration makes true for the domain — its *Goal*, the rules it serves —
  before any command output or tree state. A close that says only "commands green,
  tree clean" has buried the point.
- **Never trust the checkbox** — re-run the finished iteration's acceptance commands
  and show the output.
- **The plan must equal reality** before you emit the handoff: every claim true,
  every changed file accounted for, ripple propagated to later iterations.
- **In manual mode, never stage** — `/goal:next` only **verifies and reports** the working
  tree; `git add`/`git reset`/committing is the developer's review job. A clean tree
  is expected only under `commit+pr` (where the iteration was committed). Never
  auto-stage to "make it safe": safety in manual mode is work-on-disk + plan-on-disk.
- **You cannot self-clear or self-launch** — the final output is a prompt the
  developer runs in a fresh session; do not pretend to have cleared or continued.
- **Policy comes from the plan / handoff, not you** — if undiscoverable, **assume
  manual** and just verify/report; do not stage to "stay safe".
