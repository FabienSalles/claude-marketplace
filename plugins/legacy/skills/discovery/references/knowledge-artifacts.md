# Knowledge artifacts that stay true

The knowledge base this skill produces will be wrong in three months. Not all of
it, and not at the same rate — and the difference is structural, not editorial.

**Documentation that is generated, or gated by a drift check, stays true.
Documentation that is written rots the moment the code moves.** No amount of
discipline changes which bucket an artifact is in. What changes it is attaching a
command to the artifact: either the artifact is the output of a command, or a
command fails when the artifact stops describing reality.

Everything below was verified live on 2026-08-16. Re-verify before quoting a
version to a client: `gh api repos/OWNER/REPO --jq '.pushed_at, .archived'`.
Commands marked *(untested here)* were sourced from the tool's own source or docs
but could not be executed in this repository — it has no PHP and no database.

## 1. Sort every artifact into its bucket

| Artifact | Bucket | What keeps it true |
|---|---|---|
| `recon.md` | **Generated** | Every row already carries its command. Store the commands as a script; the file becomes its output. |
| `entity-model.md` (relationships, columns, constraints) | **Drift-checkable** | `tbls diff` against the live database, exit code 1 on divergence. |
| `entity-model.md` (business meaning per entity) | Written | Nothing checks it. It rots slowest because domain meaning outlives schema. |
| `architecture.md` (dependency direction, violations) | **Drift-checkable** | Deptrac baseline, `debug:container --format=json`. A new violation fails the run. |
| `architecture.md` (module purpose prose) | Written | Rots on the next reorganisation. |
| `use-cases/*.md` (entry points covered) | **Drift-checkable** | Diff the route list against `debug:router --format=json`; a route that vanished or appeared is an unmaintained use case. |
| `use-cases/*.md` (scenarios, `BR-XXX` rules) | Written | The most valuable and least checkable output of the whole exercise. Treat accordingly. |
| `glossary.md` | Written | The term inventory (class/table/route nouns) regenerates; the meanings do not. |
| `risk-register.md` (CVEs, type debt, dead code, churn, distance-to-modern) | **Generated** | Every one of these has a tool — see [deterministic-tools.md](deterministic-tools.md). Re-running is the update. |
| `risk-register.md` (impact, `needs-human-validation` rows) | Written | Depends on facts the repository does not contain. |
| `open-questions.md` | Written, and correctly so | It is a to-do list, not a claim about the code. It cannot rot; it can only be answered. |
| `README.md` routing table | **Checkable** | Link integrity: every artifact reachable, every link resolving. |
| `security-surface.md` (audit-prep) | **Generated**, expires fastest | Routes × authorization config. Regenerate rather than amend; a stale authz matrix is worse than none. |

Two consequences worth stating to whoever commissions this.

First, the generated column is where regeneration cost approaches zero, so it can
be re-run on every takeover milestone. The written column is where the consultant's
value sits, and it is precisely the column no tool defends. Do not sell them as one
deliverable with one freshness guarantee.

Second, an artifact in the written bucket does not become checkable by adding a
"last reviewed" date. That records that someone looked, not that anything is true.

## 2. Drift detection is the only mechanism that works

Four tools implement it for real. They share one design: constrain the question to
a machine-comparable artifact, then return an exit code.

### tbls — schema versus committed docs

https://github.com/k1LoW/tbls — MIT, 4315 stars, v1.95.0 (2026-07-11), pushed
2026-08-04, not archived.

`tbls doc` generates Markdown documentation of every table, column, index and
foreign key from a live database connection. `tbls diff` compares the live schema
against those committed documents. **It exits 1 when they differ** — verified in
the source, `cmd/diff.go` lines 149-150: `if diff != "" { os.Exit(1) }`. The README
does not state the exit code anywhere; it demonstrates the behaviour by putting
`tbls diff` in a CI `script:` block, and documents the loop verbatim at lines
323-326: "1. Commit the document using `tbls doc`. 2. Update the database schema in
the development cycle. 3. Check for document updates by running `tbls diff` or
`tbls lint` in CI. 4. Return to 1."

