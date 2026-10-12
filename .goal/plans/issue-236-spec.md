# Spec: A Codex exec whose chunks do not match its commands reads as unknown

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/236 (ticket 4a3 of goal-multi-provider, /Users/fabiensalles/projects/github/claude-marketplace/.claude/plans/goal-multi-provider-backlog.md)
Work-id: issue-236
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
Status: plan locked by /goal:plan on 2026-10-12, base `origin/main@5a4bab7`; functional contract settled by /goal:spec the same day.
Adversarial grill: ran
---

## Business intent

**Problem.** The session auditor can report a Codex command with another command's outcome. On
`origin/main@5a4bab7`, `plugins/goal/src/digest.ts:56-57` pairs the Nth command of an `exec` with
the Nth output chunk, with no check that the counts match. A command that yields before finishing
emits more than one chunk, and every later command then inherits its neighbour's exit code: a
recorded `exec` running `sleep 40; false` then `true` digests `true` as `failed`. The reverse order
turns a failure into `ok`. Two smaller blind spots sit in the same file:
- `digest.ts:27-28` reads only a double-quoted `cmd:"…"`, so a command written any other way
  vanishes from the digest without a signal.
- `digest.ts:21` matches `Exit code:` anywhere in a tool's output, so a command that prints that
  phrase rewrites its own verdict.

**Objective.** A Codex command's outcome in the digest is either its own exit code or `unknown`,
never a neighbour's and never a phrase from its output. Every `exec` call leaves a visible trace,
even when its commands cannot be read.

**Success signal.** Ticket 4b's run, supervised from Codex, produces a session audit in which every
Codex command's outcome matches its own exit code or reads `unknown`. No "same command failing
twice" finding rests on a borrowed outcome.

**Affected.** The session auditor, whose findings fold into each pull request, and the developer
reading them.

## Reproduction

- Crafted rollout (`scratchpad/pairing.jsonl`): one `custom_tool_call` `exec` with input
  `text(await tools.exec_command({cmd:"sleep 40; false"})); text(await tools.exec_command({cmd:"true"}))`
  and an output of three chunks `{chunk_id:"a",exit_code:null}`, `{chunk_id:"b",exit_code:1}`,
  `{chunk_id:"c",exit_code:0}`.
