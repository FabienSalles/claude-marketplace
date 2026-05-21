# superpowers

Cherry-picked subset of [obra/superpowers](https://github.com/obra/superpowers) (v5.1.0, MIT). Local plugin version `5.1.1` (the trailing digit tracks local cherry-pick revisions, independent of upstream releases).

## Why a subset

The upstream marketplace ships 14 skills. Two are pulled here; the others are deliberately excluded:

| Skill | Status | Why |
|---|---|---|
| `verification-before-completion` | ✅ kept | Evidence-before-claims gate — no equivalent in the rest of the marketplace |
| `systematic-debugging` | ✅ kept | Root-cause-first 4-phase process — complements `qa:phpstan-resolver` (PHP-specific) by being language-agnostic |
| `writing-plans` | ❌ skipped (removed in 5.1.1) | Real overlap with `/business-first-dev` Phase 3-4. Its only delta — bite-sized 2-5 min steps — is already covered by `php-tdd-workflow` / `vitest-tdd-workflow`. See `docs/tdd-workflow-audit.md` for the comparison. |
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
cp -r /tmp/obra-superpowers-temp/skills/{verification-before-completion,systematic-debugging} \
      ~/projects/github/claude-marketplace/plugins/superpowers/skills/
cp /tmp/obra-superpowers-temp/LICENSE \
   ~/projects/github/claude-marketplace/plugins/superpowers/LICENSE
```

Then bump the local revision suffix in `.claude-plugin/plugin.json` (e.g. `5.1.1` → `5.1.2`) when upstream content meaningfully changes.

## Notes on skill internals

- `systematic-debugging` ships supporting files (`condition-based-waiting-example.ts`, `find-polluter.sh`, etc.) — all copied as-is.
