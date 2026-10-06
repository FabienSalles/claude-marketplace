---
name: github-actions-conventions
description: "ACTIVATE when writing, reviewing or debugging a GitHub Actions workflow: jobs, timeouts, concurrency, a scheduled canary, path filters, caching, a red or stuck run. ACTIVATE for '.github/workflows', 'timeout-minutes', 'cancel-in-progress', 'on: schedule', 'nightly CI job', 'required check Pending', 'not acquired by Runner'. Covers: one entry step and one size per job, PR-only cancellation, pinned gate vs floating canary, allowlist guards, macOS legs. DO NOT use for: test sizes and where each check runs (see craft:test-suite-design), a canary release to users (see product:delivery), node --test flags (see node-test:node-test-conventions), bash 3.2 script fixes (see mac:mac-platform)."
---

# GitHub Actions Conventions

> How a test pipeline is wired into GitHub Actions, and how GitHub behaves around it. The suite's own design (the sizes and where each runs, the single entry point, per-check deadlines, what makes a canary worth having) lives in `craft:test-suite-design`; what a test asserts, in `craft:testing-principles`; `node --test` flags, in `node-test:node-test-conventions`; bash 3.2 and BSD fixes, in `mac:mac-platform`; hook suites and their per-platform rows, in `shell-test:shell-test-conventions`. The source of every GitHub behaviour below, and of every number measured on this marketplace's own CI, is listed in `references/sources.md`.

## 1. Steps

- **A job is its setup steps, then one step that calls the entry point with every group the job covers** (`node scripts/verify.ts static`; the entry point itself: `craft:test-suite-design` §11). A failed step skips the steps after it, so a second entry step loses its verdict whenever the first one goes red, and a check written straight into a `run:` block is one the local entry never runs, so local and CI verdicts drift.
- **Call the entry script itself, never through a package manager.** `npm run verify` stays the local shortcut; in CI, a committed `.npmrc` (`script-shell=/usr/bin/true`) or a changed `scripts` entry in `package.json` makes `npm run` exit 0 without running the entry, and no workflow guard reads those files (§8).
- **Let the entry install the dependencies before its first check** (`npm ci`), so a job's setup is only the checkout and the toolchain, and no job can forget the install. An entry that does not install needs an install step in every job, the canary included.

## 2. Jobs

- **One job per size, all running in parallel.** The run lasts as long as its slowest job, and a red job names the size that broke.
- **Split or shard only the job that sets the run's wall time, and only once its own work dwarfs its setup.** Shortening any other job saves nothing, and every split costs: each job gets a fresh VM and pays checkout, setup and install again; a run fails when one of its jobs never gets a runner; the Free and Pro plans run at most 20 and 40 jobs at once, 5 of them on macOS; and `node --test --test-shard` deals files out by count, not by duration.
- **Repeat the setup in every job rather than hand a result from one job to another.** An `npm ci` of about 100 packages took at most 3 s per job on this marketplace's CI, while a handed-over result costs an artifact upload, a download and a `needs:` wait that serialises the two jobs. Work that runs twice is removed, not shared (`craft:test-suite-design` §8).
- **Measure before caching dependencies.** setup-node caches the npm cache, not `node_modules`, and `npm ci` deletes `node_modules` before installing, so a lockfile of about 100 packages gains a few seconds at most. Since setup-node v5, a `packageManager` (or `devEngines.packageManager`) field set to npm turns that cache on by itself; its README advises `package-manager-cache: false` in workflows with elevated privileges.

## 3. Timeouts

- **Every job declares `timeout-minutes`, about 4 to 5 times its longest green run, read from the durations the entry reports.** Left out, it is 360: one hang holds a runner and keeps the pull request pending for six hours. The wide margin keeps a slow runner day green.
- **The job timeout only backs up each check's own deadline (`craft:test-suite-design` §10): on its own, it cancels the job without naming the check that hung.** `Terminate orphan process` lines at the end of a job log mean a check left processes behind for the runner to kill (`craft:test-suite-design` §7).
- **No timeout shortens a job that never got a runner.** That failure ends on GitHub's side (§10).

## 4. Concurrency

Cancel superseded pull request runs, never a push to main or a scheduled run. It pays off during a runner shortage, when a superseded run's jobs would still hold or wait for scarce runners.

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

