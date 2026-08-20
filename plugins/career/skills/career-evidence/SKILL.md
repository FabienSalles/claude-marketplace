---
name: career-evidence
description: "ACTIVATE when building or maintaining the referential a CV and a LinkedIn profile are derived from — capturing a mission, an audit or a training session that was just delivered, importing an existing CV into structured evidence, recovering the numbers behind a claim, or deciding what may be said about a client under NDA. ACTIVATE for 'référentiel carrière', 'j'ai fini une mission', 'ajouter un audit', 'ajouter une formation', 'mon CV n'est plus à jour', 'quels chiffres je peux citer', 'ce client est sous NDA', 'career evidence', 'track my engagements'. Keeps one Markdown file per engagement, each carrying its own disclosure level, so no document can later emit a client name its contract forbids. DO NOT use to write a CV or a dossier de compétences (see career:cv-tailor), to rewrite a LinkedIn profile (see career:linkedin-profile), or to write case studies and marketing pages from missions (see marketing-content:copywriting)."
version: "1.0.0"
---

# Career Evidence

Build the referential every career document is projected from. **This skill never
produces a CV, a profile or a proposal** — it produces the source those are compiled
from, and it refuses to invent what the source does not contain.

Four principles govern every phase.

1. **The referential is exhaustive; the rendering aggregates.** Twenty-five training
   sessions live here in full so a CV can say "198 participants" and have that number
   be recomputable. Dropping detail at capture time destroys aggregates that cannot be
   rebuilt later.
2. **Disclosure travels with the claim, not with the document.** A client name carries
   its own permission at the point it is recorded. A downstream document cannot grant
   itself a permission the source withholds.
3. **A gap is data.** A missing figure is recorded as `needs-user-input` with the
   question that would resolve it. It is never estimated, never rounded up from
   nothing, never left as vague prose that hides the hole.
4. **Every figure carries its origin.** A number a person cannot source in one sentence
   during an interview does not belong in the referential, and therefore can never reach
   a document.

## 1. Layout

Filenames sort chronologically and never contain a client name that is not public.

```
career/
├── profil.md                                   identity, titles, contact, positioning
├── missions/2021-09-<client>-<objet>.md        one file per engagement
├── audits/2026-02-<secteur>-<objet>.md         one file per engagement
└── formations/git-avance.md                    one file per COURSE
```

Three engagement types exist because they are proved differently and cited differently.
Never force one into another's shape.

| Type | Unit of file | Unit of proof | Typical citation |
|---|---|---|---|
| `mission` | the engagement | duration, stack, deliverables, renewals | client usually nameable |
| `audit` | the engagement | scope, days, deliverable | often NDA, sector only |
| `formation` | the **course** | participants and days, summed over its sessions | channel or client, varies |

**Training is the exception, and deliberately so.** The sellable unit is the course, not
the session: a two-day session with five people is not an engagement, it is an instance
of one. One file per course carries a session table in its body, which keeps every
session recorded — so totals stay recomputable and splittable — while adding a session
costs a table row instead of a new file. Fifteen courses over ten years stay legible;
two hundred session files do not.

## 2. Frontmatter

Required on every file: `type`, a date or date range, and `disclosure`. Everything else
is per type. Use `~` for a value that is genuinely unknown, never `0` and never a guess.

```yaml
type: mission                    # mission | audit | formation
client: <nom du client>
disclosure: public               # public | sector-only | excluded
secteur: <secteur>
role: <rôle tenu>
debut: 2021-09
fin: 2023-12
renouvellements: 2
equipe: 6
stack: [PHP, Symfony, Architecture hexagonale, DDD, TDD, AWS]
```

```yaml
type: audit
client: <nom>
disclosure: sector-only
secteur: Secteur public
date: 2026-02
jours: 14
domaines: [architecture, pratiques de développement, rétro-documentation]
```

```yaml
type: formation
formation: Gestion de versions avec Git
catalogue: actuel                # actuel | retire
duree_standard: 2                # days, the catalogue duration
premiere_session: 2020-01
derniere_session: 2026-08
```

A course file carries no `disclosure` of its own: permission varies per session and is
settled in the session table. Sessions live in the body as a table, one row each, and
the `Client` column holds **what may be said** — a channel, an end client where it is
public, a sector otherwise. Totals are the sum of the table, never a figure typed by
hand.

