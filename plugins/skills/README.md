# skills

Certifies any skill directory against the Agent Skills spec, hard platform limits, and
non-blocking authoring advisories, and ships the authoring conventions those checks enforce.

## Install

```text
/plugin install skills@fabien-claude-marketplace
```

## Skills (4)

| Skill | Purpose |
|---|---|
| [`skill-authoring`](skills/skill-authoring/SKILL.md) | `SKILL.md` frontmatter schema, description as routing mechanism, platform limits sourced across agentskills.io/VS Code Copilot/Codex, progressive disclosure, directory structure |
| [`agent-authoring`](skills/agent-authoring/SKILL.md) | Claude Code subagent frontmatter (`tools`/`model`/`skills`), VS Code Copilot custom agent format, cross-platform differences |
| [`plugin-conventions`](skills/plugin-conventions/SKILL.md) | Plugin directory structure, `plugin.json`/`marketplace.json`/`hooks.json` schemas, the hook output contract (stdin fields, exit codes, which channel reaches Claude per event), quoted `${CLAUDE_PLUGIN_ROOT}` portability, `evals/evals.json` format |
| [`version-bump`](skills/version-bump/SKILL.md) | Which version does each changed plugin get, and where is it written — classified from the conventional commits since its last bump, written into `plugin.json` and `marketplace.json` in the same PR |

## Certification

```text
/skills:certify <skill-dir | plugin-dir | agent-md-path> [--require-evals]
/skills:certify --all | --install-all [--cli <npm spec>] | --upstream
```

```bash
# Certify one skill
node plugins/skills/scripts/certify.ts <skill-dir>

# Certify every skill under a plugin, requiring each one to ship evals/evals.json
node plugins/skills/scripts/certify.ts <plugin-dir> --require-evals

# Certify every skill under a plugin
node plugins/skills/scripts/certify.ts <plugin-dir>

# Certify a single agent
node plugins/skills/scripts/certify.ts <plugin>/agents/<agent>.md

# Certify the whole tree: every skill, agent and evals.json (no network, no uv)
node plugins/skills/scripts/certify.ts --all

# Install every skill in one sandbox with the pinned skills CLI, or another npm spec (needs npx and the npm registry)
node plugins/skills/scripts/certify.ts --install-all [--cli <npm spec>]

# Validate every skill with the upstream skills-ref validator (needs uv and github.com)
node plugins/skills/scripts/certify.ts --upstream

# Repo-wide stock report (coherence: README counters, see-also pointers)
node plugins/skills/scripts/certify.ts --stock

# Certify only what changed since a base ref
node plugins/skills/scripts/certify.ts --diff <base-ref>

# Verify a skill installs cleanly (files present, skills-lock.json entry)
node plugins/skills/scripts/certify.ts --install <skill-dir>
```

`--all`, `--install-all` and `--upstream` run from the repository root and certify every skill
listed under `plugins/`. Each prints its findings first (`[FAIL]` for a blocking one, `[WARN]` for
an advisory one), then one summary line:

| Flag | Summary line | Exit 1 when |
|---|---|---|
| `--all` | `Certified <N> skill(s), <A> agent(s), <E> evals file(s): <F> blocking failure(s), <W> advisory finding(s)` | a blocking failure (skill or agent level 2 or 3, an `evals.json` shape), or no skill found |
| `--install-all` | `Sandboxed install of <N> skill(s) with <spec>: <F> failure(s)` | a skill's files or its `skills-lock.json` entry are missing, `npx` itself fails (`[FAIL] . install-run: …`), or no skill is found. Exit 2 when `--cli` has no value |
| `--upstream` | `Upstream skills-ref validation of <N> skill(s): <F> failure(s), <D> declared divergence(s)` | an upstream error outside the fields declared in `CLAUDE_CODE_FIELDS` (`src/rules/level2.ts`), `uvx` missing, the validator unreachable, or no skill found |

The pinned skills CLI is `PINNED_SKILLS_CLI` in `src/install.ts`; a canary passes
`--cli skills@latest` to catch upstream drift. `--upstream` fetches the validator once per skill,
so it belongs in a scheduled run, not on every change.
