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

Each lands under [`audits/`](audits/); the canonical template is `audits/superpowers-gap-analysis.md`.

| Target | Verdict (headline) |
|---|---|
| `obra/superpowers` | 2 keep, 12 skip, 6 skip motifs realigned |
| `mattpocock/skills` | 0 keep, 8 targeted grafts, doc drift fixed |
| `ai-driven-dev/framework` | 0 keep, 2 P1 / 3 P2 / 3 P3 |
| `bmad-code-org/BMAD-METHOD` | 0 keep, 3 technique-ports |
| `github/spec-kit` | 0 keep, 4 technique-ports |
| `SuperClaude-Org/SuperClaude_Framework` | full skip: 0 keep, 0 port |

The recurring lesson across all six: most competitor "gaps" are **deliberate divergences** (human-gated git, no worktrees, mutable specs, no heavy MCP/persona runtime), not holes. The audits name them explicitly so a future session doesn't "fix" a choice.

## Files

- [`usage-profile.md`](usage-profile.md): the prioritization lens (refreshed from `/insights`).
- [`commands/compare.md`](commands/compare.md): the command definition + the audit register.
