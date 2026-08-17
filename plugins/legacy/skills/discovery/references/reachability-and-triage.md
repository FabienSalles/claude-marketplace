# Reachability and finding triage

Replaces the scattered security paragraphs of `audit-prep.md` §4. Scope: what
"reachable" actually means when a tool prints it, which tools compute it for
PHP, and how a finding list becomes a defensible report instead of a pile.

The doctrine applies here harder than anywhere else in the skill: **the model
never produces the finding list.** A deterministic tool enumerates, the model
explains and filters, a human confirms by sampling. Where no tool answers,
write the analyzer, never the analysis. Section 6 gives the measured reason.

Every repository claim below was re-verified on 2026-08-16 with
`gh api repos/OWNER/REPO --jq '.pushed_at, .archived'`. Re-verify before
quoting anything to a client. Commands are marked **[tested here]** (run in a
real git repo on macOS during authoring) or **[sourced, not tested here]**
(taken from vendor documentation; no PHP runtime was available).

---

## 1. The free deterministic floor — run this before any reachability talk

Four questions get answered with no vendor, no account, no upload. Run them
first; every later refinement is measured against these numbers.

### 1.1 `composer audit` is the control baseline

```bash
composer audit --format=json > composer-audit.json
```

**[sourced, not tested here]** — built into Composer since 2.4
(github.com/composer/composer, 2.10.2 published 2026-07-01), backed by
github.com/FriendsOfPHP/security-advisories (alive, pushed 2026-08-14).

Version matching only. No reachability, no exploitability. Present it as an
inventory, not a risk verdict.

Its real job is arithmetic: **any tool reporting FEWER vulnerable packages than
`composer audit` is filtering, and the report must say exactly why** —
reachability rule absent, severity threshold, dev-dependency exclusion,
different advisory source. An unexplained smaller number is a silent
suppression, and a client who re-runs `composer audit` themselves will find it.

These commands query a remote advisory database. On an offline client VM they
fail, and a failed or absent scan is recorded as `not run (<reason>)`, never as
zero vulnerabilities.

### 1.2 `syft` + `grype` — the inventory that ages honestly

```bash
syft dir:. -o cyclonedx-json=sbom.json
grype db status
grype sbom:sbom.json -o json > grype-findings.json
```

**[sourced, not tested here]** — neither binary is installed on this machine.
github.com/anchore/syft v1.51.0 (2026-08-10) and github.com/anchore/grype
v0.117.0 (2026-08-10), both alive. Syft ships a dedicated PHP cataloger
(`syft/pkg/cataloger/php`) covering `composer.lock`, `installed.json` and
PECL/PEAR, so the Composer inventory is parsed rather than inferred.

The split matters: Syft produces the inventory, Grype matches it against a
vulnerability database. Same SBOM plus same database equals the same findings,
which is what makes a rerun months later a *measurement of drift* rather than a
new opinion. Record the `grype db status` output next to the findings —
`grype db` exposes `status`, `list`, `import`, `diff` and `check` subcommands
(verified in `cmd/grype/cli/commands` on `main`), so a pinned database archive
can be re-imported to reproduce a run byte for byte.

Grype's README states "OpenVEX support for filtering and augmenting scan
results" and prioritisation "with EPSS, KEV, and risk scoring". On EPSS
specifically: the current model version is
**unverified** — secondary sources say v4 (March 2025) but `first.org/epss/model`
did not resolve during research. Cite `api.first.org/epss` as the interface, not
a version number.

### 1.3 `gitleaks` — secrets alive in history, absent from HEAD

```bash
gitleaks git -v --report-path gitleaks.json .
```

**[sourced, not tested here]** — github.com/gitleaks/gitleaks v8.30.1
(2026-03-21), alive, MIT. The README documents that it drives `git log -p` and
that `--log-opts` configures the range, plus a baseline file (`-b`) to suppress
known findings.

This is the archaeology finding a client feels immediately: a credential
deleted in HEAD is still a live credential if it sits in a reachable commit.
Every hit carries a commit SHA and a line, so it is sampleable.

README caveat to carry: gitleaks inspects **additions** in history, so it finds
a secret that was committed, not one that was only ever deleted. Composite
rules are flagged experimental upstream.

