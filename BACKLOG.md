# Backlog

Items identified during the marketplace audit and not yet executed. Loose priority — pick what's relevant when you come back.

> Where this lives: visible from the repo root, tracked by git, never expires. Update when you tackle an item (move it to a `## Done` section or delete).

---

## 🔐 MCPs hardening (manual configuration outside this repo)

### Restrict Cloudflare API token scope
- **Why:** the `claude.ai Cloudflare Developer Platform` MCP is connected with a token that has write/delete permissions on D1, KV, R2, Workers, Hyperdrive. A compromised session (prompt injection, malicious file) could delete production resources.
- **Effort:** ~10 min (manual, on dash.cloudflare.com)
- **Trigger:** before any session involving untrusted content (file uploads, web fetches from unknown sources, third-party MCP usage).
- **Action plan:**
  1. Go to https://dash.cloudflare.com → My Profile → API Tokens.
  2. Identify the token bound to the Claude MCP (look at last-used timestamps).
  3. Either rotate to a **read-only token** if you don't need write access for daily use, OR scope it to specific zones/resources only (exclude prod).
  4. If a separate "write" token is needed occasionally, create a short-lived one (24h TTL) and revoke after use.

## 🛡️ Audit plugin extensions

### `audit:php-security` skill (if a real PHP gap emerges)
- **Why considered:** symmetry with `audit:ts-security`. **Currently NOT planned** because `netresearch/security-audit-skill` already provides `symfony-security.md`, `php-security-features.md`, `laravel-security.md`. Add only if you encounter PHP patterns the upstream misses (custom Symfony FormType validation, Doctrine repository patterns, LexikJWT setup, sodium hashing conventions, etc.).
- **Effort:** ~2 h (read upstream PHP refs, identify true gaps, write the overlay)
- **Trigger:** when you start a Symfony project with custom security patterns and feel the gap.
- **Path:** `plugins/audit/skills/php-security/`

### `audit:dependency-audit` skill (SCA / npm audit / composer audit overlay)
- **Why:** declared as `_planned_` in `audit/README.md`. Overlay personal conventions for dependency vulnerability triage (severity mapping, suppression rules, monorepo scoping).
- **Effort:** ~2 h
- **Trigger:** next time you triage a dependabot/snyk/renovate PR queue.
- **Path:** `plugins/audit/skills/dependency-audit/`

### `audit:accessibility-audit` skill (a11y / WCAG overlay)
- **Why:** declared as `_planned_` in `audit/README.md`. Frontend audit (Astro/React) — likely useful for the formation/training side.
- **Effort:** ~2-3 h
- **Trigger:** next a11y review on a public-facing site.
- **Path:** `plugins/audit/skills/accessibility-audit/`

---

## 🧩 Craft plugin extensions

(No additional principles families identified during the audit beyond the 7 shipped.)

---

## 🪺 NestJS plugin extensions

The `nest` plugin currently ships only 2 skills (`nest-conventions`, `nest-ddd-conventions`), which is sparse compared to `astro` (11) or `php` (8). During the marketplace audit, three non-obvious community patterns were identified as worth packaging — but **deliberately paused** until the next time you actively work on a NestJS project, to avoid speculative skill-writing.

Each of the three carries content that the official NestJS docs don't cover well (real-world gotchas, opinionated patterns, decision trees).

### `nest:nest-config-and-validation`
- **Why considered:** three gotchas users hit repeatedly — (1) `ValidationPipe.enableImplicitConversion: true` silently coerces `"1"` to `1` and masks upstream contract bugs, (2) `configService.getOrThrow()` + `class-validator` schema on env vars makes the app fail-fast on missing config instead of crashing 4 layers deep at first use, (3) returning ORM entities directly from controllers leaks `password_hash` / audit fields — Response DTOs must be enforced.
- **Effort:** ~1 h
- **Trigger:** next time you start or audit a NestJS project (especially a fresh one where validation/config patterns get locked in early).
- **Path:** `plugins/nest/skills/nest-config-and-validation/SKILL.md`

