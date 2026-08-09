# statusline

Claude Code statusline: directory, git branch, model, context progress bar, and 5h rate-limit usage with time-to-reset.

![Statusline preview](../../docs/statusline-preview.png)

Plain-text fallback (no terminal colors):

```
~/projects/github/claude-marketplace |  main | Opus 4.7 (1M context) | ctx:[██░░░░░░░░] 29% | 5h:5% · 4h14
```

## Install

Claude Code does not accept the `statusLine` key in `plugin.json`, so `/plugin install statusline` alone cannot activate the bar. `/statusline:setup` finishes the wiring:

```text
/plugin marketplace add FabienSalles/claude-marketplace
/plugin install statusline@fabien-claude-marketplace
/statusline:setup
```

`/statusline:setup` creates the symlink `~/.claude/statusline-command.sh → ${CLAUDE_PLUGIN_ROOT}/statusline.sh` and writes `statusLine.command = "~/.claude/statusline-command.sh"` to `~/.claude/settings.json`, backing up the previous `settings.json` before editing it. The symlink shields settings from the plugin cache path, which rotates on every plugin update. **Re-run `/statusline:setup` after upgrading the plugin** so the symlink target follows.

## What the bar shows

Segments are joined by ` | `:

| Segment | Color | Content |
|---|---|---|
| `~/path` | blue | current directory (HOME replaced with `~`) |
|  `branch` | yellow | git branch (falls back to worktree name) |
| `Model name` | cyan | active Claude model |
| `ctx:[████░░░░░░] 42%` | green / yellow / red | context window usage (green <50 %, yellow ≥50 %, red ≥80 %) |
| `5h:67% · 1h42` | magenta | 5h rate-limit usage and time until reset (the `· HhMM` only appears when `rate_limits.five_hour.resets_at` is provided by Claude Code) |

The 5h block is only emitted by Claude.ai Pro/Max subscribers and only after the first API response of the session.

## Tips

- Add `"refreshInterval": 60` next to `statusLine` in `~/.claude/settings.json` so the bar (and the countdown) refreshes every minute even when no event fires.
- Requires `jq` (already installed on most Macs via Homebrew).

## Files

- [`statusline.sh`](statusline.sh): the script (single jq pass, ~80 lines)
- [`commands/setup.md`](commands/setup.md): the `/statusline:setup` slash command
- [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json): manifest
