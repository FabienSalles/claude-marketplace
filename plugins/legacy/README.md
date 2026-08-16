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
| [`discovery`](skills/discovery/SKILL.md) | 7-phase workflow: frame (onboarding or audit-prep, committable artifacts or gitignored), recon + git archaeology, cartography + glossary, use cases aggregated by actor goal, entity model (migrations as truth), risk register (churn × complexity × no tests, deterministic pass before the first row), shared-brain index with routing table. A tool answers before the model does; where no tool answers, the session writes an analyzer whose rows a human samples. Audit-prep adds a security-surface dossier (input vectors, authorization matrix, secrets, dependency CVEs, reachability and triage) and bridges to `security-audit:security-audit` + `audit:security-overrides`. |

## Artifacts produced

In `docs/legacy/` (committable) or `.claude/legacy/` (gitignored, typical on client
missions): `README.md` (routing table), `recon.md`, `architecture.md`, `glossary.md`,
`use-cases/UC-XXX-*.md`, `entity-model.md`, `risk-register.md`, `open-questions.md`,
plus `security-surface.md` in audit-prep mode.

## Reference manuals

Loaded on demand by the skill, one per question a phase paragraph cannot answer.
Tool claims carry their URL, the date they were checked
(2026-08-16, `gh api repos/OWNER/REPO --jq '.pushed_at, .archived'`), and the
labels `vendor-published` or `unverified` where they apply.

| File | What it answers |
|---|---|
| [`deterministic-tools.md`](skills/discovery/references/deterministic-tools.md) | What to run on a PHP/Symfony takeover and in what order, tiered by what has to work on the machine (git only, single downloaded binaries, dev dependencies, heavy tier); what each number means; behavioral analysis without a licence; baselines; repository identity traps; the tools that are dead, frozen, paywalled or never supported PHP. |
| [`write-the-analyzer.md`](skills/discovery/references/write-the-analyzer.md) | What to produce when no tool answers: the three checks that gate the pattern, a PHPStan Collector skeleton, the output contract (declared schema, `path:line`, provenance sidecar), the fixture rule, the seeded sampling protocol, and why one step never both authors and applies. |
| [`recon-commands.md`](skills/discovery/references/recon-commands.md) | BSD/macOS-safe command blocks for Phase 1: stack, size, entry points, dependency health, git archaeology, complexity and coverage proxies. |
| [`artifact-templates.md`](skills/discovery/references/artifact-templates.md) | Skeletons for every artifact, including the shared-brain README routing table. |
| [`safety-net.md`](skills/discovery/references/safety-net.md) | How "characterization test" and "safe first changes" are actually executed: inventory, frozen inputs, snapshots, scrubbers and their silent failure modes, record-replay and differential testing, mutation as the gate on the net, and what model-generated tests do not prove. |
| [`audit-prep.md`](skills/discovery/references/audit-prep.md) | The audit-prep pass: input surface, authorization matrix, secrets and PII, dependency vulnerabilities, configuration posture, handover to the audit skills. |
| [`reachability-and-triage.md`](skills/discovery/references/reachability-and-triage.md) | The free deterministic floor, the two different claims both sold as "reachable" and what each proves, which tools support PHP at all, the tool/model/human division of labour on a finding list, priority computed with CISA Vulnrichment + SSVC, VEX, and the design-fault bucket. |
| [`knowledge-artifacts.md`](skills/discovery/references/knowledge-artifacts.md) | Which artifacts rot and which cannot: generated / drift-checkable / written per artifact, the drift tools (tbls, oasdiff, Atlas) and the generic gate when none exists, architecture and ADRs as checkable artifacts, and the two gate commands to run on the knowledge base itself. |

## Related

- [`self-audit`](../self-audit/README.md) compares external packs against this marketplace.
- [`audit`](../audit/README.md) + `security-audit` perform the audit this plugin prepares.
- [`goal`](../goal/README.md) / `/spec-first-dev` handle the forward direction (spec → code); this plugin handles the reverse (code → knowledge).