### `nest:nest-testing`
- **Why considered:** four non-obvious NestJS testing patterns — (1) `Test.createTestingModule().overrideProvider()` semantics differ from generic Vitest mocking, (2) test setup must reuse the app's global pipes/filters (else false positives in CI), (3) mocking Guards vs Strategies in e2e tests requires different approaches, (4) repository testing decision tree (mock vs sqlite-in-memory vs testcontainers).
- **Effort:** ~1.5 h
- **Trigger:** next NestJS test suite you write or refactor (especially e2e with auth guards). Pairs with `vitest:vitest-tdd-workflow` for the cross-language baseline.
- **Path:** `plugins/nest/skills/nest-testing/SKILL.md`

### `nest:nest-lifecycle-and-modules`
- **Why considered:** three module/lifecycle patterns that bite production teams — (1) `OnModuleInit` vs `OnApplicationBootstrap` execution order is not obvious and causes cascade pitfalls when one provider waits on another, (2) `forwardRef()` for circular deps: when to use, when to refactor instead (a cycle almost always signals a design bug — refactor is usually correct), (3) `@Global() SharedModule` pattern for cross-cutting providers vs the anti-pattern of making everything global.
- **Effort:** ~1 h
- **Trigger:** next time you organize / reorganize a NestJS application's modules, or hit a circular dependency error.
- **Path:** `plugins/nest/skills/nest-lifecycle-and-modules/SKILL.md`

### Skipped: `nest:nest-authorization-layers`
- **Why considered then dropped:** the "two-layer auth" pattern (Guards for coarse, Services for fine-grained) is genuinely useful, but the broader NestJS community is divided — many teams prefer CASL or similar libraries. Writing a strongly opinionated skill here risks contradicting whatever auth approach the project picks.
- **If revisited:** only if you settle on a specific auth pattern and want it strictly enforced across NestJS projects.

---

## 🐘 Symfony plugin polish

### Make `symfony:prg-pattern` framework-agnostic
- **Why considered:** the PRG pattern itself (POST→redirect, POST-error→re-render, flash messages) is universal across PHP web frameworks (Laravel, Slim, vanilla PHP). The skill is currently in `symfony` because the code examples use Symfony classes (`RedirectResponse`, `UrlGeneratorInterface`, `#[Route]`, `getFlashBag()`). A Laravel user installing `php` alone would miss this pattern.
- **Currently NOT planned** — option (a) was chosen during the v2 refactor: keep the skill in `symfony` to avoid extra work, since the diagram and rules are already language-readable and a Laravel user can mentally translate the few Symfony-specific class names.
- **Effort if revisited:** ~30 min (replace examples with pseudo-code or PSR-7/PSR-15 interfaces, add a 5-line Laravel snippet alongside the Symfony one, move the skill back to `php`).
- **Trigger:** if a Laravel project lands on the agenda, or a public user opens an issue asking "where's PRG for Laravel?".

---

## 🎯 Goal plugin — autonomous execution

Design lives in [`plugins/goal/docs/autonomous-architecture.md`](plugins/goal/docs/autonomous-architecture.md), [`target-harness.md`](plugins/goal/docs/target-harness.md) and [`adversarial-verification.md`](plugins/goal/docs/adversarial-verification.md). **None of it is built.** The harness is rebuilt iteration by iteration under `.claude/plans/issue-6-spec.md`; a reference spike sits on `wip/issue-6-harness-spike` and is not merged. Everything below assumes the rebuild lands first.

### Prove track disjointness in a script, not in a survey agent
- **Why:** `/goal:auto` Phase 3 bis requires proving track file sets pairwise disjoint *before creating anything*, because a false track means two PRs that conflict at merge. The workflow currently asks the survey agent to notice it, which makes a mechanical property depend on a judgement. Parse `iteration_files` from each track's gate blocks, intersect, refuse on any overlap or on a duplicated `Branch suffix:`.
- **Effort:** ~1 h, plus tests.
- **Trigger:** before the first run of a plan that declares more than one track.
- **Path:** a script in `plugins/goal/scripts/`, called before the first `git worktree add`. Gap 1 in [`plugins/goal/docs/workflow-parity.md`](plugins/goal/docs/workflow-parity.md).

