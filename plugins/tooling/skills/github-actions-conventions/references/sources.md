# Sources

Where each GitHub behaviour in `SKILL.md` is stated, checked on 2026-10-06. Plan limits, image contents and migration dates move: re-check them before quoting them as current.

## GitHub documentation

| Claim | Source |
|---|---|
| Each job runs on its own fresh VM; jobs run in parallel by default | https://docs.github.com/en/actions/get-started/understand-github-actions |
| `timeout-minutes` defaults to 360, and GitHub cancels a job that reaches it; `strategy.fail-fast` defaults to true and cancels the rest of the matrix; a job-level `permissions` block sets every permission it omits to none; a custom `shell` is a template around `{0}`; `always()` keeps a job with failed `needs` running | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax |
| A step runs under a default `success()` check, so a failed step skips the steps after it; `failure()` is true once a previous step failed. No page says whether a `failure()` step runs after a job timeout has cancelled the job, hence the "may never reach the issue" of §6 | https://docs.github.com/en/actions/reference/workflows-and-actions/expressions |
| A job runs at most 6 hours on a GitHub-hosted runner; Free runs 20 jobs at once and Pro 40, at most 5 of them on macOS | https://docs.github.com/en/actions/reference/limits |
| A pending run in a concurrency group is cancelled when a newer one queues; `cancel-in-progress` also cancels the running one and accepts an expression; `github.head_ref` exists only on pull_request events, hence the `github.run_id` fallback | https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency |
| The schedule event is delayed under high load, the start of every hour is high load, queued jobs may be dropped; a public repository's schedules are disabled after 60 days without activity; a schedule only runs on the default branch; a `pull_request` trigger runs only on the `opened`, `synchronize` and `reopened` activity types by default, and its `branches` filter matches the branch the pull request targets | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |
| A pull request's `edited` action covers a change of its base branch | https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request |
| A scheduled job creating issues with `gh issue create`, `issues: write` and `GH_TOKEN`; run at a different time of the hour to reduce delays | https://docs.github.com/en/actions/how-tos/use-cases-and-examples/project-management/scheduling-issue-creation |
| Scheduled-run notifications go to the workflow's creator, then to whoever last edited its cron or re-enabled it | https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs |
| A workflow skipped by a path, branch or commit-message filter leaves its required checks Pending and blocks the merge; a job skipped by a condition reports Success; use `always()` with `needs` for an aggregate required check | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks |
| Re-running the failed jobs of a run | https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs |
| `in:title` search qualifier used by `gh issue list --search` | https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests |

## Runner images and actions

| Claim | Source |
|---|---|
| A `-latest` label migrates over 1 to 2 months; pin a specific OS version to avoid it; `macos-26` is the arm64 image behind `macos-latest` | https://github.com/actions/runner-images |
| ubuntu-latest moves to Ubuntu 26.04 from 2026-10-19 to 2026-11-19 | https://github.com/actions/runner-images/issues/14748 |
| Bash 5.2.21 and ShellCheck 0.9.0 on ubuntu-24.04, Bash 5.3.9 and ShellCheck 0.11.0 on ubuntu-26.04, Bash 3.2.57 and no GNU grep or sed on macos-26 arm64 | https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md, https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2604-Readme.md, https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md |
| setup-node caches the global package cache, not `node_modules`; since v5 a `packageManager` or `devEngines.packageManager` field set to npm enables it; `package-manager-cache: false` advised for workflows with elevated privileges; `node-version-file` reads `.nvmrc`, which holds a version spec like `node-version` does, so `24` in it floats as well | https://github.com/actions/setup-node |
| `npm ci` removes an existing `node_modules` before installing | https://docs.npmjs.com/cli/v11/commands/npm-ci |
| ShellCheck has no bash-version target | https://github.com/koalaman/shellcheck#in-your-build-or-test-suites |
| `node --test --test-shard` assigns sorted files round-robin, by count | https://nodejs.org/docs/latest-v24.x/api/cli.html#--test-shard |
| `gh run rerun RUN_ID --failed`, `gh issue list --search --json --jq`, `gh issue create --title --body` | `--help` of gh 2.92.0; `gh issue comment NUMBER --body`: https://cli.github.com/manual/gh_issue_comment |
| A flaky test is fixed, not retried: retries teach people to ignore red | https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html |

## Measured on this marketplace's CI (FabienSalles/claude-marketplace, 2026)

| Number | Evidence |
|---|---|
| A `0 6 * * *` cron started 4 to 12 hours late | the last 40 scheduled runs before 2026-10-05 |
| `npm ci` of 98 packages: 3 s or less per job | run 37376176949 step times |
| 8 of the last 60 changes would have skipped the slowest job | `git diff-tree` over 60 first-parent commits of main |
| `The job was not acquired by Runner of type hosted even after multiple attempts`, cancelled after about 15 minutes, and a macOS capacity notice | runs 37367248514 and 37364779688 (2026-10-05) |
| `Terminate orphan process` at the end of every goal-gate job | runs 37376176949, 37377609362, 37377138437, 37376755151, 37371568124 |
| `node-version: '24'` resolved to 24.21 on CI while the developer's machine ran 24.16 | https://nodejs.org/dist/index.json |
| `shell: true {0}`, `defaults.run.shell` and a step `env` pass a denylist guard; `npm_config_script_shell=/usr/bin/true` makes `npm run verify` exit 0 without running it | in-memory probes of the workflow guard, 2026-10-05 |
