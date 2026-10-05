# Context-map patterns: evidence → pattern → consequence

The DDD context-map vocabulary is small and routinely misapplied, because the
names describe **the relationship between two teams and two models**, not the
technology of the pipe between them. REST is not a pattern. A queue is not a
pattern. What makes a relationship Conformist or Customer/Supplier is who
absorbs the change when the other side moves.

Pick the pattern from observable facts in this table, cite `craft:ddd-principles`
as the criterion, and attach the person who signs the judgement.

## The table

| If you observe… | Pattern | Consequence to write |
|---|---|---|
| This side translates the peer's model into its own at the boundary — a dedicated translation layer, not a deserializer | **Anticorruption Layer** | The peer can change shape without reaching the domain; the ACL is the maintenance cost, and the test that pins it is the real asset |
| The peer's payload flows into the domain unchanged — arrays, raw DTOs, the peer's field names in entities | **Conformist** | Every upstream change is an emergency here; the cheapest fix is an ACL at the single point where the payload enters |
| A stable, documented, versioned interface serving several unknown consumers | **Open Host Service** | Cannot be changed unilaterally, and cannot be tested against consumers who are not enumerated — the consumer list is the missing asset |
| A shared, explicit format both sides agree on: a schema, an event contract, an IDL | **Published Language** | The contract is the deliverable; a change is a negotiation, and the format's own version is what makes it possible |
| Two applications reading and writing the same tables | **Shared Kernel**, degenerate — usually a **Shared Database** anti-pattern | No contract, no versioning, no test can catch a break; a migration on one side is an outage on the other. The highest-severity row a flow map produces |
| Downstream needs something, upstream plans for it, there is a shared roadmap | **Customer/Supplier** | Works only while the planning link exists; when it lapses the relationship silently becomes Conformist |
| Both sides change together, coordinated, succeeding or failing as one | **Partnership** | Cheap while the teams talk, and the first casualty of a reorganisation |
| A dependency reduced to nothing, each side solving the problem alone | **Separate Ways** | Duplication is the deliberate price; the finding is when it was not deliberate |
| The peer is bought or vendored, its model is imposed, adaptation is one-way | **Conformist**, and name the vendor | Upgrades are the risk event; the patches and overrides applied to the vendor are the debt |
| An unstructured peer with no consistent model, integration by special case | **Big Ball of Mud** upstream | Isolate behind an ACL and never let its shapes spread |

## Patterns most often misnamed

- **"We use an ACL" for a deserializer.** Mapping JSON into a class is not
  translation; it is transport. It is an ACL when the peer's *concepts* are
  translated into this domain's concepts — different names, different
  granularity, invariants enforced at the boundary. Test: if the upstream renames
  a field, does anything outside the boundary class change? If yes, no ACL.
- **"Partnership" for two teams that merely talk.** Partnership means the two
  models change together with shared success. Two teams in the same chat channel
  with independent release trains are Customer/Supplier at best.
- **"Open Host Service" for any REST API.** OHS is a *commitment*: stability for
  consumers you do not control. An internal API with one known caller that you
  change at will is not OHS — it is Customer/Supplier with one customer.
- **"Shared Kernel" for a shared database.** A Shared Kernel is a deliberately
  shared, jointly owned *model* with a joint change protocol. Two services in one
  schema with no protocol is the anti-pattern, and calling it a kernel dignifies
  it. Write what it is.

## What a single-sided map may conclude

A flow map built from one repository sees one half of every relationship. Half
the patterns are observable from one side, half are not, and stating which is
which is what lets `flow-consolidate` do its job.

**Observable from this side alone:**

- Whether *this* side has an ACL, and whether it is real.
- Whether this side conforms — the peer's shapes are in the domain or they are not.
- Whether an interface this side publishes is versioned, documented, stable.
- The failure mode of every flow this side initiates.

**Not observable from this side alone:**

- Whether the peer treats this side as a customer, or ignores it. `Customer/Supplier`
  and `Conformist` look identical from downstream until upstream is asked.
- Whether an interface this side publishes has one consumer or forty — the
  difference between Customer/Supplier and a genuine Open Host Service.
- Whether a "Partnership" is one, or one side believing it is.
- Whether a shared table is co-owned by protocol or written by two services that
  each think they own it.

So write the pattern **with its confirming condition attached**, as a half:

> Conformist — this side has no translation layer
> (`src/.../PricingClient.php:44` returns the peer's arrays into the domain).
> Whether the peer treats us as a customer is unknown (FU-004); if it does, the
> relationship is Customer/Supplier and the missing ACL is a choice rather than
> a defect.

That sentence merges. "Conformist." does not.

## Direction and power

Two axes decide most rows, and they are independent:

- **Direction of dependency** — who needs whom to function. Read it from the
  flows: an application that cannot serve its use case without a peer's response
  is downstream, whatever the network direction of the call.
- **Direction of power** — who absorbs the cost when the other moves. Read it
  from the code: the side holding the translation, the version negotiation, the
  compatibility shim, is the side paying.

Downstream with the power (the peer maintains compatibility for you) is
Customer/Supplier. Downstream without it is Conformist. Upstream without power —
you publish, they impose their needs, you adapt — is a supplier in name only, and
worth naming as the finding it is.