### Close the CI feedback loop after a PR opens
- **Why:** the largest remaining hole in the run's awareness. A run ends at `gh pr create` and never learns that CI went red on the runner — the gate passing locally is not the same claim. A `Monitor` polling `gh pr checks`, emitting one line per check that lands and exiting when the run completes, closes it. Coverage rule: the filter must match every terminal state, or a crashed CI run looks identical to a slow one.
- **Effort:** ~1 h.
- **Trigger:** after the first PR opened by a workflow run.
- **Path:** the command, after the workflow returns. See [`plugins/goal/docs/loops.md`](plugins/goal/docs/loops.md) §C.

### Bounded escalation on infrastructure failures only
- **Why:** "a halt is final" is absolute because prose could not carry anything finer. A script can: map an observable failure signal to a failure class, attach a targeted recovery and a recovery budget, re-verify after. Retry `git worktree add`, a `gh` 5xx or a network timeout twice; never retry a failed assertion, a scope leak or spec tampering. Recovery applies to the infrastructure around the verification, never to the verdict.
- **Effort:** ~2 h, and the failure-signature table matters more than the code.
- **Trigger:** the first halt that turns out to be infrastructure rather than code.
- **Path:** `plugins/goal/workflows/goal-auto.js`. Table and anti-patterns in [`plugins/goal/docs/loops.md`](plugins/goal/docs/loops.md) §A.

### Write `state=done` at the end of a run
- **Why:** preflight check 7 ("no run already active") reads `state=running`, and nothing ever writes `done`. Benign today because check 5 stops a completed plan first, but check 7 rests on a value nothing sets.
- **Effort:** ~20 min.
- **Trigger:** any change to the preflight order.
- **Path:** `plugins/goal/workflows/goal-auto.js` ship stage, or a `--done` mode on the gate.

### Queue several plans in one unattended run
- **Why:** once one plan runs reliably, a `for` over the locked plans in `.claude/plans/` runs them overnight in sequence, stopping the queue at the first halt. Nothing in the design forbids it and it is where the autonomy actually pays off.
- **Effort:** ~1 h.
- **Trigger:** after three or four single-plan runs have gone green.
- **Path:** `plugins/goal/workflows/goal-auto.js`, or a thin wrapper workflow calling it via `workflow()`.

### Prove the workflow on a real plan (do this first)
- **Why:** the loop, the survey, the lens derivation and the GitHub reporting have only ever been read, never run. Every item below builds on code whose behaviour is currently assumed.
- **Effort:** ~1 h, needs a plan with gate blocks — `.claude/plans/issue-3-spec.md` has them.
- **Trigger:** now.
- **Path:** `/goal:auto --workflow`, ideally after the `--dry-run` below exists so nothing can commit during the first attempt.

### `--dry-run` mode for the workflow
- **Why:** the highest-value missing control. Survey + `goal-gate.sh` for **every** iteration, implementing nothing. Thirty seconds and you know, before going to bed, whether a gate block is missing, a declared path does not exist, or two tracks share a file. Today those are discovered mid-run, hours in.
- **Effort:** ~1 h — an `args.dryRun` that runs the survey and the state stage for each iteration, then returns, skipping implement/gate/lenses.
- **Trigger:** before the first real unattended run.
- **Path:** `plugins/goal/workflows/goal-auto.js`.

### Remote steering — tier 0, kill switch by label
- **Why:** the run is deliberately write-only towards GitHub, which means you cannot stop it from your phone. Reading whether a **label** exists is a boolean, not free text, so it carries no injection surface. Between two iterations, `gh api` checks for `agent-stop` on the issue and the run halts at the next boundary.
- **Effort:** ~1 h.
- **Trigger:** the first time a run does something you want to stop and cannot.
- **Path:** `plugins/goal/workflows/goal-auto.js`, per-iteration loop. Design in [`plugins/goal/docs/steering-and-injection.md`](plugins/goal/docs/steering-and-injection.md).

### Remote steering — tier 1, checkbox control panel
- **Why:** richer than a label and still injection-free, because of a permission asymmetry: anyone can create a comment, but only someone with repo write access can edit *the run's own* comment. The run posts a control panel of task-list checkboxes it authored, you tick them from mobile, and what crosses the boundary is a bit vector over a vocabulary the run wrote. Gives `stop`, `no-ship`, `skip-lenses`, `retry-current` in one place.
- **Effort:** ~2 h — post the panel at run start, `gh api` + `jq` read at each boundary, honour the bits.
- **Trigger:** once tier 0 exists and proves too coarse.
- **Path:** `plugins/goal/workflows/goal-auto.js`. **Respect the vocabulary rule**: every remotely triggerable verb may only *subtract*. `ship` and `skip-iteration` are explicitly rejected — see the doc's table.

