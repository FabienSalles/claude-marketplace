# The 17 splitting techniques

Each entry: **when it applies** → **how to cut** → **example** → **failure mode**.

SPIDR (Mike Cohn) is **§10 Spike, §1 Paths, §5 Interfaces, §4 Data variations, §3 Rules**.
§2 and §6–§9 come from the Humanizing Work catalogue, and §11–§17 are the complements that
cover what those two miss. They are not exclusive — most real features need two of them
applied in sequence.

## Contents

| # | Technique | Cuts along |
|---|---|---|
| 1 | Paths | user journeys through the feature |
| 2 | Operations (CRUD) | verbs hidden behind "manage" |
| 3 | Business rules | rules and their exceptions |
| 4 | Data variations | the data the feature accepts |
| 5 | Interfaces | how rich the UI is |
| 6 | Workflow steps | the end-to-end process |
| 7 | Simple / Complex | the core vs its variations |
| 8 | Major effort | the foundation the rest reuses |
| 9 | Defer the quality attribute | make it work / fast / secure |
| 10 | Spike | the unknown |
| 11 | Conjunctions | the "and" / "or" / "except" in the sentence |
| 12 | Acceptance criteria | the criteria list itself |
| 13 | Entry methods | the channels |
| 14 | Roles & permissions | who can do it |
| 15 | Branch by abstraction | old implementation vs new |
| 16 | Hamburger | layer options, thinnest path through |
| 17 | Zero / One / Many | hardcode → one → n |

---

## 1. Paths

**When**: the feature has several routes through it — nominal, alternate, error.

**How**: draw the flow, ship the **happy path** first, each other path as its own slice.
Errors and recovery are paths too.

**Example**: checkout. Slice 1 = pay by card, nominal. Slice 2 = gift card. Slice 3 =
payment refused, with the retry journey.

**Failure mode**: shipping the happy path with no error handling *at all* — the nominal
path still needs to fail safely (a generic error is fine), it just doesn't need the
whole recovery journey.

## 2. Operations (CRUD)

**When**: the story says "manage", "administer", "handle" — a verb hiding four.

**How**: one slice per operation, ordered by what unblocks use. Create + Read is often
usable on its own; Update and Delete follow.

**Example**: "manage promo codes" → create + list (usable by ops immediately), then
edit, then archive.

**Failure mode**: shipping Create with no Read. The pair is what makes it observable.

## 3. Business rules

**When**: the complexity is in the rules, or one rule has many exceptions.

**How**: the **dominant** rule first — 80% of the value comes from 20% of the rules.
Exceptions, special cases and derogations become their own slices.

**Example**: pricing. Slice 1 = standard rate. Slice 2 = volume discount. Slice 3 =
negotiated per-customer rate. Slice 4 = the promo × discount cumulation rule.

**Failure mode**: slicing the rules but not their tests. Each rule slice must land with
the test that proves it, or the rules silently interact later.

## 4. Data variations

**When**: the feature nominally supports many formats, types, sources or locales.

**How**: one variation first, add the rest progressively. Order by real usage volume,
not by what's easiest.

**Example**: video upload. Slice 1 = MP4. Slices 2..n = the other 14 formats, grouped by
the codec work they share.

**Failure mode**: picking the easiest variation instead of the most used one — you learn
nothing about the real load.

## 5. Interfaces

**When**: the UI is what makes it big, not the logic.

**How**: the crudest interface that works first (a plain form, a CLI, an admin screen,
a CSV), enrich later. The domain logic is identical underneath.

**Example**: a date filter. Slice 1 = two text inputs. Slice 2 = the date picker.
Slice 3 = the relative presets ("last 30 days").

**Failure mode**: shipping the crude version to end users when it was meant for internal
validation. Pair it with a flag or an internal-only audience (`product:delivery`).

## 6. Workflow steps

**When**: the feature is a multi-step process.

**How**: build the **thin end-to-end path first** (entry → exit, with the middle steps
stubbed or manual), then insert the middle steps one slice at a time. Cutting
step-by-step from the start gives you nothing shippable until the last one.

**Example**: account creation. Slice 1 = signup → account exists → login works. Slice 2 =
email confirmation. Slice 3 = the onboarding wizard. Slice 4 = the welcome sequence.

**Failure mode**: implementing the steps in order instead of end-to-end first. That is
horizontal slicing rotated 90°.

## 7. Simple / Complex

**When**: refinement keeps producing "yes but if…".

**How**: capture every "yes but" as a separate slice, ship the naive version. This is the
purest form of *reduce the variations*.

**Example**: search. Slice 1 = exact match on the title. Then: fuzzy matching, synonyms,
facets, ranking.

**Failure mode**: the simple version being so simple nobody can use it. It must still
close a real use case.

## 8. Major effort

**When**: the first slice is expensive because it builds the foundation, and everything
after it is cheap.

**How**: **do not** make the foundation its own slice — that's a technical enabler with
no value. Fold it into the first functional slice that needs it, and let the following
slices be small.

**Example**: "accept 5 payment providers". Slice 1 = one provider, which pays for the
whole payment abstraction. Slices 2–5 = one provider each, small.

**Failure mode**: a "build the payment abstraction" ticket. Nobody can prioritize it, and
it is designed against imagined needs instead of one real one.

## 9. Defer the quality attribute

**When**: performance, security hardening, accessibility, i18n or observability is what
inflates the story.

**How**: **make it work**, then **make it right**, then **make it fast**. Each is a
slice, with its own measurable criterion.

