# Cleanup — closing the loop after the slice is live

Additive delivery leaves a system that carries both the old and the new path. That is the
price of shipping safely, and it is only a good deal if the debt is repaid. The cleanup
slice is where the delivery strategy stops being a net addition of complexity.

Cleanup that lives as an intention never happens. Cleanup that lives as a **slice in the
plan, with a trigger and a proof**, happens.

## 1. Prove the old path is dead before deleting it

Deleting on the assumption that nothing uses it is how you find the caller in production.
Get evidence first — the technique depends on what you are removing:

| Removing | Evidence that it is dead |
|---|---|
| a code branch behind a flag | the flag has been at its final value for the agreed window, with no incidents |
| an old column | a log/counter on every read of it, sitting at zero for the window; and no query in the codebase |
| an endpoint or an API version | access logs at zero for the window, across every consumer (including the ones you don't own) |
| an event type | no consumer subscribed, and no replay depends on it |
| a compat shim / tolerant-reader fallback | a counter on the fallback branch at zero |

**Add the counter or log line in the slice that introduces the new path**, not in the
cleanup slice. Waiting until cleanup means starting the observation window from zero when
you thought you were finishing.

For a parallel run, the evidence is stronger and simpler: the difference count between
old and new results is zero over the window.

## 2. Deletion order

Remove in the reverse order of introduction, so the system is coherent after each step:

1. **The flag read** — the branch collapses to the winning behaviour.
2. **The losing implementation** and everything only it used (classes, templates,
   queries, translations, fixtures, tests).
3. **The flag itself** — config entry, platform entry, documentation row.
4. **The data-layer leftovers** — stop writing the old column, then drop it. Always last:
   a schema drop is the one step with no cheap rollback.

Doing 4 before 2 leaves code writing to a column that no longer exists. It happens.

## 3. What people forget to delete

The flag branch is the obvious part. The rest is what makes cleanup a real diff:

- the old implementation class **and its tests**
- the "flag off" tests (the "flag on" ones become the normal tests, unflagged)
- fixtures, factories and seeds for the old shape
- dead translation keys, templates, CSS, JS entry points
- the dual-write code and the backfill script
- the compat shim, the tolerant-reader fallback and its counter
- the deprecated endpoint, its route, its docs and its client code
- the observability you added purely to watch the migration
- the flag's entry in whatever documents flags

A `grep` on the flag name returning nothing is the minimum bar, not the proof.

## 4. The cleanup slice, written down

Put it in the plan as a normal iteration, at the end, so it is visible and estimable:

```markdown
### Iteration N — Cleanup: remove the `new_pricing` flag and the legacy path
- [ ] Not done yet
- **Trigger:** flag at 100% since <date>, zero errors on the new path, zero reads
  logged on `price_ht` for 7 days
- **Goal:** one pricing implementation, no flag, no legacy column
- **Files to touch:** `src/Pricing/*`, `config/flags.yaml`, `migrations/…`, tests
- **Delete:** flag + config entry · `LegacyPricingCalculator` + its tests · the
  "flag off" test cases · the `price_ht` column · the read counter
- **Acceptance criteria (command-line):**
  - `grep -r new_pricing src config` returns nothing
  - `<test command>` exits 0
  - `<lint/QA command>` exits 0
  - the migration applies and rolls back cleanly on a copy of prod-like data
```

The trigger is the part that makes it honest: it says what has to be **true in
production**, not merely what has to be coded. Until the trigger holds, the slice is not
startable — and that is fine.

## 5. Sequencing cleanup relative to the run

**Manual mode** — the cleanup slice sits at the end of the plan. Start it when the
trigger holds, which may be days after the last feature slice. Doing it in the same
sitting as the flip is premature: the flag is your rollback and you just used it.

**Auto mode** (an agent runs the plan unattended) — cleanup does **not** belong in the autonomous run at all,
except when the flag was never enabled in production (a pure in-repo migration, or a
change that never shipped). Otherwise the trigger depends on production evidence the
agent cannot observe, and an unattended run would delete the rollback path of a change
nobody has validated. Put cleanup in a **follow-up plan**, created when the trigger
holds.

The same logic applies to any slice whose precondition is "it behaved well in prod": an
autonomous run can build it, but it cannot decide the precondition is met.

## 6. When cleanup keeps getting postponed

If several flags are outliving their window, the cause is usually one of:

- **no trigger was written** — cleanup has no start condition, so it never starts
- **no evidence was instrumented** — nobody can prove the old path is dead, so nobody
  dares
- **the flag changed type** — it became ops or permissioning configuration. Then it is
  not debt; document the promotion and take it off the list.
- **the change was never actually rolled out** — the real problem is upstream, and
  deleting the old path would be deleting the only working one.

Naming which of the four applies is more useful than a reminder to clean up.
