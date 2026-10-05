# Merge rules

The join, step by step, with the cases that decide whether the consolidated map
is trustworthy. Everything here operates on records written to the grammar in
[`../../flow-map/references/flow-record.md`](../../flow-map/references/flow-record.md).

## The algorithm

1. **Load** every source `flows.md`. Record its application id, build date and
   counts before reading a single flow — a source whose date is far from the
   others is a suspect in every contradiction it participates in.
2. **Resolve application aliases** into canonical ids. Do this before key
   normalization: owner-qualified keys embed an application id, so an unresolved
   alias produces two keys for one resource and a false unknown on both sides.
3. **Normalize keys** per transport. Log every repair.
4. **Bucket** all records by key.
5. **Classify** each bucket (below).
6. **Reconcile contracts** within confirmed buckets (below).
7. **Close unknowns** whose flow key now has a record from another map.
8. **Emit** the six sections, then the per-project corrections.

## Key repair

Repair, and log the repair against the source that needs fixing:

| Defect | Repair | Why it must be logged |
|---|---|---|
| Hostname in the key | Replace with the owning application id | The source re-emits it every run |
| Query string present | Strip to the path | Would shatter one flow into one per caller |
| Literal path values (`/products/42`) | Template (`/products/{id}`) | The commonest cause of a false unknown |
| Missing owner on an owner-qualified transport | Infer: for `OUT`, the peer; for `IN`, the source application | Only inferable when the peer is named — otherwise the record cannot join and is reported unrepairable |
| Case difference in the scheme or app id | Lowercase both | — |
| Case difference in the address | **Do not touch** | Queue and table names are case-sensitive; a "repair" here invents a join |

A key that cannot be repaired without guessing stays unjoined and is listed in
§5 as an unknown against its own source map. Guessing a key to make a join
succeed manufactures exactly the false confidence the format exists to prevent.

## Classification

For a bucket of records sharing one key:

```
directions = the set of directions in the bucket
peers      = the set of peers named, ignoring '?'
sources    = the maps the records came from
```

- **confirmed** — one `OUT`, one `IN`, from two different sources, and each
  peer either names the other's application or is `?`. The strongest state the
  format produces.
- **resolved by join** — as above, with both peers `?`. The key alone closed
  two unknowns. Name both, cite both maps, mark both `FU-XXX` closed.
- **single-sided, peer mapped** — one record, its peer has its own map, and that
  map carries no matching record. **A contradiction, not a single-sided flow**:
  if B is mapped, B's map should have seen this channel. Three explanations, and
  the artifact must offer all three rather than pick: the flow is dead, the
  resource was renamed on one side, or B's map has a gap (most often the
  framework-configuration sweep B skipped).
- **single-sided, peer unmapped** — one record, no map exists for the peer. Not a
  contradiction: nothing could have corroborated it. The honest state, and the
  driver of the "map this application next" recommendation.
- **unclaimed** — the resource is owned by a **mapped** application and no mapped
  application claims the other end: an inbound route nobody says they call, an
  outbound channel nobody says they consume, a table nobody says they read. The
  door provably exists — its owner is mapped and its record carries the anchor —
  and the estate cannot name who walks through it. Its own section in the
  artifact, because it is neither an unknown that better mapping would close nor
  a flow that can be called dead.
- **single-sided, peer `?`** — one record, no peer named, and the resource's owner
  is **not** mapped, so nothing could have joined. Stays an unknown; more mapping
  is the fix.
- **contradiction** — everything else: same direction twice on a non-broadcast
  key, disagreeing peers, incompatible contracts, `live` against `dead`.

## Contract reconciliation

Only inside confirmed buckets, and it is where paper finds live bugs.

Compare the two sides' contract lines field by field:

- **Identical** — write once, cite both.
- **One side more detailed** — take the union, attribute each part. A producer
  usually knows the shape; a consumer usually knows which fields are actually
  read.
- **Producer sends a field no consumer reads** — record it. Dead payload is
  cheap information and often the residue of a removed feature.
- **Consumer reads a field no producer sends** — record it as a **contradiction**,
  not a note. Either the producer's map is incomplete or the consumer breaks on
  some inputs today.
