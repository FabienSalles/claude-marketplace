---
name: test-suite-design
description: "ACTIVATE when designing or reviewing a test suite: each check's size, where it runs and its time bound; a slow suite, or a gate replaying it whole; an expensive act repeated per test; a check that cannot fail or fails on every edit (change detector); a canary nobody sees; a test file no check runs, or one still running after its last test; a wall-clock ceiling. ACTIVATE for 'test sizes', 'shared fixture', 'zero tests ran', 'orphan process'. Any language, any runner. DO NOT use for: writing one test (see craft:testing-principles), a GitHub Actions workflow (see tooling:github-actions-conventions), node:test mechanics (see node-test:node-test-conventions), a bash suite harness (see shell-test:shell-test-conventions)."
---

# Test Suite Design: Economics and Wiring

> How one test is written (DAMP, AAA, doubles, what not to test, the level a rule is tested at) lives in `craft:testing-principles`. Runner idioms live in `node-test:node-test-conventions` and `shell-test:shell-test-conventions`. How a GitHub Actions workflow calls the suite (jobs, job timeouts, pins, the scheduled job) lives in `tooling:github-actions-conventions`.

This skill decides what each proof may cost, where it runs, and how checks are wired so that a green run means something. Each rule carries a **Why** (a case measured in this marketplace) and a **Criterion** (how to tell the rule holds). The general source behind each section is in `references/sources.md`.

## 1. Give Every Check a Size

**Every check has a size, and its size decides what it may touch, where it runs and the time limit of each test it runs.**
Why: a group named for static checks ran up to 27.6 s of process-level tests and called a third-party CLI over the network on every pull request, because nothing tied a check to what it touched.
Criterion: each check names its size, and nothing it does goes beyond that size's row.

