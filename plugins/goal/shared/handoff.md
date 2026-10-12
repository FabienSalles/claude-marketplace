# Handoff routing shared by /goal:plan and /goal:next

`Policy:` and the gateability of the remaining iterations decide what to emit:

| `Policy:` | Iterations | Emit |
|---|---|---|
| `manual` | any | the per-iteration handoff **only** — `/goal:supervise` refuses `manual` |
| `commit+pr` | all gateable | the **`/goal:supervise <plan path>` line only** — no per-iteration block |
| `commit+pr` | one or more not gateable | the per-iteration handoff first, and name the iterations that block a clean autonomous run |

**Under `manual`, offer the clipboard before printing.** The counter file already holds
the exact block, so ask with `AskUserQuestion`: _"Copy the `/goal` handoff to the
clipboard?"_