### Quarantined reader agent type
- **Why:** the structural half of the injection defense (dual-LLM / CaMeL): the agent that reads GitHub must hold no tool that can act. A dedicated subagent type in `.claude/agents/` granted only `Bash(gh api …)` — no `Write`, no `Edit`, no push — invoked via `agentType`, cannot act on what it read even if it is talked into wanting to.
- **Effort:** ~30 min.
- **Trigger:** together with tier 0. Neither steering tier should ship without it.
- **Path:** `.claude/agents/goal-reader.md`, then `agentType: 'goal-reader'` on the reading call.

### Secret scan before any push
- **Why:** **a risk introduced by this design, not a pre-existing one.** Halted branches are now pushed so the diagnosis survives the machine going to sleep. If an implementer accidentally committed a `.env`, a token or a key, pushing publishes it — and a halted run is exactly the situation where the tree is unusual. A scan (gitleaks, or a grep for known prefixes plus high-entropy strings) gating every `git push` in the workflow.
- **Effort:** ~1 h.
- **Trigger:** **before the first unattended run that can push.** This one is not optional.
- **Path:** `plugins/goal/workflows/goal-auto.js`, in front of every push; ideally a script so it cannot be skipped by a caller.

### Report whether a failing gate is deterministic
- **Why:** "a halt is final" is the right rule and must not weaken. But re-running the failing command once, purely for information, tells you whether you are looking at a real failure or a flaky test — without changing the verdict. The halt comment says "reproduced 2/2" or "passed on retry, suspect flakiness", which is the difference between reading it at 7am and re-running it blind.
- **Effort:** ~30 min.
- **Trigger:** the first halt you cannot reproduce by hand.
- **Path:** `plugins/goal/scripts/goal-gate.sh`, failure path only, and the halt comment in the workflow.

### Resume integrity audit
- **Why:** the durable state is the `[x]` checkboxes, so a resume trusts them. Nothing currently checks that they match reality: N ticked iterations should mean N commits carrying the plan's `commit_msg` values. A mismatch means history was rewritten or the plan was edited between runs, and resuming on top of it silently builds on a false premise. The `spec_hash` does not catch this — it only guards *within* a run.
- **Effort:** ~1 h.
- **Trigger:** the first time a run is resumed after any manual git work on the branch.
- **Path:** a check in `plugins/goal/scripts/`, called by the workflow survey stage.

### Environment fingerprint on halt
- **Why:** a gate failing because Docker, PHP or Node moved under you is a different problem from a gate failing because the code is wrong, and at 7am the halt output looks identical in both cases. Capturing the versions the gates depend on at lock time and again on halt makes the difference visible immediately.
- **Effort:** ~45 min.
- **Trigger:** the first halt that turns out to be a toolchain upgrade.
- **Path:** `plugins/goal/commands/plan.md` (record at lock), workflow halt comment (record at halt).

### Archive the workflow journal on the PR
- **Why:** every run writes a `journal.jsonl` holding each agent's real return value. It is the only artefact that explains *why* a run behaved as it did, and it currently lives in a session directory that disappears. Attaching it to the PR makes a run auditable after the fact.
- **Effort:** ~30 min.
- **Trigger:** the first run whose behaviour you cannot reconstruct.
- **Path:** the ship stage of `plugins/goal/workflows/goal-auto.js`.

### Budget forecast before starting
- **Why:** pairs with cost-per-iteration below. Once a few runs have recorded their cost, a plan's iteration count gives an estimate, and the preflight can say "this looks like ~350k, you have 200k" *before* burning the first 200k. Cheapest possible way to avoid a run that dies two thirds of the way through.
- **Effort:** ~1 h, and it needs the cost data to exist first.
- **Trigger:** after cost-per-iteration has run on three or four plans.
- **Path:** `plugins/goal/commands/auto.md` preflight.

