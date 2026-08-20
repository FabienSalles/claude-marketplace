---
name: cv-tailor
description: "ACTIVATE when producing or reworking a CV, a résumé or an ESN dossier de compétences for the French market, or when adapting one to a specific job posting or mission brief. ACTIVATE for 'refais mon CV', 'adapte mon CV à cette offre', 'dossier de compétences', 'mon CV fait trop de pages', 'mon CV ne passe pas les ATS', 'CV freelance', 'tailor my resume', 'ATS check'. Compiles the career-evidence referential into a two-page ATS-safe CV or a mission-by-mission dossier, applies parsing rules taken from vendor documentation rather than folklore, and can never emit a client name whose disclosure level forbids it. DO NOT use to build or update the underlying referential (see career:career-evidence), to rewrite a LinkedIn profile (see career:linkedin-profile), or to write a cover letter or a commercial proposal."
version: "1.0.0"
---

# CV Tailor

Compile the `career-evidence` referential into a document aimed at one reader. **The
referential is the source and is never edited from here**: a fact missing at compile
time is a fact to capture upstream, not to invent downstream.

## 1. Classify before writing

Never produce a document before these four are settled. They decide length, structure,
vocabulary and what may be named. Ask only for what cannot be read from the request.

| | Values | Decides |
|---|---|---|
| **Reader** | intermediary (recruiter, ESN sales, RH) · technical decision-maker (CTO, tech lead) · training buyer | vocabulary, what leads |
| **Artifact** | 2-page CV · dossier de compétences · per-posting variant | structure and length |
| **Channel** | ATS form · direct email · freelance platform · ESN | parsing constraints, anonymisation |
| **Target** | the role aimed at, in the market's own words | title, ordering, keyword set |

The reader is the axis most often collapsed. On the French market a large share of
inbound goes through intermediaries who filter on vocabulary without reading the
technology. The same evidence therefore compiles differently: a technical
decision-maker wants the problem and the architecture, an intermediary wants the
role title, the stack and the availability.

## 2. Two artifacts, one source

These are different documents, not two lengths of the same one. Producing a compromise
between them is the most common failure and it serves neither reader.

**The CV — two pages, never three.** Beyond ten years of experience one page
under-delivers, and past two pages a measurable share of recruiters reject on sight.
Detail the last five to seven years; condense everything before into a single dense
block. Structure: identity → headline and summary → key skills → selected engagements →
earlier career → training and certifications.

**The dossier de compétences — long, mission by mission.** The format French
intermediaries expect, and the one they can re-skin. Roughly half the volume goes to
engagements, each opening with client context before its outcomes. Detail on the last
five to seven years, micro-engagements grouped rather than listed one by one. See
[references/dossier-competences.md](references/dossier-competences.md).

Cutting an eleven-page dossier down to two pages destroys the artifact intermediaries
actually read. Compile both from the same referential instead.

## 3. Aggregate what is repetitive, detail what is singular

Engagements are the reason someone reads the document, so they carry the detail.
Recurring activity is proved by its totals, not by its list: twenty-five training
sessions become four lines, seven audits become three. The referential keeps every
entry so the totals stay recomputable.

Aggregate training by course rather than by year — a reader wants to know what can be
taught, and a chronological cut exposes gaps that need a sentence rather than a table.
Prefer participant counts over session counts when a course was delivered to large
cohorts, and state the totals so nothing looks concealed.

Where a course or an offering is no longer sold, keep it in a separate line rather than
folding it into the headline figure.

## 4. Disclosure is enforced, not advised

Before emitting any client name, read its `disclosure` in the referential.

- `public` → the name may appear.
- `sector-only` → emit `## Formulation publique` verbatim. Never the name, never the
  product, never the acronym, never a domain narrow enough to identify the buyer.
- `excluded` → the engagement contributes to totals, seniority and date continuity, and
  to nothing else.

If a restricted entry has no `## Formulation publique`, stop and say so. Do not
sanitise on the fly: judging what identifies a buyer in a narrow market is the person's
call, made once, upstream.

## 5. Bullets

One formula, applied everywhere: **verb, then object with the technology named, then a
figure or a scope, on the same line**. The reader scans line starts, so the verb comes
first and the figure never spills to the next line.

Where no figure exists, state the scope instead of inventing an outcome, and make the
challenge explicit so the bullet still carries weight. Two lines is the right density;
one is thin, three is the ceiling.

Every technology listed in the skills section must appear in at least one engagement
bullet. A skill listed and never demonstrated is what reviewers call inflated duties,
and it is one of the markers they read as machine-written. See
[references/bullet-formulas.md](references/bullet-formulas.md).

## 6. Keyword coverage is a floor

Extract the posting's vocabulary, classify each term as covered, partial, gap or
not-applicable, and place what is missing where the corresponding filter reads it.
Target roughly three quarters coverage and stop there.

Full coverage is a defect, not a goal. It means terms were claimed without evidence,
and reviewers name keyword saturation as the first thing that makes a document read as
generated. Write the acronym and its expansion once each. Never append a keyword block
at the end of the document: it ties no term to a dated engagement and reads as stuffing.

On form-based channels, fill the skills and languages fields by hand. At least one
major ATS never populates them from the uploaded file, so the filters a recruiter uses
stay empty however good the document is.

## 7. Gate before delivery

Run these in order. The first three are mechanical and must pass.

1. **Plain-text extraction.** Extract the text from the produced file and read it. That
   is what a parser sees. Wrong order, merged columns or words that lost letters mean
   the file is broken whatever it looks like on screen. Watch the `fi` `ff` `fl`
   ligatures in French: *certification*, *profil*, *efficacité*, *qualifications*.
2. **Parsing rules.** Single column, no tables, no text boxes, nothing in headers or
   footers, contact details in the body, standard section headings, one date format,
   text-layer file under 2.5 MB. Full list with sources:
   [references/ats-rules-fr.md](references/ats-rules-fr.md).
3. **Disclosure.** No restricted name anywhere in the output.
4. **Dates.** No unexplained overlap, no unexplained gap, and consistency with the
   LinkedIn profile — recruiters check both.
5. **Human pass.** Read it aloud. Every verb should be one the person would actually
   say. Vary bullet length deliberately; uniform rhythm is a tell.

Do not compute or report an ATS score. No major vendor produces one a candidate could
aim at — scores come from the tools that sell them. Report findings, not a grade.

## 8. Deliver with its diff

Ship the document plus what changed and why, section by section, one line per change.
The person accepts or rejects each one. A document rewritten in one block cannot be
reviewed, only trusted.

State explicitly what was left out and why: entries dropped for relevance, figures
missing upstream, sections aggregated. Silent truncation reads as full coverage.

## Anti-patterns

- **Compromising between the CV and the dossier.** Two readers, two artifacts.
- **Reporting a score.** It measures the tool that computed it.
- **Sanitising a restricted client on the fly** instead of stopping when the public
  formulation is missing.
- **Maximising keyword coverage.** Past the floor it is the marker reviewers reject on.
- **Editing the referential from here.** Missing facts go upstream.
- **Reordering engagements out of chronology** to put a relevant one first. Parsers and
  readers both infer recency from position; move the bullets, not the entries.
- **Reducing legibility to hit a page count.** A clean two pages beats a cramped one.