- **Fall back to `github.run_id`.** `github.head_ref` is only defined on pull_request events, so every other run gets a group of its own: each commit on main keeps its verdict, and a push never cancels the nightly.
- **Never build the group from a value that main or the schedule share** (`${{ github.ref }}` on every event, for instance). Even without `cancel-in-progress`, a pending run is cancelled as soon as a newer one queues in its group.

## 5. Pin the Gate, Float the Canary

Why a verdict that can change without a diff stays out of the gate: `craft:test-suite-design` §1. In a workflow:

- **Pin the runner image** (`ubuntu-24.04`, `macos-26`), never a `-latest` label. Such a label moves to a new image gradually, over 1 to 2 months (ubuntu-latest to Ubuntu 26.04 from 2026-10-19 to 2026-11-19): jobs of one run can land on two OS versions, and the preinstalled tools change with the image (bash 5.2 to 5.3, ShellCheck 0.9 to 0.11).
- **Pin every CLI a check or a setup step installs** (`npx skills@1.7.0`, not `npx skills`).
- **Pin the language version to the exact one developers run, in one file the gate jobs read** (an `.nvmrc` holding `24.16.0`, read with `node-version-file: .nvmrc`). `node-version: '24'` takes the newest 24.x: CI ran 24.21 while the developer's machine ran 24.16, so a feature added in between works in CI and not locally.
- **Float the same things in the canary** (`ubuntu-latest`, `@latest`, the major version only). A red canary means a floated version broke something: find which one, then move that pin, with any fix it needs, in a pull request of its own; move the image pin before the pinned image is deprecated.

## 6. Scheduled Canary

What makes a canary worth having: `craft:test-suite-design` §6. In a workflow:

- **The canary job is the gate's setup on floating versions, plus one entry step naming the canary group, under `if: github.event_name == 'schedule'`.** Run the group locally before merging a change to it, since a schedule only runs from the default branch.
- **On failure it opens one issue, or comments on the one already open.** Notifications for a scheduled workflow go to one user only: its creator, or whoever last edited its cron or re-enabled it. Give that job `issues: write` plus `contents: read` for the checkout: a job-level `permissions` block sets every permission it omits to none.
- **A hung canary check ends on its own deadline (`craft:test-suite-design` §10), well before the job's `timeout-minutes`.** The issue step runs on `failure()`, which a failed step turns true, while `timeout-minutes` cancels the job: a hang that only the job timeout ends may never reach the issue.
- **Put the cron at an odd minute (`23 4 * * *`) and treat its timing as best effort.** The schedule event is delayed under high load, the start of every hour is high load, and queued jobs may be dropped: a `0 6 * * *` cron on this marketplace started 4 to 12 hours late.
- **In a public repository, a schedule is disabled after 60 days without activity.** Check it is still enabled when a quiet project resumes.

## 7. Path Filters and Required Checks

- **Never put a path or branch filter (`paths`, `paths-ignore`, `branches`, `branches-ignore`) under the `pull_request` trigger of a workflow whose checks are required.** A workflow skipped that way leaves its checks Pending, and the pull request cannot merge. With a base-branch filter, a stacked pull request runs nothing while it targets its parent's branch, and changing its base to main later is an `edited` event, which starts no workflow by default (only `opened`, `synchronize` and `reopened` do): its checks wait for the next push.
- **Select by diff inside the entry instead,** on pull requests only, against the merge base, printing what it skipped (`not needed: no change under plugins/goal since <base>`); a push to main and the schedule run everything. Measure what it would save first: 8 of the last 60 changes on this marketplace would have skipped its slowest job.
- **An aggregate job used as the required check runs under `if: always()` and fails unless every job it needs succeeded.** Without `always()` it is skipped when a dependency fails, and a job skipped by a condition reports Success.

## 8. Guard the Workflow with Allowlists

When a test guards the workflow file (worth it once agents edit CI), it lists what may appear, never what may not.

- **A step carries only `name`, `uses`, `with` and `run`; a job only `name`, `runs-on`, `strategy`, `steps` and `timeout-minutes`,** plus the canary's schedule condition, permissions and failure step; no `env` or `defaults` at workflow or job level. A denylist of `continue-on-error` and `if: false` still accepts `shell: true {0}` (a custom shell that never runs the script), a job's `defaults.run.shell`, and a step `env` setting `npm_config_script_shell=/usr/bin/true`, under which `npm run verify` exits 0 without running anything.
- **Check coverage against the workflow itself:** every group but the canary is named by exactly one entry step in a job that runs on pull requests, and the canary only by the scheduled job. The general rule, a copy checked by its role: `craft:test-suite-design` §5.
- **Test the guard on YAML strings parsed in memory** (milliseconds, no CI run), and change it in the same pull request as the workflow.