### Smoke-test the gate commands at lock time
- **Why:** a gate command that already fails on the untouched tree is a typo, and it currently surfaces as a halt on iteration 1 hours later. Running each one once while the plan is being frozen catches it while the developer is still there. Done manually on `issue-3-spec.md` and it caught real problems.
- **Effort:** ~30 min, mostly prose in `/goal:plan` Phase 3.
- **Trigger:** next time a plan is locked.
- **Path:** `plugins/goal/commands/plan.md`.

### Canary iteration
- **Why:** a plan that is wrong systematically is wrong from iteration 1. Running the first slice alone, stopping and notifying costs one iteration instead of ten to find out.
- **Effort:** ~30 min — an `args.stopAfter` honoured by the loop.
- **Trigger:** the first plan longer than ~5 iterations.
- **Path:** `plugins/goal/workflows/goal-auto.js`.

### Turn cap per iteration
- **Why:** `templates/done-criteria.template` declares "maximum 15 turns per iteration" and nothing enforces it. An implementer stuck in a loop burns tokens silently, and the budget floor only notices once the damage is done.
- **Effort:** unknown — there is no documented per-agent turn limit in the workflow API. Needs a mechanism before it needs an implementation. Investigate before estimating.
- **Trigger:** the first run that burns a suspicious amount on one iteration.
- **Path:** `plugins/goal/workflows/goal-auto.js`.

### OpenTelemetry traces
- **Why:** Claude Code emits GenAI-convention traces, metrics and events. Turning it on gives span-level observability (tools considered vs invoked, tokens per hop, latency) in any OTLP backend, well past what `/workflows` shows. Vendor-neutral, and the standard graduated in 2026.
- **Effort:** ~30 min to try, then whatever a backend costs.
- **Trigger:** when `/workflows` stops being enough to explain why a run behaved as it did.
- **Path:** Claude Code settings, not this repo. See <https://opentelemetry.io/blog/2026/genai-observability/>.

### Cost per iteration in the PR body
- **Why:** `budget.spent()` deltas around each iteration make slice sizing empirical instead of intuitive. Over a few plans it tells you which shapes of iteration are expensive, which is exactly what `/goal:plan` Phase 3 currently guesses at.
- **Effort:** ~30 min.
- **Trigger:** after three or four workflow runs, when there is data worth reading.
- **Path:** `plugins/goal/workflows/goal-auto.js`.

### Promote the sensitivity lens to a command
- **Why:** the evaluation literature is clear that the mitigation which actually moves judge accuracy is executing code, not refining prompts. "Would this test fail if the rule broke?" is mechanisable: revert the implementation hunk, run the slice's test, require RED, restore. That turns an advisory opinion into an exit code, which means it can halt.
- **Effort:** ~1 h for the script, plus wiring it into the iteration `gate` blocks that `/goal:plan` produces.
- **Trigger:** after the lens layer has run on a few iterations and you trust the shape.
- **Path:** `plugins/goal/scripts/`, then `docs/adversarial-verification.md` §Promotion principle.

### Rename leftovers inside the frozen runner zone
- **Why:** the upstream commands were renamed (`/goal:draft-issue` → `/goal:spec`, `/goal:run-issue` → `/goal:plan`) without touching the orchestrated zone under active work. Four strings still print or assert the old names: `scripts/run/preflight.ts:116` (halt message "Move it out with /goal:run-issue"), its assertion in `tests/goal-run-preflight.test.ts:93`, `commands/supervise.md:26` ("Run `/goal:run-issue` first"), and the comment at `workflows/goal-auto.js:159`. Purely cosmetic, but the first three are user-facing and point at a command that no longer exists.
- **Also:** the bare `commit` policy was removed upstream (`/goal:plan` now offers `manual` | `commit+pr` only), but the runner and goal-auto still tolerate it: preflight refuses only `manual`, and `run/publish.ts:35` / `goal-auto.js:601` treat any non-`commit+pr` policy as "commit, publish nothing". Decide then whether that tolerance stays (old plans on disk) or a preflight refusal joins it.
- **Effort:** ~5 min + `bash plugins/goal/tests/run.sh`.
- **Trigger:** the next session that touches the runner, supervise or goal-auto anyway.
- **Path:** the lines above.

