---
name: node-test-conventions
description: "ACTIVATE when writing, reviewing or test-driving a test file that imports 'node:test', or a new test file in a package whose test script runs `node --test`. ACTIVATE for 'node:test', 'node --test', 'node:assert', 'mock.fn', 'mock.method', 'mock.module', 'mock.timers', 'describe/it from node:test'. Provides node:test runner idioms; cross-language testing principles live in craft:testing-principles. DO NOT use for: Vitest or Jest files (see vitest:vitest-test-conventions), PHP/PHPUnit tests (see phpunit:php-test-conventions), TDD iteration workflow (see craft:tdd-workflow-principles)."
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

## Running the suite

```bash
node --test                      # discovers **/*.test.* files
node --test --experimental-test-module-mocks   # when a test uses mock.module
```

TypeScript runs by type stripping (Node 24, no build step): use `.ts` import specifiers and erasable syntax only (no `enum`, no constructor parameter properties).
