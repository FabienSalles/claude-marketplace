# Copilot / Codex skills compatibility audit

Audited: 2026-09-09, branch `copilot-compliante` (even with `origin/main`).
Scope: 108 skills across 29 plugins.

Method: local inventory of every `SKILL.md`, cross-checked against official
documentation (GitHub Copilot docs, VS Code agent-skills docs, OpenAI Codex
docs, agentskills.io spec, Anthropic skill-authoring docs), the Codex loader
source (`openai/codex`), the Copilot CLI changelog (`github/copilot-cli`),
the `npx skills` installer source (`vercel-labs/skills`), and a full run of
the spec reference validator (`skills-ref validate`) on all 108 skills:
**103/108 fail strict spec validation**, but most failures are benign in
practice. Findings below are ordered by real-world impact.

## 1. Hard frontmatter violations — 12 skills

Two rules, one overlap (`symfony:symfony-frontend` breaks both).

### Description > 1024 characters (3 skills)

Limit documented by VS Code Copilot, hardcoded in the Codex loader
(`MAX_DESCRIPTION_LEN = 1024`, invalid skills are ignored with a warning),
and a hard limit of the agentskills spec.

| Skill | Length |
|---|---|
| `git:git` | 1243 |
| `symfony:symfony-frontend` | 1116 |
| `frontend:frontend-best-practices` | 1057 |

### Angle brackets in description (10 skills)

Official rule from Anthropic authoring docs: "description: Cannot contain
XML tags". The internal convention (`tooling:npx-skills-conventions`)
hardens it to "no angle brackets"; the BACKLOG had already flagged it.
Neither Copilot nor Codex documents this criterion, but the count matches
the observed Copilot failures.

| Skill | Offender |
|---|---|
| `frontend:frontend-clean-architecture` | `features/<feature>/domain` |
| `goal:supervise` | `<plan>` |
| `php:php-8-1` | `$this->method(...)` |
| `php:php-code-conventions` | `?->` |
| `phpunit:php-test-conventions` | `spy>mock` |
| `symfony:prg-pattern` | `->` (twice) |
| `symfony:symfony-frontend` | `<script>`, `<style>` (real tags, worst case) |
| `symfony:symfony-test-conventions` | `getContainer()->set` |
| `typescript:ts-functional` | `Result<T,E>` |
| `vitest:vitest-test-conventions` | `spy>mock` |

Nuance: only `<script>`, `<style>`, `<plan>`, `<feature>` are literal XML
tags. The `->` / `spy>mock` cases only break the hardened internal rule.

## 2. Codex catalog budget — systemic

Codex docs: "This list uses at most 2% of the model's context window, or
8,000 characters when the context window is unknown". Descriptions are
shortened first, then whole skills are omitted with a warning.

The 108 descriptions total **57,986 characters** (average 537, style
`ACTIVATE... Covers... DO NOT use for...`). Even individually valid,
installed together they blow the budget: Codex will expose only a fraction.
Compressing every description (target ~200-300 chars) matters more for
day-to-day use than the 12 hard cases.

### Budget mechanics (verified in `openai/codex` source, `ext/skills/src/render.rs` + `config/src/skills_config.rs`)

- Default: `2%` of the model context window, in tokens
  (`SKILL_METADATA_CONTEXT_WINDOW_PERCENT = 2`); fallback
  `8,000 characters` when the window is unknown.
- Override: `[skills] max_context_tokens = N` in `~/.codex/config.toml`.
  Source doc comment: "Maximum tokens used by the available-skills catalog.
  Defaults to 2% of the model context window and is **capped at 10,000
  tokens** when set." It is an absolute token count, not a fraction.
- Degradation ladder: descriptions are shortened first (each catalog entry
  is also hard-truncated at 1,024 chars), then all descriptions are removed
  and only names stay listed; each stage emits a warning.
