# Claude Marketplace

Skills, hooks, agents, and slash commands for [Claude Code](https://claude.ai/claude-code), organized into independent, themed plugins: install only the stacks you work with.

## Quick start

```text
/plugin marketplace add FabienSalles/claude-marketplace
/plugin install goal@fabien-claude-marketplace
```

Then use it: `/goal:spec <your ticket>` turns the ticket into a functional contract, `/goal:plan` locks the executable plan, and `/goal:supervise` runs it unattended. Browse the [catalog](#plugins), install the packs for your stack (`craft`, `php`, `typescript`…), and you're set. Not on Claude Code? `npx skills add FabienSalles/claude-marketplace` installs the same skills anywhere. Other install methods (dev mode, `skillkit`) are [below](#installation), folded under "Other install methods".

## Start here: `goal`

Most of this marketplace is conventions: prose that shapes how Claude writes code. **One pack is
not.** [`goal`](plugins/goal/README.md) turns a ticket into a pull request without you in the
loop: a runner and a gate, 2,648 lines of TypeScript under 266 tests, built around rules most
autonomous loops do not have.

> A slice of work is accepted by a **program** that runs the command the plan declared and reads
> its exit code, never by a model's opinion of its own output. That program is the only thing
> allowed to commit, and it refuses a slice that touches an undeclared file or outgrows its
> declared diff budget. The pull request stays shippable at every slice: nothing lands on it that
> the gate has not proven green on the branch, so a run that stops at 3 slices of 15 leaves 3
> commits you can put in production.

Unattended never means unwatched: every run leaves a log, a timed event stream and an auditor's
report on disk. The gate even distrusts the tests: a slice whose test still passes with the
implementation set aside is refused.

Four steps take a ticket to a pull request:

1. **`/goal:spec`**: the ticket becomes a functional contract. Every gap a question asked now,
   every business rule an observable criterion.
2. **`/goal:plan`**: every criterion mapped to the command that proves it, the work cut into
   independently shippable slices (each with its delivery strategy: breaking change accepted, or
   additive change plus a cleanup slice), the plan hashed and frozen on a branch.
3. **`/goal` + `/goal:next`** *(mode `manual`)*: one slice per session, you read every diff, and
   the checkpoint re-runs the acceptance commands before handing you the next one.
4. **`/goal:supervise`** *(mode `commit+pr`)*: the whole plan unattended. A fresh implementer per
   slice, the gate's verdict on each, a pull request that stays shippable from the first landed
   slice, halts classified and repaired once, every run audited.

You pick the mode per plan: `manual` (Claude never commits; you correct the code while it is
still cheap) or `commit+pr` (you hand over the feature and leave).

**→ [What it does and why](plugins/goal/README.md) · [every step, with the reason for each](plugins/goal/docs/walkthrough.md) · [why this shape](plugins/goal/docs/adr/0001-shape-of-the-autonomous-loop.md) · [how it compares](plugins/goal/docs/comparison.md)**

## Design philosophy

What this marketplace optimizes for (and, just as deliberately, what it refuses to do):

- **Human stays the controller.** Git, commits, and PRs are opt-in, never automated behind your back.
- **Smallest change that works.** Skills push back on unrequested surface: anti-over-engineering is the default, not a mode.
- **Discipline as skills, not runtime.** Plain `SKILL.md` conventions. No heavy MCP servers, personas, or scaffolding to stand up.
- **Curated, not accumulated.** Every pack is weighed against the alternatives (the [`self-audit`](plugins/self-audit/README.md) plugin literally runs that comparison) instead of piling on.

## Plugins

Grouped by theme. Each links to the plugin's own README with the full skill catalog and links to every `SKILL.md`.

### Craft & quality

| Plugin | What it does |
|---|---|
| [**craft**](plugins/craft/README.md) | Cross-language craftsmanship principles (refactoring, OOP, code style, testing, TDD, DDD) that the language packs build on. |

### Workflow & planning

| Plugin | What it does |
|---|---|
| [**goal**](plugins/goal/README.md) | Ticket → functional contract → locked plan → slices judged by a **program** (exit code, declared paths, diff budget) that is the only committer. The pull request stays shippable at every slice. Two modes picked per plan: `manual` (you read every diff) or `commit+pr` (unattended). |
| [**product**](plugins/product/README.md) | Slicing a spec into thin shippable iterations (`vertical-slice`) and shipping each without blocking: flags, additive change, cleanup (`delivery`). Loaded by `goal`. |
| [**common**](plugins/common/README.md) | Shared workflow tools: planning, research, context-window, TDD/feature-dev commands, code-review/test hooks, a UI agent. |
| [**legacy**](plugins/legacy/README.md) | `legacy:discovery` reverse-engineers an unfamiliar codebase into a shared-brain knowledge base: recon + git archaeology, architecture, use cases, entity model, risk register. Onboarding or audit-prep depth. |
| [**git**](plugins/git/README.md) | Transverse git & PR discipline: fetch-first ref freshness, branch/commit/PR conventions, force-push and worktree guardrails. Merges the former PR-creation skill. |
| [**release**](plugins/release/README.md) | Semver discipline for this marketplace: every PR touching a plugin bumps its version (`version-bump`), classified from the commits since its last bump. |
| [**superpowers**](plugins/superpowers/README.md) | Cherry-picked [obra/superpowers](https://github.com/obra/superpowers): `verification-before-completion`, `systematic-debugging`. |
| [**pocock**](plugins/pocock/README.md) | Cherry-picked [mattpocock/skills](https://github.com/mattpocock/skills): `grill-me`, `grill-with-docs`, `zoom-out`. |

These overlap: [**docs/workflows-decision-guide.md**](docs/workflows-decision-guide.md) maps which planning / execution workflow to reach for, and when.

### Languages & stacks

| Plugin | What it does |
|---|---|
| [**php**](plugins/php/README.md) | PHP 8.0–8.3 conventions: code style, OOP, DDD, refactoring, SQL, Composer. Framework-agnostic. |
| [**phpunit**](plugins/phpunit/README.md) | PHPUnit TDD workflow + test conventions (DAMP/AAA/Prophecy). Layers on `craft`. |
| [**symfony**](plugins/symfony/README.md) | Personal Symfony overlay: FormType, Twig components, PRG. Distinct from `atournayre/symfony`. |
| [**typescript**](plugins/typescript/README.md) | Typing, code style, functional, OOP, DDD events, refactoring. |
| [**nest**](plugins/nest/README.md) | NestJS architectural conventions + DDD. |
| [**vitest**](plugins/vitest/README.md) | Vitest TDD workflow + test conventions. |
| [**astro**](plugins/astro/README.md) | Astro 5.x: routing, content collections, i18n, SEO, Tailwind, React islands, view transitions. |
| [**frontend**](plugins/frontend/README.md) | Clean/hexagonal architecture, Container/Presentation, safe edits to existing UI. |
| [**jquery**](plugins/jquery/README.md) | jQuery module structure, `js-*` selector hooks, per-block scoping, symmetric toggles. |
| [**tooling**](plugins/tooling/README.md) | Docker, Drizzle ORM, pnpm workspaces, Zod, Claude plugin + npx skills conventions. |

### Security

| Plugin | What it does |
|---|---|
| [**audit**](plugins/audit/README.md) | Overlay on `netresearch/security-audit` (`security-overrides`) + stack code patterns (`ts-security`). |
| [**security-audit**](https://github.com/netresearch/security-audit-skill) *(external)* | netresearch OWASP/CWE/CVSS baseline: 80+ checkpoints, 61 references. |
| [**security-runtime**](plugins/security-runtime/README.md) | Runtime hooks: CLAUDE.md injection scanner (SessionStart) + Bash prompt-injection blocker (PreToolUse). |

### Meta-tooling

| Plugin | What it does |
|---|---|
| [**self-audit**](plugins/self-audit/README.md) | `/self-audit:compare` audits an external skill pack vs this marketplace into a prioritized gap backlog. |

### Platform & UX

| Plugin | What it does |
|---|---|
| [**mac**](plugins/mac/README.md) | macOS/BSD shell discipline (bash 3.2 vs 5+, BSD vs GNU) + a `bsd-gnu-lint` PreToolUse hook. |
| [**statusline**](plugins/statusline/README.md) | Colored bar: cwd, branch, model, context %, 5h rate-limit usage + reset countdown. |

### Marketing

| Plugin | What it does |
|---|---|
| [**marketing-content**](plugins/marketing-content/README.md) | LinkedIn, SEO blog, direct-response copy, editing, calendar, repurposing, SEO briefs, schema markup. |
| [**marketing-strategy**](plugins/marketing-strategy/README.md) | ICP, mental models, 139 growth ideas, competitor analysis, positioning/GTM (April Dunford). |
| [**marketing-distribution**](plugins/marketing-distribution/README.md) | Multi-platform social, Twitter/X + Reddit threads, email subject lines, newsletter growth. |
| [**marketing-analytics**](plugins/marketing-analytics/README.md) | GA4/GTM/UTM tracking setup, Google Analytics Data API + Search Console reporting. |

## Installation

**Recommended, Claude Code plugins (`/plugin`):**

```text
/plugin marketplace add FabienSalles/claude-marketplace
/plugin install goal@fabien-claude-marketplace
/plugin install craft@fabien-claude-marketplace
# …one install line per pack you want
```

The `statusline` plugin needs one extra activation step: see [Statusline](#statusline) below.

**Without Claude Code, skills only (`npx skills`):**

```bash
npx skills add FabienSalles/claude-marketplace --list        # list available skills
npx skills add FabienSalles/claude-marketplace@php-8-3       # install one skill
npx skills add FabienSalles/claude-marketplace               # install everything
```

Same `SKILL.md` format, works with the [`npx skills`](https://github.com/vercel-labs/skills) ecosystem (Cursor, Codex, Claude Code…). This is also the only install path counted by [skills.sh](https://skills.sh/fabiensalles/claude-marketplace).

<details>
<summary><strong>Other install methods</strong>: dev mode (local clone), <code>claude plugin</code>, <code>skillkit</code></summary>

### Dev mode (local clone as marketplace)

For active development of the marketplace: register the clone itself, natively. No symlinks: edits in `plugins/*/` are picked up live on the next Claude Code session.

```bash
git clone https://github.com/FabienSalles/claude-marketplace.git
```

```text
/plugin marketplace add /path/to/claude-marketplace
/plugin install goal@fabien-claude-marketplace
# …one install line per pack you want
```

### Via `claude plugin install`

Install a single plugin through the official Claude Code CLI (without going through `/plugin marketplace add`).

```bash
claude plugin install FabienSalles/claude-marketplace/plugins/php   # install one plugin
claude plugin validate plugins/php                                  # validate a manifest
```

### Via `skillkit`

Natively compatible, same `SKILL.md` format.

```bash
skillkit install FabienSalles/claude-marketplace
```

</details>

## Statusline

![Statusline preview](docs/statusline-preview.png)

Claude Code does not accept the `statusLine` key in `plugin.json`, so a small slash command finishes the wiring after `/plugin install statusline`:

```text
/plugin install statusline@fabien-claude-marketplace
/statusline:setup
```

Full details (colored screenshot, segment-by-segment breakdown, refresh-interval tip) live in [`plugins/statusline/README.md`](plugins/statusline/README.md).

## Contributing

Adding or editing a plugin, manifest conventions, local validation (`scripts/health-check.sh`), and what CI enforces are all in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT
