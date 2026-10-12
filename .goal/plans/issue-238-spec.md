# Spec: A Codex output the digest cannot read never lends or hides an outcome

---
Source: https://github.com/FabienSalles/claude-marketplace/issues/238 (ticket 4a4 of goal-multi-provider, /Users/fabiensalles/projects/github/claude-marketplace/.claude/plans/goal-multi-provider-backlog.md)
Work-id: issue-238
Policy: commit+pr
Delivery mode: no-bc-break
Cleanup: none
Remote: origin
Status: plan locked by /goal:plan on 2026-10-12, base `origin/main@ed4654f`; functional contract settled by /goal:spec the same day.
Adversarial grill: ran
---

## Business intent

**Problem.** #237 left three ways for the session digest to misreport a Codex session. On
`origin/main@ed4654f`:
- **A garbled chunk vanishes, so a call still pairs by position.** A chunk that names `chunk_id`
  but does not parse is dropped (`plugins/goal/src/digest.ts:49-50` returns `[]`). With 2
  commands and 3 chunks, one of them garbled, the counts match and the two commands pair by
  position: the borrowed-outcome bug #236 fixed comes back.
- **One undecodable command line aborts the whole digest.** `digest.ts:36` runs `JSON.parse`
  on a JavaScript string literal; `cmd:"echo \x41"` throws `Bad escaped character in JSON`, and
  the whole audit stops.
- **A printed phrase still decides an outcome.** `digest.ts:21` matches `Exit code:` in raw
  text for `function_call_output`; an output that prints `Exit code: 0` reads `ok` although the
  tool emitted no exit code.

**Objective.** Whatever a Codex rollout contains, the digest finishes. Every outcome it reports
is a tool-emitted exit code that provably belongs to its command; anything else reads `unknown`.

**Success signal.** Ticket 4b's run, supervised from Codex, produces a complete session audit
whose Codex outcomes all match their own exit codes or read `unknown`.

**Affected.** The session auditor and the developer reading its findings in each pull request.

## Reproduction

Crafted rollouts in the session scratchpad, digested with
`node -e 'import("./plugins/goal/src/digest.ts").then(m=>console.log(m.digest(process.argv[1]).join("\n"))).catch(e=>console.log("THROW",e.message))' <file>` on `origin/main@ed4654f`:
- `garbled.jsonl`: `exec` of `false` then `true`, output chunks `{"chunk_id":"k",BROKEN`, `exit_code` 1, `exit_code` 0 →
  `1: exec_command false -> failed` / `1: exec_command true -> ok` (paired by position).
- `escape.jsonl`: `exec` of `cmd:"echo \x41"` → `THROW Bad escaped character in JSON at position 7 (line 1 column 8)`.
- `phrase.jsonl`: `function_call` `js` whose output is `printed: Exit code: 0` → `1: js -> ok`.

## Scope IN

- How a Codex output chunk that does not parse counts.
- How an undecodable `cmd` literal is reported.
- Where a `function_call_output` outcome comes from.
- The digest never aborting on a Codex rollout.

## Scope OUT

- Claude and Copilot digests.
- `transcripts.ts`.
- Recovering a yielded command's final outcome.

## Business rules (each must map to a command in the DoD)

