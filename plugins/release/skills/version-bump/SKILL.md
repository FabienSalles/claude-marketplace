---
name: version-bump
description: "ACTIVATE before every `gh pr create` / `gh pr edit` in the claude-marketplace repo, and before any commit that touches files under plugins/. ACTIVATE for 'bump version', 'bump les versions', 'release plugin', 'version bump', 'semver', 'mets à jour les versions'. Classifies the pending changes per plugin into major/minor/patch from the conventional commits since that plugin's last bump, then updates plugin.json AND marketplace.json in the same PR, preserving the files' existing formatting. Claude Code caches plugins by version: a content change without a bump never reaches users. DO NOT use for: versioning application code outside this marketplace, changelog generation, or git tagging."
version: "1.0"
---

# version-bump — no plugin change ships without its semver bump

Claude Code caches installed plugins **by version**. A PR that changes a plugin's
shipped content (skills, commands, agents, hooks, scripts, README) without bumping
its version is invisible to every user until someone bumps it later. The bump
belongs in the **same PR** as the change.

## When this runs

Every time a PR is about to be created or updated on this repo, and every time a
commit touches `plugins/`. The bump commit is part of the branch, never an
afterthought on main.

## Procedure

### 1. List the plugins the branch actually changes

```bash
git fetch --prune
git diff --name-only origin/main...HEAD -- plugins/ | cut -d/ -f2 | sort -u
```

Drop from the list any plugin whose only diff is its own `plugin.json` version
line (already bumped).

### 2. Classify the bump per plugin

For each changed plugin, read the branch's commits touching it plus, if the
version was already stale before the branch, the commits since its last bump:

```bash
last_bump=$(git log -1 --format=%h -- plugins/<name>/.claude-plugin/plugin.json)
git log --oneline "$last_bump"..HEAD -- plugins/<name>
```

Apply, in priority order:

| Change | Bump |
|---|---|
| Skill / command / agent renamed or removed, hook behaviour changed incompatibly, or a commit scoped to this plugin carries `!` / `BREAKING CHANGE` | **major** |
| New skill / command / agent / hook, or a `feat` commit adding rules to an existing skill | **minor** |
| `fix`, `docs`, `refactor`, `chore`, description rewording, README-only | **patch** |

A cross-cutting `!` commit (e.g. a repo-wide sweep) is major **only** for the
plugins where its diff renames or removes something users invoke by name; for the
plugins where it merely edits prose, it is a patch. Check the diff, not the
subject line:

```bash
git show <sha> --stat -M -- plugins/<name>
```

### 3. Write the new version in BOTH files

The version lives in `plugins/<name>/.claude-plugin/plugin.json` and in the
matching entry of `.claude-plugin/marketplace.json`. They must stay identical.

Edit **only the version line** (Edit tool on the `"version": "x.y.z"` string).
Never round-trip the JSON through a serializer: it reflows inline arrays and
turns a one-line bump into a formatting diff.

### 4. Verify before pushing

```bash
bash scripts/validate-skills.sh
python3 - <<'EOF'
import json, pathlib
m = json.loads(pathlib.Path(".claude-plugin/marketplace.json").read_text())
bad = [e["name"] for e in m["plugins"]
       if pathlib.Path(f"plugins/{e['name']}/.claude-plugin/plugin.json").exists()
       and json.loads(pathlib.Path(f"plugins/{e['name']}/.claude-plugin/plugin.json").read_text())["version"] != e.get("version")]
print("mismatches:", bad or "none")
EOF
```

Both must pass. A mismatch means step 3 missed one of the two files.

## Anti-patterns

- ❌ Merge the content PR now, "bump in a follow-up". The follow-up is the commit
  history this skill exists to prevent: 26 plugins stale at once.
- ❌ One global bump level for the whole PR. Each plugin gets its own level from
  its own diff.
- ❌ Bump `marketplace.json` only. `plugin.json` wins silently; users still see
  the old version.
- ❌ Re-serialize the JSON to change one field.
