# Quantification

Which figures a contractor may put in a career document, where they come from, and what
must never be claimed.

- [1. The one-sentence test](#1-the-one-sentence-test)
- [2. Why the test is not paranoia](#2-why-the-test-is-not-paranoia)
- [3. White list — observable from the contractor's own position](#3-white-list--observable-from-the-contractors-own-position)
- [4. DORA metrics](#4-dora-metrics)
- [5. Black list — never without written authorisation](#5-black-list--never-without-written-authorisation)
- [6. When no figure exists](#6-when-no-figure-exists)
- [7. Writing the figure](#7-writing-the-figure)
- [8. Recording the origin](#8-recording-the-origin)
- [9. Recovering figures that were never recorded](#9-recovering-figures-that-were-never-recorded)
- [10. Estimation](#10-estimation)
- [11. Aggregate integrity](#11-aggregate-integrity)

## 1. The one-sentence test

**If the origin of a number cannot be stated in one sentence during an interview, it does
not go in.** A figure that cannot be defended is worth less than no figure, because it is
checked exactly when it costs the most.

Apply the test before the taxonomy below. The white list is a shortcut for figures that
usually pass it, not a licence to record a figure whose origin the person cannot state.

## 2. Why the test is not paranoia

Two vendor-published survey figures set the background. One large background-check vendor
reports that a majority of employers have found a misstatement on a CV. A recruiting
platform survey reports a large majority of recruiters having caught candidate deception.

Both are self-reported by companies selling verification or recruiting services, so treat
the magnitudes as indicative rather than measured. The operational conclusion survives
either way: **verification is a reflex, not an edge case.** Write every figure expecting
it to be checked.

## 3. White list — observable from the contractor's own position

No client authorisation is needed for these: they are visible from the seat the
contractor occupied, and they carry no client business data.

| Family | Figures |
|---|---|
| Delivery pipeline | the four DORA metrics (§4); build time and full CI time, before and after |
| Code and quality | test coverage before and after; number of pull requests reviewed; technical debt removed (files, lines, dependencies) |
| System | p95 latency; throughput; request volume; number of services or modules; data volume processed (rows, messages, TB) |
| Operations | number of on-call incidents handled |
| People | team size led or mentored; number of people trained; sessions delivered; days delivered |
| Engagement shape | duration in months; number of renewals |

## 4. DORA metrics

The strongest family on the white list, for three reasons: they are a public standard,
they are reconstructible from the client's Git and CI without touching any business data,
and they are defensible in interview because the reconstruction can be described.

| Metric | Measures |
|---|---|
| Deployment frequency | how often code reaches production |
| Change lead time | commit to production |
| Change failure rate | share of changes that fail |
| Failed-deployment recovery time | time to recover from a failed deployment |
| Deployment rework rate | a fifth metric appearing in the current definitions |

**Never quote a maturity threshold.** The elite / high / medium / low bands are not in the
public definitions page. Quote the measured value and its period, nothing else. A document
claiming "elite-level deployment frequency" is asserting a threshold the source does not
publish, and the claim collapses the moment someone asks where the band comes from.

## 5. Black list — never without written authorisation

Client revenue, margin, end-user counts, euro savings, conversion rates, and anything
coming out of the client's business intelligence. Without written authorisation these are
never claimed; if they are not public, they are not claimed at all.

The reasoning is asymmetry: a business figure that cannot be sourced buys a marginal gain
when the document is skimmed and a total loss when it is checked. There is no version of
that bet worth taking.

## 6. When no figure exists

State scope rather than invent an outcome.

> Rewrite of the billing module (14 000 lines, 3 developers, 5 months)

converts better than a fabricated improvement, and it survives any question asked about
it. A bullet with no figure is not a failed bullet: it becomes a challenge-action-result
bullet, and it must then make the challenge explicit to compensate for the missing
outcome.

## 7. Writing the figure

| Rule | Do | Not |
|---|---|---|
| Pair every percentage with an absolute value where one exists | `-30% (500 k€)`, `+12% (1.2 M€)` | `-30%` |
| Give a baseline with every percentage | `test coverage 32% to 78%` | `+40% coverage` |
| No orphan numbers | at least two of four anchors: period, baseline, scope (team size or volume), method | a bare number |
| Density | at most two or three figures per bullet | a bullet that reads as a metrics dump |

Pairing is what separates a verifiable figure from a decorative one. A delta without a
starting point is uninterpretable — the reader cannot tell whether it is remarkable or
trivial. On orphan numbers, reviewers name unanchored figures as a marker of
machine-written documents; that is a reported reviewer perception, not a measured effect,
and it is reason enough to anchor.

The pairing rule does not override §5. If the absolute value behind a percentage is a
client business figure, both halves need written authorisation before either appears.

## 8. Recording the origin

In the referential, every figure is followed in parentheses by where it came from — a
command, a dashboard, a ticket, an invoice.

That parenthetical is stripped at render time. It never reaches the CV. It is what makes
the figure defensible years later, when the engagement is cold and the person is asked in
an interview where the number came from.

## 9. Recovering figures that were never recorded

Ask scope questions, not outcome questions. An outcome question ("what improvement did you
get?") invites a reconstruction; a scope question retrieves what was actually observed.

- By how much?
- For how many users?
- Over what period?
- What was the baseline?

When no number can be recovered, qualitative proxies are acceptable **in the referential**
provided they are labelled as such: what the manager said, what changed after the work,
how the team reacted. They inform prose. **They never become figures.**

## 10. Estimation

Permitted only when the arithmetic is reconstructible and conservative:

- rounding down;
- a range;
- a floor (`100+`);
- a percentage of a known total;
- frequency times periods.

Every estimate is recorded as an estimate. **Never estimate to avoid an empty field** —
`needs-user-input` carries more information than an indefensible number.

## 11. Aggregate integrity

When a document publishes a total — participants trained, days delivered, missions
completed — that total must be the sum of the entries in the referential and must stay
recomputable from them. An aggregate that cannot be recomputed cannot be corrected, split,
or defended.

Three different published values for one metric usually means one is a stale snapshot
rather than a different definition. Check whether the smaller value is the total at an
earlier cut-off before treating it as a contradiction. Report both numbers and the
arithmetic; do not silently adopt either.
