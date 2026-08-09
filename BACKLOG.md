# Backlog

Items identified during a marketplace audit and not yet executed. Loose priority — pick what's relevant when you come back, except the `goal` section, which is ordered.

> Entries here go stale. Before acting on one, check it against the code — the `goal` section was rewritten on 2026-08-06 after an audit found it declaring built work unbuilt and routing every item at a file that had been superseded.

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

## 🎯 Goal plugin — roadmap

Rewritten 2026-08-06 after a full audit of the runner, the gate, the tests, the docs and the six
run reports on disk. The previous version of this section opened with *"None of it is built"* and
routed every item at the Workflow generation and the command that launched it. Both statements
were false: the runner ships, is tested, and has landed 26 gate-verified slices across six
unattended runs. That Workflow generation has since been deleted.

Ordered by **what it costs to lose**, not by effort. The competitive reading behind items 4–10 is
[`plugins/goal/docs/comparison.md`](plugins/goal/docs/comparison.md) §Where the field wins.

### 1. A fuse — an iteration ceiling and a clock on the implementer
- **Why:** the single largest gap, and the cheapest to close. `gate/bounded.ts` puts a 900s SIGKILL clock on every *declared command*, but the implementer session is spawned with no timeout, no turn cap and no iteration ceiling. A session circling an impossible slice circles until the usage allowance runs out — and `templates/done-criteria.template` already promises "maximum 15 turns per iteration", which nothing enforces. `SwarmOps` caps everything numerically; `Rel(AI)Build` ships a hard 3-iteration auto-fix cap; Anthropic's own `ralph-wiggum` says to "always rely on a maximum iteration count as the primary safety mechanism".
- **Effort:** ~1 h. `spawnSync` already accepts `timeout` + `killSignal` — `run/iteration.ts` simply does not pass them. The turn cap needs `--max-turns` on the `claude -p` call; verify it exists before promising it.
- **Trigger:** now. Every unattended run without this is unbounded.
- **Path:** `scripts/run/iteration.ts`, plus a `GOAL_RUN_IMPLEMENTER_TIMEOUT` beside the existing env knobs.

