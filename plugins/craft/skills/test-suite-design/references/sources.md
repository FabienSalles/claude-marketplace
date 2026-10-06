# Sources

The general source behind each section of `SKILL.md`. The cases the skill quotes as its **Why** lines were measured on this marketplace's own suites and CI runs; the sources below are what makes each rule hold beyond it.

| § | Source | What it says, as used here |
|---|---|---|
| 1 | [Google Testing Blog, *Test Sizes*](https://testing.googleblog.com/2010/12/test-sizes.html) | Small: no network, filesystem, threads or sleeps, 60 s. Medium: network to localhost only, external systems discouraged, 300 s. Large: everything allowed, 900 s or more. Fixed definitions let the tests police their own limits. |
| 1 | [*Software Engineering at Google*, ch. 11](https://abseil.io/resources/swe-book/html/ch11.html) | All tests should strive to be hermetic: a test holds everything it needs to set up, execute and tear down its environment. |
| 1 | [*Software Engineering at Google*, ch. 14](https://abseil.io/resources/swe-book/html/ch14.html) | Large tests are nonhermetic, nondeterministic and flakier, and run after submission. The skill keeps a pinned network check on every pull request anyway, and names its residual risk: an outage still turns it red. |
| 1 | [Bazel, *Test encyclopedia*](https://bazel.build/reference/test-encyclopedia) | A test accesses only the resources it declares a dependency on; HOME points into the test's temp dir and TZ is UTC; sizes map to default timeouts of 60, 300, 900 and 3600 s. |
| 1 | [Martin Fowler, *ContractTest*](https://martinfowler.com/bliki/ContractTest.html) | Tests against an external service follow that service's rhythm of change, often once a day, and a failure should trigger a task. |
| 1 | [Google Research, *State of Mutation Testing at Google*](https://research.google/pubs/state-of-mutation-testing-at-google/) | Mutation testing runs incrementally, mutating only changed code during code review. |
| 2 | [*Command Line Applications in Rust*, Testing](https://rust-cli.github.io/book/tutorial/testing.html) | Integration tests cover every type of behaviour a user can observe; unit tests cover the edge cases. |
| 2 | [Martin Fowler, *The Practical Test Pyramid*](https://martinfowler.com/articles/practical-test-pyramid.html) | Push tests as far down the pyramid as they can go. |
| 3 | [xUnit Test Patterns, *Shared Fixture*](http://xunitpatterns.com/Shared%20Fixture.html) | Immutable Shared Fixture: share what no test modifies, and build fresh what tests modify. |
| 3 | [bats-core, *Writing tests*](https://bats-core.readthedocs.io/en/stable/writing-tests.html) | `setup_file` runs once per file and `setup` once per test, each with its own temp directory. |
| 3 | [Apple Developer Forums, thread 133358](https://developer.apple.com/forums/thread/133358) | macOS runs a security assessment the first time a new executable, a shell script included, is launched. |
| 4 | [ESLint, *Node.js API*](https://eslint.org/docs/latest/integrate/nodejs-api) | One call lints many files and returns one result per file. |
| 5 | [Google Testing on the Toilet, *Change-Detector Tests*](https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html) | A change detector breaks on any change to the code without verifying behaviour, and provides negative value. |
| 6 | [TAP version 14](https://testanything.org/tap-version-14-specification.html) | The plan checks that a test file has not stopped prematurely, and a stream lacking a plan is a failed test. |
| 6 | [POSIX `grep`](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/grep.html) | Exit 0: lines selected; 1: none selected; above 1: an error. |
| 6 | [Google Testing Blog, *Flaky Tests at Google*](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html) | People ignore alarms that have a history of false signals. |
| 6 | [GitHub Docs, *Notifications for workflow runs*](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs) | A scheduled run notifies only the user who created the workflow, last edited its cron, or re-enabled it. |
| 7 | [Node.js, *Test runner execution model*](https://nodejs.org/docs/latest-v24.x/api/test.html#test-runner-execution-model) | One runner as an example: each test file is a child process that ends only when its event loop is empty, and results are reported without waiting for leftover work. |
| 8 | [*Software Engineering at Google*, ch. 11](https://abseil.io/resources/swe-book/html/ch11.html) | As the number of tests grows, so does the number of flakes, so a suite run twice doubles its flake exposure. |
| 9 | [Martin Fowler, *The Rise of Test Impact Analysis*](https://martinfowler.com/articles/rise-test-impact-analysis.html) | Tests are not infinitely fast, so their cost is balanced against their value when choosing what runs. |
| 10 | [pythonspeed, *Consistent benchmarking in CI*](https://pythonspeed.com/articles/consistent-benchmarking-in-ci) | The same code times differently across shared CI machines, while instruction counts barely move. A hosted runner is such a machine. |
| 10 | [GitHub Docs, `timeout-minutes`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes) | A job's default timeout is 360 minutes. |
| 11 | [Node.js CLI, `--test-concurrency`](https://nodejs.org/docs/latest-v24.x/api/cli.html#--test-concurrency) | One runner as an example: concurrency defaults to the available parallelism minus one, counting files, not the processes each file spawns. A bound on checks has the same blind spot. |
| 11 | [bats-core, *Usage*](https://bats-core.readthedocs.io/en/stable/usage.html) | Tests that depend on each other are a hazard once they run in parallel. |
