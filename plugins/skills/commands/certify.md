---
description: Certify a skill, plugin, or agent against the Agent Skills spec, hard platform limits, and authoring advisories.
argument-hint: <skill-dir | plugin-dir | agent-md-path> [--require-evals] | --all | --install-all [--cli <npm spec>] | --upstream
---

Certify `$1` (default to `plugins/skills` if no argument is given) by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/certify.ts" $ARGUMENTS
```

Report the verdict output verbatim to the user. If the target is a plugin directory and
`--require-evals` was passed, a skill missing `evals/evals.json` (or with an empty `routing`
array) fails certification alongside the level 2/3 findings.

The whole-tree flags take no path: they certify every skill under `plugins/` of the current
directory, so run them from a marketplace root. Report their last line (the summary) together
with the `[FAIL]` lines printed above it.

- `--all`: every skill, agent and `evals.json`, offline. Exit 1 on any blocking failure.
- `--install-all [--cli <npm spec>]`: one sandboxed install of every skill with the pinned skills
  CLI, or the given npm spec. Needs `npx` and the npm registry.
- `--upstream`: every skill through the upstream `skills-ref` validator, the Claude Code-only
  fields counted as declared divergences. Needs `uvx` and access to github.com; it fetches the
  validator once per skill, so it is slow.

A missing requirement exits 1 with its own message (`uvx not found …`, `--upstream needs network
access`): report it as an environment gap, not as a skill failure.

Do not modify any file. This command only certifies; use the skills themselves
(`skill-authoring`, `agent-authoring`, `plugin-conventions`) to fix what it reports.
