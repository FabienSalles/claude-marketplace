# superpowers

Cherry-picked subset of [obra/superpowers](https://github.com/obra/superpowers) (v5.1.0, MIT). Local plugin version `5.1.1` (the trailing digit tracks local cherry-pick revisions, independent of upstream releases).

## Why a subset

The upstream marketplace ships 14 skills. Two are pulled here; the others are deliberately excluded:

| Skill | Status | Why |
|---|---|---|
| `verification-before-completion` | ✅ kept | Evidence-before-claims gate, no equivalent in the rest of the marketplace |
| `systematic-debugging` | ✅ kept | Root-cause-first 4-phase process: this marketplace has no native, language-agnostic root-cause discipline (the only debugging aid, `qa:phpstan-resolver`, lives in an external marketplace) |
| `writing-plans` | ❌ skipped (removed in 5.1.1) | Step decomposition overlaps `/spec-first-dev` Phase 3-4 and the `*-tdd-workflow` skills. Its distinct value (a No-Placeholders discipline for plan docs) is a tracked gap in `self-audit`, not yet ported. |
| `brainstorming` | ❌ skipped | Generative divergent→convergent ideation is a deliberate non-goal here (this marketplace is critique/planning). No internal 1:1; the closest planning tools are `/spec-first-dev` + the grill family. (BMAD is an external, non-marketplace install.) |
| `test-driven-development` | ❌ skipped | Would be a 4th TDD framework alongside `php-tdd-workflow`, `vitest-tdd-workflow`, `common:feature-tdd-dev` → Claude hesitates |
| `subagent-driven-development` | ❌ skipped | Hands-off subagent orchestration is a deliberate non-goal (human-as-controller). Nearest internal workflow: `goal`. (`audit-trail.sh` is only a Bash-command logger, not an orchestrator.) |
| `requesting-code-review` / `receiving-code-review` | ❌ skipped | `common:deep-review` covers the reviewer/producer axis, not these: `requesting-code-review` is requester-side (feed the plan so silent omissions / scope-creep are caught), `receiving-code-review` is triage/pushback + no performative agreement. Both are tracked gaps in `self-audit`, not yet ported. |
| `dispatching-parallel-agents` / `using-git-worktrees` / `finishing-a-development-branch` / `executing-plans` / `using-superpowers` / `writing-skills` | ❌ skipped | Out of scope (orthogonal workflows) |

## Upstream

- Repo: https://github.com/obra/superpowers
- Author: Jesse Vincent (`jesse@fsck.com`)
- License: MIT (preserved as `LICENSE`)

## Local divergences

`systematic-debugging` is fixed locally rather than waiting on an upstream PR:

- `find-polluter.sh`: repaired the `find -path` glob (upstream never anchors it to `.`, so it
  matches nothing), fails loudly instead of exiting 0 on zero matching test files, and takes
  the test runner from `TEST_RUNNER` (default `npm test`) instead of hardcoding it.
- `CREATION-LOG.md`, `test-academic.md`, `test-pressure-{1,2,3}.md`: dropped. Unreferenced
  eval artefacts from upstream's skill-authoring process, not part of the skill itself.

A refresh from upstream must re-apply these before copying the directory over, or it silently
reverts them.

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

- `systematic-debugging` ships supporting files (`condition-based-waiting-example.ts`, `find-polluter.sh`, etc.). `find-polluter.sh` diverges from upstream, see [Local divergences](#local-divergences).
