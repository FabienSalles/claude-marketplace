---
name: node-test-conventions
description: "ACTIVATE when writing, reviewing or test-driving a test file that imports 'node:test', or a new test file in a package whose test script runs `node --test`. ACTIVATE for 'node:test', 'node --test', 'node:assert', 'mock.fn', 'mock.method', 'mock.module', 'mock.timers', 'describe/it from node:test', '--test-isolation', '--test-concurrency', '--test-force-exit', '--test-reporter'. Provides node:test runner idioms and runner mechanics; cross-language testing principles live in craft:testing-principles. DO NOT use for: Vitest or Jest files (see vitest:vitest-test-conventions), PHP/PHPUnit tests (see phpunit:php-test-conventions), TDD iteration workflow (see craft:tdd-workflow-principles)."
---

# Test Conventions — node:test

> The **cross-language testing principles** (DAMP, AAA, what NOT to test, factories, structured assertions) are defined in `craft:testing-principles`. This skill keeps the node:test runner idioms.

Examples that run: `references/examples.test.ts` (`node --test --experimental-test-module-mocks references/examples.test.ts`).

## Which runner guidance applies

- A file that imports `node:test` follows this skill. A file that imports `vitest` or Jest follows its own runner's skill. In a mixed project, an existing test file follows the runner it imports.
- A new test file follows the runner of the package whose test script will execute it (`node --test` means this skill).
- Never both runners' guidance on one file, and never migrate a file from one runner to the other unless asked.
- TypeScript project with no test runner yet: ask which runner before writing the test, proposing node:test as the zero-install option. Claude installs or configures nothing, and leaves `package.json` untouched, until the answer.

## Declaring tests

```typescript
import { describe, it, test } from 'node:test';

test('a standalone test', () => {});

describe('Receipt', () => {
  it('rejects a negative amount', () => {});
});
```

### One test per case (counterpart of `it.each`)

node:test has no `it.each`. Declare one test per case in a loop, the case data in the title:

```typescript
const cases = [
  { input: 1, expected: 2 },
  { input: 2, expected: 4 },
];

for (const { input, expected } of cases) {
  it(`doubles ${String(input)} into ${String(expected)}`, () => {
    assert.strictEqual(double(input), expected);
  });
}
```

## Assertions — `node:assert/strict`

One assertion vocabulary per file: under node:test it is `node:assert`, imported as `import assert from 'node:assert/strict'`.

| Need | Idiom |
|---|---|
| Primitive equality | `assert.strictEqual(actual, expected)` |
| Structural equality | `assert.deepStrictEqual(actual, expected)` |
| Narrow a union before reading the payload | `assert.ok(result.tag === 'success')` (an assertion function, TypeScript narrows after it) |
| Sync exception | `assert.throws(() => fn(), { name: 'RangeError', message: /negative/ })` |
| Async exception | `await assert.rejects(fn(), { name: 'RangeError', message: /negative/ })` |

A throw test always names the error it expects (class or `name`, and message matcher); a bare `assert.throws(fn)` passes on any failure.

## Test doubles — same restriction, same tool

| Tool | Use | Restriction |
|---|---|---|
| `mock.fn()` | Spy on a callback or a standalone function | A port is never doubled with `mock.fn`; give it an in-memory stub that is its own spy |
| `mock.method(obj, 'name')` | Wrap one method of a real object, the rest stays real | Same: never to double a port |
| `mock.timers` | Control time | Time is injected (a `clock` parameter); use `mock.timers` only for a clock that cannot be injected |
| `mock.module()` | Replace an imported module | Use `mock.module` only to redirect a singleton that cannot be injected |

`mock.module` needs the flag `--experimental-test-module-mocks` on Node 24 (without it: `TypeError: mock.module is not a function`). Restore mocks with `mock.restoreAll()` or the context `t.mock`, which restores itself at the end of the test.

## Characterization pin

Before changing behaviour no test pins, freeze the inputs and compare today's output, quirks included, to a committed golden file. The order, the gates and the retirement rules live in `craft:testing-principles` §16.

```typescript
it('keeps today\'s summaries, quirk included', () => {
  const frozen = [summarize('R-1', [10, 2.5, 0]), summarize('R-0', [])];
  const golden = readFileSync(new URL('./receipt-summary.golden.txt', import.meta.url), 'utf8');

  assert.strictEqual(`${frozen.join('\n')}\n`, golden);
});
```

The golden file is plain text read with `node:fs`: no snapshot API. The choice is deliberate: with `serializers: [String]`, `t.assert.fileSnapshot` would store the same plain file, but its `--test-update-snapshots` flag rewrites every snapshot the selected tests touch, while a net only ever changes the cases a change names (§16).

## Running the suite

```bash
node --test                      # discovers **/*.test.* files
node --test --experimental-test-module-mocks   # when a test uses mock.module
```

TypeScript runs by type stripping (Node 24, no build step): use `.ts` import specifiers and erasable syntax only (no `enum`, no constructor parameter properties).

## Runner mechanics

How `node --test` runs a file decides what a test may leave behind and what a timeout can stop. The rules these mechanics serve (leave nothing behind, act once, own every file and config a test touches) are `craft:test-suite-design`'s; this section keeps how node:test meets them.

