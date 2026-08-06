# Prior art — what nobody else does, and what everybody else has

A positioning record, not a feature list. Two halves, and they rot differently: every external
claim was read from a primary source in August 2026 and carries its link, so it rots when those
projects ship; every claim about this harness is anchored to the file that decides it, so it rots
when this one does. Re-read the anchor before quoting a line of this note.

The thesis is one sentence, and it is falsifiable: **the bite check exists in no delivery harness
but this one.** The rest of the document is what that sentence is worth, including the several
places where this harness is plainly behind.

## The one invariant nobody else ships

The rule "the test must fail before the fix" is not new. It is the admission criterion of
SWE-bench: an instance enters the dataset only if at least one test fails before the patch and
passes after it (`FAIL_TO_PASS`), with no regression on the tests that already passed
(`PASS_TO_PASS`).[^swebench] That is the F→P invariant, and it is enforced by an **evaluation**
harness, at dataset construction time, on a throwaway container.

No delivery harness replays it. Not aider, not OpenHands, not Cline, not Roo, not Cursor, not
Codex, not Amp. They accept a diff when the suite is green; none of them asks whether the suite
was ever red. `gate/bite.ts` is the port of that invariant into the place where code actually
lands: the implementation is set aside from HEAD, the slice's acceptance command is replayed, and
a zero exit halts the slice. It is a program, not a prompt.

The decision this encodes is worth stating without the mechanism: **a green test is not evidence
until it has been shown to fail without the code it claims to test.** Everything downstream — the
regression wall, the diff budget, the declared scope — assumes the acceptance command means
something. The bite check is the only thing that establishes it.

Why it is not a luxury: Codex's published loop "runs your test suite again and again, fixing what
fails until everything passes".[^codex] When the sole stopping condition is *the test passes*,
editing the test is a valid path to it. The bite check converts the condition into *the test
passes and failed without this slice*, which makes rewriting the test useless as a strategy
rather than merely forbidden.

One place this goes further than SWE-bench: the restore is checked for idempotence, the tree
fingerprinted before and after, so an acceptance command with side effects halts instead of
quietly leaving the tree changed. SWE-bench never needed that — it throws the container away.

**And the off switch, which is guarded by prose.** An iteration declaring an empty `test_files=`
skips the bite check outright, so that field is the check's input and its off switch at once.
`plan-guard.ts` hashes it — not the paths, which a repair may legitimately fix, but whether the
field is empty, per resolved block, beside the `gateN=` and `dodN=` lines (`:59-76`). But nothing
the machine runs invokes it: its only callers are steps in `commands/supervise.md` (`:86-90`) that
a model is asked to follow, and `supervise.md:74-76` forbids emptying the field in the same
register. So the one check nobody else has is protected from the automated classifier that repairs
the plan by an instruction, not by a program — the hash is a mechanism only for as long as
something chooses to run it.

## Who commits, and when

aider commits before it verifies. The order in `send_message` is apply → auto-commit → lint →
auto-commit again → shell → test, and its own git documentation confirms it commits with
`--no-verify` by default, `--git-commit-verify` being the opt-in.[^aider] The most widely used
harness in the ecosystem lays commits on code that has been neither linted nor tested, and
actively bypasses the repository's own pre-commit gate. Its safety net is `/undo`.

This harness is the exact inverse, and that ordering is the whole point of `goal-gate.ts`: the
checks run, then and only then does the gate stage and commit. The gate is the sole committer,
and the implementer never reaches git at all.

**Where the claim is narrower than it sounds.** "No commit exists that a gate did not verify"
holds per slice. "Nothing ships unverified" holds only on the shortest plans:
`goal-run.ts:120-131` publishes each iteration as it lands **except the last**, whose push waits
inside `close()` for a green global Definition of Done (`run/close.ts:58-67`). So a
one-iteration run does put the barrier last, exactly as `gate/ship.ts` claims when it calls the
DoD "the last barrier before anything is published". On a six-iteration run, five slices and a
draft pull request are on the remote before the barrier runs. The barrier is real; on anything
longer than one slice it is not last.

## The judge is a program, not a reader

SWE-agent's `review_on_submit_m` executes nothing. It writes the diff to a patch file, then feeds
that diff and the problem statement back to the same model as a review message.[^sweagent] It is
forced self-re-reading, which is the self-certification this harness exists to remove. The
academic reference harness has no execution gate; its reputation belongs to SWE-bench, which is a
different program.

The pattern recurs one rung down. `loop-harness`, a close public cousin, isolates each loop in a
worktree, forbids the primary agent to push, and requires a second `claude -p` session to print
`VERDICT: PASS` before the orchestrator pushes.[^loops] A separate judge — that can be argued
with. `goal-gate.ts` returns an exit code.

