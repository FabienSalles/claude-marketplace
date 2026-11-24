# Question calibration — ask what the team owns

When objectives are missing and a workshop is planned, the question list is only useful if it
is calibrated to what the team actually cares about. The recurring failure is a list of
code-internal curiosities while the team is thinking about operations, performance, process,
and which risks they already know and accept.

## The recurring divergence

Observed when a model-drafted question list was filtered and answered by the client team:

| Model's instinct | What the team actually surfaced |
|---|---|
| "How was the delivered archive produced?" | Precisely *what is missing* vs the public repo and why (tests, git history, deployment secrets) — ask the specific delta, not the process. |
| Flag `composer audit` left non-blocking in CI as a finding | Ask first whether it is **intentional** — it often is (unit tests only on critical paths touched during maintenance). |
| Rank the default `admin/admin` credential as a fresh critical | It was already **known and accepted** (changed by a manual, acknowledged-as-fragile process). Report at the severity the team assigns. |
| Bus-factor framed as a risk about people | The team answers in terms of **who owns what** and upcoming handovers (leave, reassignment) — phrase it as ownership and continuity, never blame. |
| Security-only lens | The team's own priorities included **performance** (named slow paths) and an explicit request to review **authentication, session management and ACL** — these are objectives, not footnotes. |

## Calibration rules

1. **Capture the sponsor's ranked priorities** (security / performance / IP / maintainability)
   and treat the top of that list as a first-class audit axis — performance pain points and
   auth/session/ACL concerns are findings to reproduce, not asides.
2. **Ask "is this intentional / known?" before scoring.** A practice the team adopted on
   purpose, or a risk they have already accepted, is reported as such, at their severity.
   Re-flagging accepted risk as new inflates the report and erodes trust.
3. **Ask the specific delta, not the process.** "These files are absent vs upstream tag X —
   are they intentionally excluded?" beats "how was the delivery built?".
4. **Establish provenance.** Where the code came from (a fork, a product lineage, a forced
   open-sourcing) explains missing history, dead code, and degraded features — and often
   answers several would-be findings at once.
5. **Phrase against conditions, never people** (bus factor, churn, review practice), and open
   with the coordinated-disclosure question when the repo is public.
6. **Group by audit axis, reference each question to a candidate finding**, and keep a
   coordinated-disclosure note at the top so no exploit detail leaves before the channel is
   agreed.

The point of the list is to let the client correct the audit's aim *before* effort is spent
proving the wrong things — and to record their answers back into the knowledge base so the
next session does not re-ask them.
