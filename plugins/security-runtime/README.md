# security-runtime

Runtime security hooks for Claude Code: defends against CLAUDE.md injection and Bash prompt-injection attempts that the model could otherwise be tricked into executing.

Complements `audit` (codebase audit overlay) and `netresearch/security-audit-skill` (on-demand audit). Where those scan code on demand, this plugin runs *every session* and *every Bash call*.

## Hooks

| Hook | Event | What it does |
|---|---|---|
| `claudemd-scanner.sh` | `SessionStart` | Scans `~/.claude/CLAUDE.md`, `./CLAUDE.md`, `./.claude/CLAUDE.md` for prompt-injection patterns (role overrides, system tags, exfiltration hints, zero-width chars). Warns on stderr. Non-blocking. |
| `prompt-injection-detector.sh` | `PreToolUse` (Bash) | Inspects the Bash command string for AI-instruction overrides (`ignore previous instructions`, `<\|im_start\|>system`, `[INST]`, etc.) and null bytes. **Blocks** (exit 2) on match. |
| `secret-file-guard.sh` | `PreToolUse` (Read, Grep, Bash) | Refuses to open credential files — `.env.local`, `.env.*.local`, `auth.json`, `credentials.json`, `*.pem`, `id_rsa`, `id_ed25519`, `.npmrc`, `.pgpass`, `.netrc`, anything under `.ssh/`. **Blocks** (exit 2) on match. |

## Why these layers

- **`claudemd-scanner`** catches injection in *config files* loaded into the system prompt. Claude Code does not natively sanitize CLAUDE.md.
- **`prompt-injection-detector`** catches injection in *commands* the model is asked to run. Claude Code's native command blocklist is static (blocks `curl`, `wget` by default) — it does not scan for dynamic injection payloads.
- **`secret-file-guard`** stops a credential from entering the transcript in the first place.

### On `secret-file-guard`, and why it exists

This README previously argued that secret scanning was unnecessary, on the grounds that *the model already flags secrets it encounters* via the `~/.claude/CLAUDE.md` § *Secrets awareness* rule. That reasoning was wrong, and it failed in practice: a session looking for `APP_ENV` opened `.env.local` — where it was not defined — and printed a Keycloak client secret into the transcript before flagging it.

The `CLAUDE.md` rule governs what the model does *after* reading. By then the credential is already in the context window, the transcript on disk, and any uploaded session. Flagging is remediation, not prevention. The only useful guarantee is at the tool boundary, which is what this hook enforces.

The matching is deliberately coarse: any *mention* of a credential path is refused, not just a read. A shell command line cannot be parsed with a regex, so narrowing to `cat`/`head`/`sed` would leak through every construct not enumerated. A false positive costs one rephrased command (`grep APP_ENV .env` still works); a miss costs a credential.

## Optional second layer — `permissions.deny`

```text
/security-runtime:setup
```

Hooks alone are enough to block. `/setup` additionally writes `Read(...)` deny rules into `~/.claude/settings.json` — enforced by the harness before hooks run (so they survive `disableAllHooks`), and merged into `sandbox.filesystem.denyRead` if the sandbox is ever enabled. Idempotent, backs the file up first.

## Tests

```bash
bash tests/test_prompt-injection-detector.sh
bash tests/test_claudemd-scanner.sh
bash tests/test_secret-file-guard.sh
```

Both scripts also pass `bash -n` syntax check.

## Dependencies

- `bash` (POSIX features only)
- `jq` (for parsing the stdin JSON payload from Claude Code)

## Layout

```
security-runtime/
├── .claude-plugin/plugin.json
├── commands/
│   └── setup.md
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       ├── claudemd-scanner.sh
│       ├── prompt-injection-detector.sh
│       └── secret-file-guard.sh
└── tests/
    ├── test_claudemd-scanner.sh
    ├── test_prompt-injection-detector.sh
    └── test_secret-file-guard.sh
```