## 9. macOS Legs

- **A macOS leg runs platform checks only (`craft:test-suite-design` §1): the suites of code that `/bin/bash` runs on a developer's Mac.** `macos-26` ships Bash 3.2.57 with BSD tools where `ubuntu-24.04` ships Bash 5.2 with GNU tools, and ShellCheck has no bash-version target, so in CI only the macOS leg catches a bash 4 construct. Nothing else goes there: macOS runners are capped at 5 concurrent jobs, and GitHub warned of longer macOS queues during the 2026-10-05 incident.
- **The leg catches only what some case drives.** The rows that drive each platform branch: `shell-test:shell-test-conventions`.
- **Put the OS legs in one matrix with `fail-fast: false`.** The default cancels the other legs as soon as one fails, which hides their verdicts.

## 10. A Red or Stuck Run

- **Read the annotation before re-running.** `The job was not acquired by Runner of type hosted even after multiple attempts`, with no step run, is GitHub's infrastructure, and the job is cancelled after about 15 minutes: re-run the failed jobs once the incident clears (`gh run rerun RUN_ID --failed`). No test change fixes it; fewer jobs only shrink the exposure.
- **A check that turns green on re-run is flaky, not fixed.** Open an issue for it, and never add automatic retries to the gate: they hide real races and teach everyone to ignore red.

## Example

One job per size (static checks, small in-process tests, medium process-level suites, and a platform job on Linux and macOS for the suites of code that runs on both), pinned images, PR-only cancellation, and a schedule-only canary on floating versions that reports to an issue. The gate jobs carry no `if`, so a push and the schedule re-run the whole gate. `pull_request` carries no filter, so a stacked pull request runs the gate too (§7). No job installs its dependencies: the entry runs `npm ci` (§1). `.nvmrc` holds an exact Node version (§5). Size each `timeout-minutes` from your own measured durations.

```yaml
name: Verify

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '23 4 * * *'

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  static:
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version-file: .nvmrc }
      - run: node scripts/verify.ts static

  small:
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version-file: .nvmrc }
      - run: node scripts/verify.ts small

  medium:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version-file: .nvmrc }
      - run: node scripts/verify.ts medium

  platform:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-24.04, macos-26]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version-file: .nvmrc }
      - run: node scripts/verify.ts platform

  canary:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: '24' }
      - run: node scripts/verify.ts canary
      - if: failure()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          RUN: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          issue=$(gh issue list --search 'in:title "Scheduled canary is red"' --json number --jq '.[0].number')
          if [ -n "$issue" ]; then
            gh issue comment "$issue" --body "Still red: $RUN"
          else
            gh issue create --title 'Scheduled canary is red' --body "Red: $RUN"
          fi
```

## Quick Reference

| Situation | Rule |
|---|---|
| Writing a job | Checkout and toolchain, then one entry step calling the entry script directly with every group the job covers; the entry installs |
| Laying out jobs | One per size, in parallel; split or shard only the job that sets the wall time |
| A result another job needs | Repeat the setup instead of handing results over; remove work that runs twice |
| Dependency cache | Measure first: setup-node caches the npm cache, not `node_modules` |
| `timeout-minutes` | On every job, 4 to 5 times its longest green run, behind each check's own deadline |
| `concurrency` | Group on `head_ref` with a `run_id` fallback; cancel only on `pull_request` |
| Versions | Image, CLIs and exact language version pinned in the gate, floating in the canary; a pin moves in its own pull request |
| Scheduled canary | Gate setup plus one entry step, check deadlines under the job timeout, an issue on failure, an odd-minute cron |
| Path and branch filters | Never under `pull_request` on a required check; select by diff inside the entry |
| Aggregate required job | `if: always()`, red unless every job it needs succeeded |
| Workflow guard | Allowlisted keys, every group covered by a PR job, tested on YAML parsed in memory |
| macOS leg | Platform checks only, in one OS matrix with `fail-fast: false` |
| "not acquired by Runner" | Infrastructure: re-run the failed jobs, change no test |
| Green on re-run | Flaky: an issue, never an automatic retry |
