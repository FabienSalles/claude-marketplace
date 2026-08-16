# Deterministic tools before the model

The order is not a preference. A static rule gives the same verdict on every run
and its cost is predictable; a model reading the same files gives a different
answer each time and costs more. So a tool answers first, and the model works on
the tool's output — reading it, cross-referencing it, explaining it.

Where no tool answers the question, **write the analyzer, not the analysis**:
have the model produce a script whose output a human can re-run and sample-check,
rather than have it read files and form an opinion. What ships is then an
artifact, not an avis.

Every tool below was verified alive on 2026-08-16. Re-verify before quoting a
version to a client: `gh api repos/OWNER/REPO --jq '.pushed_at, .archived'`.

## What to run first on a PHP/Symfony takeover

| Question | Tool | Command |
|---|---|---|
| What is this codebase made of? | scc | `scc --format json` |
| How much of it is still used? | shipmonk/dead-code-detector | PHPStan extension, method-level |
| How far from a modern target? | Rector | `rector process --dry-run --output-format=json` |
| How much type-safety debt? | PHPStan levels 0→10 | `phpstan analyse --level N --error-format=json` |
| Does an architecture exist? | Deptrac | `deptrac analyse --formatter=graphviz-dot` |
| Do the tests protect anything? | Infection | MSI, not line coverage |
| Which deps are unused or shadowed? | composer-dependency-analyser | one pass |
| Which CVEs apply? | composer audit | `--format=json` |
| Does the schema match the docs? | tbls | `tbls diff` returns an exit code |

Notes that change the reading:

- **`shipmonk/dead-code-detector`** (github.com/shipmonk-rnd/dead-code-detector) is
  the highest-value single tool on a legacy takeover: it is Symfony/Doctrine/Twig
  aware, so it does not flag everything the container wires by string. A naive
  dead-code detector on Symfony is mostly false positives.
- **Rector `--dry-run` is the inverted use case.** Never apply it. Point it at a
  target set (PHP 8.4, Symfony 7) you have no intention of reaching today: the
  JSON is a file-by-file, reproducible measurement of distance-to-modern, pinned
  by the rule set in `rector.php`.
- **PHPStan at successive levels** turns "this codebase is untyped" into a
  monotonic curve. Pair with `TomasVotruba/type-coverage` for four percentages
  that a client understands immediately.
- **Deptrac on a deliberately naive layer definition draws the de-facto
  architecture** of a codebase nobody documented. The first violation count is
  the finding.
- **Infection** answers the only question line coverage cannot fake. Record the
  run conditions next to the MSI: the score depends on suite determinism.
- **Mago** (github.com/carthage-software/mago) is a fast Rust first pass with
  SARIF and baselines built in, but it has no container/DI awareness. It does not
  replace PHPStan on a Symfony app.
- **Pin the version of every analyzer next to the number it produced.** Findings
  shift between minor releases, which silently invalidates a committed baseline.

## Behavioral analysis without a license

The classic hotspot / temporal-coupling / bus-factor set is computable from
`git log` alone (see [recon-commands.md](recon-commands.md)). `code-maat`
(github.com/adamtornhill/code-maat) computes them with defensible thresholds
(`--min-coupling`, `--min-shared-revs`) but is a frozen 2023 JAR and needs a
working JVM — on macOS, `command -v java` can succeed on a stub shim while
`java -version` fails, so check the runtime, not the PATH.

Two corrections before any churn number leaves the machine:

- **Filter bots and merge commits.** Automated churn (dependency bumps, formatter
  passes) dominates hotspot rankings on many repos. An unfiltered top-10 often
  measures Dependabot.
- **Apply a `.mailmap`.** Without it one human appears as four contributors and
  every ownership finding is noise.

SonarQube's "Security Hotspots" are unrelated to churn-based hotspots, and
SonarQube computes nothing from git history. Say which one you mean in the report.

## Reachability: say which claim you are making

"Reachable" is sold for two different things, and only one of them survives
outside its coverage window:

- **Curated per-CVE rules** (Semgrep Supply Chain) match a hand-written
  vulnerable-usage pattern per CVE, bounded by a published coverage window.
  Outside that window no rule exists and the finding silently degrades to plain
  version matching while appearing in the same result set.
- **Computed call graphs** (Socket.dev commercially; OWASP dep-scan + atom as the
  only free path) have no CVE ceiling but real blind spots around reflection and
  dynamic dispatch — which is precisely what Symfony's compiled container does.

For PHP the free option is `depscan --profile research -t php -i <src> --explain`
(github.com/owasp-dep-scan/dep-scan). Its accuracy on Symfony is unmeasured, so
sample every reported path by hand. Endor Labs states in its own docs that call
graphs are not supported for PHP; CodeQL has never supported PHP at all.

Semgrep's PHP dataflow is cross-function but **not cross-file**. In a Symfony app
where controller → service → repository spans three files, that path is invisible:
expect false negatives, not false positives.

## Writing the analyzer when nothing answers

For PHP, write it as a **PHPStan Collector** rather than a standalone script:
it inherits type inference, container knowledge, file discovery, caching, the
baseline and JSON output. PHPStan documented Collectors + `CollectedDataNode` +
a custom `ErrorFormatter` as a data-extraction mechanism (phpstan.org, 2026-03-26),
with a worked call-map example. Fall back to `nikic/PHP-Parser` only when there is
no working `composer install`.

Questions that have no off-the-shelf tool and are one Collector each: how many
controllers build a Doctrine query outside a repository, which services are
instantiated with `new` instead of injected, where raw SQL concatenates a
variable, which controllers bypass the Form component. Duplication detection is
another: `phpcpd` is archived and no mature successor exists.

**The output contract, every time.** CSV or JSON with a stable schema, one row per
occurrence, `path:line` as the key, plus the tool versions and a timestamp. Never
prose.

**The sampling protocol, every time.** Draw N rows, open each `path:line`, record
agree/disagree, and publish the sample and the disagreement rate next to the
number. Sampling is the step that catches a wrong analyzer, and it is the only
verification that does not consist of asking the model to re-read itself.

**The fixture rule.** An AI-authored analysis rule is syntactically valid and
semantically wrong often enough that it must never ship without a test. Rector's
`custom-rule` scaffolds the rule, a PHPUnit test and a before/after fixture; use
it. Red/green is the gate, never "the diff looks right".

## Two traps that produce false findings

- **A dead tool can look alive and a live one dead.** `archived=false` says
  nothing: some famous behavioral-analysis tools have thousands of stars and no
  release since 2020. And `archived=true` sometimes marks a repo whose code moved
  into a monorepo. Check the archived flag, the last non-README commit, the latest
  release and the package registry before concluding either way.
- **Renamed repos resolve silently.** `qossmic/deptrac` redirects to an archived
  2-star husk; the live project is `deptrac/deptrac`. The registry (Packagist,
  npm) is the authority on what a user actually installs, and the Packagist name
  is not always the GitHub org.
