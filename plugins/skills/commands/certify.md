---
description: Certify a skill, plugin, or agent against the Agent Skills spec, hard platform limits, and authoring advisories.
argument-hint: <skill-dir | plugin-dir | agent-md-path> [--require-evals]
---

Certify `$1` (default to `plugins/skills` if no argument is given) by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/certify.ts" $ARGUMENTS
```

Report the verdict output verbatim to the user. If the target is a plugin directory and
`--require-evals` was passed, a skill missing `evals/evals.json` (or with an empty `routing`
array) fails certification alongside the level 2/3 findings.

Do not modify any file. This command only certifies; use the skills themselves
(`skill-authoring`, `agent-authoring`, `plugin-conventions`) to fix what it reports.
