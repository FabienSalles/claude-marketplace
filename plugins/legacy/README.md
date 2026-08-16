# legacy

Reverse-engineer an unfamiliar or legacy codebase into a **shared brain**: a small,
versioned knowledge base that a human can read in an hour and that any future Claude
session can consume to answer questions, plan changes, or prepare an audit — without
re-reading the whole codebase.

Synthesis of the best of three public approaches, plus what they all lack:
[AIUP `/reverse-engineer`](https://github.com/AI-Unified-Process/marketplace)
(use-case aggregation by actor goal, globally unique business rules),
[DEFRA legacy-reveng](https://github.com/DEFRA/claude-legacy-reveng-plugin)
(parallel analyst decomposition),
[schematic](https://github.com/blader/schematic) (scope with git before reading,
coverage cross-check) — extended with git archaeology (churn hotspots, bus factor,
temporal coupling), a risk register, and an audit-prep mode.

## Install

```text
/plugin install legacy@fabien-claude-marketplace
```

## Skills (1)

| Skill | Purpose |
|---|---|
| [`discovery`](skills/discovery/SKILL.md) | 7-phase workflow: frame (onboarding or audit-prep, committable artifacts or gitignored), recon + git archaeology, cartography + glossary, use cases aggregated by actor goal, entity model (migrations as truth), risk register (churn × complexity × no tests), shared-brain index with routing table. Audit-prep adds a security-surface dossier (input vectors, authorization matrix, secrets, dependency CVEs) and bridges to `security-audit:security-audit` + `audit:security-overrides`. |

## Artifacts produced

In `docs/legacy/` (committable) or `.claude/legacy/` (gitignored, typical on client
missions): `README.md` (routing table), `recon.md`, `architecture.md`, `glossary.md`,
`use-cases/UC-XXX-*.md`, `entity-model.md`, `risk-register.md`, `open-questions.md`,
plus `security-surface.md` in audit-prep mode.

## Related

- [`self-audit`](../self-audit/README.md) compares external packs against this marketplace.
- [`audit`](../audit/README.md) + `security-audit` perform the audit this plugin prepares.
- [`goal`](../goal/README.md) / `/spec-first-dev` handle the forward direction (spec → code); this plugin handles the reverse (code → knowledge).
