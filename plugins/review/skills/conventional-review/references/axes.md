# Review axes

Language-agnostic checklist for the own pass. Each axis lists what to look for on the changed
lines and the usual decoration. A convention skill loaded for the diff's language refines an
axis. Business fit (acceptance criteria, scope creep) is checked before the axes, in step 2 of
`SKILL.md`.

## 1. Quality (`quality`)

Readability, naming that misleads, needless complexity, magic values, missing or loose
types, inconsistency with the surrounding code, dead code the change introduces.
`non-blocking`.

## 2. Duplication (`duplication`)

Copied blocks (confirm with a targeted search on the repository, not only the diff),
repeated conditions, constants redefined instead of reused. `non-blocking`.

## 3. Design and architecture (`design`)

- **Boundaries**: a layer depending on one it must not see (domain on infrastructure,
  controller holding business rules, UI calling the database), a module reaching into another
  module's internals.
- **Responsibility**: logic placed where it does not belong, a class or function taking a
  second job, a rule duplicated across layers instead of owned by one.
- **Coupling**: a new dependency on a concrete class where the code already uses an
  abstraction, shared mutable state, an order of calls the caller must know.
- **Consistency**: a new pattern introduced where the codebase already has one for the same
  problem (a second HTTP client, a second way to map errors).
- **Contracts**: a public API, event, message or schema changed without its consumers, or in
  a way that breaks them (renamed field, narrowed type, removed value).

`blocking` for a contract broken for an existing consumer; `non-blocking` otherwise.

## 4. Over-engineering (`simplicity`)

Surface nobody asked for and nothing uses yet: an abstraction, interface or factory with a
single implementation and no second one in view, a generic parameter or configuration flag
with one value, a layer that only forwards calls, a backward-compatibility shim with no old
caller, a helper for a two-line operation used once, speculative extension points. Ask: *does
anything in this diff or the ticket need it today?* If not, the fix is to delete it.

`non-blocking`.

## 5. Conventions (`conventions`)

Rules written in the project (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING`, ADRs, linter
configuration the CI does not run) or, under the `own` scope only, in a convention skill
loaded for the diff (`SKILL.md`, step 0). A break is a
finding only when you can **cite the rule**: the file or skill and the rule itself. A taste
with no written rule is not a finding. What a formatter or linter already enforces in CI is not
a finding either.

`non-blocking`.

## 6. Error handling (`errors`)

Every external or system call (HTTP, database, cache, file, queue, identity provider, SDK,
subprocess) is covered: failure handled or propagated on purpose, timeout set, status checked,
error logged then rethrown or converted. Look for unawaited or unprotected async calls, empty
`catch` blocks, swallowed errors, errors converted to a success value.

Where the handling belongs: at the boundary that can act (command, controller, message
handler, client adapter), not in low-level methods. A repository read that lets the exception
propagate is correct: do not report it, unless its caller does not handle the error either;
then the finding targets the caller.

`blocking` when an error or its trace is lost; `non-blocking` for a missing timeout or retry policy.

## 7. Performance and load (`perf`)

- **Cost per call**: calls that could run in parallel, N+1 queries, I/O inside loops,
  unbounded queries, missing pagination, missing index on a new filter or join column.
- **Behaviour at volume**: a whole result set loaded in memory, a batch with no size limit, a
  synchronous call to a slow dependency on a hot path, missing cache where the read volume is
  known.
- **Concurrency**: read-then-write without a lock or a unique constraint, a counter or balance
  updated without atomicity, a message handler not idempotent though the queue redelivers, a
  retry with no backoff that multiplies load on a failing dependency, a scheduled job that can
  overlap with its previous run.

`blocking` for data corrupted or duplicated under concurrency; `non-blocking` when the cost is
measurable at real volume. Do not report a theoretical cost.

## 8. Security (`security`)

Inputs not validated or not bounded, injection (SQL, shell, template, path), authentication
on new entry points, authorization per object (one user reading or changing another user's
resource by changing an id), mass assignment of fields the caller must not set, secrets or
credentials committed in the diff, secrets or personal data in logs or responses,
non-constant-time secret comparison, SSRF, unsafe deserialization, permissive CORS, new
dependencies (known vulnerabilities, maintenance, licence).

`blocking` for an exploitable path or a committed secret (and recommend rotating it);
`non-blocking` for a missing bound.

## 9. Observability (`observability`)

Key actions traced: creation, update, cancellation, refused access, failed external call.
Structured logs, correct level, correlation id propagated, no sensitive data, errors logged
with their context. `blocking` when an error leaves no trace; `non-blocking` for a key action
with no log.

## 10. Tests (`tests`)

The behaviour the change adds is covered: nominal path, error paths, limits, empty input,
the regression that motivated a fix. Ask: *if this behaviour broke where it is used, would a
test fail?* Read the test before claiming it covers or misses something; prove an absence by
searching the symbol.

List, per file, the added methods, branches and error paths with no unit test, as `non-blocking`. Without a coverage report, write "coverage estimated,
not measured".

## 11. Change hygiene (`hygiene`)

Description matches the diff, ticket linked and consistent, branch up to date with its target,
reasonable size (suggest a split when unrelated concerns are mixed), commits that describe the
change. Written as `chore` or `note`.
