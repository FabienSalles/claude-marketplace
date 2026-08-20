# career

Career material for the **French tech market**, built once and projected per target.

A referential of engagements is captured once, with a disclosure level on every client
name. A CV, an ESN dossier de compétences and a LinkedIn profile are then compiled from
it — never the other way round, and never by copying one into another.

Built after auditing sixteen public CV/LinkedIn skill packs and running six research
tracks on ATS behaviour, LinkedIn retrieval and the French freelance market. None of the
sixteen models the French market: no daily rate, no dossier de compétences, no
intermediary reader, no NDA-aware client citation. Several encode an "ATS score" that no
vendor produces, and one opens on a rejection statistic whose only source is a defunct
company's 2012 sales argument.

Every mechanical claim in this plugin traces to vendor documentation (Workday,
Greenhouse, Ashby, SmartRecruiters, Oracle), an institutional source (Apec), or the
platform's own engineering publications. Where nothing is documented, the reference files
say so instead of filling the gap.

## Install

```text
/plugin install career@fabien-claude-marketplace
```

## Skills (3)

| Skill | Purpose |
|---|---|
| [`career-evidence`](skills/career-evidence/SKILL.md) | Build and maintain the referential: one Markdown file per engagement, three types (mission, audit, training) because each is proved and cited differently. Every entry carries a `disclosure` level, so no downstream document can emit a client name its contract forbids. A missing figure is recorded as `needs-user-input` with the question that resolves it, never estimated. Produces no document. |
| [`cv-tailor`](skills/cv-tailor/SKILL.md) | Compile the referential into a two-page ATS-safe CV, an ESN dossier de compétences, or a per-posting variant — three different artifacts, never a compromise between them. Aggregates recurring activity into totals while engagements keep their detail. Gates on plain-text extraction before delivery, and ships the document with a per-change diff the author accepts or rejects line by line. |
| [`linkedin-profile`](skills/linkedin-profile/SKILL.md) | Audit and rewrite a profile for how retrieval actually works: eligibility (boolean filters, binary, one occurrence) separated from ranking (a learned model optimising the reply, not lexical density). Places each keyword once in the field whose filter reads it, and treats a freelance profile as a seller of services rather than a candidate. |

## The rule the plugin exists to enforce

**The referential is exhaustive; the rendering aggregates.** Twenty-five training
sessions live in the referential in full so a document can claim a participant total and
have that total be recomputable, corrigible and splittable by course. Four lines in a CV
cannot be un-aggregated back into twenty-five entries.

The same rule carries the NDA case. An engagement under a confidentiality agreement stays
in the referential — it feeds totals, seniority and date continuity — while its
`## Formulation publique` is the only thing a document may emit.

## Reference manuals

Loaded on demand. Each states the epistemic status of what it asserts: vendor-published,
institutional, a practitioner consensus, or an inference from a documented architecture.

| File | What it answers |
|---|---|
| [`evidence-schema.md`](skills/career-evidence/references/evidence-schema.md) | The referential file format: frontmatter per engagement type, the three disclosure levels and why removing a client name does not satisfy `sector-only` in a narrow domain, the mandatory public formulation, and the validation checklist over a set of entries. |
| [`quantification.md`](skills/career-evidence/references/quantification.md) | Which figures a contractor may claim without client authorisation (the DORA family first, because it is reconstructible from Git and CI and defensible in interview), which are never claimed, how to write a figure so it stays verifiable, and what to record when none exists. |
| [`ats-rules-fr.md`](skills/cv-tailor/references/ats-rules-fr.md) | What vendors actually document about parsing failure, why no ATS score exists, the only automatic rejection mechanism there is, the Apec recommendations, safe section headings in French and English, the two silent failures (ligatures, multi-column reading order), and the plain-text extraction test that settles all of it. |
| [`dossier-competences.md`](skills/cv-tailor/references/dossier-competences.md) | The French dossier as a commercial document rather than a career history: its volume split, the mechanisms that fit twenty-plus engagements without eleven pages, why a renewal is a buy-side quality signal, and the commercial fields no international template has a slot for. |
| [`bullet-formulas.md`](skills/cv-tailor/references/bullet-formulas.md) | Where XYZ, STAR, CAR and PAR actually come from and which belongs in a document rather than an interview, the two readers a CV serves in sequence, and the anti-markers — which are markers of bad writing, not of machine writing. |
| [`linkedin-mecanique.md`](skills/linkedin-profile/references/linkedin-mecanique.md) | Which filter reads which field, why no recruiter filter reads the headline, what the ranker optimises, what the 2026 move to embeddings implies for a repeated keyword block, the one real compliance risk, and the field-weight figures to refuse. |
| [`marche-fr.md`](skills/linkedin-profile/references/marche-fr.md) | The title taxonomy and its rate bands, the titles that generate zero postings in France, why role-plus-stack beats stack alone, the spelling variants a sourcer's boolean query uses, and the two opposite platform models. |

## Related

- [`marketing-content:linkedin-content`](../marketing-content/README.md) writes LinkedIn
  posts; this plugin writes the profile they land on.
- [`marketing-strategy`](../marketing-strategy/README.md) holds the positioning the
  referential's `profil.md` should stay consistent with.
