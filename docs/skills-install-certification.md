# Skills CLI install certification

Date: 2026-09-09

Method: every Agent Skill in this marketplace was really installed, one by one, with the `skills` CLI (npm package `skills`, version 1.5.25, installed locally per sandbox) into throwaway sandboxes (isolated `HOME`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_CONFIG_HOME`, fresh `project/` cwd), by one certification agent per plugin. Install source was the local working tree at `/Users/fabiensalles/orca/workspaces/claude-marketplace/copilot-compliante` (CLI output: "Local path validated", "Found 108 skills"). The first skill of each plugin was installed with `--agent claude-code codex github-copilot` to verify multi-agent placement; the remaining skills with `--agent claude-code` only. Every installed copy was checked for file completeness against its source directory, then run through the upstream spec validator (`uvx --from git+https://github.com/agentskills/agentskills#subdirectory=skills-ref skills-ref validate`, resolved at commit `69ef37e9424c0a7ea9dd2293b559e43ec8176379`). Post-install state was confirmed via the filesystem and `skills-lock.json`; the real `$HOME` was verified untouched.

## Tool behavior

What the `skills` CLI 1.5.25 validates and reports at install time (observed across all 108 installs):

- **Source validation**: prints `Source: <path>`, `Local path validated`, and the discovered skill count (`Found 108 skills`). A GitHub slug source (`FabienSalles/claude-marketplace`) also validates (exit 0 on `--list`).
- **Skill-name validation**: unknown `--skill` values exit 1 and print the available skill list.
- **Agent-name validation**: invalid `--agent` values exit 1 with `Invalid agents: X` plus the full roster of ~75 valid tokens. The exact verified tokens are `claude-code`, `codex`, `github-copilot` (a bare `claude` is invalid).
- **Placement reporting**: an Installation Summary box with exact destination paths and per-agent method, an `Installation complete` step, an Installed-skills box, and a closing security notice ("Review skills before use; they run with full agent permissions").
- **Non-interactive detection**: auto-detects an agent context (`claude-code_2-1-229_agent Agent detected — installing non-interactively`) and never blocks on input; `--yes` and `--all` exist as belt and braces.
- **Placement mechanics**: with a multi-agent target set, real files land in the universal `./.agents/skills/<name>/` (read directly by Codex and GitHub Copilot) and `./.claude/skills/<name>` is created as a relative symlink to it. With `--agent claude-code` alone, the CLI copies straight into `./.claude/skills/<name>/` and creates **no** `.agents/skills` entry — note the Installation Summary panel still names `./.agents/skills/<name>` in that mode, which is misleading but harmless. `./skills-lock.json` records each skill with `sourceType: "local"` and a `computedHash`.
- **Verification affordances**: `skills add <src> --list` previews skills without installing; `skills list --json` gives machine-readable post-install state (name, path, scope, agents, source, sourceType).

What it does NOT check: SKILL.md frontmatter schema (it happily installs `version` and `disable-model-invocation` keys the spec rejects, with zero warnings), description length, or any content quality. There is no `check`/`lint`/`doctor` subcommand in 1.5.25 — installing is the only validation it performs. Exit 0 from `skills add` therefore certifies delivery, not spec conformance.

Alternatives, one line each: `skillkit` 1.24.0 works but is management-oriented (skill/agent management, activity log) with no obvious single validate command; `gh skill` (GitHub CLI extension, preview) offers `gh skill publish --dry-run`, explicitly documented as "Validate skills for publishing" — the strongest validation story of the three.

## Certification matrix

29 plugins examined. 26 ship skills (108 total); `security-runtime`, `self-audit`, and `statusline` ship no `skills/` directory at all (hooks/commands/scripts only) and are out of the `skills` CLI's scope.

Aggregate: **108/108 installed ok** (exit 0), **0 CLI warnings**, **0 install failures**, **108/108 file sets complete** (source vs installed file-count and content match). Spec validation on the installed copies: **5 PASS**, **98 FAIL-version-field-only** (sole error is the `version` frontmatter key), **5 FAIL-other**.

| Plugin | Skills | Installed ok | CLI warnings | Install failures | Spec: PASS / version-only / other |
|---|---|---|---|---|---|
| astro | 11 | 11 | 0 | 0 | 0 / 11 / 0 |
| audit | 2 | 2 | 0 | 0 | 0 / 2 / 0 |
| career | 3 | 3 | 0 | 0 | 0 / 3 / 0 |
| common | 5 | 5 | 0 | 0 | 0 / 5 / 0 |
| craft | 7 | 7 | 0 | 0 | 0 / 7 / 0 |
| frontend | 3 | 3 | 0 | 0 | 0 / 2 / 1 |
| git | 1 | 1 | 0 | 0 | 0 / 0 / 1 |
| goal | 6 | 6 | 0 | 0 | 5 / 0 / 1 |
| jquery | 1 | 1 | 0 | 0 | 0 / 1 / 0 |
| legacy | 1 | 1 | 0 | 0 | 0 / 1 / 0 |
| mac | 1 | 1 | 0 | 0 | 0 / 1 / 0 |
| marketing-analytics | 3 | 3 | 0 | 0 | 0 / 3 / 0 |
| marketing-content | 10 | 10 | 0 | 0 | 0 / 10 / 0 |
| marketing-distribution | 4 | 4 | 0 | 0 | 0 / 4 / 0 |
| marketing-strategy | 6 | 6 | 0 | 0 | 0 / 6 / 0 |
| nest | 2 | 2 | 0 | 0 | 0 / 2 / 0 |
| php | 10 | 10 | 0 | 0 | 0 / 10 / 0 |
| phpunit | 2 | 2 | 0 | 0 | 0 / 2 / 0 |
| pocock | 3 | 3 | 0 | 0 | 0 / 2 / 1 |
| product | 2 | 2 | 0 | 0 | 0 / 2 / 0 |
| release | 1 | 1 | 0 | 0 | 0 / 1 / 0 |
| security-runtime | 0 | — | — | — | no skills/ directory |
| self-audit | 0 | — | — | — | no skills/ directory |
| statusline | 0 | — | — | — | no skills/ directory |
| superpowers | 2 | 2 | 0 | 0 | 0 / 2 / 0 |
| symfony | 5 | 5 | 0 | 0 | 0 / 4 / 1 |
| tooling | 6 | 6 | 0 | 0 | 0 / 6 / 0 |
| typescript | 9 | 9 | 0 | 0 | 0 / 9 / 0 |
| vitest | 2 | 2 | 0 | 0 | 0 / 2 / 0 |

The 5 PASS results are all in `goal`: `grill-adversarial`, `next`, `plan`, `spec`, `tickets` — the only skills in the marketplace with no `version` frontmatter key.

### The shared FAIL-version-field-only error (98 skills)

Every one of the 98 version-only failures is the identical single validator error, differing only in path:

```
Validation failed for <installed-skill-dir>:
  - Unexpected fields in frontmatter: version. Only ['allowed-tools', 'compatibility', 'description', 'license', 'metadata', 'name'] are allowed.
```

This is a mismatch between this marketplace's own SKILL.md convention (a `version:` key on every skill) and the upstream `agentskills` spec — not an install defect. Not listed per skill: all 98 rows are otherwise green.

### FAIL-other details (5 skills, verbatim)

**frontend:frontend-best-practices** — `plugins/frontend/skills/frontend-best-practices/SKILL.md`

```
Validation failed for .../project/.claude/skills/frontend-best-practices:
  - Unexpected fields in frontmatter: version. Only ['allowed-tools', 'compatibility', 'description', 'license', 'metadata', 'name'] are allowed.
  - Description exceeds 1024 character limit (1057 chars)
```

**git:git** — `plugins/git/skills/git/SKILL.md`

```
Validation failed for <path>:
  - Unexpected fields in frontmatter: version. Only ['allowed-tools', 'compatibility', 'description', 'license', 'metadata', 'name'] are allowed.
  - Description exceeds 1024 character limit (1243 chars)
```

**goal:supervise** — `plugins/goal/skills/supervise/SKILL.md` (no `version` key; the offending field stands alone)

```
Validation failed for .claude/skills/supervise:
  - Unexpected fields in frontmatter: disable-model-invocation. Only ['allowed-tools', 'compatibility', 'description', 'license', 'metadata', 'name'] are allowed.
```

**pocock:zoom-out** — `plugins/pocock/skills/zoom-out/SKILL.md`

```
Validation failed for .claude/skills/zoom-out:
  - Unexpected fields in frontmatter: disable-model-invocation, version. Only ['allowed-tools', 'compatibility', 'description', 'license', 'metadata', 'name'] are allowed.
```

**symfony:symfony-frontend** — `plugins/symfony/skills/symfony-frontend/SKILL.md`

```
Validation failed for .../project/.claude/skills/symfony-frontend:
  - Unexpected fields in frontmatter: version. Only ['allowed-tools', 'compatibility', 'description', 'license', 'metadata', 'name'] are allowed.
  - Description exceeds 1024 character limit (1116 chars)
```

## Certification criteria

Derived from observed behavior, a skill in this marketplace is **certified installable** with the `skills` CLI when it meets all of the following. The list distinguishes what each layer actually enforces.

Enforced by the installer (`skills add` fails or misbehaves otherwise):

1. The skill lives at `plugins/<plugin>/skills/<name>/` with a `SKILL.md` — this is what source discovery counts ("Found 108 skills") and what `--skill <name>` resolves; an unknown name exits 1.
2. The `--agent` tokens are valid roster entries (`claude-code`, `codex`, `github-copilot` verified here); an invalid token exits 1.
3. All files in the skill directory (`SKILL.md`, `references/`, `scripts/`, and even non-spec extras like `.skillkit.json` in the marketing plugins) travel with the install — the CLI copies the whole directory, verified complete for all 108 skills.

That is the installer's entire contract. It does **not** enforce anything about frontmatter or content: exit 0 was achieved by all 108 skills, including the 103 that fail spec validation.

Enforced only by the spec validator (`skills-ref validate`) — required for a **spec-clean** certification:

4. Frontmatter keys restricted to `allowed-tools`, `compatibility`, `description`, `license`, `metadata`, `name`. The marketplace-wide `version:` key violates this on 103 of 108 skills; `disable-model-invocation:` violates it on `goal:supervise` and `pocock:zoom-out`.
5. `description` at most 1024 characters — violated by `frontend-best-practices` (1057), `symfony-frontend` (1116), and `git` (1243).

Enforced only by the target agents at load/run time (out of scope for both tools above): frontmatter semantics, description-as-routing quality, body size, and per-agent compatibility constraints. See `docs/copilot-codex-compatibility-audit.md` for the Copilot/Codex-side constraints and `docs/skill-creator-review.md` for the authoring-quality review; this report does not duplicate them.

## Caveats

- **Certification ran against the local working tree**, branch `copilot-compliante` at `/Users/fabiensalles/orca/workspaces/claude-marketplace/copilot-compliante` — not against the GitHub repo. The GitHub slug (`FabienSalles/claude-marketplace`) was only smoke-tested as a source (`--list`, exit 0), never used for a full install. Consequences: (a) these results certify the tree as it stood on 2026-09-09, so any future repair (dropping `version:`, trimming the three long descriptions, removing `disable-model-invocation`) invalidates the matrix and requires a re-run — which is cheap, since the same sandboxed local-path procedure re-certifies uncommitted fixes before they are pushed; (b) what installs from GitHub is whatever is merged and pushed, which this run does not attest.
- The spec validator was resolved from `agentskills/agentskills` HEAD (`69ef37e9`), not a pinned release — the allowed-fields list and limits can drift; re-certification should record the resolved commit again.
- Multi-agent placement (universal `.agents/skills/` + Claude Code symlink) was verified on one skill per plugin; the remaining skills were installed claude-code-only, which takes the direct-copy path. Both paths delivered complete file sets everywhere they were exercised.
- Three plugins (`security-runtime`, `self-audit`, `statusline`) ship hooks/commands but no Agent Skills; they are simply outside the `skills` CLI's install mechanism, not failures.