- **R1 — An unreadable chunk voids the pairing.** → verified by `tests/digest.test.ts` (`false`, `true` with chunks `garbled, 1, 0` digest both to `unknown`).
- **R2 — An undecodable command is unread, not fatal.** → verified by `tests/digest.test.ts` (`cmd:"echo \x41"` then a readable call digest to an unread `unknown` entry and the readable call's own entry).
- **R3 — `function_call` outcomes from the tool only.** → verified by `tests/digest.test.ts` (`printed: Exit code: 0` → `unknown`; a `wait` output with a chunk `exit_code` 1 → `failed`).
- **R4 — The digest always finishes.** → verified by `tests/digest.test.ts` (a rollout mixing a garbled chunk, an undecodable `cmd` and malformed `arguments` digests completely, each unreadable item `unknown`).
- **R5 — Nothing else moves.** → verified by gate1 (existing digest, transcripts, suite-guards and supervise-host cases) and `dod1`.

## States, invariants & transitions

- **States** (one Codex item met by the digest):
  - G1 chunk naming `chunk_id` that does not parse.
  - G2 non-JSON text mentioning `chunk_id` (for example a printed rollout).
  - G3 `cmd` literal not decodable as JSON.
  - G4 `function_call_output` with a chunk object.
  - G4b `function_call_output` with only printed text.
  - G5 any other malformed line or field.
  - Plus E1–E9 from #236.
- **Invariants:**
  - I1 nothing is `ok` or `failed` without a tool-emitted exit code that provably belongs to that
    command (owner: R1, R3; inherited).
  - I2 every call is visible in the digest (owner: R2; inherited).
  - I3 Claude and Copilot digests are unchanged (owner: R5, transverse).
  - I4 the digest of a Codex rollout always completes (owner: R2, R4).
- **Transition matrix:**
  - G1 → null chunk → call all `unknown` (R1).
  - G2 → counted as null → call all `unknown`: a false `unknown`, never a false outcome (I1).
  - G3 → unread entry, `unknown`; the digest continues (R2, I4).
  - G4 → the chunk's `exit_code` decides (R3).
  - G4b → `unknown` (R3).
  - G5 → `unknown`, the digest continues (R4).
  - E1–E9 → as #236 (R5).

- Invariants as checks: I1, I2, I4 by the iteration's `digest.test.ts` cases (R1–R4); I3 transverse (gate1, `dod1`).

## Delivery strategy

Correction in place inside the Codex branch of one function: outcomes that could be borrowed or
read from printed text become `unknown`, and a fatal parse becomes an unread entry. The digest's
only reader, the `goal-session-auditor` agent, sees more `unknown` and never a crash. No flag, no
cleanup. Patch bump to 3.9.3.

## Files NOT to touch

- `plugins/goal/src/transcripts.ts`, `plugins/goal/src/run/**`, `plugins/goal/src/gate/**`, `plugins/goal/scripts/**`.
- The Claude and Copilot branches of `digest.ts`.
- `plugins/goal/tests/support/fixed-waits.ts` and `plugins/goal/tests/suite-guards.test.ts`: fixtures stay clear of `sleep <digit>` and `setTimeout(` literals instead of widening the guard.

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

### Iteration 1 — The digest finishes on any Codex rollout and never reports an outcome it cannot prove
- [x] Not done yet
- **Goal:** Whatever a Codex rollout contains, the session digest finishes, and every Codex outcome it reports is a tool-emitted exit code belonging to its own command, otherwise unknown.
- **Shippable after it:** the session audit of a Codex-hosted run neither crashes on an odd command line nor reports a borrowed or printed outcome.
- **Files to touch:** `plugins/goal/src/digest.ts`, `plugins/goal/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (+ `plugins/goal/tests/digest.test.ts`, `plugins/goal/tests/supervise-host.test.ts` (test))
- **Business rules covered:** R1, R2, R3, R4, R5
- **Delivery:** correction in place; patch bump 3.9.3.
- **Not machine-verifiable:** the success signal.

Traps learned from #236, both in this gate on purpose: `suite-guards.test.ts` rejects any
`sleep <digit>` or `setTimeout(` literal in a test, so fixture commands must not contain them; and
`supervise-host.test.ts:50-56` pins the plugin version, so the bump to 3.9.3 updates that pin in the
same commit. An item naming `chunk_id` that does not parse into an object carrying `chunk_id`
counts as a chunk with a null exit code (R1); a `cmd` literal whose `JSON.parse` throws becomes an
unread entry (R2); `exitStatus` no longer matches `Exit code:` or `exit_code` in raw text, and a
`function_call_output` reads the parsed chunk's `exit_code` like an `exec` output does (R3).

```gate
test_files=plugins/goal/tests/digest.test.ts plugins/goal/tests/supervise-host.test.ts
impl_files=plugins/goal/src/digest.ts plugins/goal/.claude-plugin/plugin.json .claude-plugin/marketplace.json
max_diff=200
commit_msg=fix(goal): the digest finishes on any Codex rollout and never reports an outcome it cannot prove
# rule: R1 R2 R3 R4 unreadable chunk voids pairing, undecodable cmd is unread, function_call outcome from the parsed chunk only, the digest never throws; R5 every reacting suite (transcripts, suite-guards, supervise-host) still holds
gate1=node --test --test-concurrency=2 --test-timeout=120000 plugins/goal/tests/digest.test.ts plugins/goal/tests/transcripts.test.ts plugins/goal/tests/suite-guards.test.ts plugins/goal/tests/supervise-host.test.ts
# rule: the project still typechecks, lints, and the marketplace structure holds after the bump
gate2=printf '%b\n' '.PHONY: all types lint structure' 'all: types lint structure' 'types:\n\tnode node_modules/typescript/bin/tsc --noEmit' 'lint:\n\tnode node_modules/eslint/bin/eslint.js --config eslint.config.js --no-error-on-unmatched-pattern plugins/goal/src/digest.ts plugins/goal/tests/digest.test.ts plugins/goal/tests/supervise-host.test.ts' 'structure:\n\tnode scripts/verify.ts structure' | gmake -f - -j2 --output-sync=target
```

## Deferred decisions

- none

## Files (as found in source)

- `plugins/goal/src/digest.ts` — `exitStatus` (`:21`), `cmd` decoding (`:36`), chunk parsing (`:40-53`).
- `plugins/goal/tests/digest.test.ts`.

## Flags for /goal:plan

- **#236's lesson:** list in the gate every suite that reacts to this change:
  `suite-guards.test.ts` (fixed-wait literals, so no `sleep N` fixture) and
  `supervise-host.test.ts` (it pins the plugin version a bump changes), not only in the DoD.
- **G2 trades precision for safety.** A command that prints a rollout containing `chunk_id`
  will void its call's pairing. This is accepted as a false `unknown`; the plan should not
  "fix" it into a heuristic.

## Out-of-band decisions captured during grill

- `commit+pr`, `origin`, carried over from the previous tickets of this chantier; `no-bc-break` recorded unasked (the auditor agent, sole digest reader, only sees more `unknown`).
- One iteration: the rules live in one function and share one test file.
- #236's lesson applied: `suite-guards` and `supervise-host` run in gate1, not only in the DoD.

## Notes / decisions from source

- The three rules come from the outcome of #238, cut by the developer from #237's review.
- G5 (the digest always finishes) was derived during the grill, not raised by the review.
- The `wait` `function_call_output` was measured on 2026-10-12 to carry a chunk JSON with `exit_code`.
