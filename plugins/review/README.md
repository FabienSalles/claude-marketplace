# review

Code review on any version control system and any language. Findings come from the diff only,
are rated from their real consequence, and are written as
[Conventional Comments](https://conventionalcomments.org/) whose decoration (`blocking`,
`non-blocking`) tells the author at a glance what blocks the merge.

## Install

```text
/plugin install review@fabien-claude-marketplace
```

## Skills (1)

| Skill | Purpose |
|---|---|
| [`conventional-review`](skills/conventional-review/SKILL.md) | Pick a level (`low` to `xhigh`, passed on to `/code-review`) and a scope (`own` applies your convention skills, `external` only the project's rules); get the change from git, Mercurial, Subversion, `gh`, `glab` or a pasted diff; check the acceptance criteria and flag scope creep; walk eleven axes (quality, duplication, design and architecture, over-engineering, conventions, errors, performance and load, security, observability, tests, hygiene); filter to the high-impact findings; decorate each as `blocking` or `non-blocking`; report a sorted table, strengths and what was not verified; on request, write each point as a conventional comment (`issue (blocking, errors): ...`) in raw Markdown; to publish, list every comment first, then create the approved ones as a pending review the user checks in the forge before it goes out. Never approves or pushes. |

## How it layers

| Agent has | The review adds |
|---|---|
| Claude Code `/code-review` | a correctness pass on the same target, filtered by the same rules |
| `craft:*` and language packs (`php`, `typescript`…) | their conventions as review criteria |
| subagents, on a thorough review | an adversarial reviewer and a separate filter, so the filter is not anchored on the first reading |
| none of these (Codex, Copilot) | nothing: the own pass on [`references/axes.md`](skills/conventional-review/references/axes.md) is the complete review |
