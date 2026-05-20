# superpowers

Cherry-picked subset of [obra/superpowers](https://github.com/obra/superpowers) (v5.1.0, MIT).

## Why a subset

The upstream marketplace ships 14 skills. Three are pulled here; the others are deliberately excluded:

| Skill | Status | Why |
|---|---|---|
| `writing-plans` | ✅ kept | Gated phase plans with explicit approvals — complements `common:crispi-planning` (more structured, more verbose) |
| `verification-before-completion` | ✅ kept | Evidence-before-claims gate — no equivalent in the rest of the marketplace |
| `systematic-debugging` | ✅ kept | Root-cause-first 4-phase process — complements `qa:phpstan-resolver` (PHP-specific) by being language-agnostic |
| `brainstorming` | ❌ skipped | Duplicates `bmad-brainstorming` (BMAD is more structured) |
| `test-driven-development` | ❌ skipped | Would be a 4th TDD framework alongside `php-tdd-workflow`, `vitest-tdd-workflow`, `common:feature-tdd-dev` → Claude hesitates |
| `subagent-driven-development` | ❌ skipped | Multi-clauding is handled manually + `audit-trail.sh` |
| `requesting-code-review` / `receiving-code-review` | ❌ skipped | `common:deep-review` covers adversarial review |
| `dispatching-parallel-agents` / `using-git-worktrees` / `finishing-a-development-branch` / `executing-plans` / `using-superpowers` / `writing-skills` | ❌ skipped | Out of scope (orthogonal workflows) |

## Upstream

- Repo: https://github.com/obra/superpowers
- Author: Jesse Vincent (`jesse@fsck.com`)
- License: MIT (preserved as `LICENSE`)

## How to refresh from upstream

```bash
cd /tmp
rm -rf obra-superpowers-temp
git clone --depth 1 https://github.com/obra/superpowers.git obra-superpowers-temp
cp -r /tmp/obra-superpowers-temp/skills/{writing-plans,verification-before-completion,systematic-debugging} \
      ~/projects/github/claude-marketplace/plugins/superpowers/skills/
cp /tmp/obra-superpowers-temp/LICENSE \
   ~/projects/github/claude-marketplace/plugins/superpowers/LICENSE
```

Then bump `version` in `.claude-plugin/plugin.json` to match upstream.

## Notes on skill internals

- `writing-plans` references `superpowers:using-git-worktrees` skill — that cross-reference is dangling in this subset (still works standalone, just informational).
- `systematic-debugging` ships supporting files (`condition-based-waiting-example.ts`, `find-polluter.sh`, etc.) — all copied as-is.
