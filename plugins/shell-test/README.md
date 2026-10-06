# shell-test

Bash test suites and Claude Code hook tests: one sourced harness, hermetic cases, exit-code and channel assertions, suites that cannot pass on nothing.

## Install

```text
/plugin install shell-test@fabien-claude-marketplace
```

## Skills (1)

| Skill | Purpose |
|---|---|
| [`shell-test-conventions`](skills/shell-test-conventions/SKILL.md) | The sourced harness and its API, hermetic cases, hooks run through their `hooks.json` routing, stdout and stderr asserted apart, literal `grep` and its exit statuses, one row per pattern with near misses, fake binaries as spies, suites that refuse a run of zero cases |

## The harness

[`references/harness.sh`](skills/shell-test-conventions/references/harness.sh) is the one harness every plugin suite of this marketplace sources (`plugins/*/tests/test*.sh`), as a sibling plugin: it has to stay at `plugins/shell-test`. It needs bash 3.2 or later and jq 1.5 or later, and stops a suite with a message when jq is missing. Another repository copies the file next to its own suites.