## 🗂️ How to add to this list

- Append a new section under the relevant category.
- Each entry: **Why** (problem) + **Effort** (rough) + **Trigger** (what would make you pick it up) + concrete pointer (file, command, link).
- When done, move it to a `## ✅ Done` section at the bottom with the commit SHA, or just delete.

---

## ✅ Done

- Bump `actions/checkout@v4` → `@v5` and `actions/setup-node@v4` → `@v5` (Node 24, kills Node 20 deprecation warnings) — covers 6 occurrences in `.github/workflows/validate.yml`.
- Install `florian-claude-tools/security-suite` (7 skills, 2 agents, 13 bash hooks: dangerous-actions-blocker, prompt-injection-detector, output-secrets-scanner, repo-integrity-scanner, security-gate, sandbox-validation, pre-commit-secrets, …). Token cost ~458 always-on. Pairs with existing `security-guidance@claude-plugins-official` (no strict overlap). Hooks activate on next Claude Code session.
- Add `audit:install-security-review-action` command + `templates/claude-code-security-review.yml` for installing the `anthropics/claude-code-security-review` GitHub Action into any production repo (`/audit:install-security-review-action` from within the target repo).
- Remove `playwright` MCP (real functional duplicate of `chrome-devtools`, 0 usage in history vs `chrome-devtools` actively used with 3 auto-allowed tools).
- Native BSD-vs-GNU lint hook shipped in `plugins/mac/hooks/bsd-gnu-lint.sh` + `hooks.json`. Warn-only (never blocks), runs on every PreToolUse:Bash. Detects: `grep -P`, `sed -i` without BSD empty suffix, `readlink -f`, `xargs -r`, `date -d`, GNU-only `realpath` flags, `mapfile`/`readarray`, `${var,,}`/`${var^^}`. Smoke-tested across 8 cases (5 trigger, 3 silent).
- Fix the `test-npx-skills` CI warning. Root cause: `npx skills` v1.5+ replaced the per-skill `SKILL.md` path output with a TUI summary (`Found <N> skills`). The CI grep was counting the old marker (2 incidental occurrences) and always tripped the warning. Switched the parser in `.github/workflows/validate.yml` to extract the `Found <N> skills` integer and compare to the 40-skill threshold; local run reports `Discovered 63 skills`.
- Disable `github@claude-plugins-official` plugin (the only thing it ships is a GitHub Copilot MCP pointing at `api.githubcopilot.com/mcp/`, which fails to connect without a Copilot subscription + valid `GITHUB_PERSONAL_ACCESS_TOKEN`). User does not use GitHub Copilot. Removed from `~/.claude/settings.json.enabledPlugins`; effective on next Claude Code restart.
- Cherry-pick `obra/superpowers` v5.1.0 into local `plugins/superpowers/` — 3 skills kept (`writing-plans`, `verification-before-completion`, `systematic-debugging`). Skipped: `brainstorming` (doublon `bmad-brainstorming`), `test-driven-development` (4th TDD framework → hesitation), `subagent-driven-development` / `requesting-code-review` / `receiving-code-review` / etc. (out of scope or covered). LICENSE + upstream attribution preserved.
- Cherry-pick `mattpocock/skills` into local `plugins/pocock/` — 3 skills kept (`grill-me`, `grill-with-docs`, `zoom-out`). Inverts the push-back loop: Claude grills before code. Skipped: `tdd` (4th TDD framework), `diagnose` (overlap `phpstan-resolver` + `systematic-debugging`), `triage` / `improve-codebase-architecture` / `to-issues` / `to-prd` / `prototype` / `caveman` / `handoff` / `write-a-skill` / `setup-matt-pocock-skills`. LICENSE + upstream attribution preserved.

---

## ❌ Rejected after evaluation

### `atournayre/customize` (Bash Security Validator + Hooks) — _evaluated, not adopted_
- **What it does:** PreToolUse hook running a TypeScript validator via `bun` to block destructive bash commands (`rm -rf /`, `dd`, fork bombs, writes to `/etc`/`/usr`/`/bin`, …).
- **Why rejected:**
  1. **Doesn't address the actual friction**: usage report flags portability (BSD vs GNU), not destructive commands. customize is a security validator, not a portability validator.
  2. Requires `bun` runtime (not installed) and adds startup latency on every Bash invocation.
  3. The native BSD-vs-GNU lint hook (planned above) addresses the real problem in pure bash, zero dependency, zero overhead.