- `node -e 'import("./plugins/goal/src/digest.ts").then(m=>console.log(m.digest(process.argv[1]).join("\n")))' pairing.jsonl`
  on `origin/main@5a4bab7` → `2: exec_command sleep 40; false -> unknown` / `2: exec_command true -> failed`
  (`true` reported with `false`'s exit code).

## Scope IN

- How the digest pairs a Codex `exec`'s commands with its output chunks.
- A visible entry for `exec` commands the digest cannot read.
- Where an exit code is read from in a Codex tool output.

## Scope OUT

- Claude and Copilot digests.
- The Codex reading scope and reader (`transcripts.ts`), settled by #235.
- Recovering the true outcome of a yielded command from a later `write_stdin` call.

## Business rules (each must map to a command in the DoD)

- **R1 — Matching counts or nothing.** → verified by `tests/digest.test.ts` (more chunks than commands, and fewer, both digest every command of the call to `unknown`).
- **R2 — A yielded chunk voids the pairing.** → verified by `tests/digest.test.ts` (one `exit_code: null` chunk plus one missing chunk, equal counts, digests every command to `unknown`).
- **R3 — Every exec leaves a trace.** → verified by `tests/digest.test.ts` (one readable and one template-literal command digest to two entries, both `unknown`, one marked unread).
- **R4 — Exit code from the tool, not the output.** → verified by `tests/digest.test.ts` (a chunk whose `output` text holds `exit_code: 0` / `Exit code: 0` while its parsed `exit_code` is 1 digests to `failed`).
- **R5 — Matching calls keep their outcomes.** → verified by `tests/digest.test.ts` (`[1,0,0]` for three commands digests to `failed`, `ok`, `ok`).
- **R6 — Nothing else moves.** → verified by gate1 (the existing digest and transcripts cases) and `dod1`.

## States, invariants & transitions

- **States** (one Codex `exec` call):
  - E1 N readable commands, N chunks, all with an exit code.
  - E2 more chunks than commands.
  - E3 fewer chunks than commands.
  - E4 equal counts, but a chunk without an exit code.
  - E5 no readable command at all.
  - E6 some commands readable, some not.
  - E7 output text holding `Exit code:` printed by a command.
  - E8 a chunk that does not parse.
  - E9 `exec_command(` written inside a string: overcounted.
- **Invariants:**
  - I1 nothing is reported `ok` or `failed` without an exit code that provably belongs to that
    command (owner: R1, R2, R4).
  - I2 every `exec` call is visible in the digest (owner: R3).
  - I3 Claude and Copilot digests are unchanged (owner: R6, transverse).
- **Transition matrix:**
  - E1 → per-command `ok` / `failed` (R5).
  - E2, E3 → all `unknown` (R1). E3 changes #234's prefix pairing, by the developer's decision.
  - E4 → all `unknown` (R2).
  - E5 → one entry per `exec_command` occurrence, marked unread, `unknown` (R3).
  - E6 → all `unknown`, unread ones marked (R3).
  - E7 → the phrase is ignored, the chunk's `exit_code` decides (R4).
  - E8 → all `unknown` (the counts no longer match: R1).
  - E9 → the count mismatches → all `unknown`: safe under I1.

- Invariants as checks: I1 and I2 by the iteration's `digest.test.ts` cases (R1–R5), I3 transverse (existing cases in gate1, `dod1`).

## Delivery strategy

A correction inside one function's Codex branch: outcomes that were wrong become `unknown`, and
invisible commands become visible entries marked unread. The only reader of the digest, the
`goal-session-auditor` agent, gets an additive marker. Claude and Copilot branches are untouched. No flag,
no cleanup. Patch bump to 3.9.2 so installed copies pick it up.

## Files NOT to touch

- `plugins/goal/src/transcripts.ts`, `plugins/goal/src/run/**`, `plugins/goal/src/gate/**`, `plugins/goal/scripts/**`.
- The Claude and Copilot branches of `digest.ts`.

## Definition of Done (global, command-line verifiable)

```gate
dod1=bash plugins/goal/tests/run.sh
dod2=node node_modules/typescript/bin/tsc --noEmit
dod3=node scripts/verify.ts structure
dod4=bash plugins/goal/tests/support/mutate.sh
```

Also true, and not expressible as a command of its own:
- Every business rule above has a passing covering test (proven by `dod1`)
- The success signal (4b's Codex-supervised audit) is observed after merge

## Functional iterations

### Iteration 1 — A Codex command's outcome is its own exit code or unknown
- [x] Not done yet
- **Goal:** A Codex command in the session digest carries its own exit code or reads unknown: never a neighbour's, never a phrase from its output, and every exec call leaves a visible entry even when its commands cannot be read.
- **Shippable after it:** the session audit of a Codex-hosted run can no longer report a command with a borrowed outcome.
- **Files to touch:** `plugins/goal/src/digest.ts`, `plugins/goal/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (+ `plugins/goal/tests/digest.test.ts` (test))
- **Business rules covered:** R1, R2, R3, R4, R5, R6
- **Delivery:** correction in place in the Codex branch; patch bump.
- **Not machine-verifiable:** the success signal.

Measured inputs (recorded rollouts, 2026-10-07 to 2026-10-12): each `exec_command` that finishes
contributes one `input_text` item whose text is a JSON object with `chunk_id` and `exit_code`
(`null` when the command yielded). Parse that object and read its field; never regex the text,
since the `output` field it carries holds whatever the command printed. Count `exec_command(`
occurrences in the `input` script; read each `cmd:` that is a JSON double-quoted string, and give
any other occurrence an entry marked unread. Pair by position only when readable commands,
occurrences and chunks are equal in number and no chunk has a null `exit_code`; otherwise every
command of the call is `unknown`. The reproduction fixture (`sleep 40; false` / `true` with chunks
`null, 1, 0`) is the first case to pin.

```gate
test_files=plugins/goal/tests/digest.test.ts
impl_files=plugins/goal/src/digest.ts plugins/goal/.claude-plugin/plugin.json .claude-plugin/marketplace.json
max_diff=200
commit_msg=fix(goal): a Codex command reads its own exit code or unknown
# rule: R1 R2 R3 R4 R5 pairing only on matching counts with no yielded chunk, unread commands visible, exit code from the parsed chunk; R6 Claude and Copilot unchanged
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/digest.test.ts plugins/goal/tests/transcripts.test.ts
# rule: the project still typechecks, lints, and the marketplace structure holds after the bump
gate2=printf '%b\n' '.PHONY: all types lint structure' 'all: types lint structure' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/src/digest.ts plugins/goal/tests/digest.test.ts' 'structure:\n\tnode scripts/verify.ts structure' | gmake -f - -j2 --output-sync=target
```

## Deferred decisions

- none

## Files (as found in source)

- `plugins/goal/src/digest.ts` — `execCommands` (`:27-28`), `exitStatus` (`:21`), pairing (`:56-57`).
- `plugins/goal/tests/digest.test.ts` — covers fewer chunks than commands, not more.

## Flags for /goal:plan

- Measured at plan time: no `Exit code:` header in 784 recorded Codex outputs, so R4 reads the parsed chunk's `exit_code` only; 18 of 706 recorded `exec` calls carry a `cmd` not in double quotes, so R3 is live.
- **Counting `exec_command(` occurrences in a JS script is a heuristic.** E9 shows it overcounts
  harmlessly; check it does not undercount on the recorded inputs.

## Out-of-band decisions captured during grill

- `commit+pr`, `origin`; `no-bc-break` recorded unasked (the auditor agent, sole digest reader, gets an additive marker).
- One iteration: the six rules live in one function and share one test file.

## Notes / decisions from source

- Fewer chunks than commands → all `unknown`, superseding #234's prefix pairing (developer).
- Both #235 smaller leftovers are in scope: unread commands made visible, exit code anchored to the
  tool (developer).
- Derived during the grill, without a decision needed: a chunk with a null exit code voids the
  pairing (E4), and a read/occurrence count mismatch voids it (E6).