| Date | Days | Participants | Client | Format |
|---|---|---|---|---|
| 2026-08 | 2 | 5 | Orsys | presentiel |
| 2026-04 | 2 | 10 | Orsys | presentiel |

### The disclosure field

This is the one field that must never be filled by inference. Ask, or default to the
most restrictive value.

- **`public`** — the client may be named. Reserve this for clients already named
  publicly by the person themselves (a logo wall, a published case study, a signed
  testimonial). A past engagement is not automatically public.
- **`sector-only`** — the engagement may be described, the client may not be named.
  This is the correct default for anything under NDA.
- **`excluded`** — the engagement is not mentionable at all. Keep the file: it still
  feeds totals, seniority and continuity of dates.

**`sector-only` is not satisfied by removing the name.** In a narrow domain, the
business function identifies the client as surely as its name does: one buyer in a
country runs the permit-application software, one runs the public-procurement platform.
When the domain is narrow, the public formulation must also generalise the domain.

That judgement is made once, by the person, at capture time. It is recorded in the body
(§3) rather than derived later by a renderer that has no way to know.

## 3. Body

Two sections, always in this order. The second is mandatory for `sector-only` and
`excluded`.

```markdown
## Contexte

Written for the person's own use: interviews, proposals, recall in three years.
Full detail, real names, everything they would want back later.

## Réalisations

- One bullet per outcome, verb first, figure on the same line as the verb.
- Each figure followed by its origin in parentheses.

## Formulation publique

The sanitised one-liner that documents are allowed to emit. No client name, no product
name, no acronym, and no domain detail narrow enough to identify the buyer.
```

A renderer reads `## Formulation publique` whenever `disclosure` is not `public`, and it
may never fall back to `## Contexte`. If that section is missing on a restricted entry,
the entry is incomplete — say so and stop, rather than emit a sanitised guess.

## 4. Capture

Work from what exists before asking anything. An existing CV, a LinkedIn export, a
timesheet, an invoice history and a testimonial page carry most of a referential
already.

1. **Inventory the sources first.** List what was read and what it covered before
   writing a single entry. Never silently infer that a document was consulted.
2. **One entry per engagement**, from the sources.
3. **Reconcile the totals.** Sum what the entries hold and compare against every figure
   the person already publishes. Report each divergence with both numbers and the
   arithmetic. Do not silently adopt either value.
4. **Ask about disclosure**, per client, once. Never infer.
5. **Ask the blocking questions only**, one at a time, and only what the sources cannot
   answer. A long questionnaire is a failure of step 1.

Divergences are the most valuable output of a first capture. Three figures for the same
metric usually means one is a stale snapshot rather than a different definition — check
whether the smaller one is the total at an earlier cut-off before treating it as a
contradiction.

## 5. Figures

Record only what is observable from the person's own position, and record where it came
from. See [references/quantification.md](references/quantification.md) for the full
white list, the DORA definitions, and what must never be claimed without written
authorisation.

The test is one sentence: **if the origin cannot be stated in an interview, the figure
does not go in.** A number that cannot be defended is worth less than no number, because
it is checked at exactly the moment it costs the most.

## 6. Maintenance

Capture at the end of an engagement, not at the moment a CV is needed. A mission written
up three years later loses the figures that made it worth writing up.

On each pass, verify:

- no date overlap between entries, unless explicitly labelled as parallel;
- every month between the first and last engagement is covered or explained;
- totals still reconcile with what is published publicly;
- entries marked `needs-user-input` are surfaced, oldest first.

## Anti-patterns

- **Writing the CV from this skill.** It produces the source. Compiling is `cv-tailor`.
- **Filling `disclosure` by inference.** "They are a big company, it is probably fine"
  is how a name reaches a document it should never have reached.
- **Dropping detail because a CV would not use it.** The CV is one projection among
  several. The referential serves proposals, interviews and training pages too.
- **Estimating a missing figure to avoid an empty field.** `needs-user-input` carries
  more information than a number nobody can defend.
- **Recording an aggregate instead of its terms.** "About 200 people trained" cannot be
  recomputed, corrected, or split by course. Twenty-five entries can.