- **Same field, different type or meaning** — the highest-value finding available
  to this skill. A code sent as a string and parsed as an integer, a date without
  a timezone on one side, an enum with a value the other side does not handle.
  Print both anchors.

Never merge two contracts into one prose sentence that hides the difference.

## Closing an unknown

An `FU-XXX` closes when a record from **another source map** joins its flow key.
Nothing else closes it: not a similar name, not a plausible system, not the
consolidating session's own inference.

The closure line carries source map, record id there, the peer now named, and
that record's evidence line — so a reader can re-verify the closure without this
file:

```markdown
- **FU-002 closed** — publisher is `product-master`.
  Source: `product-master/flows.md` · FLOW-014 · `OUT · amqp:queue/import_sync_products_to_pim`
  Evidence there: read — `src/Export/PimPublisher.php:88`
  Confidence: single assertion, no runtime evidence on either side.
```

Note the last line. A join between two `read` records proves both teams *believe*
the channel exists — strong, and still not proof that it carries traffic. When
either side has `measured` evidence, say so; the estate's `live` statuses are
worth exactly what their evidence is worth.

## Unclaimed channels: what full coverage still cannot prove

A flow with no counterparty among the mapped applications yields exactly one
sentence: **"no counterparty among the mapped applications"**, with the mapped
set named. Not "unused", not "dead", not "candidate for removal".

This holds **even when every project has been mapped**, and that is the sentence
to internalise. "Every project" means every project someone had access to. The
estate that exists is larger than the estate that can be read: a subsidiary's
repository nobody can clone, a partner's system, a subcontractor's integration, a
gateway that forwards without appearing in anyone's code. Coverage measured at
100% of the reachable perimeter is not 100% of the callers, and no amount of
mapping converts one into the other.

So unclaimed channels are not the residue of an incomplete job — they are a
**standing category of the artifact**, listed by name every run. They deserve
their own section for a reason beyond bookkeeping: a channel nobody claims is a
channel nobody tests, nobody versions, nobody notices being abused, and nobody
dares switch off. It is simultaneously a documentation gap, a lifecycle debt and
an attack surface, and it is invisible in every per-project map because each map
sees only the door, never the visitor.

### Why a caller can be invisible

Offer the list rather than a verdict, because it converts an unknown into a
checklist someone can work through in an afternoon:

- A repository outside the mapping perimeter — another business unit, a partner,
  a subcontractor, an acquisition.
- A third-party or SaaS integration configured in a console, not in code.
- An operator's script, a cron on a server, a runbook step, a scheduled report.
- A decommissioned system whose credentials still work and whose calls still land.
- Monitoring, a synthetic probe, a scanner, a load balancer's health check.
- An internal consumer reaching it through a gateway that hides the true origin.
- Nobody at all — the channel outlived its consumer and no one noticed.

The last item is one hypothesis among seven, never the default reading.

### What would settle it

Only runtime evidence, and the artifact names the instrument per channel rather
than sending the reader to a meeting: the access log for an HTTP route, the
broker's binding and consumer list for a queue, the credentials or connection
table for an API, the egress log for an outbound call, the gateway's per-route
statistics.

Two outcomes, and the second is the valuable one: the instrument names a caller
and the channel leaves this section, or it shows **no traffic over a stated
window**, which is the only evidence that supports decommissioning. Write the
window — "no request in 90 days of retained logs" is actionable and refutable;
"appears unused" is neither.

The one flow genuinely safe to call dead remains the one with a proof of absence
at its own end — the library is not installed, the flag is off, the consumer
process does not exist — and that proof lives in the source map's `dead` status,
never in this file's silence.

## Re-running

The second consolidation should be a diff, not a rebuild.

- Keep the alias table and the key repairs in the artifact; both are inputs to
  the next run.
- Report per section: flows added, removed, changed status, changed pattern.
- **A flow that disappears from a source map is a finding, not a deletion.**
  Either it was removed from the code — the fact the estate most needs to know —
  or the map's sweep got narrower. Ask which.
- A pattern that changed states what evidence changed it, or it is a mistake.
- An unknown closed in the previous run that reopens means a source map lost a
  record. Chase it before publishing.
