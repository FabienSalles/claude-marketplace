---
description: Install anthropics/claude-code-security-review GitHub Action workflow in the current repo
---

# /audit:install-security-review-action

Install the canonical `anthropics/claude-code-security-review` GitHub Action workflow into the current git repository.

## Source

Template: `${CLAUDE_PLUGIN_ROOT}/templates/claude-code-security-review.yml`

Target: `<repo>/.github/workflows/security-review.yml`

## Steps

1. Verify the current working directory is a git repository (`git rev-parse --show-toplevel`).
2. Check whether `.github/workflows/security-review.yml` already exists:
   - If **no**, copy the template directly.
   - If **yes**, show the diff and ask the user before overwriting.
3. After writing the file, print the **post-install checklist** the user must do manually:
   - Add `CLAUDE_API_KEY` in GitHub Settings → Secrets and variables → Actions.
   - For public repos / external contributors: enable "Require approval for first-time contributors" (or stricter) in Settings → Actions → General. The action is **not hardened against prompt injection**.
   - Commit & push the workflow file.
4. Suggest customising `exclude-directories` (vendor, node_modules, tests) and optionally pointing to a project-specific `custom-security-scan-instructions` file.

## Behavior

- Never overwrite without showing a diff and asking first.
- Do not run `gh secret set` or any GitHub API call — secrets must be configured manually by the user for security.
- Do not commit the file automatically — let the user review and commit.

## Pairs with

- `audit:security-overrides` (output format conventions + FP filters that apply to PR comments)
- `netresearch:security-audit` (the patterns the action is based on, conceptually)
