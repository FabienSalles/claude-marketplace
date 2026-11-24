# Shipped-finding record & verdict vocabulary

## Verdict vocabulary

- **CONFIRMED** — reproduced end to end on the instance, decisive command/output captured.
- **PARTIAL** — mechanism real, claimed effect not reached as stated. Always say what
  actually happens: blocked by a layer (e.g. a reverse proxy normalises the path), masked by
  a second bug (a type error crashes before the corruption), or only demonstrable on a
  populated / authorized instance not available here.
- **REFUTED** — the running system does not exhibit it; false positive. Name the reason the
  reader was misled (the framework resolves the call, a guard was missed, the version in use
  is already patched).

A PARTIAL or REFUTED verdict is a **win for the audit**, not a failure — it is exactly the
false-positive elimination the client is paying for. Report the count of each.

## Shipped-finding row

Every finding that ships carries all of this, so the human can validate and restitute it
without re-deriving it:

```
#<id> — <title>  [<severity> | CVSS <score> | verdict]
Location     : <path:line> (+ secondary anchors)
Reference    : <CVE / CWE-xxx / OWASP Axx / skill checkpoint>
Reproduction : <numbered steps the human can rerun in minutes, with the decisive output>
Criticality  : <score + one line tying it to demonstrated reachability and the audit objective it hits>
Fix          : <concrete change>
Restitution aids:
  - Understand : where in the code the flaw lives and why it is wrong (the mechanism, 2-3 lines)
  - Demonstrate: the shortest benign witness that shows it live
  - Explain    : how to say it to the client — impact in their terms, not jargon
```

The **three restitution aids** are what make the audit defensible in the room: the auditor
can open the code, show the reproduction, and explain the business impact, all from the row.
A finding without them is a claim, not a deliverable.

## Scoring discipline

- Score with CVSS v4.0; map to the severity buckets in `audit:security-overrides` (Critical
  9.0–10, High 7.0–8.9, Medium 4.0–6.9, Low 0.1–3.9).
- A theoretical-only finding is **capped** (and the cap stated): you cannot score a path
  critical that you could not demonstrate reachable.
- Weight by the sponsor's ranked objectives: the same technical issue can be Medium in a
  security-led audit and High in a performance-led one.
- Authentication, session management and ACL findings get the demonstrated-reachability
  treatment too — "an auth check is missing" is a hypothesis until the pair (refused /
  accepted) is shown.

## Traceability rule

Nothing ships on the model's authority. Each row's reproduction is the human's to rerun,
each anchor the human's to open, each score the human's to accept or revise. The model's job
is to make that re-check cost minutes, not hours.