A cheap complementary pass, no install required:

```bash
git log --all --diff-filter=A --name-only --pretty=format: | sort -u \
  | grep -iE '\.env|credential|secret|\.p12$'
```

**[tested here]** — returns paths added at any point in history. It found two
files in this repository. Never echo the values found; truncate any cited
secret to first and last four characters, and flag it for rotation.

### 1.4 OpenSSF Scorecard — will a future CVE in this package get fixed?

No CVE scanner answers that question. Loop Scorecard over the direct
dependencies and it becomes a table of numbers.

```bash
jq -r '.packages[].source.url
       | select(test("github.com"))
       | sub("^https://";"") | sub("\\.git$";"")' composer.lock \
| while read -r repo; do
    scorecard --repo="$repo" --format=json > "scorecard-${repo//\//_}.json"
  done
```

**[tested here]** for the `jq` extraction and the loop shape, against a
synthetic `composer.lock`; the `scorecard` invocation itself is
**[sourced, not tested here]** (binary absent). github.com/ossf/scorecard
v5.5.0 (2026-04-23), alive. `.packages` is runtime only — `.packages-dev`
holds dev dependencies and is deliberately excluded.

This is the write-the-analyzer pattern at its cheapest: the model writes the
loop, the tool produces every number, and the reviewable unit is six lines of
shell. In a legacy Composer tree full of half-abandoned packages, this
forward-looking risk usually outweighs today's CVE list.

---

## 2. Two different claims, both sold as "reachable"

This distinction decides what can be said to a client. Two findings printed by
two tools, both labelled reachable, can rest on completely different evidence.

| | Curated per-CVE rules | Computed call graph |
|---|---|---|
| Mechanism | A hand-curated rule per CVE describing the vulnerable usage pattern | The tool builds a call graph of the application and the dependency, then looks for a path |
| What "reachable" proves | The codebase contains a usage pattern someone wrote a rule for | A call path exists from application code to the vulnerable function |
| Ceiling | The published **coverage window**. No rule, no reachability | None from CVE age or severity |
| Blind spot | Everything outside the window | Reflection, dynamic dispatch, runtime-generated code |
| The tell | A **date-bounded coverage window** stated in the docs | Vendor documentation naming reflection as an open gap |
| Failure mode | Silent degradation to version matching, **in the same result set** | Missed path, reported as not-reachable |

### 2.1 The coverage window is the tell

