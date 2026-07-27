# Roadmap — what is not true yet

Everything in the other design notes describes what **shipped**. This file is the opposite: it
holds what is still moving, so a note written in the present tense never has to lie again.

That distinction is the whole point. The drift these notes suffered came from describing an
intention as if it were a mechanism: a separate test-author agent, a bash gate, a command-line
flag none of which were ever built. An item stays on this page until it is held by an exit
code, and then it moves into the note that describes the thing it now holds.

## Open, in priority order

### 1. Nothing exercises the launch path

`node --check` proves the workflow **parses**. It does not prove it **starts**. Three consecutive
defects reached a green branch that way: arguments arriving as a JSON string, agents addressed
without their plugin namespace, and a test wrapper reading its own summary through ANSI colours.

What would close it: a smoke run of the loop against a two-iteration throwaway plan, in a
temporary repository, asserting that it reaches the first gate. It cannot live in the gate's own
suite — the loop spawns agents, and the suite must stay a pure function of the filesystem.

### 2. A crash leaves the run lock held

The loop releases the lock on every exit path it controls. An uncaught throw is not one of them,
and it happened once: a run died mid-survey and left `<plan>.run.lock` behind. Recovery is
documented (`/goal:auto` preflight check 7, then `goal-gate.ts unlock`) and it worked, but a
documented recovery is prose. The mechanical form is a top-level guard that releases before it
rethrows.

### 3. The reader holds plain `Bash`

`goal-reader` should hold only `Bash(gh api …)`. The agent `tools:` field takes tool names, not
permission patterns, so the restriction is currently its brief — a hint, not a capability. The
mechanical form is a permission rule at the settings layer, which is a different surface from an
agent definition. Stated as a residual risk in `steering-and-injection.md`.

## Designed, deliberately not built

- **The blast-radius lens.** Required only under `no-bc-break`, and every plan run so far is
  `allow-bc-break`. Shipping a lens nobody exercises is how a catalogue becomes prose.
- **`retry-current` as a remote verb.** Listed as acceptable in `steering-and-injection.md` —
  a forged retry costs one iteration twice. It is not implemented because the loop has no retry
  at all, and a remote verb whose only job is to contradict "a halt is final" would be the first
  place that rule leaks.
- **Bounded escalation on infrastructure failures** (`loops.md`). The classes are named and the
  recovery budgets are written; nothing implements them. A retry policy that cannot name the
  class it recovers from is a token furnace, so this waits for a real failure to classify.

## Known cost, measured and unresolved

A slice's cost tracks the **number of files and gates it touches**, not the lines it writes: on
the first real run the most expensive iteration had the smallest diff. `max_diff` therefore
bounds the diff and not the cost, and there is no budget on the thing that actually varies.
Whether that needs a second bound, or just a note in the planning command, is open.