Anthropic's own guidance converges on the same place: start from the repository's deterministic
signals, encode repeated verifications as rules rather than prose, and route rubric judgement
through a separate grader agent to avoid self-evaluation bias.[^anthropic] Claude Code does not
ship the loop that would use it — the issue asking for `--verify`, `--max-iterations` and an exit
code contract on `claude -p` was closed "not planned".[^issue28489] This harness fills a hole its
own vendor has described and not tooled.

**Where it is behind its own claim.** `gate/halt.ts` prints the `HALT` block — `REASON:` and
`DETAIL:` — to the gate's stdout, the runner concatenates it with stderr into `reporter.record()`
(`run/iteration.ts:184`) and it lands in the run's own log,
`.claude/goal-runs/<work-id>/<run-id>/.run.log` (`run/report.ts:20-25`, `:80-84`), which is
exactly the evidence `/goal:supervise` Phase 5 is told to read back. What is missing is one rung
up: there is no exit-code taxonomy separating an infrastructure failure from an implementation
failure — the distinction the closed issue above asked for, and the one the classifier most
needs, since the gate collapses every refusal it makes into a single code.

## Restriction was the wrong layer, and Amp said so first

Amp rejects the whole approach this harness's second invariant is built on: "Taking tools away,
like preventing the agent from reading certain files, makes the agent look for an alternative,
like running a Bash command instead to access file contents."[^amp] Its answer is a permission
chain with an `allow / reject / ask / delegate` verdict, `delegate` handing the decision to an
external program that answers by exit code.

The audit found precisely the failure Amp predicted, on the denial side. `goal-deny-setup.sh:34`
installs four prefix rules — `Bash(git commit:*)`, `Bash(git push:*)`, `Bash(git add:*)`,
`Bash(git stash:*)`. The earlier preflight verified they were present with a `String.includes`
over the raw text of `.claude/settings.local.json`, so an *allow* entry naming the same verbs
satisfies it. The rule does not apply retroactively to a session already running. The current
runner dropped that check rather than repair it — a verdict a permission chain would have
delegated to a program, where this one delegated it to a substring.

The documented precedent is not hypothetical either: in `anthropics/claude-code#40117`, an agent
carrying a project memory rule against `--no-verify` used `--no-verify`, used `git stash` to
manipulate the index, and landed six consecutive commits with failing tests.[^bypass] Both verbs
that incident abused are on the list above — which is exactly why the list is not the answer. It
is a set of prefixes read once from a file the implementer can write to, in a permission system
that reads it at session start.

**What this harness does have, and the panel does not:** detection that does not depend on any of
that. `run/iteration.ts:132-165` reads HEAD before and after every iteration and pauses on a move
with the commit named; it snapshots the git directory's executable surface — `config`,
`config.worktree`, `info/exclude` and every file under `hooks/`, recursively, `.sample` included
— and pauses naming what changed (`run/gitwatch.ts`); and it snapshots **every** ref with
`for-each-ref`, so a `refs/remotes/` move is reported as a push and any other ref move, `git
stash` included, is reported as a ref move. `git status --porcelain -uall` sees none of the three.
That is the a-posteriori detection the incident above argues for, and it catches the commit, the
push, the stash and the planted hook.

Cursor, for its part, documents its own guardrails as "best-effort guardrails rather than a hard
security boundary", deprecated its denylist in 1.3, routes non-allowlisted calls to an LLM
classifier, and closes with "Always use version control so you can revert changes".[^cursor] The
market leader arbitrated for speed and treats git as the only real net. That validates the bet
made here — a mechanical constraint over a classification — and names its price: this harness is
far slower to land a slice.

## Two axes: the machine, and the repository

OpenHands has a sophisticated security layer and no test gate at all: risk analyzers, LOW through
HIGH levels, confirmation policies. Its default classifier is the LLM itself, annotating its own
tool calls with a `security_risk` field.[^openhands] That is exactly the self-certification this
harness refuses — and it is on a different axis.

**OpenHands protects the machine from the agent. This harness protects the repository from the
agent.** The OpenHands axis is entirely empty here: no sandbox, no network isolation, no risk
analysis of what the implementer runs. `run/iteration.ts` spawns `claude -p --permission-mode
auto` in the developer's own tree. Codex takes the same containment route as OpenHands — isolated
container, no network.[^codex] This is assumed debt, not a bug: the harness is pointed at a
repository its owner trusts. The day it is pointed at one he does not, the whole axis is missing.

