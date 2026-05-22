# security-runtime

Runtime security hooks for Claude Code: defends against CLAUDE.md injection and Bash prompt-injection attempts that the model could otherwise be tricked into executing.

Complements `audit` (codebase audit overlay) and `netresearch/security-audit-skill` (on-demand audit). Where those scan code on demand, this plugin runs *every session* and *every Bash call*.

## Hooks

| Hook | Event | What it does |
|---|---|---|
| `claudemd-scanner.sh` | `SessionStart` | Scans `~/.claude/CLAUDE.md`, `./CLAUDE.md`, `./.claude/CLAUDE.md` for prompt-injection patterns (role overrides, system tags, exfiltration hints, zero-width chars). Warns on stderr. Non-blocking. |
| `prompt-injection-detector.sh` | `PreToolUse` (Bash) | Inspects the Bash command string for AI-instruction overrides (`ignore previous instructions`, `<\|im_start\|>system`, `[INST]`, etc.) and null bytes. **Blocks** (exit 2) on match. |

## Why both layers

- **`claudemd-scanner`** catches injection in *config files* loaded into the system prompt. Claude Code does not natively sanitize CLAUDE.md.
- **`prompt-injection-detector`** catches injection in *commands* the model is asked to run. Claude Code's native command blocklist is static (blocks `curl`, `wget` by default) — it does not scan for dynamic injection payloads.

Output secrets scanning is **not** included here. The model already flags secrets it encounters; a global `CLAUDE.md` rule reinforces this without the overhead of a per-call subprocess. See `~/.claude/CLAUDE.md` § *Secrets awareness*.

## Tests

```bash
bash tests/test_prompt-injection-detector.sh
bash tests/test_claudemd-scanner.sh
```

Both scripts also pass `bash -n` syntax check.

## Dependencies

- `bash` (POSIX features only)
- `jq` (for parsing the stdin JSON payload from Claude Code)

## Layout

```
security-runtime/
├── .claude-plugin/plugin.json
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       ├── claudemd-scanner.sh
│       └── prompt-injection-detector.sh
└── tests/
    ├── test_claudemd-scanner.sh
    └── test_prompt-injection-detector.sh
```
