# Conventional Comments: the decoration is the criticality

Format from [conventionalcomments.org](https://conventionalcomments.org/):

```
<label> [decorations]: <subject>

[discussion]
```

The decoration says how critical a comment is; there is no separate priority. This skill puts
the blocking status first, then optionally the axis: `issue (blocking, security): ...`.

## Labels

| Label | Use it for | Decoration |
|---|---|---|
| `issue` | a problem the change introduces; always paired with a fix | `blocking`, `non-blocking` |
| `todo` | a small, mandatory change (missing guard, forgotten case) | `blocking` |
| `suggestion` | a concrete improvement, said explicitly with the reason | `non-blocking` |
| `nitpick` | a trivial, preference-level request | `non-blocking` |
| `question` | a doubt the reviewer cannot settle from the diff | any, until answered |
| `note` | information the author should know, no action expected | |
| `chore` | a process step before merge (rebase, ticket link, description) | |
| `praise` | something done well, specific; never generic | |
| `thought` | an idea for later, not for this change | |

## Decorations

| Decoration | Meaning |
|---|---|
| `blocking` | must be resolved before merge |
| `non-blocking` | should be addressed, does not hold the merge |

Extra decorations name the axis: `security`, `perf`, `tests`, `errors`, `observability`,
`duplication`, `quality`, `hygiene`.

## Template

````markdown
**<label> (<decoration>, <axis>): <subject>**

`<file>:<line>`, search for `<term>` in the diff view.

<Problem: one or two sentences, the concrete impact.>

**Proposed fix**
- <short bullet>

```<language>
<fixed code>
```

**Test**

```<language>
<test that pins the fix>
```
````

## Examples

````markdown
**issue (blocking, errors): the payment call can fail silently**

`src/checkout/pay.ts:42`, search for `await gateway.charge`.

`charge()` is awaited outside any `try`, and the caller `submitOrder` does not catch either:
a gateway timeout leaves the order `pending` with no log.

**Proposed fix**
- catch at the handler, log with the order id, mark the order `failed`

```ts
try {
  await gateway.charge(order);
} catch (error) {
  logger.error('payment failed', { orderId: order.id, error });
  await orders.markFailed(order.id);
  throw error;
}
```
````

````markdown
**suggestion (non-blocking, quality): name the retry limit**

`app/sync.py:18`, search for `range(5)`.

`5` is the retry budget; a named constant says so and is the single place to change it.

```python
MAX_SYNC_ATTEMPTS = 5
for attempt in range(MAX_SYNC_ATTEMPTS):
```
````

````markdown
**praise: the idempotency key closes the double-submit case**

`src/order/create.go:30`. The duplicate request now returns the first order instead of a
second charge, and the test covers it.
````

A `blocking` comment whose answer is out of the reviewer's reach adds the check that settles
it, through the project's own tools (here, a query on its database):

````markdown
**question (blocking, errors): can `customer_id` be null in production?**

`db/migrations/0042.sql:3`, search for `NOT NULL`.

If existing rows hold a null, the migration fails on deploy. To confirm:

```sql
SELECT count(*) FROM orders WHERE customer_id IS NULL;
```
````