## Rollback instead of refusal

Cline's YOLO mode "disables all safety checks"; the documented net is "Git becomes your safety
net" plus checkpoints. Roo implements checkpoints as a shadow git repository separate from the
project's VCS, restoring content, additions, deletions, renames and binaries — created *after*
the modification, and its own documentation states that "no formal approval process exists before
changes are accepted".[^cline]

Neither has a gate. This harness does not need rollback, because nothing lands unverified — that
is a coherent trade. But the trade has a cost nobody has paid here: **post-halt forensics.** When
a slice halts, what exists is the tree as the implementer left it, the gate's `HALT` block in the
run log, and nothing else. Roo can replay the film; `/goal:supervise` has to classify from that
one block and from transcripts read through `transcripts.ts` — no snapshot of the tree before the
implementer touched it, and no closing synthesis, because a halt never reaches the closing stage.
The forensic path exists on paper. It has never run once.

## The plan as a contract, which is the other thing nobody does

The spec-driven family — spec-kit, Agent OS — produces plans and ships no mechanism to hold an
agent to one.[^speckit] The plan is advisory; the agent reinterprets it silently. Here the plan is
hashed and a run that rewrote it is refused, which makes it the only opposable plan in the panel.
On the strength of the survey, this is a stronger differentiator than the bite check, because the
bite check is at least *conceivable* elsewhere, while an opposable plan contradicts how every
other harness treats planning.

One leak left, and it is narrower than it was. The hash still normalises ticked boxes back to
unticked before digesting, so an untick moves nothing in it — but the untick no longer passes
unnoticed: `gate/ticked.ts:13-27` compares the ticked set the plan carried when `check` locked
the run against the set on disk at `commit`, and halts on any iteration that disappeared
(`goal-gate.ts:154`). The boundary is the run: that set is captured at check time and carried by
argument, so an untick performed *between* two runs is simply the state the next run locks, and
the regression wall it replays is the smaller one.

## What the panel has and this harness does not

- **A fuse.** SwarmOps caps everything numerically — turns, retries, review cycles, a hard
  30-minute timeout.[^swarmops] Anthropic's own `ralph-wiggum` plugin states that string-matching
  a completion promise is unreliable and to "always rely on `--max-iterations` as your primary
  safety mechanism". Here the wall clock exists but stops at the wrong boundary: every declared
  command runs under `GOAL_CMD_TIMEOUT`, 900 seconds by default, SIGKILL
  (`gate/bounded.ts:17`, `:84-90`), while the implementer session is spawned with no timeout and
  there is no turn cap and no iteration cap. The only bounded loop in `run/iteration.ts` is the
  quota-window retry. An implementer circling an impossible slice circles until the quota runs
  out.
- **Detection of a weakened test.** The failure mode has a stable four-signal taxonomy —
  assertions deleted, tolerances widened, tests skipped, expected values and snapshots
  regenerated — and a formulation worth keeping: "in an agent PR, the tests are part of the
  claim, not part of the evidence".[^rewrite] The bite check proves the test *bites*. It does not
  prove the test still asserts as much as it did. A test stripped of three assertions, keeping one
  that fails without the implementation, passes the bite check and fits under any diff budget.
  Nothing counts assertions, detects an added skip, or compares a snapshot.
- **A holdout.** METR measured o3 reward-hacking in 30.4% of RE-Bench runs, and the explanatory
  factor it names is access to the scoring function.[^metr] Here the acceptance commands are
  written in the plan, and the plan is the implementer's brief: the agent being scored is handed
  the marking scheme. The bet made instead is the explicit contract, backed by the bite check to
  make that knowledge harmless. That bet may well be right, but it is a bet, and it should be
  stated rather than left implicit.
- **An exportable run artifact.** Bernstein keeps an always-on replay journal with an HMAC-signed
  audit chain, verifiable offline by a third party without replaying the run.[^bernstein] The
  invariant "every claim is a command that ran" is, here, a promise about how the code is written.
  There is no artifact anyone else can check.
- **A machine critic on the plan.** Jules added a Planning Critic that reviews auto-approved plans
  before any code, for a measured 9.5% reduction in task failure rate.[^jules] Leaving the grill
  human is a deliberate and well-supported choice — the field's own guidance is that autonomous
  loops should not be pointed at ambiguous requirements — but nothing critiques a plan
  mechanically before it is frozen, and a plan fault is what `/goal:supervise` most often has to
  classify.

## Choices made blind that the literature has since scored

Two decisions here predate the evidence for them, and the evidence has arrived.

