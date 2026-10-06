# Local install on a Mac

Reproduces the full personal setup from a **local clone**, without going through
`FabienSalles/claude-marketplace` on GitHub — the clone *is* the marketplace, so the repo stays
maintainable in place.

Verified on `claude` 2.1.252, macOS (darwin 25.6), Node 26.7.0.

---

## 0. Prerequisites

| Tool | Needed by | Check |
|---|---|---|
| `claude` CLI | everything | `claude --version` |
| `node` 24.x (the repository's `.nvmrc`) | `goal` runner + gate, `scripts/`, `npm run verify` | `node -v` |
| `jq` | `/statusline:setup`, `/security-runtime:setup`, the `security-runtime` hooks, `npm run verify` (shell suites) | `jq --version` |
| `python3` | 2 of the `common` PreToolUse hooks (`remind-skills.py`, `warn-clock-bypass.py`) | `python3 -V` |
| `git` | marketplace resolution + the `git` plugin hook | `git --version` |
| `gh` **authenticated** | `goal` in `commit+pr` mode, GitHub-sourced plugins | `gh auth status` |
| `gitleaks` **or** `betterleaks` | any `goal` push (refused, not skipped, when absent) | `command -v gitleaks betterleaks` |

Install what is missing:

```bash
brew install jq gh gitleaks
gh auth login          # pick SSH + upload a key, or HTTPS
```

---

## 1. Clone

```bash
mkdir -p ~/project/github && cd ~/project/github
git clone git@github.com:FabienSalles/claude-marketplace.git
cd claude-marketplace
```

## 2. Register the clone as a marketplace

Use an **absolute path** or a `./`-prefixed one. A bare `.` is rejected
(`Invalid marketplace source format`).

```bash
claude plugin marketplace add ~/project/github/claude-marketplace
claude plugin marketplace list
```

Expected: `fabien-claude-marketplace — Source: Directory (/Users/…/claude-marketplace)`.

## 3. Install the local plugins

```bash
cd ~/project/github/claude-marketplace
for p in $(jq -r '.plugins[] | select(.source|type=="string") | .name' .claude-plugin/marketplace.json); do
  claude plugin install "${p}@fabien-claude-marketplace" --yes
done
```

`--yes` is what makes this usable outside an interactive TTY.

### 3b. `security-audit` (external, GitHub source)

Declared inside `marketplace.json` but hosted at `netresearch/security-audit-skill`.
`claude plugin install` clones plugin sources over **SSH** (`git@github.com:`) even though
`marketplace add` uses HTTPS — so this one needs a GitHub SSH key on the machine. `gh auth login`
in HTTPS mode is *not* enough: it sets up a token for git operations, not an SSH key.

Without an SSH key, rewrite that one repo to HTTPS — scoped to the repo, so your own clones and
pushes keep using SSH:

```bash
git config --global \
  url."https://github.com/netresearch/security-audit-skill".insteadOf \
      "git@github.com:netresearch/security-audit-skill"

claude plugin install security-audit@fabien-claude-marketplace --yes
```

Undo with `git config --global --unset url."https://github.com/netresearch/security-audit-skill".insteadOf`.
A future GitHub-sourced plugin needs its own line (or an actual SSH key, `gh ssh-key add`).

Note: `marketplace.json` pins this entry at `"version": "1.0.0"`, but what installs is upstream's
real version (2.11.1 today) — for a `github` source the declared version is informational.

## 4. External marketplaces (`EXTERNAL_PLUGINS.md`)

```bash
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin marketplace add atournayre/claude-marketplace   # registers as atournayre-claude-plugin-marketplace

for p in feature-dev figma frontend-design hookify php-lsp plugin-dev \
         security-guidance skill-creator typescript-lsp; do
  claude plugin install "${p}@claude-plugins-official" --yes
done

for p in doc qa symfony; do
  claude plugin install "${p}@atournayre-claude-plugin-marketplace" --yes
done
```

`github@claude-plugins-official` is deliberately skipped — see `EXTERNAL_PLUGINS.md`.

---

## 5. Global `~/.claude/` wiring

Three post-install steps. All three write to `~/.claude/`; the two that touch `settings.json`
back it up first as `settings.json.bak.<epoch>`.

### 5a. Global `CLAUDE.md`

```text
/common:install-global-claude-md
```

Non-interactive equivalent (only when `~/.claude/CLAUDE.md` does **not** exist — otherwise the
slash command shows you a diff first and asks):

```bash
cp ~/.claude/plugins/cache/fabien-claude-marketplace/common/1.1.0/templates/global-claude-md.template \
   ~/.claude/CLAUDE.md
chezmoi add ~/.claude/CLAUDE.md   # optional, for portability across Macs
```

### 5b. Credential-file deny rules

```text
/security-runtime:setup
```

Adds 11 `Read(...)` deny rules to `permissions.deny`, unioned with whatever is already there
(idempotent). This is a second layer: the plugin's hooks block those files regardless.

### 5c. Statusline

Vanilla wiring:

```text
/statusline:setup
```

> ⚠️ It **overwrites** any existing `statusLine` key without asking.

**Coexisting with the Orca statusline.** Orca (`~/.orca/agent-hooks/claude-statusline.sh`)
installs its own `statusLine`, but it renders nothing: it reads the JSON payload, throttles to
one call per 15 s, and POSTs it to a local Orca daemon on `127.0.0.1`. All of its output goes to
`/dev/null`. Since only one command can own the key, and stdin can only be read once, a wrapper
buffers the payload and feeds it to both:

```bash
cat > "$HOME/.claude/statusline-combined.sh" <<'EOF'
#!/usr/bin/env bash
# Buffer the payload once, then feed it to both consumers:
#   - Orca: telemetry only, prints nothing. Detached, so its curl (max-time 1.5s)
#     can never delay the bar and its failure can never break it.
#   - the statusline plugin: renders the visible bar on stdout.
payload=$(cat)

orca="$HOME/.orca/agent-hooks/claude-statusline.sh"
if [ -r "$orca" ]; then
  (printf '%s' "$payload" | /bin/sh "$orca" >/dev/null 2>&1 &)
fi

printf '%s' "$payload" | "$HOME/.claude/statusline-command.sh"
EOF
chmod +x "$HOME/.claude/statusline-combined.sh"

# Stable symlink (shields settings.json from the versioned plugin-cache path)
ln -sf ~/.claude/plugins/cache/fabien-claude-marketplace/statusline/1.1.0/statusline.sh \
       ~/.claude/statusline-command.sh

# Point settings.json at the wrapper
cp ~/.claude/settings.json ~/.claude/settings.json.bak.$(date +%s)
jq '.statusLine = {"type":"command","command":"~/.claude/statusline-combined.sh"}' \
  ~/.claude/settings.json > ~/.claude/settings.json.tmp \
  && mv ~/.claude/settings.json.tmp ~/.claude/settings.json
```

Optional: add `"refreshInterval": 60` inside `statusLine` so the 5 h counter ticks every minute.

Re-running `/statusline:setup` resets the key to the plain symlink and drops Orca — re-apply the
`jq` line above afterwards.

---

## 6. Verification

### 6a. Install state

```bash
claude plugin list | grep -c '✔ enabled'   # expected: 41 (29 own + 12 external)
jq 'keys' ~/.claude/plugins/known_marketplaces.json   # expected: 3 marketplaces
jq '.permissions.deny | length' ~/.claude/settings.json   # expected: ≥ 11
```

### 6b. The repo itself — everything CI runs, locally

From the repository root, on the Node version `.nvmrc` pins (`nvm use`):

```bash
npm run verify                  # every pull-request check, in parallel
npm run verify -- --sequential  # the same checks one at a time, when other sessions load the Mac
```

`npm run verify -- <group>` runs a single group; [`CONTRIBUTING.md`](../CONTRIBUTING.md#validate-locally)
lists them. Each run starts with `npm ci`, so it needs the npm registry. The report ends with the
verdict, then `not reproduced on this Mac:` lines naming what only CI reproduces.

Render the statusline against a synthetic payload:

```bash
jq -nc --argjson r "$(( $(date +%s) + 7200 ))" \
  '{workspace:{current_dir:"'"$PWD"'"},model:{display_name:"Opus 5"},
    context_window:{used_percentage:37},effort:{level:"high"},
    rate_limits:{five_hour:{used_percentage:12.4,resets_at:$r}}}' \
  | ~/.claude/statusline-combined.sh
```

Then restart Claude Code — plugins, hooks and the statusline are all read at session start.

---

## 7. What installing these packs changes at runtime

`common`, `security-runtime`, `mac` and `git` register **15 hooks** that fire on ordinary tool
calls, not just on demand:

| Plugin | Hooks |
|---|---|
| `common` | 10 — 6 PreToolUse (Write/Edit/Bash reminders + guards), 2 PostToolUse, plus **a system sound on every Notification and every Stop** (`afplay`) |
| `security-runtime` | 3 — CLAUDE.md injection scan at SessionStart, Bash prompt-injection + secret-file guards at PreToolUse |
| `git` | 1 — blocks `git switch -c` / `checkout -b` on stale refs |
| `mac` | 1 — warns on GNU-only flags and bash 4+ syntax |

To silence just the end-of-turn sound without dropping the pack, edit
`plugins/common/hooks/hooks.json` (then re-propagate, §8), or `claude plugin disable common`.

---

## 8. Maintaining the clone: propagating an edit

> The README's dev-mode section claims edits are "picked up live on the next session". On
> `claude` 2.1.252 that is **not** what happens: `claude plugin install` **copies** the plugin
> into `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. That copy is keyed by
> version, so an edit alone changes nothing — `claude plugin update <p>` answers
> *"already at the latest version"*.

Two ways to propagate, both verified:

**a. Version bump** — the real release flow (what the `release` plugin enforces on every PR).
Bump the version in `plugins/<p>/.claude-plugin/plugin.json` **and** in `.claude-plugin/marketplace.json`, then:

```bash
claude plugin marketplace update fabien-claude-marketplace
claude plugin update <p>
```

**b. Reinstall** — for iterating without touching versions:

```bash
claude plugin marketplace update fabien-claude-marketplace
claude plugin uninstall <p> && claude plugin install "<p>@fabien-claude-marketplace" --yes
```

Either way, **restart Claude Code** to load the new copy.

Note that old versions accumulate under
`~/.claude/plugins/cache/fabien-claude-marketplace/<plugin>/`; remove stale ones by hand.

---

## 9. Rollback

```bash
# every entry, including the github-sourced security-audit
for p in $(jq -r '.plugins[].name' .claude-plugin/marketplace.json); do
  claude plugin uninstall "$p"
done
claude plugin marketplace remove fabien-claude-marketplace
git config --global --unset url."https://github.com/netresearch/security-audit-skill".insteadOf

# restore the pre-install settings.json (pick the right timestamp)
ls -t ~/.claude/settings.json.bak.* | head -1
```