**Example**: an export. Slice 1 = works synchronously for a small dataset. Slice 2 =
asynchronous with a job queue for large ones, criterion "10k rows < 30 s".

**Failure mode**: deferring something that is not deferrable. Auth on a public endpoint,
GDPR on personal data, and injection safety are never a later slice.

## 10. Spike

**When**: the blocker is not size but **uncertainty** — nobody knows whether the approach
works or what the vendor API really returns.

**How**: a timeboxed investigation with a question to answer and a deadline. Its output
is knowledge, thrown-away code, and a **real split of the remaining work**.

**Example**: "can we stream the provider's webhooks at our volume?" → 1 day, answer,
then slice.

**Failure mode**: the spike becoming the feature, or spiking by default. Use it only
when the uncertainty genuinely blocks slicing — most stories don't need one.

## 11. Conjunctions

**When**: always try this first. It costs 10 seconds.

**How**: read the story out loud and cut at every **and**, **or**, **but**, **except**,
**including**, **as well as**. Each conjunction is usually a hidden second story.

**Example**: "as an admin I can export users **and** their orders **and** filter by
period" → three slices, immediately.

**Failure mode**: cutting at a conjunction that binds one behaviour ("first name and last
name"). Check each resulting piece is still valuable alone.

## 12. Acceptance criteria

**When**: the story already has a criteria list.

**How**: group criteria by the **business rule** they express; each group becomes a
slice. A criterion that stands alone is a slice on its own.

**Example**: 8 criteria on a signup form → 3 slices (create the account, validate the
input, handle the duplicate email).

**Failure mode**: one slice per criterion, mechanically. Some criteria are the same
behaviour phrased twice, and you end up with slices that cannot be shipped separately.

## 13. Entry methods

**When**: the same capability is exposed through several channels.

**How**: one channel first — the one with the most users or the most learning. The others
follow, reusing the same domain code.

**Example**: "create an order" → web UI first, then the public API, then the CSV import,
then the mobile app.

**Failure mode**: building the shared abstraction for all channels up front. Do one
channel, extract the abstraction when the second arrives.

## 14. Roles & permissions

**When**: behaviour differs by actor, or the story implies a permission model.

**How**: one role first (usually the most constrained or the most numerous), other roles
and the fine-grained permission matrix as later slices.

**Example**: a dashboard. Slice 1 = the regular user sees their own data. Slice 2 = the
manager sees their team. Slice 3 = the admin sees everything + the audit log.

**Failure mode**: shipping slice 1 with no authorization check at all "since only one
role exists". Authorization is never deferred — its *granularity* is.

## 15. Branch by abstraction

**When**: replacing an existing implementation, in legacy code, with no seam to cut at.

**How**: slice 1 introduces the abstraction over the **current** behaviour (pure
refactor, no behaviour change, provably green). Following slices move call sites and
implement the new behaviour behind it. The last slice removes the old implementation.

**Example**: swapping the mail sender. Slice 1 = `MailerInterface` wrapping the current
sender. Slice 2 = the new implementation behind a flag. Slice 3 = flip. Slice 4 = delete
the old one.

**Failure mode**: introducing the abstraction *and* changing behaviour in the same slice.
When it breaks you cannot tell which half did it. See `product:delivery` for the full
pattern, including the flag and the removal slice.

## 16. Hamburger

**When**: the team's instinct is "it's all one block".

**How** (Gojko Adzic): list the **layers** (the tasks the story needs — UI, validation,
storage, notification…), then for **each layer** list its options from crudest to
richest. Ship the thinnest complete path through every layer, then thicken one layer at
a time.

**Example**: "notify the user". Layers = trigger, channel, template, retry.
Thin path = on save · email · plain text · none. Later slices thicken each layer.

**Failure mode**: mistaking the layer list for the slice list — that is horizontal
slicing. The slices are the **paths through** the layers, never the layers themselves.

## 17. Zero / One / Many (elephant carpaccio)

**When**: you need the thinnest possible first slice, or the team is learning to slice.

**How**: hardcode the answer (zero), then handle one case for real (one), then generalize
(many). Alistair Cockburn's exercise builds a whole feature in 5-minute slices this way;
the point is proving how thin a *shippable* slice can be.

**Example**: a discount engine. Slice 1 = flat 0% wired end to end, real screen, real
persistence. Slice 2 = one hardcoded rule. Slice 3 = rules from configuration.

**Failure mode**: using it in front of end users. Zero/One slices are for validating the
pipeline end to end — put them behind a flag or an internal audience.

---

## Sources

- [SPIDR — Mike Cohn](https://www.mountaingoatsoftware.com/blog/five-simple-but-powerful-ways-to-split-user-stories)
- [The Humanizing Work Guide to Splitting User Stories](https://www.humanizingwork.com/the-humanizing-work-guide-to-splitting-user-stories/)
- [Five Story-Splitting Mistakes — Mountain Goat](https://www.mountaingoatsoftware.com/blog/five-story-splitting-mistakes-and-how-to-stop-making-them)
- [Gojko Adzic — the hamburger method](https://gojko.net/2012/01/23/splitting-user-stories-the-hamburger-method/)
- [Alistair Cockburn — Elephant Carpaccio](https://alistair.cockburn.us/elephant-carpaccio/)
- [Bill Wake — INVEST](https://xp123.com/invest-in-good-stories-and-smart-tasks/)
- [Allen Holub — #NoEstimates](https://holub.com/noestimates-an-introduction/)