- **What keeps a file alive.** Under the default process isolation each file is one process, which ends only when its event loop is empty: a pending timer or a live child keeps it running after its last test, and the runner waits for it. Clear or `unref()` a deadline timer once its race is decided; `references/examples.test.ts` checks it with `process.getActiveResourcesInfo()`. `--test-force-exit` ends the file anyway and hides the leak, orphaned children included.
- **A test timeout cannot stop synchronous code.** Under `{ timeout: 500 }`, a test blocked 3 s in `spawnSync` is reported as passing. Bound a sync spawn with its own `timeout` option, or spawn asynchronously with `signal: t.signal`. Either kills only the direct child: spawn a forking child asynchronously with `detached: true` and kill its group with `process.kill(-child.pid)`.
- **A cancelled test keeps running.** `--test-timeout` (no limit by default) reports the test as cancelled, but its pending work runs on into the next test. Keep every helper's own deadline shorter than the runner's timeout.
- **A file that declares no test passes.** `node --test` reports it as one passing test named after the file, so a pass count above zero does not prove that every file declared a test.
- **Files run in parallel, tests in a file by default do not.** One process per file, `os.availableParallelism() - 1` files at a time (3 on a 4-vCPU runner), and `--test-concurrency` counts files, not the processes they spawn. Inside a file, tests run one after another unless a `describe('…', { concurrency: N })` lets them overlap: worth it only for independent tests whose spawns are asynchronous and bound to `t.signal`, since `spawnSync` blocks the event loop.
- **`--test-isolation=none` is not the same suite in one process.** It ignores `--test-concurrency`, runs top-level tests one at a time, and attaches each file's top-level hooks to the shared root: a top-level `beforeEach` runs before the tests of every file. Keep it for pure in-process files, wrap per-file hooks in `describe()`, and leave out any file that changes `process.cwd()`, `process.env` or `process.exit`, or cleans up on the process `exit` event.
- **One expensive act, several readers.** When one test can carry every assertion, prefer it (`craft:testing-principles` §15 allows several per test). When each facet of one spawned run or one install needs its own test name, run the act once in a `before()` inside a `describe()` and make each test a read-only check of the result: the exception `craft:test-suite-design` §3 makes to the per-test Arrange-Act-Assert of `craft:testing-principles` §4. A test that needs another input builds its own fixture. Cleanup goes in `after()`, which runs even when a test fails.
- **Hermetic environment for git and spawned programs.** Build one environment and pass it to every git command and every program under test: `GIT_CONFIG_GLOBAL=/dev/null` (Git 2.32+) and `GIT_CONFIG_NOSYSTEM=1`, author and committer from `GIT_AUTHOR_*` and `GIT_COMMITTER_*`, `maintenance.auto=false` (`GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=maintenance.auto`, `GIT_CONFIG_VALUE_0=false`, Git 2.31+), `-b main` on every `git init`, and `HOME` in a per-run temp directory. Otherwise the developer's config leaks in (default branch, excludes file, credential helpers), and every commit starts a detached `git maintenance run --auto` (in the background since Git 2.47) that races the fixture's copy or deletion.
- **Fake executables are written once.** Write each fake binary once per run and link it into each fixture's `PATH` directory: a freshly written executable pays macOS's first-exec scan (`mac:mac-platform`). Remove the link before a test replaces a fake, or the write goes through it into the shared file.
- **Reporter text is not an API.** Node documents built-in reporter output as subject to change between versions. Read counts, skips and durations from the TestsStream events (`test:summary`, `test:pass`, `test:fail`) through a custom reporter added next to `spec` (a second `--test-reporter`/`--test-reporter-destination` pair), or through `run()`, which runs one file at a time unless given `concurrency`. A regex over `spec` output also misses what it does not name: a test stopped by `--test-timeout` shows `ℹ cancelled 1` with `ℹ fail 0`, so read the exit code first. A check may still match a `spec` summary line (`ℹ pass N`) when it reads the exit code first and the Node version is pinned (an `.nvmrc` that CI reads), so the text cannot change under it without a diff.

## Quick Reference

| Situation | node:test idiom |
|---|---|
| Which runner | The one the file imports; a new file follows its package's test script |
| One test per case | A loop of `it()` with the case data in the title |
| Assertions | `node:assert/strict`; a throw test names the error it expects |
| Doubles | `mock.fn`/`mock.method` never on a port; `mock.timers` and `mock.module` only for what cannot be injected |
| Characterization pin | A plain golden file read with `node:fs` |
| Deadline timer | Cleared or `unref()`ed once the race is decided; never `--test-force-exit` |
| Synchronous spawn | Its own `timeout` option, or async with `t.signal`; kill the group of a forking child |
| Test timeout | Longer than every helper's deadline: a cancelled test's work keeps running |
| File without a test | Counts as a passing test |
| Parallelism | One process per file, `availableParallelism() - 1` files at once, tests in a file in sequence unless `describe('…', { concurrency: N })` |
| `--test-isolation=none` | Pure in-process files only, per-file hooks inside `describe()` |
| Expensive act | One test with several assertions; once in `before()` inside `describe()` when each fact needs its own name |
| Git and spawned programs | One hermetic environment: no global or system config, `maintenance.auto=false`, `init -b`, temp `HOME` |
| Fake executables | Written once, linked per fixture, unlinked before a replacement |
| Counts and durations | Exit code first; counts, skips and durations from TestsStream events |
