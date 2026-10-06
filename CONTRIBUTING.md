# Contributing

This marketplace is a set of independent plugins. Contributing means **adding or editing a plugin**, then keeping the manifest, README, and CI green. This guide covers the mechanics.

## Anatomy of a plugin

Every plugin lives under `plugins/<name>/` and is self-contained:

```
plugins/<name>/
├── .claude-plugin/plugin.json   # required — manifest
├── README.md                    # required — see template below
├── skills/<skill>/SKILL.md      # 0..n skills (with optional references/)
├── commands/<command>.md        # 0..n slash commands
└── hooks/hooks.json + *.sh       # 0..n hooks
```

- Reference bundled files with `${CLAUDE_PLUGIN_ROOT}/...`, never absolute or `~` paths. This is what makes a plugin portable and what the `structure` checks verify. In a `hooks.json` command, wrap the path in double quotes (`"${CLAUDE_PLUGIN_ROOT}/hooks/x.sh"`): `claude plugin validate --strict` refuses an unquoted placeholder.
- A plugin can ship any mix of skills / commands / hooks / agents. Single-purpose is fine (`jquery` ships one skill; `self-audit` ships one command).

## `plugin.json`

```json
{
  "name": "<name>",
  "version": "1.0.0",
  "description": "<one line — what it does, framework/scope>",
  "author": { "name": "FabienSalles" },
  "license": "MIT",
  "keywords": ["..."]
}
```

Declare component directories explicitly only when auto-discovery doesn't apply (e.g. `"commands": "./commands/"` in a command-only plugin).

## Register it in the marketplace

Add one entry to `.claude-plugin/marketplace.json` → `plugins[]`:

| Field | Notes |
|---|---|
| `name` | Matches the directory name. |
| `source` | `./plugins/<name>` for local, or a `{ "source": "github", "repo": "owner/name" }` object for a re-export (see `security-audit`). |
| `description` | One line, reused verbatim as the plugin's tagline. |
| `version`, `author`, `license` | Mirror `plugin.json`. |
| `category` | One of `development` · `testing` · `productivity` · `platform` · `security` · `marketing`. |
| `keywords` | For discovery. |

Dev mode needs no extra step: `/plugin marketplace add /path/to/clone` registers the clone as a local marketplace, and the new plugin is installable as soon as it appears in `.claude-plugin/marketplace.json`.

## Write the README

Two conventions, pick the fit:

- **Skills-catalog** (language/skill plugins): `# <name>` → one-line description → `## Install` → `## Skills (N)` table → optional `## When to use`. Model: [`plugins/frontend/README.md`](plugins/frontend/README.md).
- **Overlay/rationale** (vendored or overlay plugins): lead with *why this exists / what's included / how it layers*. Model: [`plugins/audit/README.md`](plugins/audit/README.md).

Keep the `## Skills (N)` count in sync with the actual number of skill directories: it's a convention readers rely on.

## Validate locally

`npm run verify` runs every check CI runs on a pull request, from the repository root on the Node version `.nvmrc` pins, and gives the CI verdict. It prints the output of each check that fails as soon as it fails, then one line per check with its duration, then the verdict. `npm run verify -- <group> [<group>...]` runs only the named groups. The checks, the groups and the goal suite's time ceiling live in `scripts/verify/`. Every run starts with `npm ci`, which replaces `node_modules` and needs the npm registry: when it fails (offline, for instance), no check runs and the report says so.

It runs in one of two modes, with the same verdicts:

```bash
npm run verify                  # checks in parallel, as many at a time as half the machine's cores, rounded up
npm run verify -- --sequential  # one check at a time, for a machine other sessions already load
```

In both modes the goal suite and the mutation check run alone, after every other check: the mutation check rewrites `plugins/goal/src` while it runs.

The groups follow the test types:

| Group | What it proves |
|---|---|
| `structure` | Static checks: manifests, the workflow guard, hook commands and `${CLAUDE_PLUGIN_ROOT}` references, every test file run by one check, the certification of every skill, agent and evals file, the skill coherence suite, the goal docs' anchors (and the suite that tests the anchor check) and module headers, eslint and tsc |
| `unit` | The node:test suites of `scripts/`, `plugins/skills` and the node-test examples |
| `shell-suites` | The hook and script suites of the plugins, under `/bin/bash` 3.2 on macOS, the bash the hooks get there |
| `goal-gate` | The goal suite |
| `mutation` | The goal suite catches the mutations `mutate.sh` plants |
| `plugin-validate` | `claude plugin validate --strict` on the marketplace and every plugin (needs the `claude` CLI) |
| `skills-discovery` | The pinned skills CLI discovers every skill, and the network tests of `plugins/skills` pass (needs the network) |
| `canary` | Opt-in, never run by a bare `npm run verify`: every skill installs with `skills@latest`, the upstream skills-ref validator accepts every skill, `skills@latest` discovers every skill, and `claude plugin validate --strict` passes with the latest Claude Code (needs the network, uv and the `claude` CLI) |

A local run ends with `not reproduced on this Mac:` lines naming what only CI reproduces: the canary's latest Claude Code and Node 24, the goal suite's wall-clock ceiling, which CI alone applies, the macOS leg's `/bin/bash` 3.2 when the `bash` on your `PATH` is another version, and the pinned Node or Claude Code version when yours differs.

`./scripts/health-check.sh` (add `--quick` to skip the upstream sync) stays a local diagnostic around the native `claude plugin` commands: it re-syncs upstream marketplaces, validates the root `marketplace.json` and each plugin with `--strict` as CI does, checks every `${CLAUDE_PLUGIN_ROOT}/...` reference in `hooks.json` and command files, and lists installed plugins. CI does not run it: the `plugin-validate` and `structure` groups cover what it checks.

## What CI enforces

`.github/workflows/validate.yml` runs on every pull request and push to `main`: one job per group, in parallel, each under a `timeout-minutes`, on a pinned ubuntu, with `shell-suites` also on a pinned macOS, where hooks run under `/bin/bash` 3.2. Each job does only setup (checkout, the Node version `.nvmrc` pins, plus the pinned Claude Code install in `plugin-validate`) and then runs `node scripts/verify.ts <group>`, the command `npm run verify` wraps. CI leaves npm out, so that no npm setting committed to the repository can change what a job runs; for the same reason eslint and tsc run from `node_modules`, not through `npx`.

A `structure` check holds the workflow to that shape and refuses anything else: a raw check step, a key that could neutralise a step or a job (`continue-on-error`, `if`, `env`, `defaults`, `shell`), a job without a timeout or on another runner, a trigger filter that could skip a pull request or a push to `main`, or a group that no pull-request job runs. A new push to a pull request cancels the run it supersedes; a push to `main` cancels nothing.

The pull-request jobs pin what could change a verdict without a diff: the runner image, Node through `.nvmrc`, Claude Code and the skills CLI. The canary floats them; when it turns red on a newer version, move that pin, with any fix it needs, in a pull request of its own.

The `canary` group runs only in a scheduled job, on the latest Node 24 and the latest Claude Code, which also sets up uv. When it fails, the job's last step opens a `Canary failed` issue, or comments on the one already open; the guard requires that step.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOME` | `~/.claude` | Override the Claude config directory. |
