# Evidence Schema

The file format the whole plugin rests on: one Markdown file per engagement, YAML
frontmatter plus body. Everything a document may later say is decided here, at capture
time, and nowhere else.

## Contents

1. [Layout on disk](#1-layout-on-disk)
2. [The three engagement types](#2-the-three-engagement-types)
3. [Frontmatter fields](#3-frontmatter-fields)
4. [Missing values: `~` and `needs-user-input`](#4-missing-values--and-needs-user-input)
5. [`disclosure`, the load-bearing field](#5-disclosure-the-load-bearing-field)
6. [`sector-only` is not "name removed"](#6-sector-only-is-not-name-removed)
7. [Body structure](#7-body-structure)
8. [Renderer contract](#8-renderer-contract)
9. [`profil.md`](#9-profilmd)
10. [Worked example: mission](#10-worked-example-mission)
11. [Worked example: audit](#11-worked-example-audit)
12. [Worked example: formation](#12-worked-example-formation)
13. [Validation checklist](#13-validation-checklist)
14. [Not specified by this schema](#14-not-specified-by-this-schema)

## 1. Layout on disk

```
career/
├── profil.md
├── missions/
├── audits/
└── formations/
```

One file per engagement, one engagement per file. Filenames sort chronologically via a
`YYYY-MM` prefix, and never contain a client name that is not public. The directory a
file sits in matches its `type`.

Field keys are fixed and never translated. Field values follow the person's own language
(a role recorded as it appears in the French posting stays in French).

## 2. The three engagement types

Three types exist because each one is proved by different evidence and cited
differently. Never force one into another's shape.

| Type | Unit of proof | Typical citation |
|---|---|---|
| `mission` | duration, stack, deliverables, renewals | client usually nameable |
| `audit` | scope, days, deliverable | often NDA, sector only |
| `formation` | participants, sessions, days, format | channel or end client, varies |

## 3. Frontmatter fields

Required on every file regardless of type: `type`, a date or date range, `disclosure`.

| Field | mission | audit | formation | Holds |
|---|---|---|---|---|
| `type` | required | required | required | `mission` \| `audit` \| `formation` |
| `disclosure` | required | required | required | `public` \| `sector-only` \| `excluded` |
| `client` | required | required | — | the real client name (see below) |
| `client_final` | — | — | optional | end client behind the channel |
| `secteur` | required | required | — | sector of activity |
| `role` | required | — | — | role held |
| `debut` | required | — | — | start of the engagement |
| `fin` | required | — | — | end of the engagement |
| `date` | — | required | required | date of the engagement |
| `renouvellements` | required | — | — | number of renewals |
| `equipe` | required | — | — | team size |
| `stack` | required (list) | — | — | technologies |
| `jours` | optional | required | required | days |
| `modalite` | optional | — | — | `regie` \| `forfait` |
| `lieu` | optional | — | required | location |
| `domaines` | — | required (list) | — | scope covered by the audit |
| `livrable` | — | required | — | deliverable produced |
| `formation` | — | — | required | title of the training |
| `catalogue` | — | — | required | `actuel` \| `retire` |
| `participants` | — | — | required | number of participants |
| `canal` | — | — | required | training channel |
| `format` | — | — | required | `presentiel` \| `distanciel` |

`client` holds the real name. The file is the private referential: `## Contexte` carries
full detail and real names, and only the filename is constrained. What a document may
emit is governed by `disclosure` and by `## Formulation publique`, never by blanking a
frontmatter field.

## 4. Missing values: `~` and `needs-user-input`

Two sentinels, and no third option. Never `0`, never a guess, never vague prose that
hides the hole.

- `~` for a value that is genuinely unknown.
- `needs-user-input` for any figure a question would resolve. It carries that question
  as a trailing comment, so a later pass can ask it without reconstructing the context:

```yaml
jours: needs-user-input  # how many days was this audit billed?
```

`needs-user-input` is legitimate on any figure. An entry carrying it is a valid entry,
not a draft.

## 5. `disclosure`, the load-bearing field

| Value | The engagement may be | Keep the file |
|---|---|---|
| `public` | described and the client named | yes |
| `sector-only` | described, client not named | yes |
| `excluded` | not mentioned at all | yes |

- **`public`** is reserved for clients the person already names publicly themselves: a
  logo wall, a published case study, a signed testimonial. A past engagement is **not**
  automatically public.
- **`sector-only`** is the correct default for anything under NDA.
- **`excluded`** still keeps its file. The entry continues to feed totals, seniority, and
  the continuity of dates, even though no document may cite it.

## 6. `sector-only` is not "name removed"

Removing the client name does not satisfy `sector-only`. In a narrow domain the business
function identifies the buyer as surely as the name does.

Worked example. In a country where a single public body commissions the software that
handles building-permit applications:

| Formulation | Verdict |
|---|---|
| "audit of a building-permit application system, public sector" | fails: names the client to anyone in that market |
| "audit of a public-sector line-of-business application" | passes: the domain is generalised too |

The rule that follows: when the domain is narrow, the public formulation must generalise
the domain, not just drop the name.

## 7. Body structure

Three sections, always in this order.

```markdown
## Contexte

For the person's own use: interviews, proposals, recall in three years. Full detail,
real names, everything they would want back later.

## Réalisations

- One bullet per outcome, verb first, figure on the same line as the verb.
- Each figure followed by its origin in parentheses.

## Formulation publique

The sanitised one-liner documents are allowed to emit. No client name, no product name,
no acronym, no domain detail narrow enough to identify the buyer.
```

`## Formulation publique` is **mandatory whenever `disclosure` is not `public`**.

## 8. Renderer contract

A renderer reads `## Formulation publique` whenever `disclosure` is not `public`, and it
may **never** fall back to `## Contexte`.

A restricted entry missing that section is incomplete. Stop and report it. Never emit a
sanitised guess.

## 9. `profil.md`

One file at the root of `career/`, holding what is true of the person rather than of an
engagement:

- identity and contact
- the titles claimed publicly
- the positioning sentence
- availability
- mobility
- rates, if published
- legal entity

## 10. Worked example: mission

`career/missions/2021-03-retail-order-platform.md`

```markdown
---
type: mission
client: Client A
disclosure: sector-only
secteur: Retail
role: Senior backend engineer
debut: 2021-03
fin: 2023-06
renouvellements: 4
equipe: 6
stack:
  - PHP
  - Symfony
  - PostgreSQL
  - RabbitMQ
jours: needs-user-input  # how many days were billed across the four renewals?
modalite: regie
lieu: on site two days a week
---

## Contexte

Order platform of Client A, rebuilt while the legacy system stayed in production.
Joined a team of six, on a four-times-renewed contract. Full internal detail belongs
here: team names, the reason the first architecture was abandoned, who to call back.

## Réalisations

- Cut the nightly order import from 40 min to 6 min (timed on the client's preprod, run
  logs of 2022-05).
- Shipped the migration of 12 endpoints to the new platform (count from the migration
  checklist kept in the team's repository).
- Renewed 4 times over 27 months (contract records).

## Formulation publique

Backend engineering on the order platform of a retail group, 27 months, four renewals,
team of six.
```

## 11. Worked example: audit

`career/audits/2024-02-public-sector-lob-application.md`

```markdown
---
type: audit
client: Client B
disclosure: sector-only
secteur: Public sector
date: 2024-02
jours: 14
domaines:
  - architecture
  - development practices
  - retro-documentation
livrable: written report plus restitution to the steering committee
---

## Contexte

Audit of the application handling building-permit applications for Client B. Single
buyer for this software in the country, so the domain itself identifies them. Real names,
contacts and the political context of the mandate belong here.

## Réalisations

- Audited 14 days across three domains (signed order form).
- Documented 9 architecture findings ranked by remediation cost (the report's own
  summary table).
- Presented the restitution to the steering committee (agenda of the 2024-02 session).

## Formulation publique

Architecture and development-practices audit of a public-sector line-of-business
application, 14 days, written report and restitution to the steering committee.
```

The domain is generalised, not only the name: see [section 6](#6-sector-only-is-not-name-removed).

## 12. Worked example: formation

`career/formations/2023-09-version-control-with-git.md`

```markdown
---
type: formation
formation: Version control with Git
catalogue: actuel
date: 2023-09
jours: 2
participants: 8
canal: Training provider C
lieu: Paris
format: presentiel
disclosure: public
client_final: ~
---

## Contexte

Two-day session run through Training provider C. End client not disclosed by the
provider, hence `client_final: ~` rather than a guess. Group of eight, mixed seniority.

## Réalisations

- Trained 8 participants over 2 days (provider's attendance sheet).
- Ran the session in presentiel in Paris (provider's session confirmation).

## Formulation publique

Two-day Git training for a group of eight, run through a training provider.
```

`disclosure: public` here covers the channel, which is named. The end client stays
unknown rather than inferred.

## 13. Validation checklist

Run over a set of entries, not over a single file:

- [ ] every file has `type`, a date, `disclosure`
- [ ] every non-public entry has `## Formulation publique`
- [ ] no date overlap between entries, unless explicitly labelled parallel
- [ ] every month between the first and the last engagement is covered or explained
- [ ] entries carrying `needs-user-input` are surfaced, oldest first
- [ ] no non-public client name appears in any filename

## 14. Not specified by this schema

State these as open rather than inventing an answer:

- the date format inside frontmatter (the `YYYY-MM` prefix is a filename rule; the
  examples above reuse it for consistency, which is a convention, not a documented
  constraint)
- how an intentionally parallel engagement is labelled, so the overlap check can pass
- the unit and rounding of `jours`
- whether `secteur` draws from a closed list