### 2. Detect a weakened pre-existing test
- **Why:** this protects the one differentiator nobody else has. The bite check proves the *new* test bites; it does not prove that a pre-existing test living inside the same declared files was not gutted. Three assertions removed of four, keeping the one that fails without the implementation, passes every check today and fits under any diff budget. The failure mode has a stable taxonomy — assertions deleted, tolerances widened, tests marked skip, snapshots regenerated — and the formula worth keeping is *in an agent's PR the tests are part of the claim, not part of the proof*.
- **Effort:** ~2 h. `greenproof` (<https://github.com/zxyasfas/greenproof>) is a working implementation of exactly half of this in ~200 lines: snapshot the test files before the slice, then re-run the **originals** against the new code. Same shape as the bite check, opposite direction, and it composes rather than competes.
- **Trigger:** now, and before any further competitive claim rests on the bite check.
- **Path:** a new `scripts/gate/` module, run beside `bite.ts` in `verify`.

### 3. A run report for a halted run
- **Why:** a structural blind spot in the evidence base. `run/iteration.ts` exits at `:195`/`:199` before `close()`, and `close()` is the only caller that spawns the auditor — so **no report can exist for a run that halted.** The six reports on disk are successful-runs-only by construction, and the auditor's brief promises it a halt input that never arrives. That is the opposite of what you want: the runs worth auditing are the ones that stopped.
- **Effort:** ~1 h. Call the auditor on the halt path too, briefed that the run stopped.
- **Trigger:** the next halt.
- **Path:** `scripts/run/iteration.ts` halt/pause paths, `scripts/run/close.ts`.

### 4. Make the run's own records survive
- **Why:** every run report lives under a fully git-ignored `.claude/`, and reports **have already been lost** — `e39e66d.md` cites six earlier reports (`a7289c3`, `bf532d1`, `c767072`, `b843981`, `fdc8928`, `ea236ba`) that are no longer on disk, including the one holding half the evidence for the closing-iteration-halt pattern. Not one `.run.jsonl` or `.run.log` survives anywhere, so no figure in any of the six reports can be re-derived. Separately: the current records layout (`<work-id>/<run-id>/`) has never been exercised by a real run — all six reports are still flat `<sha>.md` files — so the first auditor to run under it will find zero prior reports rather than "the other reports".
- **Effort:** ~1 h.
- **Trigger:** before the next run, or the next comparison is against nothing.
- **Path:** decide a retention rule; `scripts/run/report.ts` and the auditor brief in `scripts/run/close.ts`.

### 5. Finish the structured-events work the plan claimed
- **Why:** `goal-run-remaining-events-spec.md` is ticked and its stated payoff never arrived. It promised that "iteration 7 took 3044s" would become "implementer 2610s, gate 380s, push 54s". Every runner-level stage still folds its timings into a formatted string handed to `reporter.say`, so they land as prose inside a `message` field — exactly the parsing problem the plan says it exists to remove. The lens caught this at the time and it was recorded as advisory. Its own acceptance test asserts a regex over concatenated `message` strings, so it passes on precisely the shape the rule forbids. No per-`dodN` event is emitted at all.
- **Why it matters beyond tidiness:** *"a run's first entered iteration costs far more than its diff explains"* has now hit three runs across three plans, and the instrumentation cannot separate setup cost from implementation cost — so a recurring finding stays undiagnosable.
- **Effort:** ~1 h.
- **Trigger:** now — it is the only open item that a previous plan already claimed as delivered.
- **Path:** `scripts/run/report.ts`, `scripts/run/close.ts`, `scripts/gate/ship.ts`, and the test at `tests/goal-run-events.test.ts:124`.

### 6. Close the test-coverage holes in the harness itself
- **Why:** eleven of the 25 modules under `scripts/gate/` and `scripts/run/` have no test file of their own, including `gate/scope.ts`, `gate/commands.ts`, `run/iteration.ts` and `run/report.ts` — and the README's "each with its own test file" is written as though they all did. Worse, four of `tests/run.sh`'s five refusals are untested, including the missing-summary halt; and the skip guard that *is* tested is blind to any skip nested inside a `describe()` or a subtest, because its pattern is anchored at column 0 and node indents those. `run/shell.ts`'s `quote()` is the only shell-injection barrier for four command strings and has zero tests.
- **Effort:** ~3 h.
- **Trigger:** the next change to any of those modules.
- **Path:** `plugins/goal/tests/`.

### 7. Make the documents machine-checkable
- **Why:** a full audit found 12 high-severity claims in `docs/` that the code contradicted — in both directions, including several mechanisms that *ship and work* but appear only as admitted gaps. Roughly a third of the ~95 `file:line` anchors point at blank lines or unrelated code. These documents are unusually honest and that is exactly why they are worth keeping true; drift is the only thing that devalues them.
- **Effort:** ~2 h for a CI check that resolves every `path:line` anchor in `docs/` and fails on one pointing at a blank line or a file that does not exist. Line-content matching is over-engineering; existence and non-blankness catch nearly all of it.
- **Trigger:** after the current correction pass, so the check starts green.
- **Path:** `scripts/`, wired into `.github/workflows/validate.yml`.

### 8. Bind evidence freshness beyond plan time
- **Why:** the plan is hashed once, at plan time. *Proof-or-Stop* (<https://arxiv.org/abs/2607.14890>) binds a `materialHash` over the live tracked source tree at **every** gate, which is strictly stronger. Related measured result: using a stale verification trace against current code broke 34 of 135 otherwise-correct attempts, against 4 of 135 with a fresh one.
- **Effort:** ~2 h.
- **Trigger:** after items 1–3.
- **Path:** `scripts/gate/plan.ts`, extending `lockedHash`.

### 9. An observe mode
- **Why:** there is currently no way to try a new refusal without it being able to stop a run. `axiom` installs every rule recording-only — "it records what it *would* have blocked and blocks nothing" — and enforcement is turned on per rule once its findings have earned it. That is how items 2 and 9 should ship rather than going straight to blocking.
- **Effort:** ~1 h.
- **Trigger:** together with item 2.
- **Path:** `scripts/gate/halt.ts`, plus a `GOAL_GATE_OBSERVE` list.

### 10. Exportable proof
- **Why:** "every claim is a command that ran" is a promise about how the code is written; no artefact exists that a third party could verify without re-running everything. `Bernstein` keeps a signed audit chain checkable offline, `axiom` a custody chain, `HORKOS` a receipt ledger. The `.run.jsonl` stream is most of the raw material already — it needs a stable schema and a signature, not a new mechanism.
- **Effort:** ~2 h.
- **Trigger:** the first time someone other than the author needs to trust a run.
- **Path:** `scripts/run/report.ts`.

### 11. A machine critic of the plan, before it freezes
- **Why:** Google's `Jules` added a critic reading self-approved plans before any code, for a measured 9.5% drop in failure rate. Keeping the *human* grill is deliberate and well supported; having **nothing** mechanical read a plan before freezing is a separate decision that was never actually taken. A plan defect is also the most common thing `/goal:supervise`'s classifier has to handle — and both halts on record were plan-vs-implementation calls.
- **Effort:** ~2 h.
- **Trigger:** after three more plans, so there is a defect corpus to write the critic against.
- **Path:** `/goal:plan` Phase 4, before the lock.

### 12. React to a red CI run
- **Why:** still the largest open loop. Nothing learns that the pull request the run just opened went red, and the gate passing locally is not the same claim. It is deliberately hard here, because closing it means reading CI and PR text — precisely what the write-only invariant forbids.
- **Effort:** unknown, and the design matters more than the code. The safe shape is already written in [`plugins/goal/docs/steering-and-injection.md`](plugins/goal/docs/steering-and-injection.md): a reader agent holding no write tool, a remote vocabulary where every verb may only *subtract*, and a checkbox panel the run authored and reads back as a bit vector.
- **Trigger:** not before items 1–3.
- **Path:** design first.

### Deliberately not planned

- **A sandbox.** `OpenHands` protects the machine from the agent; this protects the repository from the agent. That is an accepted debt: the harness is pointed at a repository whose owner trusts it. The day it is pointed at somebody else's, this whole axis is missing — recorded so the decision is visible, not so it gets built.
- **Parallel tracks.** Built, measured over two real runs, and removed. Reasoning and numbers in [`plugins/goal/docs/why-not-parallel.md`](plugins/goal/docs/why-not-parallel.md). Several plans a night, run in sequence, is the replacement.
- **Reading issue or PR text.** The write-only invariant is the answer to a real attack class (a malicious GitHub issue *title* drove a chain ending with attacker code in a coding agent's own npm package, February 2026). The cost — you cannot steer a run by commenting — is accepted.

### Closed since the previous version of this section

**Retiring the Workflow generation** (2026-08-06): `workflows/goal-auto.js` and the test harness built for it are deleted. It was never called by `scripts/`, but a plugin's `workflows/*.js` are registered as invokable skills, so it stayed launchable by name — carrying the publication defect that caused its abandonment. Every document citing it now says it was removed rather than pointing at a path.

Verified against the code, not against memory: the **secret scan before any push** ships and refuses rather than degrades when no scanner is installed (`gate/ship.ts`); **smoke-testing the gate commands** ships as the base sweep, deduplicated, in preflight (`run/sweep.ts`); **reporting whether a failing gate is deterministic** ships as a three-run replay of `gate1` (`gate/commands.ts`); **the environment fingerprint on halt** ships in part, as the post-mortem that records the failing attempt, the dying session's transcript tail and whether the `claude` binary changed underneath it (`run/postmortem.ts`); **track disjointness** and the `--dry-run` mode are moot — tracks were removed, and every unfinished slice is already proven runnable before any is implemented (`goal-run.ts:72-106`).

### Port the goal commands to skills, with a declared portability boundary
- **Why:** the doc confirms commands and skills are equivalent at invocation ("Custom commands have been merged into skills", code.claude.com/docs/en/skills), and skills add what goal wants: `npx skills` distribution, `disable-model-invocation` (a model must never launch `supervise` on its own), a support-files directory. The boundary to declare per skill: `tickets`/`spec`/`plan`/`next` are portable prose (degrade AskUserQuestion → plain question, MCP → inline paste, pbcopy → print), `supervise` is Claude Code only (the runner spawns `claude -p --agent`, see ADR 0001).
- **Not one plugin split in two:** the gate serves the manual loop too, and `plan`/`next` reference `supervise`; a structural split creates cross-plugin drift for nothing a frontmatter line does not already say.
- **Effort:** 2–3 slices (mechanical move + reference sweep, then the degradation pass and postures).
- **Trigger:** after the `goal-parallel-readability` run lands (2026-08-09 session).

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