This is the only mature tool in the whole territory that turns "the docs are stale"
into a build failure. `tbls lint` adds rules (`requireTableComment`,
`requireForeignKeyIndex`, `requireColumns`, `unrelatedTable`), and `unrelatedTable`
is the orphan-table list — produced by a command rather than by reading. `tbls
coverage` is a narrower thing than its name suggests: README line 295 defines it as
"document coverage (description, comments)", not how much of the schema exists in
the docs at all.

```bash
# (untested here — needs a database)
tbls doc --force
tbls diff        # exit 1 = the committed docs no longer describe the database
tbls lint
```

Let the agent write `.tbls.yml` for this specific schema — viewpoints, exclusions,
lint rules — and let tbls produce the numbers. No schema fact enters an artifact
that was not read out of tbls output.

### oasdiff — API contract versus API contract

https://github.com/oasdiff/oasdiff — Apache-2.0, 1319 stars, v1.29.1
(2026-08-16), not archived. **The repository moved: `Tufin/oasdiff` still
redirects, but the canonical owner is now `oasdiff`.** Cite the new URL.

It diffs two OpenAPI specs and classifies every change: `diff` is the full
machine-readable diff, `breaking` lists only what breaks existing clients,
`changelog` is the consumer-facing summary, and `checks changelog` prints the
classification rules so a client can see what "breaking" means here rather than
take it on trust.

Exit-code behaviour, verified in source this session (the research carried it as
unverified):

- `internal/diff.go:29` — `--fail-on-diff` / `-o`, "exit with return code 1 when
  any change is found".
- `internal/breaking_changes.go:22` and `internal/changelog.go:28` — `--fail-on` /
  `-o`, "exit with return code 1 when output includes errors with this level or
  higher".

On a takeover the interesting use is not release gating. **Export the OpenAPI
document once, commit it, and every future divergence between the code and the
documented contract becomes a command instead of an incident.**