| Size | May touch | Runs |
|---|---|---|
| Static | the files of the tree, executing nothing of the product: lint, type-check, manifest and link checks | every save, every PR |
| Small | the memory of one process: pure functions, parsers, rules, in-memory doubles; no child process, network, sleep or filesystem | every save, every PR |
| Medium | a temp root of its own: real files, real git, spawned binaries and fakes on `PATH`, signals, localhost | every PR, and locally before a push |
| Platform | an external CLI or the OS the code meets in production (a vendor CLI's validator, macOS `/bin/bash` 3.2 with BSD tools), at a pinned version | every PR, only where that platform is the subject |
| Network | a remote tool or registry, at a pinned version | every PR while pinned, naming its outages (below) |
| Canary | moving targets: latest upstream releases, live validators | on a schedule; locally only when named |
| Mutation | the source under test, rewritten on purpose | designated mutants on every PR; broad runs on a schedule |

Size cuts across the layers of `craft:testing-principles` §1: the layer says what a test covers, the size what it may touch and what it costs. Per-test limits follow Google's sizes: 60 s small, 300 s medium (platform tests included), 900 s or more large, which is any test that reaches a remote system (network, canary). A mutation check holds each test it replays to that test's own limit; a static check runs no test, and its own deadline (§10) bounds it like every check.

**A medium test owns everything it reads and writes: HOME, configuration, git config and temp directories live under a root it creates and removes.**
Why: a hook test that kept the real HOME scanned the developer's own `~/.claude/CLAUDE.md`, and a fixture repository inherits the developer's git config, so it can pass on one machine and fail on a fresh runner.
Criterion: the suite passes unchanged with an empty HOME and no global git config. How to isolate: `node-test:node-test-conventions`, `shell-test:shell-test-conventions`.

**A check whose verdict can change without a diff stays out of the pull-request gate: the gate runs the tool pinned, and the floating version runs in the canary.**
Why: the discovery check ran the latest release of a third-party CLI on every pull request, so an upstream publish could turn every PR red with no change in the repository.
Criterion: the same commit gets the same PR verdict a week later, short of an outage the check names. Pinning and floating in a workflow: `tooling:github-actions-conventions`.

A pinned network check keeps one way to change its verdict without a diff: an outage or a withdrawn version turns it red. Make it name the remote it could not reach (§6), so an outage never reads as a defect of the change.

## 2. Decide In-Process, Prove the Wiring Once

**Test every rule in-process, through the function the binary itself calls.**
Why: 13 of 29 spawned preflight tests ran the whole program end to end to read one preflight line, and 11 re-checked rules that in-process tests already owned: the spawns bought a second owner, not a second proof.
Criterion: a new case for a rule adds no process spawn.

**Spawn the binary once per observable outcome: its exit code, its stdout and stderr contract, a signal, the env and argv it hands a child.**
Why: tests of a lock holder read the machine's whole process table, so another checkout's run turned 3 of 5 red, although the function already took that table as a parameter.
Criterion: one spawned smoke per binary and outcome; every other case calls the function with its inputs.

A test-side copy of that function: `craft:testing-principles` §11 and §12. What a thin adapter's own test covers, and the CLI level's place among the levels: [#168](https://github.com/FabienSalles/claude-marketplace/issues/168) (future home `craft:testing-principles`); this section keeps only what each level costs. Doubles at a process boundary, and one contract suite per port: [#160](https://github.com/FabienSalles/claude-marketplace/issues/160).

## 3. Pay for an Expensive Starting Point Once

**Build an expensive starting point once per run, or once per file, and give each test its own copy of it; share, or link to, only what no test modifies.**
Why: a fresh git repository cost 60 to 151 ms against 6 to 18 ms for a copy of a template, and fresh fake executables paid macOS's first-exec scan in every fixture (about 1.1 to 1.4 s per fixture, against 2 to 3 ms through a link to one already run).
Criterion: per test, the only cost is the copy, and whatever a test writes lands in its own copy. An executable on macOS: `mac:mac-platform`.

**Copy only what the code under test reads.**
Why: a suite copied the whole tree, 48 MB of `node_modules` included, for each of its five cases: 8.4 s at light load, about a minute under contention.
Criterion: the copy holds nothing the code under test never opens (dependency folders, `.git`, build output).

**Act once, assert many: when several assertions read one expensive result, produce it once.**
Why: four tests each ran the same sandboxed install (4.4 to 4.7 s) to read one fact of the same result, 17.6 s in all, when one install carried all four facts.
Criterion: an expensive act (spawn, install, clone, network call) runs once per distinct input. The plainest form is one test with several assertions, which `craft:testing-principles` §15 allows. When each fact needs its own name, a once-per-group hook runs the act and each test only reads its result: the exception this section makes to the per-test Arrange-Act-Assert of `craft:testing-principles` §4, for an act too expensive to repeat and for nothing else. The node:test form: `node-test:node-test-conventions`.

## 4. Prove an Intent at Its Cheapest Level

**Ask a tool's configuration before running the tool: a configuration query says whether a file is covered without checking the file.**
Why: a test proved three facts about the lint and type-check configuration by linting and type-checking a full copy of a plugin (8.2 s at moderate load, up to 26 s under heavy load); asking both configurations which files they cover answered for all 175 tracked files in 0.44 s.
Criterion: the check executes only what its question needs.

**Batch probes into one tool run and read its result per file.**
Why: the same test started one linter process per probe, 14 in all; one type-check and one batched lint run over a sandbox holding only the probes gave identical verdicts in about 0.6 s.
Criterion: the tool starts once per check, not once per probe.

**Never run a suite only to count or list its tests: read the inventory from the files and the checks' declarations, and say what it counts.**
Why: a doc check ran the whole goal suite on every CI run only to read its test count (the number has since left the doc, §5); the guard that finds test files no check runs answers from the tracked files and each check's declared command in 0.2 s.
Criterion: no check executes tests whose verdicts it discards, and a count read from declarations is called declared: a static count here found 564 declared tests where 585 ran, because loops declare several.

**Keep one end-to-end case per tool, so a broken invocation still turns red.**
Why: a configuration query cannot see a tool that no longer starts or a flag that changed meaning.
Criterion: one probe still goes through the real tool and expects its real error.

## 5. Never Pin What Every Edit Changes

**The change-detector rule of `craft:testing-principles` §2 covers every check a suite runs, whatever runs it: a doc-count script, a guard over the tree, a pin on prose that is not the contract.**
Why: exact counts in two docs, recomputed by a check, caused 16 of 27 red pull-request runs (59%) and caught no defect; 15 of 26 edits to those docs changed only digits.
Criterion: a behaviour-preserving edit (a test added, a line moved, a module split) keeps every check green.

**Give each value one owner, and check its copies by role, never by literal.**
Why: a test compared the check groups with a copied literal list instead of the workflow it claimed to mirror, and another banned the bare number 80 across the scripts, where an unrelated `.slice(0, 80)` would have turned it red.
Criterion: changing the value edits one line, and a guard asserts the relation (this list mirrors that source), never the literal.

## 6. Make Every Check Able to Fail

**A run of zero cases fails: each check states the least it accepts (at least one case ran, none failed) and refuses anything less.**
Why: the shell suites ended on "no failure", so a run that executed nothing was green; TAP 14 treats a stream without a plan as a failed test.
Criterion: pointed at an empty suite, the check goes red.

**An error is never an absence: tell found, absent and could-not-look apart, and fail on the third. A clean verdict proves its target was examined.**
Why: the coherence suite read grep's error exit as "absent" and reported 346/346 beside the error, with one guard unable to fail on macOS or Linux; ESLint exits 0 on a file no configuration covers, so "no finding" did not prove the file was linted.
Criterion: aimed at a missing file or a malformed pattern, the assertion goes red. Exit codes in shell: `shell-test:shell-test-conventions`.

**A skip states its reason, and a missing capability is the check's declared requirement, reported by name.**
Why: a check accepted any skip, and a test that skipped itself offline let the check report "passed" for a test that never ran.
Criterion: a skip with no reason fails the run; an offline run names what it lacks.

**Every finding a check can produce either turns it red or reaches its report.**
Why: the skill-stock check printed its findings as warnings and exited 0 whatever they were, and a passing check's output was dropped, so no finding could ever reach anyone.
Criterion: plant one finding: the check goes red, or its report line shows it.

**A canary whose red reaches nobody is not a canary, and neither is one never seen green.**
Why: the nightly canary failed 25 nights out of 25 from the night it was created, and nobody noticed: a scheduled run notifies only whoever created the workflow, last edited its schedule or re-enabled it.
Criterion: it was seen green on the day it was added, and a red run creates work a person sees. In a workflow: `tooling:github-actions-conventions`.

How one test proves it can fail (a deliberate break, near misses, mutation) and what makes a red the right one: [#159](https://github.com/FabienSalles/claude-marketplace/issues/159). This section keeps what a whole check refuses: an empty run, an error read as an absence, an unexplained skip, a finding nobody sees.

## 7. Leave Nothing Behind

**A test ends what it started: it clears its timers, reaps its processes (the whole process group, not only the direct child) and removes its temp directories, because whatever is left keeps the runner waiting, keeps loading the machine after the run, or fills the disk.**
Why: a deadline timer left pending after its race kept four test files alive up to 30 s past their last test, and the CI goal job's median rose from 63 s to 90 s before the one-line fix; a timeout that killed only the direct child left an orphan `sleep` in every goal CI job log checked, for the runner to terminate; the goal suite had leaked 114 056 temp directories before it got one reaper.
Criterion: the time a file or a run spends after its last test stays near zero, nothing of a test's process group outlives it, and the temp dir holds nothing new afterwards.

**Fix the leak; never end the run by force.** An option that exits whatever is still pending hides this leak and every later one. The node:test mechanics: `node-test:node-test-conventions`.

## 8. Run Every Test File in Exactly One Check

**Every tracked test file runs in exactly one check, and every check declares its size; a guard reports orphans and duplicates.**
Why: seven test files ran under no check, the certifier's own tests among them, so a fail-open regression in the gate itself would have landed green; and the goal suite ran in two checks of every CI run, the second only to count tests, which cost about 75 to 78 s per run and reported a failing test twice, the second time without its name.
Criterion: a static guard maps each tracked test file to one check: none is an orphan, two is a duplicate.

## 9. Target What Gets Replayed

**A command that something replays N times (a gate line, a determinism rerun, an agent told to run the tests) runs the change's own tests; the whole suite runs once, last.**
Why: the goal gate replays its first line 4 times per verify; plans that put the whole suite there paid 56 to 65 s per replay, and one verify ran five suite commands in 291 s.
Criterion: price each candidate command as its measured seconds times its replays before choosing it. A goal plan's replay table: `goal:plan`.

## 10. Measure Time Where It Means Something

**Gate on wall-clock time only where nothing else loads the machine, and only with a wide margin over the slowest measured run; a hosted CI runner is a shared machine and qualifies only with that margin. Elsewhere, report the wall time and gate on measures load does not move: process spawns, CPU seconds.**
Why: one 29-test file took 12.7 s on a quiet machine and 112 s at load 18 for the same CPU time, while two full suite runs used 110.4 and 110.6 CPU-seconds; the suite's 80 s ceiling, raised from 63 s after failing a busy Mac, would still have failed every loaded run (113 to 134 s), and on CI's hosted runners it left 2 to 5 s of headroom.
Criterion: if another session loading the machine, or a slow runner day, can turn the check red, it measures the machine.

**Give every check its own deadline, well above its slowest run measured under load, that kills its whole process group and names the check.**
Why: checks ran with no timeout and buffered their output, so a hang (three tests armed a 7-day sleep as a trap) would have held a CI runner for GitHub's 6-hour job limit behind an empty log; sized from a quiet run, a deadline turns the load swing above into a red check.
Criterion: a hung check fails as "timed out after N s" under its own name and leaves no process behind, and no healthy run under load reaches the deadline. A deadline catches hangs; it is not a performance ceiling. The job-level bound that backs it up: `tooling:github-actions-conventions`.

**Print each check's duration on its report line.**
Why: a passing check's output was dropped, so two slowdowns of the goal suite (+16 s, then +11 s) surfaced only by mining job durations afterwards.
Criterion: the report shows a trend without re-running anything.

## 11. One Entry Point, Two Modes

**One entry point runs every check, locally and in CI, selected by group; the canary group runs only when named.**
Why: the nightly, the one job written outside the entry point, lacked the dependency install the entry runs, and failed on it every night.
Criterion: one local command reproduces any CI verdict, and a bare run gives the verdict a pull request gets. How a workflow job calls the entry: `tooling:github-actions-conventions`.

**Run independent checks in parallel by default, at a bound well below the CPU count (start at half, then measure), and sequentially on demand for a machine other sessions load.**
Why: the bound counts checks, not the processes each one starts, and a check running its own parallel runner multiplies them; that runner alone, left at one worker per spare core (17 on 18 threads), inflated spawn-heavy files 3 to 6 times (one file: 15.3 s at 3 workers, 47.8 s at 17), and that latency is what turns fixed deadlines flaky.
Criterion: the bound was picked by timing a few values on the machine that runs it; both modes run every selected check, report every failure in one run, and print one line per check in the declared order.

**A check that writes outside its own temp root, or whose verdict depends on timing, runs alone after the concurrent batch.**
Why: mutation testing rewrites the goal sources in place, so a type-check or a suite running beside it reads a mutant; a wall-clock ceiling measures nothing while other checks share the CPU.
Criterion: no check ever overlaps an exclusive one.

## Quick Reference

| Rule | Principle |
|------|-----------|
| Size | Every check has a size that fixes what it touches, where it runs and each test's time limit |
| Hermetic | A medium test owns its HOME, configuration and temp root |
| Moving targets | A verdict that can change without a diff stays out of the gate: pinned there, floating in the canary; a pinned remote names its outages |
| In-process | Rules in-process through the binary's own function; one spawned smoke per observable outcome |
| Shared start | Build once, copy per test; share or link only what no test modifies |
| Lean copy | Copy only what the code under test reads |
| Act once | One expensive act per distinct input, every assertion on that one result |
| Cheapest proof | A configuration query over a full run, one batched tool run, no suite run only to count it, one real end-to-end case |
| Perishable values | A check re-deriving counts, line numbers or copied lists is a change detector (`craft:testing-principles` §2); one owner per value, copies checked by role |
| Zero cases | A run that executed nothing fails |
| Errors | Found, absent and could-not-look are three outcomes; the third fails |
| Skips | A skip states why; a missing capability is a named requirement |
| Findings | Every finding fails the check or reaches its report |
| Canary | Seen green once, and its red creates work a person sees |
| Nothing left | Timers cleared, process groups reaped, temp dirs removed; never force the exit |
| One check per file | Every tracked test file runs in exactly one check |
| Replays | A replayed command is targeted; the whole suite runs once, last |
| Wall clock | Gate on it only with a wide margin where nothing else loads the machine; elsewhere report it and gate on spawns or CPU |
| Deadlines | Every check has its own hang bound, above its slowest run under load, that kills its group and names it |
| Durations | Every report line carries its duration |
| Entry point | One entry for every check, local and CI; the canary only when named |
| Two modes | Parallel by default, well below the CPU count; sequential on demand; exclusive checks alone; same verdict |
