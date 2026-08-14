# ADR-0002: A pre-push scan judges committed content, not the working directory

## Status

- **Status**: Accepted
- **Date**: 2026-08-13
- **Authors**: FabienSalles

## Context

`goal-gate.ts scan` runs a secret scanner before anything is pushed. The scanner takes a mode:
`git`, which reads the branch's history, or `dir`, which reads every file on disk regardless of
whether it is tracked.

`dir` was tried first, on the reasoning that the working directory is a superset of what gets
pushed and a superset can only find more. It found more, and refused a push it should not have:
the run's own execution log is gitignored and rewritten on every iteration, and it held the
Supabase local demo anon key, a credential published as a default and identical on every
machine. The scan refused every push permanently, over content the push could never have
carried.

## Decision

**A pre-push scan judges committed content, not the working directory.** The scanner runs in
`git` mode: it reads the branch's commits, including one written several slices ago, and nothing
that is merely present on disk and not tracked.

## Consequences

### Positive

- **A finding always means the push would publish it.** There is no category of refusal the scan
  can produce that the push itself could not justify.
- **Gitignored content — logs, `.env`, local state — cannot block a push it was never going to
  carry**, which is exactly the failure mode that motivated the change.

### Negative

- **A secret committed and later deleted from the tree still refuses**, because it is still in
  history and the push still carries it. That is correct, not a gap: deleting a file does not
  unpublish an earlier commit, and the scan is right to keep refusing until the secret is
  rotated.
- **Nothing on disk but never committed is invisible to this scan.** A credential dropped in a
  tracked-but-unstaged file is caught at commit time by other guards, not by this one; this scan's
  scope is deliberately the branch that is about to be pushed, not the whole filesystem.

## Alternatives considered

### Option 1: scan the working directory (`dir` mode)

- **Advantages**: catches a secret before it is even committed; a wider net.
- **Reason for rejection**: the net is wider than what is being judged. A pre-push scan exists to
  answer "does this push publish a secret", and the working directory answers a different
  question. The incident above is the net catching something outside its own question and
  refusing over it.

## References

- [`0001-shape-of-the-autonomous-loop.md`](0001-shape-of-the-autonomous-loop.md): the layer this
  scan runs inside