For that to work the spec must come out of the existing code, which on Symfony it
does: API Platform (https://github.com/api-platform/core, pushed 2026-08-16) and
NelmioApiDocBundle (https://github.com/nelmio/NelmioApiDocBundle, pushed
2026-08-12) both export an OpenAPI document from an existing codebase. Neither
requires the code to be modified first. Find the export route or console command
in the client's app, dump to a file, commit it as the baseline.

```bash
# (untested here — needs the client's app running)
bin/console api:openapi:export --yaml > docs/legacy/openapi.baseline.yaml
# later, on any commit:
bin/console api:openapi:export --yaml > /tmp/openapi.head.yaml
oasdiff breaking docs/legacy/openapi.baseline.yaml /tmp/openapi.head.yaml --fail-on ERR
```

The exact export command name varies by bundle and version — run
`bin/console list api` or `bin/console list nelmio` first rather than assuming.

### Atlas — hand-made changes to a production database

https://github.com/ariga/atlas — Apache-2.0, 8649 stars, v1.3.0 (2026-08-02),
not archived.

Atlas answers the question that silently invalidates every other document
produced: *has anyone changed this production database by hand?* On a legacy
takeover that is not a hypothetical.

Be honest about the split, because the vendor's marketing is not:

- **Free and deterministic**: `atlas schema diff` in the open-source CLI, comparing
  a desired schema against a live database. Run it manually, on demand.
- **Paid**: the always-on drift dashboard. atlasgo.io/monitoring/drift-detection
  places the feature under "Cloud > Schema Monitoring" and instructs the reader to
  "enable drift detection in Atlas Cloud". An Atlas Agent mechanism exists and is
  documented at atlasgo.io/cloud/agents.
- **Unverified**: whether continuous drift detection is usable at all without the
  Atlas Cloud control plane. The claim that the agent runs "in the DB VPC" is an
  inference from the docs structure, not a quotation — do not repeat it as one.

On Symfony, Atlas competes with Doctrine Migrations rather than composing with it.
Its realistic role on a takeover is detection, never owning migrations.

### The generic gate, when no tool exists

Any artifact that a command can regenerate can be gated in a handful of lines. The
pass branch was tested in this repository, the fail branch in a throwaway git
repository (a real drift requires modifying a tracked file):

```bash
<regenerate the artifact in place>
git ls-files --error-unmatch docs/legacy/recon.md >/dev/null 2>&1 || {
  echo "UNTRACKED: docs/legacy/recon.md was never committed, nothing to compare" >&2
  exit 1
}
git diff --quiet -- docs/legacy/recon.md || {
  echo "DRIFT: docs/legacy/recon.md no longer matches its generator" >&2
  exit 1
}
```

`git diff --quiet` exits 0 when the regenerated output is byte-identical to the
committed file and 1 when it differs. That is the entire mechanism behind tbls,
and it works for any analyzer whose output is deterministic and ordered. Sort
before writing — an unstable row order produces a diff on every run and the gate
gets disabled within a week.

The `git ls-files` line is there because `git diff --quiet` also exits 0 for a path
git has never tracked. Without it, renaming the artifact — or generating it for the
first time and forgetting to commit it — turns the gate green on a file nobody is
comparing. That was reproduced against the throwaway repository.

## 3. Schema versus code is itself a finding

tbls connects to the database. It documents the schema **as it actually is**, not
as the Doctrine mapping claims it is. Those two disagree on most legacy codebases,
and the disagreement belongs in `risk-register.md` under schema/code drift, with
the command that surfaced it.

The skill already states the authority order — migrations > ORM mapping >
DTOs/forms, because the database is what runs. tbls raises that from a manual
cross-check to a reproducible one, and Doctrine ships the other half:

`orm:validate-schema` returns a non-zero exit code, verified in the source of
doctrine/orm 3.6.8 at `src/Tools/Console/Command/ValidateSchemaCommand.php` —
`$exit` accumulates 1 for mapping errors (line 61) and 2 for a database not in sync
with the mapping (line 82), returned at line 87. That file is byte-identical back
to 3.5.0. **Read the installed version before citing a line**: on the 2.x branch a
takeover is far more likely to be running, the same three statements sit at lines
65, 86 and 91. The behaviour is identical; the line numbers are not. DoctrineBundle
historically exposes the command under a `doctrine:` prefix in Symfony apps, but
**that alias name is unverified**; run `bin/console list doctrine` and use whatever
the client's version actually registers.

Two commands, two directions, one finding:

| Command | Compares | A failure means |
|---|---|---|
| `tbls diff` | live database ↔ committed docs | the documentation is stale |
| `orm:validate-schema` | ORM mapping ↔ live database | the code's model of the database is wrong |

The second is the more alarming result on a takeover, and the one worth running
first — before the entity model is written, not after. A mapping that disagrees
with the database has been lying to every developer who read it.

## 4. Architecture as a checkable artifact

### Structurizr DSL

https://github.com/structurizr/structurizr — Apache-2.0, 345 stars, release
v2026.06.28, created 2025-11-30.

**The naming trap first.** `structurizr/cli`, `structurizr/lite`,
`structurizr/java` and `structurizr/onpremises` are all archived — cli, lite and
java on 2026-02-01. Their READMEs read "The Structurizr CLI will not receive any
further updates - please migrate to the new consolidated tooling." Every C4
tutorial, conference talk and blog post still points at those repos, and the
replacement has 345 stars against the old java repo's 1134. Search results will
favour the dead ones for years.

The value is that a C4 model written in the DSL is text: versioned, diffable,
reviewable as a diff rather than as an image. One model produces many consistent
views, exportable to PlantUML, C4-PlantUML and Mermaid. The **inspection** module
flags missing descriptions and technology choices, so model quality is gated
rather than eyeballed.

Two honest limits:

- **Structurizr makes no drift-detection claim.** The primary docs at
  docs.structurizr.com/ai describe model-based consistency and the inspection
  feature, nothing more. Secondary sources and aggregators attribute "detecting
  architectural drift" to it; that capability was invented downstream. Do not
  carry it into a client deliverable.
- The `structurizr-component` finder that reverse-engineers components from code is
  Java-oriented. On PHP the DSL is authored — by hand or by an agent — not
  extracted. What keeps it honest is Deptrac running against the same layer names.

Licensing, verbatim and in full from docs.structurizr.com/commands: "All the
Structurizr commands listed below are free and open source except for server -
this follows an open core model, with closed extensions for features that are
designed for use in enterprise environments." Quoting only the first half of that
sentence, as most write-ups do, drops the part a client will ask about. An MCP
server is documented at https://mcp.structurizr.com/mcp
and responds to a JSON-RPC POST (a plain GET returns 405, so a browser check looks
like a dead endpoint and is not).

### arc42 — twelve questions, twelve analyzers

https://github.com/arc42/arc42-template — 1265 stars, pushed 2026-07-07, version
9.0 (Jul 2025), CC BY-SA 4.0. The repository dates from 2014; arc42 itself dates
from 2005, by Peter Hruschka and Gernot Starke. No GitHub releases are published;
arc42.org carries the versioning.

arc42 is not a tool. It is the list of questions a takeover document must answer,
and that is exactly what stops an AI-assisted audit from producing an
unstructured wall of prose. The twelve sections, read from the repository tree
(`EN/adoc/`), map onto this skill's artifacts and onto a separate analyzer each:

| arc42 section | Artifact that answers it | Analyzer behind it |
|---|---|---|
| 01 Introduction and goals | `open-questions.md` | none — a human owns this, and its absence is the finding |
| 02 Architecture constraints | `recon.md` | runtime/framework versions with EOL status |
| 03 Context and scope | `architecture.md` | external calls, HTTP clients, message transports |
| 04 Solution strategy | `architecture.md` | inferred; mark as inference, see ADRs below |
| 05 Building block view | `architecture.md` | namespace/module inventory, Deptrac layers |
| 06 Runtime view | `use-cases/*.md` | `debug:router --format=json`, `debug:event-dispatcher` |
| 07 Deployment view | `recon.md` | CI config, Dockerfile/compose, environment surface |
| 08 Cross-cutting concepts | `architecture.md` | auth, listeners, feature flags, caching, i18n |
| 09 Architecture decisions | ADRs (below) | none — reconstruction, always flagged as such |
| 10 Quality requirements | `open-questions.md` | none obtainable from a repository |
| 11 Risks and technical debt | `risk-register.md` | the full deterministic pass |
| 12 Glossary | `glossary.md` | domain nouns from class/table/route names |

Read the table as a coverage check, not a table of contents. Three of the twelve
sections have no analyzer and never will: goals, solution strategy and quality
requirements are things a repository does not contain. A takeover document that
answers them confidently has invented them.

## 5. Decisions: ADRs record what was inferred

**Standardise on MADR.** https://github.com/adr/madr — 2399 stars, spec 4.0.0
(2024-09-17), repository pushed 2026-08-03. A stable spec, still tended: context,
considered options, decision outcome, consequences, as markdown in
`docs/decisions/`.

Skip the tools, and know why:

- **adr-tools** (https://github.com/npryce/adr-tools) — 5611 stars, more than any
  other ADR tool, and the default recommendation in nearly every ADR article. Last
  release 3.0.0 on **2018-07-25**; last commit 2024-04-25. It is not archived and
  it is POSIX shell with no runtime dependencies, so it still works — call it
  unmaintained but functional, not dead. The point is that its star count is not
  evidence of anything.
- **log4brains** (https://github.com/thomvaill/log4brains) — 1561 stars,
  Apache-2.0, last push and last release both 2024-12-17, npm frozen at 1.1.0.
  Dormant for roughly twenty months. The nicest publishing experience in the
  category, and not something to build a client deliverable on.

The format matters more than the tool. `mkdir -p docs/decisions` plus a copied
template is three lines and carries no maintenance risk.

**The takeover-specific use is different from the normal one.** An ADR normally
records a decision as it is made. Here it records what was *inferred* about a past
decision and how confident that inference is. Every such file states which
evidence produced the reconstruction (a migration, a commit range, a config value)
and carries `needs-human-validation` until someone who was there confirms it.

The reason to bother: without this, a choice questioned today is unreadable. It is
impossible to tell an error from the right call of an era whose constraints are
gone — a library that did not exist, a deadline, a database that could not be
migrated, a person who could not be hired. The reconstruction is the only thing
standing between "this is bad" and "this was reasonable and is no longer". That
distinction is the difference between an audit and a complaint.

## 6. Shared-brain implementations worth studying

### living-architecture / Rivière (Nick Tune)

https://github.com/NTCoding/living-architecture — Apache-2.0, 136 stars, pushed
2026-08-16. Note the owner casing (`NTCoding`) and that **no tagged GitHub release
exists**; npm packages are all prefixed `riviere` under the `@living-architecture`
scope (`@living-architecture/riviere-cli` 0.12.2, plus `riviere-schema`,
`riviere-builder`, `riviere-query`, `riviere-extract-ts`). There is no
`@living-architecture/cli` or `/core`.

It extracts FLOW-based architecture — how an operation actually travels from UI to
API to domain logic to events — into a JSON schema, rather than mapping which file
imports which.

**Its architecture is itself an endorsement of this plugin's doctrine**: the AI
discovers and proposes, and a deterministic linter enforces the source conventions
that make extraction reliable. That division of labour is the transferable part.
Only the TypeScript extractor ships (`riviere-extract-ts`) and enforcement is
ESLint rules, so on PHP both halves must be reimplemented — a PHPStan Collector for
extraction, a PHPStan rule or PHPArkitect rule for enforcement.

And the ceiling on the whole approach, named precisely in a comment under Tune's
own article — the research attributes that comment to Jaroslaw Wasowski and the
attribution is **unverified**, the thread was not re-read this session, so make the
argument without the name: a lint rule guarantees every class carries its
`@Role` annotation, but it only proves the annotation exists, not that it is still
true. **Enforcing that metadata is present is deterministic; enforcing that it is
correct is not.** That applies to every annotation-based living-documentation
design, including any built here. State it rather than discover it later.

### openrewrite/rewrite-prethink

https://github.com/openrewrite/rewrite-prethink — 9 stars, created 2026-01-25,
v1.2.0 (2026-08-12), Java.

**This is the closest existing thing to this plugin, and it is built the right way
round.** A deterministic analyzer runs, and its *output is* the agent knowledge
base: CSV data tables plus markdown written to `.moderne/context/`, with the
agent's config files patched to point at it. No model in the analysis loop. Its
stated rationale is this skill's: pre-computed context so a coding agent
understands the codebase without burning context window reading source files.

The eight data tables, verbatim from the README, are a ready-made schema for what
a codebase knowledge base should contain: `ServiceEndpoints`,
`DatabaseConnections`, `ExternalServiceCalls`, `MessagingConnections`,
`ServerConfiguration`, `SecurityConfiguration`, `DataAssets`,
`DeploymentArtifacts`. It also emits a FINOS CALM architecture diagram
(`calm-architecture.json`) — a published standard rather than an ad-hoc markdown
blob.

Detection is JVM-only (Spring MVC, JAX-RS, Micronaut, Quarkus, JPA, Spring Data,
JDBC). The table schema transposes onto Symfony almost one-to-one: routes and
controllers, Doctrine entities and repositories, HttpClient calls, Messenger
transports, `security.yaml`, Dockerfile and compose. **Study the design; do not
depend on the tool.** Nine stars and seven months old.

### AGENTS.md

https://agents.md/, spec repository https://github.com/agentsmd/agents.md — 23666
stars, MIT, pushed 2026-03-12. **The repository moved out of the OpenAI org**;
`openai/agents.md` redirects. Cite `agentsmd/agents.md`.

The baseline container: one markdown file at repo root carrying build and test
commands, code-style rules and boundaries, versioned with the code and read
natively by 24 named tools. Vendor-published on agents.md: it "is now stewarded by
the Agentic AI Foundation under the Linux Foundation" and is "used by over 60k
open-source projects" — that last figure is a GitHub code-search count linked from
the site, not an audited statistic. It counts files. Do not repeat it as adoption.

Its limitation is what justifies everything above it: a flat file stops scaling on
a large legacy system.

### lat.md

https://github.com/1st1/lat.md — MIT, 1831 stars, v0.12.2, pushed 2026-08-12,
by Yury Selivanov. Its README opens, verbatim, with "`AGENTS.md` doesn't scale."

A knowledge graph as plain markdown in a committed `lat.md/` directory, sections
cross-linked with `[[wiki links]]` and linked into code symbols
(`[[src/auth.ts#validateToken]]`), with source files linking back via
`// @lat: [[section-id]]` comments.

**The one idea to steal is `lat check`**: it validates every wiki link and code
reference and fails when they drift apart. That is a referential-integrity gate for
a documentation set, and nothing else in this territory has one. The same check is
implementable for this skill's artifacts without adopting the tool — every
`BR-XXX` referenced somewhere exists, every `path:line` cited still resolves, every
routing-table entry points at a file that is there.

PHP support is **unverified**: the README shows `//` for TypeScript and `#` for
Python, both of which PHP accepts, but no explicit language list was found and the
source parser was not inspected. Test before recommending it to a client.

## 7. Cautionary findings — what not to build on

**Sourcegraph deleted Search Notebooks.** Prose interleaved with live,
re-executing search queries is the purest form of documentation that cannot rot: a
finding stated next to the query that produces it, re-run on read. Sourcegraph
removed it in 7.0 — verbatim from the changelog at
https://sourcegraph.com/changelog/7-0-removals-deprecations, "we've decided to
remove Search Notebooks from Sourcegraph: Notebooks can no longer be viewed or
created directly in Sourcegraph." The reasoning given: the premise dates to 2022
and "predates the AI era", and "the future lies much more in this type of
agent-driven code exploration". The only migration path is a one-time GraphQL
export by an administrator. `gh api repos/sourcegraph/sourcegraph` returns 404 —
the product source is gone from public GitHub. Re-confirmed 2026-08-16.

**CodeSee is dead.** The flagship "visualise any codebase automatically" startup,
acquired by GitKraken in May 2024. The **entire codesee.io domain returns 404,
homepage included** — re-confirmed 2026-08-16. There is no offboarding page; do not
link one. Its GitHub org is a graveyard of 2022-2024 pushes. It is still
recommended in 2026 listicles recycling pre-2024 copy.

**Backstage has no answer either.** The reference developer portal, 34149 stars,
and its TechDocs documentation (https://backstage.io/docs/features/techdocs/) is
silent on staleness. A "Trust Card with
associated Trust Score and automatic triggering of documentation maintenance
notifications" appears only on the roadmap, under a "Someday/Maybe" heading. The
category leader has not solved the category's core problem.

**The conclusion for this skill, and it is not negotiable.** The knowledge base is
plain markdown files in the client's own git, readable with no vendor, no account
and no running service. A platform can disappear between the audit and the
follow-up; a hosted wiki can lose its login when the champion leaves; a startup
that raised money on exactly this problem can 404 its own homepage. Files in git
survive all three. And the re-execution property that Sourcegraph deleted has to
be rebuilt rather than bought: a markdown artifact whose commands are runnable and
re-run in CI, which is the gate in section 2 applied to documentation.

## 8. DeepWiki — useful for their code, unusable for the client's

https://deepwiki.com/ — replace `github.com` with `deepwiki.com` in any public
repository URL and it serves a generated wiki with architecture pages, diagrams
and file-linked summaries. An MCP server at https://mcp.deepwiki.com/mcp exposes
the same corpus with exactly three tools: `ask_question`, `read_wiki_contents`,
`read_wiki_structure`. Confirmed live and unauthenticated this session by calling
`tools/list` directly. Cognition's own post states it is "completely free with no
login or auth required" (vendor-published).

The split is the rule:

- **Public repositories — genuinely useful.** Orienting in an inherited third-party
  bundle, a framework version the client pinned five years ago, an abandoned
  dependency nobody understands. Reading a vendor's code through a generated wiki
  is faster than reading it cold, and nothing confidential leaves the machine
  because the code is already public.
- **The client's own private code — unusable.** docs.devin.ai, verbatim: "Want
  DeepWiki capabilities for private repositories? Sign up for a Devin account at
  Devin.ai and use the Devin MCP server with your Devin API key." Private coverage
  is a paid Devin account and an API key. Sending a client's codebase to a third
  party is a contractual question long before it is a technical one. Assume the
  answer is no.

Its output is generated prose either way. Regeneration is cheap, which is not the
same as reproducible: the same input does not guarantee the same output. Treat it
as a navigation aid and a hypothesis generator. Nothing from it enters an artifact
without a deterministic check behind it.

## 9. Two commands to run on the knowledge base itself

Both were executed on 2026-08-16 under bash, zsh and `/bin/sh`, against a
throwaway git repository carrying a populated `docs/legacy/` tree. This plugin's
own repository has no `docs/legacy/`, so neither could be exercised here.

**Which artifacts are older than the code they describe.** Not proof of staleness —
proof that staleness is possible, which is enough to order a review:

```bash
CODE=$(git log -1 --format=%ct -- src/ migrations/); CODE=${CODE:-0}
find docs/legacy -name '*.md' | sort | while IFS= read -r f; do
  DOC=$(git log -1 --format=%ct -- "$f"); DOC=${DOC:-0}
  if [ "$CODE" -gt "$DOC" ]; then S=STALE; else S=fresh; fi
  printf '%-6s %s\n' "$S" "$f"
done
```

Two details are load-bearing. The `${VAR:-0}` guards: `git log` prints nothing for
a path with no commits, and an empty string makes `[ -gt ]` fail rather than
compare. And `find` rather than `docs/legacy/*.md docs/legacy/use-cases/*.md`: on a
takeover whose use cases are not written yet the second glob matches nothing, which
under bash emits a phantom `STALE docs/legacy/use-cases/*.md` row and under zsh
kills the loop before it prints anything. `find` names the missing directory on
stderr and invents no rows. The `git log` inside the pipeline does not swallow the
loop's stdin — checked by row count, every file still gets one.

**Whether the routing table still routes.** Every link in the shared-brain index
resolving to a file that exists, written as a gate rather than as a report:

```bash
[ -f docs/legacy/README.md ] || {
  echo "MISSING INDEX: docs/legacy/README.md" >&2
  exit 1
}
BROKEN=$(grep -o '](\([^)]*\.md[^)]*\))' docs/legacy/README.md \
  | sed 's/^](//; s/)$//; s/#.*$//' \
  | while read -r p; do
      [ -f "docs/legacy/$p" ] || echo "BROKEN: $p"
    done)
[ -z "$BROKEN" ] || { echo "$BROKEN" >&2; exit 1; }
```

The bare pipeline this is built from fails three ways, all of them silent. It exits
0 while printing `BROKEN:` lines, so a CI job wired to it goes green. It exits 0
when the index file itself is gone, because a missing file only makes `grep`
complain on stderr. And `[^)]*\.md` alone skips every link carrying an anchor
(`entity-model.md#orders`) — the exact link a rename breaks without anyone
noticing. The three guards above close all three.

Run both at the end of every session that touches the knowledge base, and wire the
second into the verification pass. A routing table pointing at a file that was
renamed is the first way a shared brain stops being one.