- **If revisited:** would only be relevant as defense-in-depth against accidental destructive commands, after `bun` is installed and a measurable risk is identified. Low priority.

### `florian-claude-tools/security-suite` — _adopted, then superseded by internal `security-runtime`_
- **What it was:** 7 skills + 2 agents + 13 PreToolUse / PostToolUse bash hooks (dangerous-actions-blocker, prompt-injection-detector, output-secrets-scanner, repo-integrity-scanner, security-gate, sandbox-validation, pre-commit-secrets, claudemd-scanner, …). Installed during the audit work (commit history visible in BACKLOG ✅ Done section).
- **Why superseded:**
  1. **Footprint disproportionné** — 13 always-on hooks (~458 tokens of context) versus the 2 hooks that actually mattered for this threat model.
  2. **Real value concentrated in 2 hooks** — `claudemd-scanner` (SessionStart) and `prompt-injection-detector` (PreToolUse:Bash). The other 11 either overlapped with existing tooling (`pre-commit-secrets` is covered by per-project pre-commit configs, `dangerous-actions-blocker` is covered by Claude Code's native blocklist) or were defensive-of-defensive layers with negligible marginal value.
  3. **Replacement built locally** — `plugins/security-runtime/` ships those 2 hooks, smoke-tested (8 + 12 cases), with a README explaining the threat model and what is *not* covered (notably: MCP-vector prompt injection — token scoping is still required for that).
- **Current state:** `security-suite@florian-claude-tools` is **disabled** in `~/.claude/settings.json`. The marketplace `florian-claude-tools` is still registered, so re-enabling is one toggle away if a real gap is identified.
- **If revisited:** would only be considered if (a) the threat model widens beyond CLAUDE.md + Bash injection, and (b) a specific hook in the 13 is identified as having unique coverage not replicable in ~30 lines of bash. Low probability.

### `ctxharness` as pre-commit on this marketplace — _piloted, not adopted_
- **What it does:** scans declared markdown files (CLAUDE.md, AGENTS.md, docs/) for verifiable claims (semver, paths, scripts) and flags drift against ground truth.
- **Pilot result:** `ctxharness init` + `ctxharness scan README.md` on this repo produced 4 false positives — `SKILL.md`, `plugin.json`, `marketplace.json`, `hooks.json` all flagged as "NOT FOUND" because `scan` resolves paths at repo root only, while these files live in `plugins/*/` subdirectories. Real drifts here (version `plugin.json` ↔ `marketplace.json`, plugin count in README, skill-name ↔ directory-name) would require hand-written custom assertions — not auto-discovery.
- **Why rejected here:**
  1. The marketplace has no CLAUDE.md / AGENTS.md at the root (those live in `~/.claude/` and are out of scope).
  2. Two existing guardrails already cover the relevant invariants: `claude plugin validate` for manifest correctness, and `scripts/health-check.sh` for marketplace state.
  3. Net value here would be marginal — and would add commit-time friction.
- **Where it still makes sense:** real product repos (eres, formation, RAG) that maintain rich CLAUDE.md / SKILL.md / docs with version, path, and count claims that drift often. Install there, not here.

### `atournayre/gemini` (Gemini CLI delegation: 1M context, Deep Think, Google Search) — _evaluated, not adopted_
- **What it does:** Delegates queries to the `gemini` CLI for ultra-long context (1M tokens), Deep Think reasoning, and Google Search.
- **Why rejected:**
  1. **Already covered by current setup**: Claude Opus 4.7 (1M context) is already running here — feature #1 brings nothing.
  2. Claude `extended thinking` covers Deep Think.
  3. `WebSearch` covers most search use cases.
  4. Plugin requires a Google AI Studio API key (free tier sufficient, but a non-Anthropic dependency).
  5. User preference: stay on Claude Code + local models if extra capacity is needed (no value in adding a Google dependency).
- **If revisited:** only relevant if heavy reliance on Google-indexed corpora (recent web data) or if Claude quota becomes a constraint — neither applies today.
