# self-audit

Meta-tooling that keeps this marketplace **honestly curated**: it runs a rigorous, evidence-based comparison of an external Claude skill pack against everything already here, weighted by real usage, and turns the findings into a prioritized backlog. It is the industrialized form of the original manual `obra/superpowers` audit.

## Install

```text
/plugin install self-audit@fabien-claude-marketplace
```

## Command

```text
/self-audit:compare <target> [tier]
```

- `<target>`: a GitHub pack (`owner/name` or URL) or a local path.
- `[tier]`: `quick` | `standard` (default) | `deep`. Higher tiers fan out more agents and verify quotes verbatim.
- append `no-repo-audit` to skip the repo/doc-health pass.

**Read-only, always.** The command never stages, commits, pushes, opens a PR, or renames files: it produces exactly one report and updates its register. Versioning the report is your job, done separately.

## How it works

1. **Acquire**: shallow-clone the target, enumerate its skills/commands/hooks, map each to this marketplace's candidate equivalents.
2. **Adversarial comparison**: one unit of work per target skill reads it in full plus the local equivalents, returns coverage (`full`/`partial`/`none`), where this marketplace is genuinely better (backed by a verbatim quote + line ref), real gaps, and a cherry-pick verdict (`keep` / `skip` / `port technique X`). Posture is anti home-team bias; "deliberately out of scope" is a valid, common verdict.
3. **Verbatim verification**: load-bearing quotes are re-grepped against the real files and tagged ✅ verified / 🔎 to reconfirm.
4. **Usage lens**: gaps are prioritized P1/P2/P3 by reading [`usage-profile.md`](usage-profile.md): a gap that closes a real friction is P1; one orthogonal to how I actually work is P3 or skip.
5. **Repo/doc health**: a marketplace-internal pass (plugin layout, orphan files, `plugin.json`/`marketplace.json` coherence, README drift).
6. **Synthesize**: write `audits/<target>-gap-analysis.md` from the canonical 8-section template and append a row to the register.

## Reports produced so far

Two cuts of the same corpus, both under [`audits/`](audits/). The canonical per-target template is
`audits/superpowers-gap-analysis.md`.

### By theme (2026-08) — the current read

Six audits, each reading this marketplace against **eleven public packs** from fresh clones, anchored
to `file:line` on both sides.

| Theme | Ahead | Behind |
|---|---|---|
| [Workflow](audits/theme-workflow.md) | Judge is a program and the only committer; plan frozen by hash; bite check | No fuse on the implementer; a halted run writes no report; nothing reads the plan before it freezes |
| [Tests](audits/theme-tests.md) | Choosing the level a rule reads best at; no prod code in service of a test | No "what doesn't count as a test" taxonomy; a skipped or filtered test passes the gate; no mutation check |
| [Craft](audits/theme-craft.md) | Cross-language rules split from per-language examples — unique in the corpus | No shared design vocabulary; missing the "one adapter = hypothetical seam" guard; domain purity never mechanical |
| [Stack](audits/theme-stack.md) | One skill = one enforceable rule, scoped by language version; no target ships any stack convention at all | Zero mechanically checkable rule; PHP stops at 8.3; no skill detects the project's version |
| [Git & guardrails](audits/theme-git-garde-fous.md) | The only corpus where the writing agent structurally cannot commit, and it is verified after the fact | No hook blocks destructive git; the active force-push block is rented from an external plugin; hooks untested |
| [Meta-tooling](audits/theme-meta-tooling.md) | Real structural CI, manifest parity, versioned audit register | Progressive disclosure nearly absent; zero eval on 106 skills; descriptions break this pack's own spec |

### By target (2026-07 → 2026-08)

| Target | Report | Verdict (headline) |
|---|---|---|
| `obra/superpowers` | [`superpowers`](audits/superpowers-gap-analysis.md) | 2 keep, 12 skip, 6 skip motifs realigned |
| `mattpocock/skills` | [`mattpocock-skills`](audits/mattpocock-skills-gap-analysis.md) | 0 keep, 8 targeted grafts |
| `ai-driven-dev/framework` | [`aidd-framework`](audits/aidd-framework-gap-analysis.md) | 0 keep, 2 P1 / 3 P2 / 3 P3 |
| `bmad-code-org/BMAD-METHOD` | [`bmad-method`](audits/bmad-method-gap-analysis.md) | 0 keep, 3 technique-ports |
| `github/spec-kit` | [`spec-kit`](audits/spec-kit-gap-analysis.md) | 0 keep, 4 technique-ports |
| `SuperClaude-Org/SuperClaude_Framework` | [`superclaude`](audits/superclaude-gap-analysis.md) | full skip: 0 keep, 0 port |
| `eyaltoledano/claude-task-master` | [`claude-task-master`](audits/claude-task-master-gap-analysis.md) | full skip: 0 keep, 0 port |
| `buildermethods/agent-os` | [`agent-os`](audits/agent-os-gap-analysis.md) | near-skip: 1 optional P3 |
| `ruvnet/claude-flow` | [`claude-flow`](audits/claude-flow-gap-analysis.md) | full skip: out of category |
| `FlorianBruniaux/claude-code-plugins` | [`bruniaux`](audits/bruniaux-claude-code-plugins-gap-analysis.md) | 4 technique-ports |
| 20 public predefined workflows | [`workflow-corpus`](audits/workflow-corpus-gap-analysis.md) | 2 new P1 + 8 survivors |

The recurring lesson: most competitor "gaps" are **deliberate divergences** (human-gated git, no
worktrees, mutable specs, no heavy MCP/persona runtime), not holes. The audits name them explicitly so
a future session doesn't "fix" a choice. The thematic cut adds the symmetrical discipline — naming,
with a quote, every axis where a target genuinely wins.

## Files

- [`usage-profile.md`](usage-profile.md): the prioritization lens (refreshed from `/insights`).
- [`commands/compare.md`](commands/compare.md): the command definition + the audit register.