*Stale evidence is worse than no evidence.* Measured: using an outdated verification trace against
current code broke 34 of 135 otherwise-correct attempts, versus 4 of 135 with a current
trace.[^looping] The gate replays its commands against the tree it is standing in, so its evidence
is bound to the state by construction and never carried over from a previous turn. That was an
instinct; it is now a number.

*Forcing a second revision degrades the result.* The same work measures correctness falling from
82% after one revision to 67.3% after two. `/goal:supervise` relaunches once and then stops. Same
instinct, same vindication.

A third, still unmeasured here: putting an LLM in the coordination loop costs roughly 40% of total
tokens in coordination overhead rather than code, which is why one close cousin replaced its LLM
orchestrator with a plain scheduler.[^scheduler] That is the argument for the move away from the
Workflow runtime that used to hold this loop, onto `goal-run.ts`. The move was made; the
measurement was not. And no project in the panel kept both orchestrators alive — they renamed or
replaced. This one kept both alive for a while and has now replaced: the Workflow generation stayed
checked in at 941 lines long after `goal-run.ts` superseded it, and because Claude Code registers a
plugin's `workflows/*.js` as invokable skills, it remained typeable by name the whole time —
calling nothing in `scripts/`, dispatching to six agent types that no longer existed as files, and
advertising a command that had been deleted. It was removed on 2026-08-06. The lesson the panel
teaches is that the old orchestrator has to go, not merely stop being called.

## Where this leaves the positioning

Every framework in the panel sells its orchestrator. The orchestrator here is ordinary, and
reproducible with Claude Code's own primitives. What is not reproducible is the judge: the bite
check, the diff budget measured against HEAD, the opposable declared scope, the never-versioned
refusal, the determinism replay. If one piece of this harness deserves to be extracted and
published on its own, it is `gate/`.

The two honest sentences to keep beside that one. First, the deficits above are not cosmetic:
no fuse, no assertion-count check, no holdout, no exportable proof, no closing artifact on the
one path that most needs one, and a deny layer built on the weakest available rung. Second, the
single stage deliberately left un-automated — the human grill — sits in the column the field
describes as the one that stops scaling, and it is acceptable only because it runs once per plan
rather than once per diff.

---

[^swebench]: *Introducing SWE-bench Verified* — <https://openai.com/index/introducing-swe-bench-verified/>, and the `FAIL_TO_PASS` / `PASS_TO_PASS` construction discussed in <https://github.com/SWE-bench/SWE-bench/issues/174>
[^codex]: *Introducing Codex* — <https://openai.com/index/introducing-codex/>
[^aider]: `aider/coders/base_coder.py` — <https://raw.githubusercontent.com/Aider-AI/aider/main/aider/coders/base_coder.py>, and <https://aider.chat/docs/git.html>
[^sweagent]: `tools/review_on_submit_m/bin/submit` — <https://raw.githubusercontent.com/SWE-agent/SWE-agent/main/tools/review_on_submit_m/bin/submit>
[^loops]: <https://github.com/lSAAGl/loop-harness>, alongside <https://github.com/rxdt/loopgate_harness>
[^anthropic]: *Building verification loops in Claude Code with skills* — <https://claude.com/blog/building-verification-loops-in-claude-code-with-skills>
[^issue28489]: <https://github.com/anthropics/claude-code/issues/28489>
[^amp]: *Permissions* — <https://ampcode.com/notes/permissions>, and <https://ampcode.com/news/tool-level-permissions>
[^bypass]: <https://github.com/anthropics/claude-code/issues/40117>
[^cursor]: *Agent security* — <https://cursor.com/docs/agent/security>
[^openhands]: *Security* — <https://docs.openhands.dev/sdk/guides/security>
[^cline]: <https://docs.cline.bot/features/auto-approve>, and <https://roocodeinc.github.io/Roo-Code/features/checkpoints>
[^speckit]: <https://github.com/github/spec-kit>
[^swarmops]: <https://github.com/rekpero/claude-code-swarm>
[^rewrite]: *The test rewrite failure mode* — <https://pyor.review/blog/test-rewrite-failure-mode>
[^metr]: *Recent reward hacking* — <https://metr.org/blog/2025-06-05-recent-reward-hacking/>
[^bernstein]: <https://github.com/sipyourdrink-ltd/bernstein>
[^jules]: <https://jules.google/docs/changelog/2026-01-26-1/>
[^looping]: *Looping Is Not Reliability* — <https://arxiv.org/abs/2607.24604>
[^scheduler]: *Why I stopped using LLMs to schedule LLMs* — <https://dev.to/alex_chernysh/why-i-stopped-using-llms-to-schedule-llms-4176>
