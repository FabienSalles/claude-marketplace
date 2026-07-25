# Feature flags

## 1. The four types — decide which one you are creating

Martin Fowler's taxonomy, ordered by how long the flag lives. **Naming the type at
creation is what prevents flag debt**: a release toggle nobody labelled as temporary
becomes permanent configuration, and then nobody dares delete it.

| Type | Purpose | Lifespan | Flip frequency | Who decides |
|---|---|---|---|---|
| **Release** | ship unfinished code inactive | days to weeks — **temporary by contract** | once | the team |
| **Experiment** | A/B test, measure a hypothesis | the duration of the experiment | per user, consistently | product / data |
| **Ops** | kill switch, degrade a costly feature | long, sometimes permanent | rare, urgent | ops / on-call |
| **Permissioning** | premium tier, beta panel, internal-only | permanent | per user / tenant | product |

The two axes that matter: **longevity** (does it get deleted?) and **dynamism** (does the
decision change per request, or is it fixed for a deploy?). A release toggle is
short-lived and static — which is why an env var is usually enough. A permissioning
toggle is long-lived and per-request — which needs the user context at evaluation time.

**Slicing implication**: a release toggle belongs in the plan **with its removal slice**.
The other three types are features in their own right and are not cleanup candidates.

## 2. Living with the mechanism you chose

The choice itself is the table in `SKILL.md` §2, driven by the flag's dynamism. What that
table does not say is what each mechanism costs you once it is in place:

- **Env var / build-time config** — flipping needs a deploy, so it is not a rollback plan
  when the deploy is slow or gated. Fine for a release toggle on a project that deploys
  cheaply and often.
- **Runtime configuration** — cache it, and make sure a **cache miss falls back to off**.
  A cached flag whose miss resolves to on turns a cold start into an unplanned release.
- **Per-user / per-tenant setting** — this is how you honour *"we can't expose it until
  it's finished"*: expose it to ten people who agreed to see it rough.
- **A flag platform** — it brings a dashboard, an audit trail and a real kill switch, and
  also a dependency in the request path. Decide what happens when it is unreachable. The
  answer is the default, off.

Migrating up the list later is a contained refactor **if** flag reads go through one
seam. Which is the next section.

## 3. Where the flag lives in the code

Decide at the **edge**, inject the consequence. The flag is a delivery concern; the domain
should stay unaware that two behaviours ever coexisted.

```
# Good — the composition root picks the implementation
$calculator = $flags->isEnabled('new_pricing')
    ? new NewPricingCalculator(...)
    : new LegacyPricingCalculator(...);

# Bad — the flag leaks into the domain and stays there forever
class PricingCalculator {
    public function total(Cart $cart): Money {
        if ($this->flags->isEnabled('new_pricing')) { ... } else { ... }
    }
}
```

The good version deletes cleanly: remove the branch in the composition root, delete the
legacy class. The bad version leaves `if` statements scattered through the domain that
nobody can prove are safe to remove.

Practical rules:
- **One read point per flag**, at a routing / factory / controller boundary.
- **Never combine flags in a condition.** `if (A && !B)` is a state nobody tested.
- **A flag has a default, and it is off.** Missing config, unreachable platform, cache
  miss: all resolve to the pre-existing behaviour.
- **Toggle points are not toggle routers.** If the same flag is read in six places,
  extract a strategy object instead.

## 4. Naming and documenting

`<scope>_<what>` in the project's convention, tied to the work item so cleanup is
traceable: `new_pricing`, `checkout_v2_gift_card`, `ops_disable_pdf_export`.

Record, wherever the project keeps flags (config file comment, README, the plan):
type, owner, creation date, and — for release toggles — the removal condition. A flag
with no removal condition is permanent by omission.

## 5. Testing both branches

A flagged slice has two production behaviours, and both are live code.

- Test the **new** behaviour with the flag on, the **existing** behaviour with it off.
  The second one is the regression proof — the whole point of shipping inactive.
- The existing suite runs with flags at their **default** (off) so the default path is
  continuously verified.
- Do not multiply the matrix: `2^n` combinations for `n` flags is not testable, which is
  why flags must not be combined in conditions.
- On removal, the "flag on" tests become the normal tests — delete the "flag off" ones
  with the old path.

## 6. Rollout, when the mechanism supports it

Start internal (the team), then a beta panel, then a percentage, then everyone. Each step
answers a question the previous one raised, and each is reversible in one flip.

What makes a step safe to take is not elapsed time, it's a signal: error rate on the new
path, the metric the feature was supposed to move, and support volume. If you cannot see
those, the rollout is a guess — add the metric in the same slice.

## 7. The mistakes that create flag debt

- **No removal date, no owner** — the flag outlives everyone who understood it.
- **Type drift** — a release toggle quietly becomes ops configuration. If that is the real
  need, promote it deliberately, document it, and take it off the cleanup list.
- **Flags for things a config value should do** — a timeout, a limit, a feature the
  customer buys. Those are configuration, not toggles.
- **Long-lived branch *and* flag** — the flag was supposed to replace the branch. Doing
  both pays twice and integrates late anyway.
- **Testing only the on path** — the off path is what the majority of users are running.
- **Flags on the critical path with no fallback** — an unreachable flag service must not
  take the request down.