- Context windows: per-model, service-published. Official API docs list the
  GPT-5.6 family (Sol/Terra/Luna) and GPT-6 Astra at **1.05M tokens**; the
  CLI source falls back to **272,000 tokens** for unknown models (the
  GPT-5.1-codex generation window). `codex /status` shows the live value.
- Consequences for this marketplace (~58K chars ≈ ~14.5K tokens at the
  source's own 4-bytes/token approximation):
  - 272K-token model: default budget 5,440 tokens → heavy shortening; even
    the maxed-out override (10,000) still overflows.
  - 1.05M-token model: default budget ~21,000 tokens → everything fits with
    no config at all; setting the override there would *lower* the budget
    (capped 10,000 < default 21,000), so leave it unset on large models.
- Claude Code comparison (docs, `code.claude.com/docs/en/slash-commands`):
  default budget is 1% of the context window, raisable via the
  `skillListingBudgetFraction` setting (a fraction, e.g. `0.02`) or the
  `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var (fixed chars); per-entry cap of
  1,536 chars configurable via `skillListingMaxDescChars`; on overflow it
  drops descriptions for the least-invoked skills first. Codex has no
  fraction knob and a hard 10,000-token ceiling on the override.

## 3. Top-level `version` — 102 skills

The spec only allows `{name, description, license, allowed-tools, metadata,
compatibility}`; the compliant location is `metadata.version`. The official
`skills-ref` validator rejects 102 skills for this (the bulk of the 103
failures). In practice: the Codex loader ignores unknown fields (verified in
source, serde without `deny_unknown_fields`) and the Copilot CLI even
removed its unknown-field warnings (changelog). **Not blocking today**, but
any spec-validating tooling (`gh skill publish`, `skills-ref`, future strict
loaders) will reject them. Fully scriptable fix.

## 4. Structurally Claude-only skills

- **`goal:supervise`**: 5 invocations of
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-run.ts...`. Doubly broken
  outside Claude: the variable does not exist (Copilot uses
  `${PLUGIN_ROOT}`, Codex has nothing), and the scripts live at *plugin*
  level (`plugins/goal/scripts/`), so a bare-skill install does not even
  copy them. The whole `goal` pack (5 agents + hooks + scripts) is a Claude
  Code machine.
- **`common:crispi-planning`**: 3 relative links escaping the skill
  directory (`../../commands/spec-first-dev.md`, `../../../goal/README.md`,
  `../../../../docs/workflows-decision-guide.md`). Dead when the skill is
  installed standalone.
- **`disable-model-invocation`** (`goal:supervise`, `pocock:zoom-out`):
  supported by VS Code Copilot and the Copilot CLI (changelog: "Fully honor
  the skill disable-model-invocation flag"), absent from the spec and from
  Codex. On Codex both skills become auto-invocable, exactly what they are
  meant to prevent.
- **`allowed-tools`** (3 marketing-distribution skills): the spec defines it
  as a *space-separated string*; here it is a YAML list, with Claude tool
  names (`WebFetch`, `WebSearch`) unknown to Copilot (documented vocabulary:
  `shell`/`bash`) and to Codex.
- **~40 `see plugin:skill` pointers** in descriptions
  (`see craft:oop-principles`...): the `plugin:` namespace only exists in
  Claude. Elsewhere it is noise that eats the description budget. VS Code
  even documents that namespace prefixes in a `name` make the skill silently
  fail to load (all `name` fields here are clean; only prose pointers are
  affected).
- **Edge case**: `claude-recovery` and `claude-plugin-conventions` contain
  the reserved word "claude" (forbidden by Anthropic platform docs for API
  upload; no effect on Copilot/Codex).

## 5. Body sizes

Official recommendation everywhere (Anthropic + spec): **SKILL.md under 500
lines**; the internal convention says under 2000 words. One skill exceeds
500 lines: **`goal:plan` (930 lines, 8991 words)**. Thirteen more exceed
2000 words:

| Skill | Words |
|---|---|
| `craft:testing-principles` | 3104 |
| `goal:supervise` | 2968 |
| `marketing-strategy:marketing-psychology` | 2949 |
| `marketing-strategy:marketing-ideas` | 2943 |
| `goal:spec` | 2863 |
| `git:git` | 2824 |
| `legacy:discovery` | 2820 |
| `goal:next` | 2638 |
| `marketing-distribution:social-content` | 2587 |
| `product:vertical-slice` | 2182 |
| `marketing-content:write-blog` | 2175 |
| `marketing-distribution:email-subject-lines` | 2108 |
| `marketing-distribution:thread-writer` | 2013 |

Not install-blocking, but every activation loads the full body.

## 6. Distribution paths

| | Copilot | Codex |
|---|---|---|
| Repo paths | `.github/skills`, `.claude/skills`, `.agents/skills` | `.agents/skills` only (cwd, parent, repo root) |
| Personal paths | `~/.copilot/skills`, `~/.agents/skills` (+ `~/.claude/skills` in VS Code) | `~/.agents/skills`, `/etc/codex/skills` |
| Plugins | Agent Plugins 1.0 (GA Aug 2026): `plugin.json` + `marketplace.json`, near-identical to Claude's | `manifest.json`, different format |

Skills "work fine on Claude" because they are installed as *plugins*
(`~/.claude/plugins`), a path neither Copilot nor Codex scans. The common
denominator is `.agents/skills`, which `npx skills add` fills (verified in
the vercel-labs source; the installer itself validates nothing, everything
happens at load time). Bonus: since Copilot now supports
`plugin.json`/`marketplace.json` marketplaces, this repo is close to being
consumable as a Copilot marketplace as-is; what will not carry over: hooks,
commands, Claude agents and `${CLAUDE_PLUGIN_ROOT}`.

## Already clean

Zero duplicate names across the 108, zero invalid names (charset, length,
`name` = directory everywhere), sound YAML (all descriptions quoted, no bare
colons, the number-one pitfall listed by the spec), `references/` one level
deep, no Windows paths. The only 5 skills passing the spec validator as-is:
`goal:grill-adversarial`, `goal:next`, `goal:plan`, `goal:spec`,
`goal:tickets` (ironically, the least functionally portable pack).

## Repair plan (ordered by yield)

1. **Scriptable in one pass**: `version:` → `metadata.version` (102 files).
2. **The 12**: rewrite the 3 descriptions over 1024 chars and rephrase the
   10 angle-bracket cases (`->` → "to", `$this->method(...)` →
   "first-class callable syntax", `Result<T,E>` → "Result type",
   `<script>` → "script tags").
3. **Global description compression** (~300 chars max) removing the
   `see plugin:skill` pointers: also fixes the Codex budget, the highest
   yield for actual use.
4. **`goal:plan`**: split under 500 lines via `references/`; the 13 others
   over 2000 words as they get touched.
5. **`crispi-planning`**: inline or rewrite the 3 escaping links.
6. **`goal` pack**: own the Claude-only status via the `compatibility:`
   field (what the spec provides it for) rather than bending it.
7. **`validate-skills.sh`**: add desc ≤ 1024, no angle brackets, frontmatter
   field whitelist, body ≤ 500 lines (the BACKLOG already planned the
   ceiling check).

## Sources

- <https://code.visualstudio.com/docs/agent-customization/agent-skills>
- <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills>
- <https://docs.github.com/en/copilot/concepts/agents/about-agent-skills>
- <https://developers.openai.com/codex/skills>
- <https://agentskills.io/specification>
- <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>
- `openai/codex` source (`codex-rs/skills/src/parser.rs`,
  `codex-rs/ext/skills/src/loader/mod.rs`)
- `github/copilot-cli` changelog
- `vercel-labs/skills` source (`src/agents.ts`, `src/installer.ts`)
- `agentskills/agentskills` reference validator (`skills-ref`)
