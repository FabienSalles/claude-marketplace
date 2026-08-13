# ADR-0003: The gate spawns commands it does not trust

## Status

- **Status**: Accepted
- **Date**: 2026-08-13
- **Authors**: FabienSalles

## Context

Every command a plan declares — a `gate1`, a `dod2` — is written by whoever froze the plan, and
run unattended, on a machine nobody is watching. `bounded.ts` sits between the gate and every
such command. Two incidents shaped what it enforces:

- A recursion in a test wrapper spawned itself without bound and leaked 114 056 fixtures before
  pegging the machine through a reboot. Nothing had told the gate how many processes a declared
  command was allowed to hold open.
- The run's own state — the JSONL path, later the ticked set — reached a declared command through
  `GOAL_RUN_*` environment variables, because the gate's own process environment was passed
  through unfiltered. A suite a plan declares spawns gates of its own, and each leaked variable
  put that nested gate red on the first run that carried it.

Both incidents share a shape: the gate assumed a declared command would behave, and a declared
command did not.

## Decision

**The gate spawns commands it does not trust.** Every guarantee a declared command needs to
respect is enforced by the operating system, not requested of the command: `ulimit -u` caps the
processes it may hold open, a wall clock kills it with `SIGKILL` rather than the `SIGTERM` a hung
process is already ignoring, and its environment is stripped of every `GOAL_RUN_*` variable
before it is spawned. None of the three is a convention the command could opt out of by ignoring
it.

## Consequences

### Positive

- **A misbehaving command cannot take the machine down with it.** The process ceiling is a hard
  limit, not a request, and cannot be raised back once inherited.
- **A hung command cannot hang the gate.** The wall clock's kill signal is the one a stuck process
  cannot ignore.
- **A declared command cannot observe or influence the run that is judging it**, because the state
  that would let it never reaches its environment.

### Negative

- **The ceiling is a bash extension.** `ulimit -u` fails on a shell that does not support it, so
  the probe that decides whether to emit it costs a process on first use.
- **A grandchild the command forks and detaches from it is outside the process group the wall
  clock kills**, and survives past the timeout. That gap is scope, not a defect this decision
  closes.

## Alternatives considered

### Option 1: trust the plan's authors to write well-behaved commands

- **Advantages**: nothing to build.
- **Reason for rejection**: both incidents above were written by the same authors this option
  would have to trust, and neither behaved. A boundary that only holds when nothing goes wrong is
  not a boundary.

## References

- [`0001-shape-of-the-autonomous-loop.md`](0001-shape-of-the-autonomous-loop.md): the layer this
  boundary sits inside
