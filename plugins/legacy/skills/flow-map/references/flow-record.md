# The flow record

The grammar of one flow, and the normalization rules that make two projects'
records join. This file is the **contract between `flow-map` and
`flow-consolidate`** — a record that does not follow it still reads fine to a
human and silently fails to merge, which is the expensive failure.

## The record

````markdown
### FLOW-003 · OUT · amqp:exchange/pim_sync_products_to_sylius

- **Peer**: `sylius-back` (asserted, unconfirmed)
- **Technical**: AMQP publish, Symfony Messenger transport
  `sync_products_to_sylius`, serializer `AkeneoSyliusMessageSyncSerializer`,
  one message per product model.
- **Functional**: when a product becomes sellable, the catalogue pushes it to
  the e-commerce front so it can be ordered.
- **Contract**: `SyncProductToSyliusMessage` wrapping `AbstractProductDTO`
  normalized with group `push` — 14 fields, `code` is the shared identity.
- **Trigger**: Akeneo `POST_SAVE` storage event, bulk CLI `pim:sync_list-products`,
  and the pricing webhook (FLOW-007).
- **Failure**: no retry strategy on this transport; a rejected message lands in
  `failed` and nothing alerts.
- **Status**: live
- **Evidence**: read — `config/packages/messenger.yaml:88`,
  `src/Akeneo/SyliusSync/Service/ProductExportService.php:61`
````

`Peer` is one application id, or `?`. Anything else — a role, a guess, a list —
is a defect. When the peer is asserted from one side only, say so with
`(asserted, unconfirmed)`; `flow-consolidate` promotes it to `(confirmed)` when
the other side's map carries the matching row.

## The key

The headline is `### FLOW-<NNN> · <DIRECTION> · <key>`. `FLOW-<NNN>` is local to
the file and never travels; **the key is the join**, and two projects that
describe the same channel must produce byte-identical keys.

`OUT` = this application initiates, publishes or writes. `IN` = it receives,
serves or consumes. Direction is always from the mapped application's side.

### Normalization by transport

| Transport | Key | Owner-qualified? |
|---|---|---|
| AMQP / RabbitMQ | `amqp:exchange/<name>` · `amqp:queue/<name>` | no |
| Kafka | `kafka:topic/<name>` | no |
| SQS / Pub-Sub | `sqs:queue/<name>` · `pubsub:topic/<name>` | no |
| HTTP / REST | `http:<owner-app>:<METHOD> <path>` | **yes** |
| gRPC | `grpc:<owner-app>:<Service>/<Method>` | **yes** |
| GraphQL | `graphql:<owner-app>:<operation>` | **yes** |
| SQL | `sql:<owner-app>:<database>.<schema>.<table>` | **yes** |
| Object storage | `s3:<bucket>/<prefix>` | no |
| Mail | `smtp:<purpose>` (e.g. `smtp:user-notifications`) | no |
| File drop / SFTP | `file:<owner-app>:<path-or-storage>` | **yes** |
| Webhook out | `http:<owner-app>:POST <path>` — the *receiver* owns it | **yes** |

**Why some keys carry an owner and others do not.** A queue has one globally
unique name on one broker: publisher and consumer already say the same word. An
HTTP path, a table, a file path do not — `/health` and `products` exist in every
application in the estate. So the key names the application that **owns the
resource**: for an `OUT` HTTP call, the owner is the callee; for an `IN` route,
the owner is the mapped application itself. That single convention is what makes
`OUT http:service-pim:GET /api/rest/v1/products` from one project join
`IN http:service-pim:GET /api/rest/v1/products` from another.

### Rules that apply to every key

- **Lowercase the scheme and the application id; never lowercase the address.**
  Queue and table names are case-sensitive in the systems that own them.
- **Never put an environment hostname in a key.** `pim.staging.corp` and
  `pim.pwbs.docker` are the same application; the key carries the application id
  and the record's Technical line carries the hostname actually read.
- **Template path variables** as `{id}`, `{code}`, `{uuid}` — never a sample
  value. `GET /products/42` and `GET /products/{id}` are the same flow.
- **Strip the query string** from the key; describe it on the Technical line.
  Filters vary per caller and would shatter one flow into twenty.
- **One key per resource, not per operation**, unless the operations differ
  functionally. `GET` and `POST` on the same path are two flows when one reads
  and the other creates; a `PUT`/`PATCH` pair that both update is one.
- **Version in the path stays in the key.** `/api/v1/x` and `/api/v2/x` are two
  flows, and the fact that both are live is usually a finding.

## Status

| Status | Means | What proves it |
|---|---|---|
| `live` | The channel carries traffic | Runtime evidence: a log line, a broker binding, a non-zero counter, a row |
| `declared` | Wired in code or config, traffic never observed | Code anchor only — the honest default when no environment is reachable |
| `dead` | Configured but provably cannot run | The proof of absence: no client library installed, the flag is off, the consumer daemon does not exist, the credentials point at an emulator |
| `suspected` | Traces of a channel with no wiring found | Named so a human confirms or deletes it — never merged into `declared` |

`dead` demands the evidence of absence, spelled out. Absence of evidence is
`declared`, and the difference between the two is exactly the difference between
a finding and a guess.

## Evidence and nature

The three natures of `legacy:discovery` apply unchanged, and one record may carry
several lines:

- `measured — <command>` — a tool produced it (a broker binding list, an access
  log count, a route dump). Refuted by re-running the command.
- `read — path:line` — recovered by reading code or configuration. Refuted by
  opening the anchor and disagreeing.
- `judged — <criterion>, signed <owner>` — an assessment. Belongs in the
  context-map section, essentially never in a flow record.

A record whose Status is `live` on a `read` evidence line is a contradiction:
code proves intent, not traffic. Either attach the runtime evidence or drop the
status back to `declared`.

## Unknowns

````markdown
### FU-002 — Who publishes on `import_sync_products_to_pim`?

- **Flow**: FLOW-011 (`IN · amqp:queue/import_sync_products_to_pim`)
- **Why the code cannot say**: a consumer holds no record of its publishers.
- **Probably knows**: the upstream product feed — application id unknown, start
  with the team that owns the product master.
- **Resolves with**: `rabbitmqctl list_bindings | grep import_sync_products_to_pim`
  on any environment, or a matching `OUT` record in another project's `flows.md`.
- **Blocks**: the Relation cell for this counterparty in §3, and whether the
  retry/DLQ policy matches the sender's expectations.
````

`Probably knows` is what makes an unknown resolvable by `flow-consolidate`
instead of by a meeting. Name an application id when you can guess one — a wrong
guess here is harmless, because consolidation joins on the flow key, not on this
line, and it is the only field in the whole format allowed to speculate.

## A malformed record, and what each defect costs

````markdown
### FLOW-009 · OUT · https://pricing.dev.corp/Pricing/rest/pricing/product-prices?codes=ABC

- **Peer**: the pricing team
- **Technical**: we call the pricing API
- **Status**: live
- **Evidence**: `PricingClient.php`
````

Five defects, each fatal to a different reader:

1. The key carries a hostname, a query string and no owner id — it will never
   join the pricing team's own map, and consolidation will report a false unknown
   on both sides.
2. `the pricing team` is an organisation, not an application id. Applications
   join; teams do not.
3. No functional line: nobody outside the code can tell what breaks if the flow
   stops.
4. No contract and no failure mode: the two lines the other team actually needs.
5. `live` on an evidence line with no command and no line number — a status that
   claims runtime knowledge from a file name.
