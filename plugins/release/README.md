# release

**Automatic semver discipline for this marketplace**: every PR that changes a
plugin's shipped content carries that plugin's version bump, in the same branch.

Claude Code caches installed plugins by version. A skill improved without a bump
is a skill nobody receives: users keep the cached copy until the number moves.
This plugin makes the bump part of shipping, not a follow-up.

## Skills (1)

| Skill | Answers | Read it when |
|---|---|---|
| [`version-bump`](skills/version-bump/SKILL.md) | *Which version does each changed plugin get, and where is it written?* | before every `gh pr create`, and before any commit touching `plugins/` |

## How the level is chosen

Per plugin, from the conventional commits since its last bump:

- **major**: a skill / command / agent renamed or removed, an incompatible hook
  change, or a `!` / `BREAKING CHANGE` commit scoped to the plugin
- **minor**: a new skill / command / agent / hook, or a `feat` extending one
- **patch**: `fix`, `docs`, `refactor`, `chore`, prose-only edits

A cross-cutting `!` sweep is major only for the plugins where its diff renames or
removes something invoked by name; prose edits elsewhere stay a patch.

The version is written in **two files that must agree**:
`plugins/<name>/.claude-plugin/plugin.json` and the plugin's entry in
`.claude-plugin/marketplace.json`.
