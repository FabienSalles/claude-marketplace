# ATS Rules (French market)

Parsing and filtering rules a CV must satisfy, taken from vendor documentation rather
than from the resume-optimisation industry. Read before producing or checking any CV
file.

## Contents

1. [What vendors actually document](#1-what-vendors-actually-document)
2. [There is no ATS score](#2-there-is-no-ats-score)
3. [The only documented automatic rejection](#3-the-only-documented-automatic-rejection)
4. [The French institutional source (Apec)](#4-the-french-institutional-source-apec)
5. [Safe section headings](#5-safe-section-headings)
6. [Two silent failures](#6-two-silent-failures)
7. [The decisive free test](#7-the-decisive-free-test)
8. [PDF vs DOCX](#8-pdf-vs-docx)
9. [File hygiene checklist](#9-file-hygiene-checklist)
10. [Never do this](#10-never-do-this)
11. [French ATS landscape](#11-french-ats-landscape)
12. [Regulatory note](#12-regulatory-note)

## 1. What vendors actually document

| Vendor | What its own documentation states |
| --- | --- |
| Workday | Parsing results vary with resume format and word order. Recommends resumes without images or image-based styles. Publishes no format requirement and no size limit. Documents that it does **not** auto-fill Languages and Skills from the resume. |
| Greenhouse | Publishes the most precise failure list available (see below). Cites ".docx or .pdf" with no stated preference. Does **not** score resumes. |
| Ashby | States its AI never ranks applicants and never assigns numerical ratings, and that a human must always be involved in the decision. |
| SmartRecruiters | Documents a distinct "unparsable-resume" error whose example is an image, and a 2 MB limit on its partner API (not the public form limit). Its matching score is described as aggregating structured attributes — work history, skills, seniority, education — not the prose. |
| Oracle Taleo | Resume parsing is an option that may or may not be switched on ("If Resume Parsing is on…"). Structured profile fields entered by hand are indexed independently of the resume. |
| Flatchr (French SME segment) | Parsing is a paid add-on, not a native function. On part of the French market nobody parses at all — a human opens the PDF. |

### The single most under-known rule

Workday documents that it does not auto-fill Languages and Skills from the resume.
Consequence: on that platform, the skills a recruiter filters on come from the **form**,
not from the file. A perfect CV leaves those filters empty. **Always fill skills and
languages by hand.**

### Greenhouse's documented failure list

Three families:

- **Size** — cannot parse resumes larger than 2.5 MB.
- **Placeholder data** — the parser skips what it cannot validate as real, e.g.
  "First Last", "Company 1".
- **Formatting** — spaces between letters; graphics, photos or word art; an image
  uploaded instead of a text file; tables; headers and footers; name and contact details
  placed in a header/footer or a text box; columned layout; inconsistently formatted
  sections; incomplete job titles; company names with no identifying word (Inc., Co.,
  LTD, LLC — in France, SAS, SA, SARL).

Greenhouse's refusal to score is an explicit design decision its CEO has stated
publicly: automated scoring of a document that heterogeneous inherits the biases of
whoever built the algorithm, and the judgement is better left to hiring managers.

## 2. There is no ATS score

There is no ATS score to aim at. The scores candidates see come from the optimisation
tools that compute them, and are read by no ATS.

**Report findings, never a grade.**

## 3. The only documented automatic rejection

The knockout question on the application form — mobility, degree, years of experience,
work authorisation. One wrong answer can reject. That is where attention belongs, not in
lexical density.

## 4. The French institutional source (Apec)

The Apec publishes an official page on passing ATS filters, and it is the only French
institutional source available. It recommends:

- Avoid image formats; beware flattened PDFs.
- Avoid overly creative layouts. Explicit warning on tables and text boxes.
- Use standard section headings — "Expérience professionnelle", "Compétences",
  "Formation".
- Integrate keywords naturally and coherently.
- Quantify.
- Expand acronyms, because the CV will also be read by a human.

Note what the Apec does **not** say: it never claims ATS reject automatically, only that
optimisation improves the odds of passing the filter. It gives no length recommendation.

## 5. Safe section headings

A parser segments on headings. Use these; never creative ones.

| Purpose | French | English |
| --- | --- | --- |
| Experience | Expérience professionnelle (also Expériences professionnelles, Parcours professionnel) | Work Experience / Professional Experience |
| Education | Formation | Education |
| Skills | Compétences (also Compétences techniques) | Skills / Technical Skills |
| Certifications | Certifications | Certifications |
| Languages | Langues | Languages |
| Projects | Projets | Projects |

## 6. Two silent failures

Both are invisible on screen.

**Ligatures.** The `fi`, `ff`, `fl` glyphs can extract as empty or unmapped Unicode
because the ToUnicode cmaps attached to the font map the ligature glyph ids incorrectly.
In French this hits exactly: certi**fi**cation, pro**fi**l, e**ffi**cacité,
quali**fi**cations, o**ffi**ce. The word looks perfect and is unfindable by search.

**Multi-column reading order.** A PDF encodes no logical structure: text is positioned by
coordinates and the extractor rebuilds order heuristically. On two columns the lines
interleave and a job title ends up glued to an unrelated skill. The same mechanism hits
ATS parsers and LLM pipelines.

## 7. The decisive free test

Open the produced PDF, select all, copy, paste into a plain text editor. What you see is
exactly what the parser reads. Wrong order, missing blocks, or words that lost letters
mean the file is broken whatever it looks like.

**This is the mandatory gate before any delivery.**

## 8. PDF vs DOCX

A settled non-question. The precise figures circulating (e.g. "DOCX parses at 96.7% vs
91.3% for PDF") are fabricated — no protocol, no sample, no list of ATS tested.
Greenhouse cites ".docx or .pdf" without preference; Workday names no format. For a clean
single-column text file there is no evidence of a significant difference.

What breaks is not the PDF container, it is the absence of a text layer: a scanned,
image-exported or flattened PDF has nothing to extract.

Choose DOCX only when the form requires it.

## 9. File hygiene checklist

- Single column.
- No tables.
- No text boxes.
- Nothing in headers or footers.
- Contact details in the body.
- Standard section headings.
- One date format throughout (MM/YYYY - MM/YYYY).
- Full company names with legal suffix.
- Standard bullets only — no icons, dingbats or emoji, whose glyphs are often unmapped.
- No letter-spacing effects.
- No placeholder text.
- Text-layer file under 2.5 MB; target under 1 MB.
- Generated from a word processor, not from a design tool.
- Standard fonts.
- 10 pt minimum.

## 10. Never do this

White text, 1 pt fonts, hidden keywords, instructions addressed to an AI, fabricated data
in PDF metadata.

**The mechanism most guides miss:** the parser extracts text regardless of colour and
size, and the ATS then **displays** that extracted text to the recruiter. What is
invisible in the file becomes visible in the recruiting interface. Recruiters report
eliminating these candidates almost systematically, and a select-all reveals it anyway.

On scale: an academic study measured roughly 1% of resumes carrying hidden injections
across about 200 000 real resumes, and over 90% of those were fabricated **data** in
invisible text rather than instructions — which is misrepresentation. The 41% figure
circulating has no methodology.

**Also never:** a trailing keyword block at the end of the document. It ties no term to a
dated engagement and reads as stuffing.

## 11. French ATS landscape

Reliability caveat: no independently audited market-share source exists. The available
overviews are published by vendors or commercial sites without methodology. What can be
said:

| Segment | ATS |
| --- | --- |
| Largest French groups | Workday dominates |
| Historic, declining | Taleo |
| Industry, finance, pharma | SAP SuccessFactors is strong |
| French SME / mid-cap | Flatchr, Taleez, Beetween |
| Startups | Recruitee |
| Multinationals | SmartRecruiters |
| Tech subsidiaries of US companies | Lever, Greenhouse appear mostly here |

DigitalRecruiters has become Cegid HR Talent Acquisition. What Softy, Beetween, Recruitee
and Teamtailor actually parse is not publicly specified.

## 12. Regulatory note

Since August 2026, EU regulation classifies AI systems used to filter applications and
evaluate candidates as high risk, which explains the defensive posture of vendors
refusing numerical ranking. A possible deferral to December 2027 is mentioned by one
source and its status is unconfirmed.
