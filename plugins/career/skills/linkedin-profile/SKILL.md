---
name: linkedin-profile
description: "ACTIVATE when auditing or rewriting a LinkedIn profile so recruiters, ESN sourcers and prospective clients actually find it — headline, About, experience entries, skills, services. ACTIVATE for 'mon profil LinkedIn', 'optimiser LinkedIn', 'je ne reçois pas de sollicitations', 'quel titre mettre sur LinkedIn', 'bloc de mots-clés LinkedIn', 'être trouvé par les recruteurs', 'LinkedIn headline', 'LinkedIn profile audit'. Separates eligibility (entering a recruiter's result set) from ranking (the order within it), places each keyword once in the field whose filter actually reads it, and treats a freelance profile as a seller of services rather than a candidate. DO NOT use to write LinkedIn posts or content strategy (see marketing-content:linkedin-content), to build the underlying career referential (see career:career-evidence), or to produce a CV (see career:cv-tailor)."
version: "1.0.0"
---

# LinkedIn Profile

Rewrite a profile for how LinkedIn retrieval and ranking actually work, and for a
market that pays for the role title rather than the technology. Every mechanical claim
in this skill traces to vendor documentation or to LinkedIn's own engineering
publications; where nothing is documented, say so rather than repeat the folklore.

## 1. Eligibility is not ranking

This distinction decides almost every keyword question, and it is the one practitioners
collapse.

**Eligibility** is entering a recruiter's result set. It is produced by boolean filters
and it is binary. A term present once anywhere in the profile makes the profile
eligible for a query containing it; the recruiter keyword filter reads the whole
profile page. The second, fifth and twelfth occurrence add nothing.

**Ranking** is the order within that set. It is produced by a learned model whose
optimisation target is not lexical relevance but whether the recruiter reaches out
**and the person answers**. No LinkedIn source documents a term-frequency signal in it.

Two consequences follow, and they are the whole strategy.

- Repeating a keyword cannot improve eligibility, because eligibility was already
  acquired at the first occurrence.
- Appearing without converting works against the system's own objective, since the
  metric being optimised is the reply.

Since 2026 sourcing runs on semantic embeddings: the profile is compressed into a
single vector. There is no occurrence counter in that architecture — added text moves
the vector rather than accumulating. A profile listing twenty role variants sits at the
average of all of them, and therefore further from each. LinkedIn does not state this
consequence; it follows from the architecture they publish, and it should be presented
as a strong mechanical hypothesis, not as a fact.

See [references/linkedin-mecanique.md](references/linkedin-mecanique.md) for which
filter reads which field, with sources.

## 2. Place each keyword once, where its filter reads it

| To capture | Filter | Put it in | Times |
|---|---|---|---|
| A role title | job titles | the Title field of an Experience | 1 |
| A technology | skills | Skills section, plus the role description | 2 |
| A business context | keywords | About or a role description | 1 |
| A client company | companies | the Company field of an Experience | 1 |

Two rules govern the Title field specifically.

**Use the market's standard title, not a creative or over-specified one.** LinkedIn
recommends this explicitly, and two filters a candidate never sees — job function and
seniority — are *derived* from that field by standardisation against a canonical
taxonomy. A title that resolves badly silently drops the profile out of both.

**Technologies do not belong in the Title field.** It trades standardisation for a
signal the Skills section carries better. Standard title plus the stack in Skills and
in the description captures both without degrading either.

Never put a title in an Experience that was not held. This is the one real compliance
risk in the whole keyword question: the platform's policies forbid misleading
information about work experience, and that constraint lives in the fields asserting
facts, not in free prose.

## 3. The trailing keyword block

A recurring pattern deserves a direct verdict: a comma-separated list of role-title
variants, repeated at the end of every experience and in About.

It buys eligibility for those terms — once. Every repetition after the first adds
nothing retrievable, and no source documents a ranking gain. Against that, it costs on
the only metric ranking optimises: a reader who reaches the profile and finds a wall of
titles converts less well.

Keep a reduced form: each variant once, in prose that means something, in the field
whose filter reads it. Drop the repetition across sections.

No LinkedIn source documents an algorithmic penalty for keyword stuffing, and claiming
one is as unfounded as claiming the block works. The cost is human, not algorithmic.
Say that precisely rather than inventing a sanction.

## 4. Freelance, not candidate

A profile selling services is not a profile seeking employment, and most published
advice models only the second. See
[references/marche-fr.md](references/marche-fr.md) for the French market data.

- **Open to providing services**, not open to work. The first produces no photo frame
  and feeds the services surface; the second tells a prospect the person is looking for
  an employer.
- **The services section and a custom profile button occupy the same slot.** Adding one
  replaces the other. Decide deliberately rather than discovering it.
- **Pick the narrowest service sub-category available.** Root categories hold millions
  of providers; matching runs on that field plus language and location.
- **One Experience entry per long engagement**, not a single "Independent consultant"
  covering years. The platform allows one recommendation per position per person, so a
  single entry caps how many recommendations can ever be collected, and wastes the
  description characters each entry carries.
- **Response badges are the only quality signals the platform computes and displays.**
  They are binary and fully under control. Do not open a services page without
  intending to answer.

## 5. Write for the visible fraction

Limits and visible thresholds are not the same number, and the second is what matters.
The headline allows far more than what a search result displays; the About section
allows far more than what shows before the fold.

Write the headline for its first sixty to seventy characters, since that is what
appears in a result list and what search engines use as the page title. Write About for
its first two hundred, opening on the reader's problem in the reader's words rather
than on the person's own history, and close on an explicit invitation naming who it is
for and what happens next.

Character limits are not published by LinkedIn. Verify them in the editor before
encoding any figure in a deliverable.

## 6. Audit output

Produce, per finding: what is wrong, why it costs, the exact navigation path to fix it,
and ready-to-paste replacement text. An audit that produces a list of observations
transfers the work back; an audit that produces N paste-ready fixes and N paths
finishes it.

Rank findings by what they cost, not by section order. Cover: headline, About,
experience entries and their Title fields, skills and their order, services, featured,
recommendations, custom URL, profile language, visibility settings.

Never state a per-field ranking weight. LinkedIn declares it does not disclose its
feature list, and every published weighting is blog folklore that contradicts the next
one. Never quote an unsourced multiplier.

## 7. Consistency with the CV

Dates, titles and company names must match the CV exactly — recruiters consult both,
most of them routinely. Report divergences rather than silently aligning one to the
other: which is correct is the person's call.

Client names obey the referential's disclosure levels here exactly as in a CV. A
profile is more public than a CV, not less.

## Anti-patterns

- **Quoting a field weight** ("the headline is 60% of ranking"). Not disclosed, and the
  published figures contradict each other.
- **Repeating the keyword block across sections.** Buys nothing after the first
  occurrence, costs on conversion.
- **Putting technologies in the Title field.** Breaks standardisation, drops the
  profile out of derived filters.
- **Claiming a stuffing penalty.** Undocumented. The real risk is a false title in a
  field that asserts a fact.
- **Recommending skill assessments or badges.** Removed from the platform.
- **Treating a freelance profile as a candidate profile.** Wrong signal to a buyer.
- **Promising attributable measurement.** Search-appearance data does not expose search
  terms, so no keyword change can be attributed to a variation.
