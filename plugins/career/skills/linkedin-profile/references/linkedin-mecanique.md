# LinkedIn retrieval and ranking

What is actually documented about how LinkedIn finds and orders profiles. Read before
any profile rewrite. Every claim below carries its epistemic status: vendor-published,
inferred from published architecture, or undocumented. Do not upgrade one into another.

## Contents

1. [The frame: eligibility versus ranking](#1-the-frame-eligibility-versus-ranking)
2. [The recruiter filter map, field by field](#2-the-recruiter-filter-map-field-by-field)
3. [Derived filters: job function and seniority](#3-derived-filters-job-function-and-seniority)
4. [Filter logic](#4-filter-logic)
5. [What the engineering publications document](#5-what-the-engineering-publications-document)
6. [The embedding inference](#6-the-embedding-inference)
7. [Verdict on the trailing keyword block](#7-verdict-on-the-trailing-keyword-block)
8. [Compliance: the one real risk](#8-compliance-the-one-real-risk)
9. [Freelance surfaces](#9-freelance-surfaces)
10. [Settings and surfaces](#10-settings-and-surfaces)
11. [Measurement and what it cannot tell you](#11-measurement-and-what-it-cannot-tell-you)
12. [Myths to refuse](#12-myths-to-refuse)
13. [What to say when asked for a number](#13-what-to-say-when-asked-for-a-number)

## 1. The frame: eligibility versus ranking

**Eligibility** is entering a recruiter's result set. Produced by boolean filters.
Binary: present or absent.

**Ranking** is the order within that set. Produced by a learned model.

Almost every keyword question resolves once these two are separated. A term that is
present once has bought all the eligibility it can ever buy; further occurrences act, if
at all, on ranking, and no LinkedIn source documents a term-frequency signal there.

## 2. The recruiter filter map, field by field

Source: a LinkedIn Talent Solutions tip sheet on recruiter search filters. **Dating
caveat, state it whenever citing this document:** it is dated 2016-2019 and is still
served by the vendor, and it remains the only field-by-field map the platform publishes.
Treat it as the best available vendor documentation, not as a description of the current
product's internals.

| Filter | Reads | Operational consequence |
|---|---|---|
| Keywords | "data from the entire profile page" | A term placed anywhere makes the profile eligible. Satisfied by a **single** occurrence. |
| Job titles | The **Title** field of the Experience section | Does **not** read the headline. A role title only enters this filter from an Experience Title. |
| Skills | The Skills section **and** keywords in relevant sections where skills are likely to be listed | Argument for listing technologies in role descriptions as well as in Skills. |
| Companies | The Company Name field of an Experience | Client or employer names must sit in that field, not only in prose. |
| Schools | The Education section | — |
| Years of experience | Derived from the start date of the earliest position | Controlled by dates, not by any text. |

Two consequences worth stating explicitly to a user:

- The Keywords filter reading the whole page is **the only solid mechanical argument for
  a keyword block anywhere on the profile**, and it is fully satisfied by one occurrence.
- **No recruiter filter reads the headline at all.** The headline enters retrieval only
  through the Keywords filter (which reads everything anyway) and through the ranker.
  Advice that treats the headline as a titles-filter surface is wrong on the mechanics.

## 3. Derived filters: job function and seniority

The tip sheet documents that **Job function** and **Seniority** are not fields the member
fills. They are **derived from the job title** by standardisation against a canonical
taxonomy of tens of thousands of titles.

Consequence: a title that resolves badly against that taxonomy drops the profile out of
two filters the candidate never sees and can never debug. This is the mechanical reason
to use the market's standard title in an Experience Title field rather than a creative,
over-specified, or technology-loaded one.

## 4. Filter logic

Documented in the same tip sheet:

- **Implicit AND between filters.** Every filter the recruiter sets must be satisfied.
- **Implicit OR between terms within a filter.** Several variants inside one filter
  widen the set.

So a profile missing one filter's condition is absent from the set entirely, regardless
of how strong it is on the others.

## 5. What the engineering publications document

Source: LinkedIn's own engineering blog and papers.

**The ranker's objective is not lexical relevance.** It optimises **InMail Accept** —
the joint probability that the recruiter reaches out *and* the candidate responds
positively. The business metric is precision@k computed over candidates who received
*and* accepted a message.

State the consequence plainly: **appearing without converting works against the system's
own objective.** A profile that pulls impressions and no replies is being optimised
away by the metric itself.

**Architecture.** Distributed L1 retrieval followed by L2 re-scoring, personalised per
recruiter and per contract, with in-session adaptation. Two recruiters running the
identical query do not see the same order. Any advice promising "position N for query
X" is meaningless under this design.

**2026 change: sourcing moved to semantic embeddings.** LinkedIn's stated justification
is that boolean search "returned zero results for nearly half of queries". The model is
a two-tower encoder that compresses a profile into a single vector, pre-computed across
more than a billion profiles. The published relevance rubric is explicitly
multidimensional — title, seniority, industry, hard skills, education — and contains
**no density dimension**.

## 6. The embedding inference

**Label this an inference from published architecture, never as a documented fact.
LinkedIn states nothing about this case.**

In a two-tower encoder there is no occurrence counter. Added text **moves** the profile
vector rather than accumulating weight. A block of twenty role variants therefore pulls
the profile toward the average of all twenty, and so **further from each one
individually**.

Present it as a strong mechanical hypothesis that follows from the architecture the
vendor publishes. Do not present it as measured, and do not claim a magnitude.

## 7. Verdict on the trailing keyword block

The recurring pattern: a comma-separated list of role-title variants repeated at the end
of every experience and in About. The reasoning, in order:

1. **One occurrence buys eligibility.** The Keywords filter reads the entire page.
2. **Repetition across sections adds nothing retrievable.** Eligibility was already
   acquired; there is nothing left for occurrence two to win.
3. **No source documents a ranking gain** from repetition — not the tip sheet, not the
   engineering blog, not the papers.
4. **The cost lands on the one metric ranking optimises.** A reader who arrives and
   finds a wall of titles is less likely to send or accept a message, and that reply is
   precisely what the ranker maximises.

Operational rule: **keep each variant once, in prose, in the field whose filter reads
it.** Drop the cross-section repetition.

## 8. Compliance: the one real risk

**No LinkedIn source documents an algorithmic penalty for keyword stuffing.** Not in the
community policies, not in the user agreement, not on the account-restriction pages, not
on the engineering blog, not in the papers. Claiming a penalty exists is exactly as
unfounded as claiming the block works. Refuse both.

**What the policies do forbid is misleading information about qualifications and work
experience.** That constraint binds the fields that *assert facts* — above all the
**Title field of an Experience**, plus company names, dates and education — and not free
prose in About or a description. A never-held title in an Experience Title is a real
policy exposure; a list of adjacent role names in a paragraph is not.

## 9. Freelance surfaces

| Surface | Documented behaviour |
|---|---|
| Services section | Core profile section, free, available worldwide with one country excepted. Opens a free messaging channel from **any** member regardless of connection degree. |
| Profile vs company page | The choice to offer services on the personal profile or on a company page is **irreversible**. |
| Custom profile button | Occupies the **same slot** as the services section: adding or editing the button **replaces** the services on the profile. Documented, and almost never mentioned. |
| Custom button availability | Not guaranteed even with a paid plan — available to a selected subset of subscribers, on criteria the platform does not document. |
| Service-request matching | Runs on the declared service **sub-category** plus **language** plus **location**. The platform explicitly refuses to guarantee volume. Root categories hold millions of providers, so pick the narrowest sub-category available. |
| Broadcast requests | The automatic matching inherited from the former freelance marketplace ended in **May 2024**. Responding to broadcast requests is now restricted to a paid tier. |
| Reviews | Up to **twenty** past clients may be invited to review. Marking a project complete triggers a review request **without consuming one of those twenty invitations**. |
| Response badges | Two exist — responds within 24 hours, and a response rate (threshold documented around 80%). They are **the only quality signals the platform computes and displays**. |
| Recommendations | **One recommendation per position per member.** A single "independent consultant" entry therefore caps how many recommendations can ever be collected. |

## 10. Settings and surfaces

| Item | Status |
|---|---|
| Open to | Three options. Only **finding a new job** produces the public frame. **Providing services** produces none. |
| Creator mode | Removed as a toggle in **March 2024**. Nothing remains to activate. |
| Profile hashtags | Removed in **February 2024**. |
| Skill assessments and badges | Removed in **2023**, purged from profiles in **2024**. |
| Skills cap | **100**, not 50, since **February 2024**. |
| Profile language | A genuine recruiter filter. A secondary-language profile is indexed **separately**, with its own URL. |
| Custom URL | **No documented effect on internal ranking.** Its effect is on external search. |

## 11. Measurement and what it cannot tell you

Search appearances shows a **total count** plus aggregated insights on the searchers
(top companies, top job titles), updated **weekly**.

**It does not show the search terms.**

State the consequence directly: **no keyword change can be attributed to a variation in
that number.** The instrument does not expose the variable. This is precisely why no
credible test of the trailing keyword block has ever been published — not because
nobody tried, but because the platform gives no attributable signal to test against.

## 12. Myths to refuse

| Myth | Why it is refused |
|---|---|
| Any per-field weighting ("the headline is 60% of ranking") | The document usually cited does not exist; the circulating figures contradict each other; LinkedIn states it does not disclose its feature list. |
| "All-Star profiles appear in 40x more searches" | No traceable primary source, and the profile-strength indicator and badge have been retired. |
| "The algorithm penalises keyword density" | Undocumented anywhere. A mental transfer from web SEO onto a system that does not work like a web engine. |
| "Search appearances shows the keywords used to find you" | It does not. Total count plus aggregated searcher insights only. |
| "Pass the skill assessments for the badges" | Removed from the platform. |
| "You can add 50 skills" | It is 100. |
| "Connection degree orders recruiter results" | In the recruiter product, degree is a **filter** and a plan limit, not an ordering. In the **free people search**, network proximity genuinely does weigh, and the platform recommends widening one's network for that reason. Say which product you mean. |

## 13. What to say when asked for a number

Refuse per-field weights outright: LinkedIn declares it does not disclose its feature
list, so any percentage in circulation was invented somewhere and copied since.

Quote **mechanisms**, not magnitudes. "The job titles filter reads the Experience Title
field" is checkable. "The Title field is worth 30%" is not, and repeating it is how the
folklore this skill exists to remove gets laundered into advice.

Require a **primary link** before repeating any figure: LinkedIn help pages, the
engineering blog, the business or Talent Solutions pages, or the company's own papers.
A blog citing a blog is not a source. When no primary source exists, say the figure is
undocumented and give the mechanism instead — that answer is more useful than the number
the user asked for, and it is the only one that survives being checked.
