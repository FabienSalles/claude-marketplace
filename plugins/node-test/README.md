# node-test

node:test runner guidance: declaring tests, `node:assert`, mocks and timers, running TypeScript suites with `node --test`, and the runner mechanics that keep a suite fast and honest.

## Install

```text
/plugin install node-test@fabien-claude-marketplace
```

## Skills (1)

| Skill | Purpose |
|---|---|
| [`node-test-conventions`](skills/node-test-conventions/SKILL.md) | `test`/`describe`/`it`, one test per case in a loop, `node:assert` vocabulary, `mock.fn`/`mock.method`/`mock.module`/`mock.timers` with the same restrictions as their Vitest counterparts, mixed-project and no-runner rules, runner mechanics (handles that keep a file alive, timeouts against `spawnSync`, isolation and concurrency, one expensive act in `before()`, hermetic git, reporter events) |