Semgrep Supply Chain publishes reachability rules for **Critical-severity CVEs
back to 2017 and High-severity CVEs back to May 2022** (verified on
semgrep.dev, the PHP reachability launch post,
https://semgrep.dev/blog/2025/taming-the-elephant-introducing-reachability-analysis-for-php/).

Read what that implies. A Medium-severity CVE has no rule. A Critical from
2015 has no rule. Those findings do not disappear and are not flagged as
un-analysed — **they appear in the same result set, silently degraded to plain
version matching.** A severity-and-date-bounded window is the signature of
rules authored one CVE at a time.

Whether the rules are literally hand-written per CVE is **unverified** —
Semgrep never states the authoring process. Write "curated per-CVE rules,
bounded by a published coverage window", not "manually written".

Client-safe phrasing for a rule-based reachable finding:

> Reachable: the codebase uses the vulnerable pattern described by the vendor's
> rule for this CVE. Findings outside the vendor's published coverage window
> (Critical since 2017, High since May 2022) carry no reachability signal at
> all and are reported as version matches.

### 2.2 The call graph has real blind spots, and they are Symfony's

Socket.dev's own launch post names the remaining gaps verbatim:
"reflection-driven dispatch and runtime-generated code"
(https://socket.dev/blog/reachability-for-php, 2026-04-24, vendor-published).

That is a precise description of a Symfony application at runtime. The
compiled container resolves services through generated PHP; lazy services go
through generated proxy classes; `__call` and string-keyed container lookups
move dispatch out of the static call graph. The vendor states it models
Laravel's container, Symfony's DI and PHP-DI, and handles `__call` — but the
gap it declares lands on exactly the machinery a Symfony app leans on hardest.

Client-safe phrasing for a call-graph finding:

> Not reachable in the computed call graph. The graph does not resolve
> reflection or runtime-generated code, which in this codebase covers the
> compiled container and proxy classes. Treat as a strong prior, verified by
> sampling, not as proof of non-exploitability.

Sample-verify before repeating either claim. Open the cited file and line, and
follow the path by hand for a handful of findings. The sample is the evidence
that the tool output was read rather than forwarded.

---

## 3. Who actually supports PHP

Verified 2026-08-16. Every row was checked against the vendor's own
documentation or the repository.

| Tool | Mechanism | PHP reachability | Self-hosted | Source |
|---|---|---|---|---|
| Socket.dev | Function-level call graph | **Yes**, since 2026-04-24 | No (SaaS) | https://socket.dev/blog/reachability-for-php |
| OWASP dep-scan + atom | Call-graph / data-flow slicing | **Yes** | **Yes** | https://depscan.readthedocs.io/reachability-analysis/ |
| Semgrep Supply Chain | Curated per-CVE rules | Yes, bounded by coverage window | No (commercial) | https://docs.semgrep.dev/supported-languages |
| Endor Labs | Whole-app call graph | **No** — stated in vendor docs | No | https://docs.endorlabs.com/scan/sca/php |
| Snyk | Call graph + AI ranking | **No** — PHP absent from the table | No | https://docs.snyk.io/scan-fix-and-prevent/fix/prioritize-issues-for-fixing/reachability-analysis |
| CodeQL | Interprocedural taint | **No** — PHP never supported | Licence-gated | https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/ |
| OSV-Scanner | Lockfile → OSV matching | No (Go and experimental Rust only) | Yes | https://github.com/google/osv-scanner |

Row-by-row, the parts that matter in a client conversation:

**Endor Labs** markets function-level reachability as its core differentiator
and excludes PHP by name in its own documentation: "Call graphs are not
supported for PHP projects." PHP gets dependency-level analysis only. Use the
**resolved** URL `https://docs.endorlabs.com/scan/sca/php` — the older
`/scan-with-endorlabs/language-scanning/php/` path 301-redirects and will rot.

**Snyk** lists reachability for Java (Maven, Gradle) GA, JavaScript/TypeScript
(npm, Yarn, pnpm) GA, Python (pip, poetry, pipenv) GA and C# (NuGet, paket)
Early Access. PHP/Composer is absent. Snyk Open Source still lists PHP
dependency CVEs, version-matched — precisely the noise reachability was meant
to remove. Note also that Snyk's pipeline is explicitly **hybrid**: its docs
describe NLP ranking of related code elements and manual expert verification
ahead of the call-graph step, so "Snyk says reachable" is not a purely
deterministic claim.

**CodeQL** has never supported PHP. The August 2026 supported-languages list is
C/C++, C#, GitHub Actions, Go, Java, Kotlin, JavaScript, Python, Ruby, Rust,
Swift, TypeScript. This is the answer to "why aren't you using CodeQL?" — it
does not parse the stack, before licensing is discussed at all. **Correction to
a widely repeated claim:** github.com/github/codeql is MIT-licensed (`gh api
repos/github/codeql --jq .license.spdx_id` returns `MIT` — **[tested here]**;
`--jq .license` returns the whole licence object, not the string). The
frequently quoted "not an Open Source Codebase" restriction is **not** in that
repository and must not be attributed to it. A commercial gate on the
separately distributed CodeQL CLI binary is real, but its exact wording was not
verified during this research — do not quote it.

**Socket.dev** publishes accuracy figures for its PHP engine: "above 90% on
PHPUnit, WordPress, and Flysystem, and in the mid-to-high 80s on Twig and
Espo". These are **vendor-published**, with **no disclosed methodology**, no
published test corpus, and no independent replication found. Given the declared
reflection gap, real-world accuracy on a DI-heavy Symfony codebase is plausibly
below the headline range — that assessment is **unverified**. The engine is
described as built with researchers at Aarhus University. Operationally the
blocker is legal, not technical: it requires uploading client dependency and
source metadata, so obtain written client consent before pointing it at a repo.

---

## 4. Semgrep on PHP: cross-function, not cross-file

Semgrep's own support matrix (https://docs.semgrep.dev/supported-languages)
lists cross-**file** dataflow for C#, Go, Java, JavaScript, Kotlin, Python,
TypeScript and C/C++. PHP sits one tier down, at **cross-function dataflow**
only, alongside JSX, Ruby, Scala, Swift, Rust and Terraform. The PHP row reads
verbatim: "Generally available / Cross-function dataflow analysis / 50+ Pro
rules".

Concretely, in a Symfony application:

```
OrderController::create()      src/Controller/OrderController.php
  → OrderService::place()      src/Service/OrderService.php
    → OrderRepository::save()  src/Repository/OrderRepository.php
```

A taint path from `$request->get('ref')` through the service to a raw
`Connection::executeQuery()` in the repository spans three files. Semgrep does
not follow it on PHP. **Expect false negatives from this limit, not false
positives.** A clean Semgrep run on a Symfony codebase is not evidence that no
taint path exists; it is evidence that no taint path exists *within a single
file*.

Paying for Semgrep Pro does not change this. Interfile taint tracking is not
offered for PHP, which is exactly where controller-to-service-to-repository
flows live.

What Semgrep is genuinely good for here is the analyzer pattern: have the model
author a custom YAML rule from a natural-language description of the smell,
validate it with `semgrep --test` against annotated fixtures, then ship the
rule with the report. The rule is the reviewable artifact and the client can
re-run it in CI. github.com/semgrep/semgrep v1.173.0 (2026-08-13), alive.

Stale-recommendation trap: the standalone `semgrep/mcp` repository is
**archived** (last push 2025-10-28) while third-party MCP directories still
list it as current. The live MCP server is vendored inside the semgrep binary
at `cli/src/semgrep/mcp`. A model recommending the standalone repo from memory
sends the reader to a dead project with 683 stars.

---

## 5. The only free, self-hosted PHP reachability path

```bash
docker run --rm -v "$PWD":/app ghcr.io/owasp-dep-scan/dep-scan \
  depscan --profile research -t php -i /app --reports-dir /app/reports --explain
```

**[sourced, not tested here]** — the flags and the `PHP >= 7.4` requirement are
documented on `/languages/jvm-js-python-php-reachability/` and
`/supported-languages/` at https://depscan.readthedocs.io (the
`/reachability-analysis/` overview shows only a generic `-t <language>`
placeholder). Those pages give the bare `depscan …` form; the image name and the
container wrapper come from the repository README. No PHP runtime and no
suitable target project existed during authoring.

The repeated `depscan` after the image name is load-bearing. The Dockerfile ends
on `CMD [ "depscan" ]` with no `ENTRYPOINT`, so arguments placed straight after
the image **replace** the default command instead of extending it, and
`docker run … dep-scan --profile research …` dies on
`exec: "--profile": executable file not found in $PATH` — **[tested here]**
against a locally built image with the same `CMD`-without-`ENTRYPOINT` shape.

github.com/owasp-dep-scan/dep-scan v6.3.0 (2026-07-23), alive, 1280 stars. The
reachability docs state verbatim: "atom backs Java/JVM, JavaScript/TypeScript,
Python, and PHP." The `--explain` flag emits the reachable flow; reports come
out as JSON/CycloneDX, so an agent consumes them without parsing prose.

**This is the only open-source, self-hostable, zero-egress path to PHP
function-level reachability that exists.** On an audit engagement where client
source cannot leave the premises, it is the only option at all — which is
usually the real blocker, not price.

Two limits to state in the report, both **unverified** rather than dismissed:

1. **Single point of failure.** The slicer is github.com/AppThreat/atom
   (v3.1.1, 2026-08-07, alive, **97 stars**), recently rewritten in Rust. One
   small project carries the entire open-source PHP reachability capability.
   Bus factor cannot be assessed from repository metadata, and this is a
   genuine fragility in the OSS supply chain for this territory.
2. **Symfony accuracy is unmeasured.** No published benchmark, no independent
   evaluation, and the documentation is silent on autoloading, dynamic dispatch
   and PSR-4 resolution. Treat output as a strong prior to sample-verify, never
   as truth.

For arbitrary structural questions rather than CVE reachability, the
open-source substrate is Joern (github.com/joernio/joern, v4.0.604, alive) with
its `php2cpg` frontend — actively maintained (commits 2026-07-09 through
2026-08-13) despite the repository description omitting PHP entirely. Have the
model write CPGQL queries, let Joern execute them and emit the counts. Quality
on Symfony's DI indirection is **unverified**: no evaluation of PHP CPG
completeness was found.

---

## 6. Triage: never let the model produce the finding list

### 6.1 The measured argument

**SastBench** (arXiv 2601.02941, Feiglin & Dar, submitted 2026-01-06;
github.com/RivalSecurity/sastbench, Apache-2.0) measures how well LLM agents
triage SAST findings. The dataset is 2,737 samples — 299 true positives against
2,438 false positives, an **8.15:1 false-to-true imbalance** — across 38
languages and 139 CWEs. PHP is **deliberately included**; the paper notes that
"most datasets don't contain PHP, though it is one of the languages with most
vulnerabilities".

Results for the best measured configuration:

| Configuration | MCC | Precision | Recall |
|---|---|---|---|
| Gemini 2.5 Pro (Improved ReAct) | 0.148 | **0.169** | 0.582 |
| Claude Sonnet 4.5 (Improved ReAct) | 0.110 | 0.140 | 0.722 |

**Roughly five of every six findings the best agent calls real are not.** That
number is the entire argument for the division of labour below, and it is
citable, reproducible and PHP-inclusive.

One honesty caveat to carry: the paper does not publish a per-language sample
breakdown, so **SastBench is not yet evidence about PHP specifically**. The
dataset ships in `data/`, so the PHP sample count is directly countable —
count it before citing SastBench as a PHP claim.

**RealVuln** (arXiv 2604.13764, Pellew & Raza, Kolega.Dev, dated 2026-03-31) is
the useful counterweight: 26 repositories, 796 hand-labelled entries including
120 deliberate false-positive traps. Semgrep 0.205 precision / 0.175 recall;
Claude Sonnet 4.6 0.785 / 0.498; Kolega.Dev 0.388 / 0.809. **Python only** —
cite it for the methodological point that precision and recall trade off hard,
never for a PHP claim. Read the vendor bias openly: the authors benchmark their
own commercial tool, and the headline ranking uses F3, which weights recall 9x.

Two independent benchmarks disagreeing on magnitude while agreeing on direction
is itself the finding.

### 6.2 The division of labour

The best-measured 2026 statement of the correct architecture is Tencent's
industrial study (arXiv 2601.18844, Du et al., 2026-01-26): a deterministic
analyzer defines the candidate set, an LLM classifies each alarm true or false
using source and sink context, and a human confirms. On 433 alarms (328 false
positives, 105 true positives) across three bug categories, the hybrid
eliminated **94-98% of false positives with high recall**, at 2.1-109.5 seconds
and $0.0011-$0.12 per alarm, against a baseline burden of **10-20 minutes of
manual inspection per alarm** (per alarm triaged, not per false alarm). Not a
PHP study — the architecture transfers, the numbers do not.

So:

- **The tool enumerates.** `composer audit`, `grype`, dep-scan, Semgrep,
  PHPStan and Psalm define what exists. The candidate set is never the model's.
- **The model filters and explains.** It writes the exploitability narrative,
  proposes the fix diff, and classifies alarms — over a list it did not create.
- **The human confirms by sampling.** Open the cited file and line for a
  sample of findings and check the path by hand. The sample size and its result
  go in the report.

Two named traps:

- **A second AI pass is not verification.** Huang et al., *Large Language
  Models Cannot Self-Correct Reasoning Yet* (arXiv 2310.01798, ICLR 2024):
  intrinsic self-correction, with no external signal, does not improve
  reasoning and at times degrades it. Only an external signal — a script that
  runs, a test that fails, a grep that counts — verifies anything.
- **Ranking by LLM has measurable ordering bias.** Zheng et al., *Judging
  LLM-as-a-Judge* (arXiv 2306.05685, NeurIPS 2023 D&B) documents position,
  verbosity and self-enhancement biases alongside over-80% agreement with human
  preference. If a model ranks a findings list, score it in both orders and
  average, or the ranking is an artefact of ordering.

---

## 7. Computing a priority instead of inventing one

CVSS gives theoretical severity computed outside any environment. It is an
input, never the verdict. The free machine-readable inputs below let an agent
**compute** a priority and record how it got there.

### 7.1 CISA Vulnrichment — three decision points, free, hourly

github.com/cisagov/vulnrichment, alive, pushed 2026-08-16T17:15:55Z, updated
continuously. README verbatim: "Every CVE analyzed by the CISA ADP will have
three SSVC decision points listed." Records span 1999 through 2026.

```bash
curl -s https://raw.githubusercontent.com/cisagov/vulnrichment/develop/2024/21xxx/CVE-2024-21626.json \
| jq -r '.containers.adp[]?.metrics[]?.other
         | select(.type=="ssvc") | .content.options'
```

**[tested here]** — returns:

```json
[
  { "Exploitation": "poc" },
  { "Automatable": "no" },
  { "Technical Impact": "total" }
]
```

The path is `<year>/<bucket>xxx/<CVE-ID>.json` on the `develop` branch, where
the bucket is the CVE number's thousands prefix. Note that CISA stopped adding
CPE strings to new enrichments on 2024-12-10, so do not build a matcher on
that field.

### 7.2 CERT/CC SSVC — the decision tree

github.com/CERTCC/SSVC, alive, release 2026.7.0 (2026-07-20, calendar
versioning, so recency reads off the tag). Outcomes are **Track / Track\* /
Attend / Act** rather than a number. CISA hosts a companion calculator at
`cisa.gov/ssvc-calculator` with PDF and JSON export. Fetch it with `curl`, not
with an agent fetcher: `curl` returns 200 with a browser User-Agent, with the
default `curl/*` one, and with the header suppressed entirely, while WebFetch
returns 403 — **[tested here]**. The block is not User-Agent based, so do not
report it as one.

### 7.3 The rule

> **The agent never invents Exploitation, Automatable or Technical Impact.**
> Those three come from Vulnrichment as data, or the finding is recorded as
> un-enriched. The agent **asks the human** for mission prevalence and public
> well-being impact — those are client judgements about the business, and no
> repository carries them. The agent then computes the outcome and records
> every input alongside it.

This is what makes a decision reviewable. A decision tree with recorded inputs
can be defended months later, in front of someone who was not in the room:
*here is what was known, here is what the client told us, here is the branch
that produced "Track".* **"CVSS 7.5, we deprioritised it" cannot be defended at
all** — it records neither the environment nor the judgement.

This is how a decision **not** to fix gets defended. Most audit findings end in
that decision; the ones that end there without a recorded reason are the ones
that come back.

Downstream, github.com/DependencyTrack/dependency-track (5.0.4, 2026-07-30,
alive) consumes CycloneDX SBOMs, integrates EPSS, and produces and consumes
VEX/VDR — the natural way to turn a one-off audit into a monitoring deliverable
the client keeps.

### 7.3 When the audited application itself calls a model

A growing share of PHP applications embed an LLM call, and at that point none of
the frameworks above describe the risk. The reference set changes:

- **OWASP GenAI Security Project** (genai.owasp.org) — the LLM application risk
  top ten, re-released **2026-08-03**, plus a top ten for agentic applications.
  Guidance, not tooling: the project ships no scanner and no repo to run.
- **OWASP AIVSS** (aivss.owasp.org) — a scoring system for vulnerabilities of AI
  systems, **v0.8, February 2026**, PDF specification plus an interactive
  calculator built on an SSVC decision tree.

Two rules follow. Scope: these score the vulnerabilities *of an AI system*, not
those of a PHP application that happens to be audited with AI — conflating the
two is the standing confusion of this whole field. Maturity: a v0.8 is not a
settled specification, so cite it as emerging rather than as a standard.

Sourcing note worth carrying: the press reports a precise incident count behind
the 2026 edition while the project's own page says only "thousands". Prefer the
project's wording.

---

## 8. VEX: the structured claim

A reachability conclusion that stays in a PDF paragraph dies with the PDF. VEX
turns it into a machine-readable statement the client's own scanner consumes.

OpenVEX statuses, read from the specification source
(github.com/openvex/spec, `OPENVEX-SPEC.md`): `not_affected`, `affected`,
`fixed`, `under_investigation`.

Justifications, required when the status is `not_affected`, verified from the
same source — **exactly five values**:

| Justification | Use when |
|---|---|
| `component_not_present` | The vulnerable component is not in the product at all |
| `vulnerable_code_not_present` | The component is present, the vulnerable code is not |
| `vulnerable_code_not_in_execute_path` | The vulnerable code is present but never called |
| `vulnerable_code_cannot_be_controlled_by_adversary` | Called, but no attacker-controlled data reaches it |
| `inline_mitigations_already_exist` | A mitigation in the product already blocks it |

The enum is the point. It forces a real statement instead of "we assessed this
as low risk". Picking between `vulnerable_code_not_in_execute_path` and
`vulnerable_code_cannot_be_controlled_by_adversary` is exactly the reasoning
the report should contain.

```bash
vexctl create --product="pkg:composer/vendor/package@1.2.3" \
              --vuln="CVE-2024-12345" \
              --status="not_affected" \
              --justification="vulnerable_code_not_in_execute_path"
```

**[sourced, not tested here]** — syntax taken from the `vexctl` README; the
binary is not installed on this machine.

Ecosystem state, verified 2026-08-16:

- `openvex/spec` — alive but **stale**: last push 2026-01-16, and the latest
  tagged release is **v0.2.0 from 2023-08-22**, nearly three years old. Read
  this as a finished, stable document rather than an abandoned project, but do
  not expect movement.
- `openvex/vexctl` — healthier: pushed 2026-08-13, v0.4.4 (2026-06-16). Tooling
  is ahead of the specification.
- `CycloneDX/specification` — the competing VEX/VDR representation and clearly
  more active: pushed 2026-08-16, release 1.7.1 (2026-06-02). If the client
  already runs Dependency-Track or produces CycloneDX SBOMs, use CycloneDX's
  representation rather than introducing a second format.

**The rule: an agent may draft VEX statements from reachability output. A named
human attests.** Do not automate the signature. A signed `not_affected`
suppresses the finding in every downstream scanner, and the person whose name
is on it must have looked at the path.

---

## 9. The design-fault bucket

A point that is not reachable from a real entry with attacker-controlled data
**is not reported as a vulnerability**. That rule is what keeps the report
usable, and it is what the curl project's experience makes concrete: the
maintainers ended monetary bug-bounty rewards on 2026-01-31 after the confirmed
report rate fell from historically "north of 15%" to below 5%, attributed to an
"explosion in AI slop reports" (Daniel Stenberg, 2026-01-26). Volume without
triage killed the bounty; the reporting channel itself survives, redirected to
GitHub private vulnerability reporting and `security@curl.se`.

But not-exploitable is not the same as noise. A finding still belongs in the
report when it signals a design fault:

- validation placed too late,
- a responsibility misplaced,
- a protection that relies on the caller rather than the callee.

These go in a **different section, with a different criticality**:

```markdown
### Design findings (not exploitable)

A point not reachable from a real entry with attacker-controlled data is not
reported as a vulnerability. It goes here when it still signals a design fault
— validation placed too late, a responsibility misplaced, a protection that
relies on the caller — with a location and a fix, and **no CVSS score**.
```

No CVSS score is deliberate. Scoring a non-exploitable design fault is the
failure that produces the 500-line noisy report; dropping it is the failure
that loses the design signal a takeover audit exists to surface. The separate
section avoids both.

This also fixes a live contradiction in the marketplace worth knowing about:
`audit:security-overrides` §2 lists generic input-validation findings under
"findings to automatically downgrade or dismiss" unless a concrete attack path
is identified. Downgrade, yes. **Dismiss, no** — route them here instead.

---

## 10. Before quoting any of this

```bash
gh api repos/OWNER/REPO --jq '.pushed_at, .archived'
```

**[tested here]** — the single check that catches the most common failure,
which is a model recommending a project that has been archived for a year.

Everything in this file was verified on **2026-08-16**. Versions move, vendors
change coverage tables, and archived repositories stay listed in third-party
directories for months. Re-verify liveness before a version, a support claim,
or a coverage window reaches a client deliverable, and carry the words
**vendor-published** and **unverified** through to the report exactly as they
appear here.
