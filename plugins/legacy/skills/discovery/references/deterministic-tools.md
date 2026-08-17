# Deterministic tools before the model

The order is not a preference. A static rule gives the same verdict on every run
and its cost is predictable; a model reading the same files gives a different
answer each time and costs more. So a tool answers first, and the model works on
the tool's output — reading it, cross-referencing it, explaining it.

Where no tool answers the question, **write the analyzer, not the analysis**:
have the model produce a script whose output a human can re-run and sample-check,
rather than have it read files and form an opinion. The reviewable unit is the
analyzer, not the conclusion.

## How to read this file

Tools are grouped by **what has to be working on the machine**, because that is
the constraint that actually bites on day one of a takeover:

| Tier | Requirement | Use when |
|---|---|---|
| 0 | git, and at most the project's own `composer` / `bin/console` | Always. First hour, before asking for anything. |
| 1 | A single downloaded binary. No PHP runtime, no autoloader, no `composer install`. | `composer install` fails, PHP version mismatch, read-only checkout, locked-down machine. |
| 2 | A working `composer install` with dev dependencies | The normal engagement, once the app builds. |
| 3 | A JVM, Docker, a database connection, or a tolerance for young tooling | Specific questions worth the setup cost. |

Every entry carries the **question only it answers**, the **exact command with
its machine-readable output flag**, and the **trap**.

Two markers appear on commands:

- `[ran here]` — executed on 2026-08-16 on macOS (BSD userland) in a PHP-free git
  repository, and the output was as described. Safe to paste.
- `[not run here]` — the command and its flags come from the tool's own docs or
  source via the research journal, but nothing PHP could be executed on this
  machine. Confirm the binary name in `vendor/bin/` before quoting the command
  to a client.

Every version and status below was verified on **2026-08-16**. Re-verify before
quoting anything to a client:

```bash
gh api repos/OWNER/REPO --jq '.pushed_at, .archived'   # [ran here]
```

**Offline claims are by mechanism, not by test.** Everything in tiers 0–2 is
classified as local because it computes on local files with no remote API in its
detection path — not because an air-gapped run was tested. `composer audit` needs
the advisory database, dependency scanners need a vulnerability feed, and any
`gh api` verification step needs the network. Say "local computation" and not
"works offline" unless the air gap was actually tested.

## Find the tool by the question

| Question | Tool | Tier |
|---|---|---|
| What is this codebase made of, by language and size? | scc, cloc | 1 |
| What does the framework actually wire at runtime? | `bin/console debug:container --format=json` | 0 |
| Which routes and listeners really exist, in which order? | `debug:router`, `debug:event-dispatcher` | 0 |
| Which CVEs apply to the locked dependencies? | composer audit | 0 |
| Which files change most, and who owns them? | git log — see [recon-commands.md](recon-commands.md) | 0 |
| When X changes, what else changes with it? | code-maat `coupling` | 3 |
| Is there a live secret in the history? | gitleaks | 1 |
| What classes and methods exist, when `composer install` fails? | `ast-grep outline` | 1 |
| Where does this structural pattern occur, without types? | ast-grep, Semgrep | 1 |
| How much type-safety debt, as a curve? | PHPStan levels 0→10 | 2 |
| How much of the code declares types at all? | type-coverage (four percentages) | 2 |
| How much of this is still used? | shipmonk/dead-code-detector | 2 |
| How far is this from PHP 8.4 / Symfony 7? | Rector `--dry-run` | 2 |
| Does an architecture exist, and is it degrading? | Deptrac | 2 |
| Do the tests protect anything? | Infection MSI | 2 |
| Which dependencies are unused, shadow, or misplaced? | composer-dependency-analyser | 2 |
| How violently has the public API churned between two tags? | Roave BC check | 2 |
| Has this codebase ever had a coding standard? | PHP-CS-Fixer `--dry-run` | 2 |
| What are the architecture-level metrics? | PHPMetrics | 2 |
| Does user input reach a dangerous sink? | Psalm `--taint-analysis` | 2 |
| What is around the app — image, OS packages, IaC? | Trivy | 1 |
| Does the real database match the committed docs? | tbls `diff` | 3 |
| Nothing above answers it | PHPStan Collector — see the last section | 2 |

---

## Tier 0 — the first hour, nothing installed

### git as the analyzer substrate

Change frequency, author concentration, code age and co-change are computable
from `git log` alone. The full command set lives in
[recon-commands.md](recon-commands.md). Two corrections are mandatory before any
number leaves the machine — see *Behavioral analysis without a license* below.

### Symfony's own `debug:*` commands — the framework's truth

A static analyzer *guesses* at DI wiring. `debug:container --format=json` is the
container itself, after compilation, reporting every service id, class, tag and
autowired argument. Same for the real routing table (as opposed to what the
attributes look like) and the resolved listener priority chain that actually
decides request handling.

- **Unique question**: what does this application wire at runtime, as opposed to
  what the source suggests.
- **Command** `[not run here]`:
  ```bash
  bin/console debug:container --format=json > container.json
  bin/console debug:router --format=json > routes.json
  bin/console debug:event-dispatcher --format=json > listeners.json
  ```
- **Verified**: `RouterDebugCommand.php` (line 56), `ContainerDebugCommand.php`
  (line 55) and `EventDispatcherDebugCommand.php` (line 52) each declare
  `new InputOption('format', null, InputOption::VALUE_REQUIRED, ...)` in
  framework-bundle 7.3. `symfony/console` 7.3 `Helper/DescriptorHelper.php`
  registers **five** descriptors at lines 38–42: txt, xml, json, md, rst.
- **Trap 1**: `debug:translation` is in the same `Command/` directory and is
  routinely assumed to be part of the family. It declares **no `format` option at
  all**. Do not pipe it into a JSON parser.
- **Trap 2**: this requires a bootable app with a valid environment. A
  static-only audit may not have that on day one, and `bin/console` executes
  project code — on an untrusted checkout, read the routing configuration
  instead.
- **Cost**: zero. No dependency to install, no vendor, no account. This is the
  most underused deterministic source on an unknown Symfony app.

### composer audit

- **Unique question**: which locked dependencies carry a published advisory,
  with no account and no upload.
- **Command** `[not run here]`: `composer audit --format=json`
- **Verified**: built into Composer since 2.4; `composer/composer` at 2.10.2
  (2026-07-01). The advisory source `FriendsOfPHP/security-advisories` was pushed
  2026-08-14, i.e. within days of this research.
- **Trap**: version matching only. No reachability, no exploitability. Present it
  as an inventory, never as a risk verdict. Use it as the **control**: if a
  fancier scanner reports fewer packages than `composer audit`, that scanner is
  filtering, and the report must say exactly why.

---

## Tier 1 — single binaries, no PHP runtime

This tier is decisive, and it is the one most toolchain lists skip. On a client
machine where `composer install` does not work — wrong PHP version, missing
extensions, private repositories you have no token for, a vendor directory that
was never committed — everything in tier 2 is unavailable and these still run.
They parse or count without booting anything.

### scc — Sloc Cloc and Code

- **Unique question**: what is this codebase actually made of, before assuming it
  is a Symfony app.
- **Command** `[not run here]`: `scc --format json > scc.json`
- **Verified**: `boyter/scc` v3.7.0 (2026-03-04), 8,623 stars, MIT. Siblings
  alive: `XAMPPRocky/tokei` v14.0.0 (2025-12-30), `AlDanial/cloc` v2.10
  (2026-07-04).
- **Why it matters**: it supplies the complexity axis. `git log` gives change
  frequency for free; scc gives the complexity to multiply it by, across every
  language in the tree.
- **Trap**: the tool's own framing is a "cyclomatic-complexity **estimate**", not
  a parser-computed cyclomatic complexity. Do not present it next to PHPMetrics'
  number as if the two measured the same thing.

### cloc

- **Unique question**: how much of the last 12 months of effort went into PHP
  versus Twig, JS and SCSS.
- **Command** `[not run here]`: `cloc --json .` and `cloc --git --diff <sha1> <sha2>`
- **Trap**: GPL-2.0. It is a tool you run, not code you ship inside a
  deliverable. It is also slower than scc and has no complexity metric — the
  reason to reach for it is the `--git --diff` per-language churn mode the faster
  counters do not offer.

### ast-grep

- **Unique question**: where does this *structural* pattern occur — a method call
  inside a catch block, a `new` not preceded by a null check — on code that does
  not install, does not autoload, and may not even parse with PHP.
- **Commands** `[not run here]`:
  ```bash
  ast-grep outline --json path/to/File.php     # structural index: classes, methods, ranges
  ast-grep scan --json                          # YAML rules -> machine-readable matches
  ast-grep run -p '<pattern>' -r '<rewrite>'    # structural rewrite
  ```
- **Verified**: `ast-grep/ast-grep` 0.45.1 (2026-08-07), 15,541 stars. PHP is
  first-class: `crates/language/src/php.rs` exists and `crates/language/Cargo.toml`
  declares `tree-sitter-php = { version = "0.24.0", optional = true }`. The
  `outline` command landed in 0.44.0 (2026-06-22) and was exercised hands-on
  during the research on a real PHP file, returning correct class/method
  extraction with `symbolType`, `signature` and `astKind: class_declaration`.
- **Trap**: syntax only. It does not know types, inheritance, or which `->save()`
  you mean. Anything requiring "which class does this variable actually hold" is
  a tier-2 question.

### Semgrep (Community Edition)

- **Unique question**: a reproducible security-and-pattern census on day one,
  with Symfony- and Doctrine-specific rules already written by someone else.
- **Commands** `[not run here]`:
  ```bash
  semgrep --config p/php --json --output semgrep.json
  semgrep --config <rules> --autofix --dryrun     # preview a rule-defined fix
  ```
- **Verified**: `semgrep/semgrep` v1.173.0 (2026-08-13), LGPL-2.1.
  `semgrep/semgrep-rules` `php/` contains exactly: doctrine, lang, laravel,
  symfony, wordpress-plugins. The docs list PHP as *Generally available* with
  cross-function dataflow and 50+ Pro rules.
- **Trap, and it is the important one**: PHP dataflow is cross-**function** but
  **not cross-file**. The cross-file tier is C#, Go, Java, JavaScript, Kotlin,
  Python, TypeScript, C/C++ — PHP is not in it. In a Symfony app where
  controller → service → repository spans three files, that path is invisible.
  Expect false negatives, not false positives, and say so in the report.
- **Note**: the standalone `semgrep/mcp` repository is archived (since
  2025-10-28). The MCP server is vendored inside the semgrep binary now.

### gitleaks

- **Unique question**: is a secret that was deleted in HEAD still alive in the
  history.
- **Commands** `[not run here]`:
  ```bash
  gitleaks git --report-path gitleaks.json .
  gitleaks git -v --log-opts="--all commitA..commitB" path_to_repo
  gitleaks git -b baseline.json --report-path new-findings.json .
  ```
- **Verified**: `gitleaks/gitleaks` v8.30.1 (2026-03-21), 28,753 stars. The
  README states it scans `git log -p` patches, documents `--log-opts` (line 179)
  and the baseline behaviour (`-b, --baseline-path`, lines 134 and 191–203:
  gitleaks ignores findings already present in the baseline).
- **Trap**: it inspects **additions** only. It finds a secret that was committed;
  it does not find one that only ever appears as a deletion. Composite rules are
  flagged experimental by the project itself.
- **Why it earns its place in an audit**: every hit carries a commit SHA and a
  line, so it is sampleable, and it converts an audit into an urgent remediation
  ticket — which is how an audit earns a follow-up mandate.

### universal-ctags

- **Unique question**: a symbol inventory on code that does not parse cleanly,
  as a cross-check against a fancier index. If ast-grep and ctags disagree on the
  class count, one of them is wrong and something has been learned.
- **Command** `[not run here]`: `ctags --output-format=json -R src/`
- **Verified**: `universal-ctags/ctags` v6.2.1 (2025-10-25), `parsers/php.c`
  present.
- **Trap, reproduced on this machine** `[ran here]`: `/usr/bin/ctags` on macOS is
  BSD ctags from the Command Line Tools. It has no PHP parser and rejects long
  options —

  ```
  $ ctags --version
  /Library/Developer/CommandLineTools/usr/bin/ctags: illegal option -- -
  ```

  `brew install universal-ctags` is mandatory, and no script may assume the
  `ctags` on PATH is the right one. Call
  `$(brew --prefix)/bin/ctags` explicitly.

### Trivy and OSV-Scanner

- **Unique question (Trivy)**: what is wrong *around* the PHP code — the base
  image, the OS packages, the leaked value in a config file, the Dockerfile. On a
  legacy Symfony takeover the real finding is often in the image, not the app.
- **Command** `[not run here]`:
  `trivy fs --scanners vuln,secret,misconfig --format json -o trivy.json .`
- **Verified**: `aquasecurity/trivy` v0.74.0 (2026-08-14); a composer analyzer
  exists at `pkg/fanal/analyzer/language/php`.
- **Unique question (OSV-Scanner)**: the same CVE baseline as `composer audit`,
  from a second independent database, as a cross-check.
- **Command** `[not run here]`:
  `osv-scanner scan source --lockfile=composer.lock --format=json .`
- **Verified**: `google/osv-scanner` v2.5.0 (2026-08-07); the supported-lockfiles
  page lists `PHP: composer.lock`.
- **Trap**: OSV-Scanner's call analysis exists for Go (default on, govulncheck) and
  experimentally for Rust (DWARF-based). **There is no PHP call analysis.** Never
  let a report imply it prioritises PHP findings by exploitability; it version-matches.

---

## Tier 2 — the PHP dev-dependency core

Everything here needs a working `composer install --dev`. Every tool that is a
PHPStan extension lands in the **same** `--error-format=json` stream, sharing one
baseline and one exit code. That is the architectural point of this tier: one
invocation, one parser, many dimensions.

### PHPStan — the type-safety curve

- **Unique question**: how much type-safety debt exists, expressed as a monotonic
  curve rather than a single opinion.
- **Command** `[not run here]`:
  ```bash
  for L in 0 1 2 3 4 5 6 7 8 9 10; do
    vendor/bin/phpstan analyse --level "$L" --error-format=json --no-progress src \
      > "phpstan-level-$L.json"
  done
  ```
  One artifact per level; the error count comes from the `totals` block of each.
  Read the key names off the first file rather than assuming them — they were not
  verified by the research. The curve *is* the debt profile: reproducible, and
  verifiable by sampling any single reported line.
- **Verified**: `phpstan/phpstan` 2.2.8 (2026-08-04), 14,072 stars, 10.8M
  downloads/month. Eleven levels, 0 to 10; `--level max` aliases level 10, which
  was introduced in PHPStan 2.0 and reports errors even for implicit `mixed`.
  Error formatters, confirmed both on phpstan.org and in
  `phpstan-src/src/Command/ErrorFormatter`: table, raw, checkstyle, json,
  prettyJson, junit, github, gitlab, teamcity.
- **Symfony awareness is the pair, not the core**: `phpstan/phpstan-symfony`
  2.0.20 (2026-06-16) resolves service ids from the compiled container XML;
  `phpstan/phpstan-doctrine` 2.0.28 (2026-07-13) types repository and query
  results. Without them the analysis is PHP-aware, not Symfony-aware, and the
  false-positive rate on a DI-heavy codebase makes the numbers unusable.
- **Trap**: **PHPStan has no SARIF formatter.** This surprises people who assume
  the market leader has the best machine-readable output. Psalm and Mago both
  ship SARIF natively; the third-party PHPStan SARIF formatters are thin
  (`jbelien/phpstan-sarif-formatter`, 13 stars). If a client platform requires
  SARIF, that is an argument for Mago or Psalm in the pipeline, not for a 13-star
  formatter in the critical path.
- **Runtime note**: `phpstan/turbo-ext` is a native C++ extension (PHP 8.3+),
  repository created 2026-07-13, releases tracking core exactly (2.2.6, 2.2.7,
  2.2.8). The 2.2.6 release notes state, **vendor-published, verbatim**: "Optional
  native PHP extension (PHP 8.3+) written in C++ that makes running PHPStan
  10-30 % faster (depending on project specifics)". It changes runtime, not
  results. Check its presence with `vendor/bin/phpstan diagnose`, because the same
  analysis on two machines may differ in runtime and must not differ in output.
  Any "PHPStan is too slow for large legacy codebases" claim written before July
  2026 needs re-measuring.

### TomasVotruba/type-coverage

- **Unique question**: how much of this codebase declares types at all, as four
  independently checkable percentages — **parameter, return, property, constant**.
- **Command** `[not run here]`: a PHPStan extension; results arrive in the same
  `--error-format=json` stream once `tomasvotruba/type-coverage` is installed and
  the minimum percentages are set in `phpstan.neon`.
- **Verified**: 2.3.0 (2026-07-29), 218 stars, 984,276 downloads/month — the gap
  between stars and downloads is the signature of a transitive dev dependency in
  template projects, not of a community.
- **Why it earns a slide**: it turns "this codebase is untyped" from an impression
  into four numbers a client understands immediately, and it moves monotonically
  as remediation proceeds, so it doubles as the progress metric of the follow-up
  contract.

### shipmonk/dead-code-detector — the highest-value single tool

- **Unique question**: how much of this is actually still used, at
  method / property / constant / enum-case granularity.
- **Command** `[not run here]`: PHPStan extension; findings land in the PHPStan
  JSON stream.
- **Verified**: `shipmonk-rnd/dead-code-detector` 1.3.3 (2026-08-07), 502 stars,
  653,630 downloads/month.
- **Why nothing else substitutes**: it is framework-aware for **Symfony,
  Doctrine, Twig, Laravel and PHPUnit**, so it does not flag controller actions,
  event listeners or Twig-called methods that the container wires by string. A
  naive dead-code detector on a Symfony app produces mostly false positives, and
  handing a client a false-positive-laden dead-code list destroys the credibility
  of everything else in the report.
- **Two modes worth knowing**: it detects **dead call cycles** (clusters of code
  that only call each other and are reachable from nothing — exactly what legacy
  codebases accumulate), and it can separately flag code that is **only ever used
  by tests**, which distinguishes real dead code from code kept alive
  artificially by its own test.
- **Trap**: it can auto-remove what it finds. Treat that as a suggestion
  generator an agent proposes, never as an unattended step.

### Rector — the inverted measurement

- **Unique question**: how far is this codebase from a modern target, file by
  file, as an artifact instead of an impression.
- **Command** `[not run here]`:
  `vendor/bin/rector process src --dry-run --output-format=json > rector.json`
- **The inversion**: point it at a target set (PHP 8.4, Symfony 7) you have **no
  intention of reaching today**, and **never apply it**. The JSON is a
  deterministic, file-by-file measurement of distance-to-modern, fully
  reproducible because the rule set is pinned in `rector.php`.
- **Verified**: `rectorphp/rector` 2.6.2 (2026-08-12), 10,401 stars, 6.07M
  downloads/month. Flags read from `rector-src/src/Configuration/Option.php`:
  line 19 `DRY_RUN = 'dry-run'`, line 21 `DRY_RUN_SHORT = 'n'` (a separate
  constant, not an attribute of the first), line 23 `OUTPUT_FORMAT = 'output-format'`.
  Formatters in `src/ChangesReporting/Output/`: Console, GitHub, Gitlab, Json.
- **Trap**: `--dry-run` is designed as a CI gate, so expect a non-zero exit when
  it would change something. In a measurement pipeline that exit code means
  "distance > 0", not "failure". Confirm the actual exit code on the first run
  before wrapping the command in a `set -e` script.
- **Rule inventory as an artifact**: `vendor/bin/rector list-rules --output-format json`.
- **Custom rules are the falsifiable AI path**: `vendor/bin/rector custom-rule`
  (documented since Rector 0.19.3) scaffolds the rule class, a PHPUnit test and a
  before/after fixture file, and wires the PSR-4 path into `composer.json`. An
  LLM-authored rule is therefore immediately falsifiable: the fixture either
  transforms to the expected output or it does not. Red/green is the gate, never
  "the diff looks right".
- **Honest state of the ecosystem**: there is no official Rector MCP server, no
  official agent skill, and zero AI/agent/MCP posts on the Rector blog across the
  whole visible 2026 archive. Discussion #9074 (opened 2025-03-23) is unanswered;
  the maintainer's only comment reads, verbatim: "I'd have to see this in action.
  My experience with GPT and Rector is poor, as there is not much learning
  material and AST is precision work. How far are you from making a proof of
  concept to try out?" The closing question is an invitation, not a rejection.
  The community servers are `vasilvestre/mcp-rector` (13 stars, no push since
  2025-10-31) and `Digital-Process-Tools/mcp-rector-warm` (1 star). Plan on CLI
  plus JSON parsing, which is the more auditable path anyway because the command
  lands in the report.

### Deptrac — drawing the architecture nobody documented

- **Unique question**: two, and no other tool answers either as directly.
  1. **Reverse engineering**: on a deliberately naive layer definition, the
     graph output draws the *de facto* dependency structure of a codebase nobody
     documented. The first violation count is the finding.
  2. **Enforcement**: a baseline freezes today's violations so the next run
     measures whether the architecture is degrading — the number a client
     actually cares about.
- **Commands** `[not run here]`:
  ```bash
  vendor/bin/deptrac analyse --formatter=json > deptrac.json
  vendor/bin/deptrac analyse --formatter=mermaidjs        # diagram, consumed directly
  vendor/bin/deptrac analyse --formatter=graphviz-dot
  vendor/bin/deptrac analyse --formatter=baseline         # freeze today's violations
  ```
- **Verified**: `deptrac/deptrac` 4.7.1 (2026-07-23), 2,991 stars, 881,911
  downloads/month. Thirteen formatters, read from
  `src/DefaultBehavior/OutputFormatter/` at tag 4.7.1: table, console, json, xml,
  junit, codeclimate, github-actions, baseline, mermaidjs, graphviz-display,
  graphviz-dot, graphviz-html, graphviz-image.
- **Trap — the repository moved**: `gh api repos/qossmic/deptrac` silently
  resolves to `opensoftwareconsulting/deptrac`, which is `archived=true`, last
  pushed 2025-02-17, has 2 stars, zero releases and tags stopping at 2.0.4.
  Reproduced `[ran here]`. Every article, CI config and bookmark pointing at the
  old org lands on an archived husk.
- **Carried through as unverified**: how usable the `graphviz-dot` output is when
  the layer definitions are *deliberately naive* — that is exactly the
  reverse-engineering use case recommended above, and it was not tested by the
  research. Budget an iteration on the depfile before promising a diagram.
- **The AI's job here** is to write the `depfile.yaml` — inferring intended layers
  from directory structure and namespaces — and let the tool produce the verdict.
  Opinion in, artifact out.

### PHPat — architecture rules inside PHPStan

- **Unique question**: same territory as Deptrac, different mechanics. Because it
  runs **as a PHPStan extension**, architecture violations land in the same JSON
  stream as type errors, sharing one baseline and one exit code. For an agent
  pipeline that means one invocation and one parser covering both dimensions.
- **Verified**: `carlosas/phpat` 0.12.4 (2026-03-17), 1,274 stars, 632,276
  downloads/month. The README confirms it is a PHPStan extension requiring
  `phpstan/extension-installer` and a `phpstan.neon` entry.
- **Trap worth stating to a client**: 632k downloads/month against a **0.x**
  version with no stable release in five months. It is not alone — see the
  never-declared-stable note under *Version pinning*.

### Infection — the only answer line coverage cannot fake

- **Unique question**: is this test suite actually protecting anything. A suite
  can execute 80% of lines and assert nothing; MSI cannot be gamed the same way.
- **Command** `[not run here]`: `vendor/bin/infection --threads=4`, with loggers
  and thresholds configured in `infection.json5`.
- **Verified**: `infection/infection` 0.34.2 (2026-08-07), 2,233 stars, ~1.19M
  downloads/month. Loggers documented on infection.github.io: text, html,
  summary, json, perMutator, github, gitlab, stryker, summaryJson. Config keys:
  `minMsi`, `minCoveredMsi`, `ignoreMsiWithNoMutations`.
- **Two scores, not one**: MSI covers the whole codebase; **Covered Code MSI**
  covers only the lines the suite executes. Quoting one without the other lets a
  client read a good number off a suite that tests a tenth of the app.
- **Trap — determinism**: classified **hybrid** by the research, and that
  classification is explicitly the researcher's judgement, not a documented
  property of the tool. The mutation set is deterministic; the pass/fail of each
  mutant depends on the test suite, which on legacy Symfony frequently has
  ordering, time and timeout sensitivity. Pin the seed and the timeout, and
  publish the run conditions next to the number.
- **The artifact for a human** is the `perMutator` log: it says which *kind* of
  assertion the suite is systematically missing, which is a finding rather than a
  number.
- **Practical constraint**: mutation testing multiplies suite runtime. Scope it to
  the modules the hotspot cross already flagged rather than the whole app.

### composer-dependency-analyser

- **Unique question**: three dependency defects in one pass — **unused**
  (declared, never used), **shadow** (used but not declared, i.e. relying on a
  transitive package), and **misplaced** (a prod requirement used only in dev, or
  the reverse).
- **Command** `[not run here]`: `vendor/bin/composer-dependency-analyser`
- **Verified**: `shipmonk-rnd/composer-dependency-analyser` 1.8.4 (2025-11-25),
  853,345 downloads/month — more than `composer-require-checker` (576,017) and
  `composer-unused` (408,407) individually, which is the adoption signal.
- **Why shadow dependencies are the finding that bites**: the codebase compiles
  today only because some other package happens to pull in what it silently uses.
  It breaks the moment anything is bumped — i.e. on the first day of the
  modernisation the client just bought.
- **Cross-check**: `maglnet/ComposerRequireChecker` 4.24.0 (2026-03-20) is the
  most conservative, longest-established answer to the shadow question. Two
  independent tools agreeing on a finding is exactly the verifiability an audit
  deliverable needs. See the case-sensitivity trap below before scripting its
  verification.

### Roave/BackwardCompatibilityCheck

- **Unique question**: how violently has this codebase's public surface churned —
  run it between an old tag and HEAD rather than between two releases.
- **Command** `[not run here]`:
  `vendor/bin/roave-backward-compatibility-check --from=<old-tag> --to=HEAD --format=json`
- **Verified**: 8.21.0 (2026-05-15), 601 stars, 296,800 downloads/month.
  Formatters read from `src/Formatter/`: Json, Junit, GithubActions,
  MarkdownPipedToSymfonyConsole, SymfonyConsoleText.
- **Trap**: it requires all source paths to be covered by `composer.json`
  autoload. That is satisfied on any modern Symfony app and frequently **not**
  satisfied on a truly ancient one — which is precisely the codebase you wanted
  to measure.
- **Second use**: on a codebase with internal shared packages, it tells you which
  ones are safe to modify and which have consumers you would break.

### PHP-CS-Fixer — style debt as a proxy for how the team worked

- **Unique question**: has this codebase ever had a consistent standard at all.
- **Command** `[not run here]`:
  `vendor/bin/php-cs-fixer fix --dry-run --format=json > cs.json`
- **Verified**: v3.95.18 (2026-07-30), 13,547 stars. Reporters in
  `src/Console/Report/FixReport/`: Checkstyle, Gitlab, Json, Junit, Text, Xml —
  note there is **no** GitHub-Actions reporter here, unlike Rector and Roave.
- **Trap**: the value is diagnostic, not cosmetic. Never apply it during an audit —
  a formatting commit destroys the `git blame` and churn data the rest of the
  audit depends on.

### PHPMetrics

- **Unique question**: the architecture-level numbers a client report needs —
  Maintainability Index, LCOM, cyclomatic complexity, Halstead,
  instability/abstractness, coupling.
- **Command** `[not run here]`:
  `vendor/bin/phpmetrics --report-summary-json=metrics.json src/`
- **Verified**: `phpmetrics/PhpMetrics` v2.11.0 (2026-08-09), 2,609 stars.
  Report flags read from `src/Hal/Application/Config/Validator.php` (line 95 and
  lines 131–135): `--report-html`, `--report-csv`, `--report-json`,
  `--report-summary-json`, `--report-violations`, plus `--junit`, `--git`,
  `--composer`, `--metrics`, `--exclude`, `--extensions`, `--config`.
- **Trap — the Maintainability Index needs its inputs quoted.** MI is a composite
  with contested weightings. Publishing "MI = 62" as a grade invites a fight with
  anyone who knows the formula. Publish it with the inputs it was computed from
  (complexity, Halstead volume, LOC) and it becomes defensible.
- **Second trap**: on Symfony it needs path exclusions for `var/` and `vendor/`
  or the numbers are meaningless.
- **Carried through as unverified**: the *semantics* of `--report-violations`,
  `--git` and `--composer` were inferred from the flag names. The flags exist in
  the source; their output schemas were not tested.
- **Use `--report-summary-json`**, not `--report-json`: the full JSON is large
  enough to be awkward to diff and to feed into context.

### Psalm — taint analysis, and only taint analysis

- **Unique question**: does user-controlled data reach a dangerous sink, across
  function boundaries. Where Semgrep stops at the file boundary on PHP, Psalm
  crosses it. This is the closest thing to CodeQL that PHP has.
- **Command** `[not run here]`:
  `vendor/bin/psalm --taint-analysis --report=taint.sarif`
- **Verified**: `vimeo/psalm` stable 6.16.1 (2026-03-19), 5,882 stars, 1.65M
  downloads/month, default branch 6.x. The research's two verification passes
  **split on the label**: one raised "maintained-slowly" to active against its own
  18-month staleness threshold, the other let "maintained-slowly" stand. Both read
  the same facts — last commits 2026-06-23, roughly eight weeks of silence before
  this file was written, against a stable release on 2026-03-19. Quote the dates,
  not the label. Seventeen report classes at tag 6.16.1, read from
  `src/Psalm/Report/`: Sarif, Sonarqube, CodeClimate, Checkstyle, Json,
  JsonSummary, Junit, GithubActions, Pylint, Compact, Count,
  ByIssueLevelAndType, Console, Emacs, PhpStorm, Text, Xml — the richest report
  set in the territory.
- **Trap 1 — the 7.0 line is not something to build on**: 7.0.0-beta1 shipped
  2025-03-20 and beta19 on 2026-04-15, nineteen betas across thirteen months with
  no stable 7.0 seventeen months in. 6.x is the maintained line.
- **Trap 2 — taint analysis trusts your escaping.** The Psalm docs warn verbatim
  that it "relies on not making any mistakes when escaping values". A hand-rolled
  `real_escape_string` call reads as safe. It also needs reasonably complete type
  information, so a legacy untyped codebase yields far weaker results — the
  codebase most in need of it is the one it serves worst.
- **Do not invert the pipeline**: run Psalm to get the flows, then hand the SARIF
  to the model to judge exploitability and draft fixes. A model guessing taint
  flows across a Symfony service graph is exactly the unverifiable opinion this
  skill rejects.

### Mago — the fast first pass with SARIF and a baseline

- **Unique question**: a full-repo analysis cheap enough to run exhaustively
  rather than by sampling, with SARIF and a baseline built in.
- **Commands** `[not run here]`:
  ```bash
  mago analyze --reporting-format=sarif > mago.sarif
  mago analyze --generate-baseline
  ```
- **Verified**: `carthage-software/mago` 1.46.0 (2026-08-05), 3,380 stars,
  Apache-2.0, 244,549 downloads/month, 46 minor releases since 1.0.0 (2025-12-20).
  Reporting formats from `docs/.../shared-reporting-options.md`: rich, medium,
  short, ariadne, emacs, github, gitlab, json, checkstyle, **sarif**, count,
  code-count. Baseline flags: `--generate-baseline`, `--baseline <PATH>`,
  `--remove-outdated-baseline-entries`, `--backup-baseline`, `--ignore-baseline`.
- **Trap 1 — no container awareness.** It is a pure language-level analyzer. It
  will not resolve `$container->get('x')` or Doctrine repository return types the
  way `phpstan-symfony` and `phpstan-doctrine` do. It is a fast first pass, not a
  Symfony-aware one, and it does not replace PHPStan on a Symfony app.
- **Trap 2 — it changes its output format when an agent runs it.** Mago
  auto-detects coding agents via the env vars `CLAUDECODE`, `GEMINI_CLI`,
  `CODEX_SANDBOX`, `OPENCODE_CLIENT` and defaults to the terser `medium` format
  when one is set (verified in `src/commands/args/reporting.rs`). An agent
  pipeline that does not pass an explicit `--reporting-format` will silently get
  different output than the same command run by a human. Always pass the flag.
- **Carried through as unverified**: every Mago-vs-PHPStan speed ratio. The
  headline figures are **vendor-published** on a benchmark harness written by
  Mago's own authors, last updated 2026-04-15 — which predates PHPStan Turbo
  entirely. The research could not extract the per-tool timing table. Re-run
  locally before repeating any multiple.
- **Also unverified**: Mago's own stability policy. Its FAQ still says analyzer
  plugins are "not before 1.0.0" and LSP is "planned for 2.0.0" while releases sit
  at 1.46.0, so the FAQ is stale relative to the version number. Whether 1.x
  implies semver stability for *findings* is unconfirmed — and that matters
  directly, because findings that shift between minor versions break a committed
  baseline.

---

## Tier 3 — heavy or situational

### code-maat — temporal coupling with a defensible threshold

- **Unique question**: when file X changes, what else changes with it, at a
  confidence level you can defend to a client. No static analyzer sees this.
- **Commands** `[log command ran here]`:
  ```bash
  git log --all --numstat --date=short --pretty=format:'--%h--%ad--%aN' \
    --no-renames --after=2024-01-01 -- . ':(exclude)vendor/*' > evo.log
  java -jar code-maat-1.0.4-standalone.jar -l evo.log -c git2 -a coupling \
    --min-coupling 30 --min-shared-revs 5
  ```
  The `git log` line and the pathspec-exclusion form are verbatim from the
  code-maat README and were executed in this repository (4,219 lines of valid
  `git2`-format log). The `java -jar` line could not be executed — see the JVM
  trap.
- **Verified**: `adamtornhill/code-maat` v1.0.4 (2023-02-20), 2,624 stars, assets
  `code-maat-1.0.4-standalone.jar` and `code-maat-1.0.4.jar`. The `-h` output
  lists **18 analyses**: abs-churn, age, author-churn, authors, communication,
  coupling, entity-churn, entity-effort, entity-ownership, fragmentation,
  identity, main-dev, main-dev-by-revs, messages, refactoring-main-dev,
  revisions, soc, summary. Defaults from the README usage block: `--min-revs 5`,
  `--min-shared-revs 5`, `--min-coupling 30`, `--max-changeset-size 30`.
- **Frozen, not dead**: the last release is February 2023 and the last
  non-README merge is 2024-11-18. For a deterministic CLI with a frozen input
  contract, "unmaintained" and "unusable" are genuinely different things, and
  conflating them costs the best free coupling analysis available.
- **Trap — the JVM stub, reproduced on this machine** `[ran here]`:
  `command -v java` **succeeds** and resolves to `/usr/bin/java`, because macOS
  ships a shim on PATH whether or not a JDK is installed. `java -version` returns
  "Unable to locate a Java Runtime." Check the runtime, never the PATH:

  ```bash
  java -version >/dev/null 2>&1 || echo "no JRE — code-maat unavailable"   # [ran here]
  ```
- **Trap — the threshold is a judgement, not a constant.** `--min-coupling 30`
  is a default, not a scientific finding. A 2026 study across 14K+ commits and
  five repositories found co-committal strength varies widely with contributors'
  style and activity, making temporal coupling a project-dependent proxy rather
  than a general indicator of logical dependency. An honest report states the
  threshold and shows the sensitivity at a second value. That study's numbers
  reached the research through a search summary and DOI metadata, not the full
  text (the publisher returned 403) — **carried through as unverified**; do not
  cite the paper's figures in a client deliverable without reading it.

### Joern (php2cpg)

- **Unique question**: genuine interprocedural dataflow on PHP — the reachability
  and taint questions a PHPStan Collector cannot answer because it has no flow
  analysis.
- **Verified**: `joernio/joern` v4.0.604 (2026-08-14), 3,425 stars. `php2cpg` is
  present among the frontends; it works by invoking
  `php-parse --json-dump --with-recovery` per file, i.e. it is itself built on
  nikic/PHP-Parser, and requires PHP >= 7.0. A `ComposerAutoloadPass` consumes
  composer autoload.
- **Trap**: 145 issues mention php2cpg, with open ones on scope resolution (`::`),
  late static bindings, destructuring, and "some dynamic calls now generate empty
  call nodes" (#6022). PHP's dynamic dispatch is exactly where a code property
  graph gets weak — which is exactly what Symfony's compiled container is built
  on. Sample every path it reports.

### OWASP dep-scan — the only free computed-reachability path for PHP

- **Command** `[not run here]`:
  ```bash
  depscan --profile research -t php -i <source directory> \
    --reports-dir <reports directory> --explain
  ```
- **Verified**: `owasp-dep-scan/dep-scan` v6.3.0 (2026-07-23), 1,280 stars. The
  docs state "atom backs Java/JVM, JavaScript/TypeScript, Python, and PHP", and
  the supported-languages row reads
  `PHP | pkg:composer | cdxgen (composer.lock, requires PHP >= 7.4) | atom | FrameworkReachability`.
  `AppThreat/atom` v3.1.1 (2026-08-07).
- **Trap**: its accuracy on Symfony is **unmeasured**. Sample every reported path
  by hand before it reaches a report.
- **The distinction to state in writing**: "reachable" is sold for two different
  things. **Curated per-CVE rules** (Semgrep Supply Chain — PHP reachability
  generally available since July 2025, vendor-published) match a hand-written
  vulnerable-usage pattern per CVE, bounded by a published coverage window
  (critical-severity CVEs back to 2017, high-severity back to May 2022). Outside
  that window no rule exists and the finding silently degrades to plain version
  matching **while appearing in the same result set**. **Computed call graphs**
  have no CVE ceiling but real blind spots around reflection and dynamic
  dispatch. Endor Labs states in its own docs (docs.endorlabs.com/scan/sca/php)
  that "Call graphs are not supported for PHP projects".

### tbls — the schema as it actually is

- **Unique question**: does the committed documentation still describe the real
  database, with an exit code rather than an opinion. On a Doctrine app it
  documents the schema as it **is**, not as the entity attributes claim.
- **Commands** `[not run here]`: `tbls doc`, `tbls diff`, `tbls lint`, `tbls coverage`
- **Verified**: `k1LoW/tbls` v1.95.0 (2026-07-11), 4,315 stars, MIT. The README
  documents the CI loop verbatim: commit the document with `tbls doc`, change the
  schema, check with `tbls diff` or `tbls lint` in CI, repeat.
- **Also answers**: which tables are orphaned (`unrelatedTable`) and which foreign
  keys have no index (`requireForeignKeyIndex`) — deterministically.
- **Trap**: it needs a live database connection. That is a client conversation,
  not a technical step, and it belongs in the engagement scope from day one.

### PhpCodeArcheology

- **Unique question**: architecture metrics, git churn hotspots and a
  machine-consumable graph in **one** deterministic run, with SARIF, a Knowledge
  Graph JSON export and a first-party MCP server
  (`claude mcp add phpcodearcheology -- vendor/bin/phpcodearcheology mcp`, exposing
  `get_health_score`, `get_problems`, `get_metrics`, `get_hotspots`,
  `get_test_coverage`).
- **Verified**: latest GitHub release v2.11.2 (2026-07-27), MIT, created
  2023-12-22 — but Packagist serves v2.11.3 (2026-07-28), a tag with no GitHub
  release behind it. The registry is what `composer require` installs; pin from
  there, not from the releases page.
- **Trap — this is the adoption risk entry, not a hidden gem.** 88 stars and
  2,493 downloads/month. The best-fitting tool for AI-assisted audit in this
  territory is also one of the least battle-tested. Cross-check its numbers
  against PHPMetrics before any of them enter a client report.

### churn-php

- **Unique question**: churn × PHP-aware cyclomatic complexity, ranked, in one
  command, with a non-zero exit code above a threshold.
- **Verified**: `bmitch/churn-php` 1.7.3 (2026-01-02), last push 2025-12-31,
  1,376 stars, 22,899 downloads/month.
- **Trap**: it needs a real git history, so it fails on a squashed or
  freshly-imported repository — which is common on legacy handovers.
- **Honest recommendation**: the underlying computation is trivial to reproduce
  (`git log` change counts joined against any complexity metric), which makes this
  a better candidate for a generated 20-line analyzer than for a dependency —
  especially since its value is exactly the number the client's own team should be
  able to re-run after the engagement ends.

---

## Behavioral analysis without a license

The hotspot / temporal-coupling / bus-factor set is computable from `git log`
alone — see [recon-commands.md](recon-commands.md). code-maat adds defensible
thresholds. Neither requires a subscription.

**Two corrections are mandatory before any churn number leaves the machine.**

1. **Filter bots and merge commits.** A 2026 MSR study of 91 repositories found
   bots dominate hotspot churn — Pinned Version Bump alone at 26% of hotspot
   patterns, Formatting Ping-Pong at 9%. An unfiltered top-10 often measures
   Dependabot, not the team. (The study reached the research through its arXiv
   landing page with no linked replication package — **carried through as
   unverified**; the practice stands on its own regardless.)

   ```bash
   # [ran here] — works on Apple git 2.50.1 and Homebrew git
   git log --no-merges --use-mailmap --perl-regexp --author='^((?!bot).*)$' \
     --pretty=format: --name-only | grep -v '^$' | sort | uniq -c | sort -rn | head -20
   ```

2. **Apply a `.mailmap`.** Without it one human appears as four contributors and
   every ownership finding is noise. `git shortlog` reads `.mailmap` by default;
   `git log` needs `--use-mailmap` explicitly.

   ```bash
   git log --no-merges --use-mailmap --pretty=format:'%aN <%aE>' \
     | sort | uniq -c | sort -rn | head -20                            # [ran here]
   ```

**Naming discipline**: SonarQube's "Security Hotspots" are security-sensitive
locations needing human review. Tornhill hotspots are complex code that changes
often. Same word, unrelated concepts — and SonarQube, including the 2026.1 LTA,
computes nothing at all from git history. A report that does not disambiguate
them invites "we already have that in Sonar".

**On CodeScene**: the behavioral half is the paid half. Of the MCP server's 25
tools, a standalone token enables local Code Health only —
`docs/configuration-options.md` line 61 states verbatim that with a standalone
token "Project-level and API-dependent features are not available". Hotspots,
ownership maps and knowledge maps are REST calls against a CodeScene account.
The Community free tier is scoped to open-source projects, which is no use for a
client audit. Whether CodeScene's Code Health metric supports PHP at all was
**not verified** by the research — check codescene.io/docs before asserting it.

---

## Baselines are the engagement mechanism

Commit a baseline at engagement start and the second run is a **diff**, not a
re-audit. That single mechanic is what turns a one-off report into a measurable
remediation contract, and it is the strongest argument for choosing tools that
have one.

| Tool | Baseline mechanism |
|---|---|
| PHPStan | `--generate-baseline` (formatters `BaselineNeon`, `BaselinePhp` in `phpstan-src`); every PHPStan-extension tool inherits it |
| Deptrac | `analyse --formatter=baseline` |
| Mago | `--generate-baseline`, plus `--baseline`, `--remove-outdated-baseline-entries`, `--backup-baseline`, `--ignore-baseline` |
| gitleaks | `-b, --baseline-path` — known findings suppressed, new ones surface |
| Infection | `minMsi` / `minCoveredMsi` thresholds in `infection.json5` (a floor, not a frozen inventory) |

The baseline file is a frozen, diffable inventory of **accepted** debt. Say that
in the report: it is not a list of things that are fine, it is a list of things
that were knowingly not fixed today.

## Version pinning is not optional

**Pin the version of every analyzer next to the number it produced.** Findings
shift between minor releases, and a shifted finding silently invalidates a
committed baseline — the baseline still applies cleanly, it just no longer means
what it meant. Mago shipped 46 minor releases in under eight months and its own
stability policy for findings is unverified; that is the extreme case, not the
only one.

Record, next to every figure: the tool version, the extension versions, the
config file, and the date. `composer show --locked --format=json` captures the
tier-2 set in one artifact.

A related caution for the deliverable: large parts of the PHP quality toolchain
that everyone treats as production infrastructure have **never declared
themselves stable** — PHPat 0.12.4 at 632k downloads/month, composer-unused 0.9.6
at 408k, Infection 0.34.2 at ~1.19M after roughly a decade. That is not a reason
to avoid them. It is a reason to pin them.

---

## The cut list

Knowing these are dead is worth more than knowing a live tool exists, because
they are still recommended in most "PHP audit toolchain" articles and in any
model's recall.

| Tool | Status on 2026-08-16 | Why it is cut |
|---|---|---|
| `sebastianbergmann/phpcpd` | `archived=true`, last push 2023-01-10, 2,211 stars, no releases endpoint | The standard duplication detector, archived. See the gap note below. |
| `sebastianbergmann/phploc` | `archived=true`, last push 2025-04-12, 2,343 stars | Size/structure metrics — use PHPMetrics or PhpCodeArcheology instead |
| `sebastianbergmann/phpdcd` | `archived=true` since 2015-10-12 | Dead-code detection — use shipmonk/dead-code-detector |
| PHPMD | Not archived, pushed 2026-08-16, but **frozen at 2.15.0 since 2023-12-11** — 2 years 8 months. 1,911,008 downloads/month, `abandoned=null` on Packagist | Nothing warns you. Recent commits are a security-advisory allowlist entry and typo fixes ("ifit" → "if it"). It predates modern typing, has no Symfony awareness, and PHPStan level 6+ already covers most of its findings. **If a client's CI depends on it, that is itself a finding.** |
| composer-unused | 0.9.6 (2026-01-30), last push 2026-04-27 | Superseded: composer-dependency-analyser covers the same ground plus two other defect classes in one pass. Keep only as a contentious-finding cross-check. |
| Qodana for PHP | `qodana-cli` alive (pushed 2026-08-15), but PHP is **paywalled** | The pricing page confirms three tiers, that PHP is unavailable under Community, that "Qodana for PHP" requires Ultimate or Ultimate Plus, and that the licensing minimum is three contributors. Reproducibility that requires a purchase is weaker reproducibility. **The dollar figures circulating for these tiers are unverified** — the help page carries no prices and the buy page renders them client-side. Do not quote a number. |
| CodeQL | Alive, but **has never supported PHP** | The supported-languages list is C/C++, C#, GitHub Actions, Go, Java, Kotlin, JavaScript, Python, Ruby, Rust, Swift, TypeScript. Correction worth carrying: the `github/codeql` repository is **MIT-licensed**; the commercial restriction people quote attaches to the separately distributed CodeQL CLI binary's terms, not to the query repository. Do not repeat the restrictive quote as if it came from that repo. |
| Exakat | Website demonstrably alive (blog posts 9–14 August 2026, "+1600 rules"), OSS distribution dead: `exakat/exakat` last pushed 2022-03-24 with a latest GitHub release of v-0.6.1 from **2016**; `exakat/exakat-ce` last pushed 2024-04-04 with **zero** releases | The rule breadth for PHP-version-compatibility questions is genuinely unmatched, but a pipeline the client must be able to re-run cannot rest on a distribution channel this stale. Its current CE version, its actual download path and whether it emits SARIF are all **unverified**. |
| Phan | Genuinely alive: 6.0.7 (2026-06-22), 5,623 stars | No unique question on a Symfony codebase and no meaningful Symfony/Doctrine extension ecosystem, so it misreads container and repository types. Worth knowing it is alive so you can say so with evidence when a client's legacy CI already uses it. Not worth adding to a new pipeline. |
| Comby | Repository pushed 2026-06-08, but the **distributed artifact is frozen at 1.8.1 (2022-06-28)** | `brew install comby` gets the June 2022 build. The three 2026 commits are "v2 prep" and an OCaml 5 port that has shipped nothing. ast-grep is strictly better for the same job on PHP. |
| `phpdepend/callmap` | 3 stars, last push 2024-10-06, pinned to `phpstan/phpstan: ^1.11` | Composer refuses to install it alongside PHPStan 2.2.8. It remains the best **reference implementation** to copy: the off-the-shelf call-map exists, is uninstallable, and writing the equivalent Collector is both faster and more maintainable. |
| `src-d/hercules`, `code-forensics`, `git-of-theseus`, `bus-factor-explorer` | Dead or archived | See the "a dead tool can look alive" trap. hercules in particular reads as alive: 2,804 stars, `archived=false`, last commit 2022-11-29, last release January 2020, amd64-only binaries. |

**The duplication gap is real and unfilled.** With phpcpd archived, the only fresh
option found is `shipmonk-rnd/copy-paste-detector` (created 2026-01-17, 6 stars,
2 published versions, 1,395 downloads/month) — far too young to anchor a client
deliverable. Its `composer.json` self-describes the technique as "AST-based
analysis, inspired by CloneDR to detect Type-2 (parameterized) code clones",
a different approach from phpcpd's token stream; that is the package's own
description and **no output of it was exercised**. Duplication
detection is therefore a prime write-the-analyzer target: token-stream
normalisation plus a rolling hash over PHP-Parser output is a tractable script.

---

## Repository identity traps

These produce false findings and wasted hours, and every one of them was
reproduced live.

- **A renamed repository resolves silently.** `gh api repos/qossmic/deptrac`
  returns `opensoftwareconsulting/deptrac`, `archived=true`, 2 stars. The live
  project is `deptrac/deptrac`. `[ran here]` Same class of trap:
  `arzzen/git-quick-stats` now resolves to `git-quick-stats/git-quick-stats`.

  ```bash
  gh api repos/qossmic/deptrac --jq '.full_name, .archived'   # [ran here]
  # -> opensoftwareconsulting/deptrac
  # -> true
  ```

- **GitHub API paths are case-sensitive.** `gh api repos/maglnet/composer-require-checker`
  returns HTTP 404 while `repos/maglnet/ComposerRequireChecker` resolves. `[ran here]`
  A verification script that lowercases repository names reports live tools as dead.

- **The Packagist name is not always the GitHub org.** `composer-unused/composer-unused`
  installs as `icanhazstring/composer-unused`; PhpCodeArcheology installs as
  `php-code-archeology/php-code-archeology`. The **registry**, not the repository,
  is the authority on what a user actually installs — the same lesson as git-truck,
  whose npm `latest` is 5.0.0 while GitHub's newest release and tag are both v4.0.0.

- **`archived=false` says nothing, and `archived=true` is not always fatal.**
  Some famous tools have thousands of stars, `archived=false`, and no functional
  commit since 2022. Others are archived because the code moved into a monorepo.
  Check four things before concluding either way: the archived flag, the last
  **non-README** commit, the latest release, and the package registry.

  ```bash
  gh api repos/OWNER/REPO --jq '.archived, .pushed_at, .stargazers_count'        # [ran here]
  gh api repos/OWNER/REPO/releases/latest --jq '.tag_name, .published_at'      # [ran here]
  curl -s https://repo.packagist.org/p2/VENDOR/PACKAGE.json \
    | jq -r '.packages["VENDOR/PACKAGE"][0] | .version, .time'                    # [ran here]
  ```

- **A README edit is not maintenance.** code-maat's `pushed_at` of 2025-07-03 is a
  Windows-instructions README commit; the last non-README merge is 2024-11-18.
  For a frozen-contract CLI that changes nothing about its usability — but the
  same signal on a tool with a live dependency surface (a Node or Python
  toolchain) means it no longer installs.

---

## When nothing answers: write the analyzer

**For PHP, write it as a PHPStan Collector, not a standalone script.** It
inherits type inference, container knowledge (via `phpstan-symfony`), file
discovery, caching, the baseline and JSON output. PHPStan documented Collectors +
`CollectedDataNode` + a custom `ErrorFormatter` as a data-extraction mechanism on
2026-03-26, with a worked call-map example emitting
`callingClass / callingMethod / calledClass / calledMethod` resolved through
`$scope->getMethodReflection()`.

The difference from a hand-rolled visitor is that results are **type-resolved
rather than name-matched** — the difference between a real call graph and a
guess. Fall back to `nikic/PHP-Parser` directly (v5.8.0, 2026-07-04, 17,452
stars, the most-starred repository in this whole territory) only when there is no
working `composer install`, and reach for `Roave/BetterReflection` (6.72.0,
2026-07-22) when types are needed without booting the app.

Questions with no off-the-shelf tool, one Collector each:

- How many controllers build a Doctrine query outside a repository.
- Which services are instantiated with `new` instead of injected.
- Where raw SQL concatenates a variable.
- Which controllers bypass the Form component.
- Which entities are mutated outside a repository.
- Duplication detection, per the gap above.

This pattern is not an invention of this skill. Rector's own maintainer published
it on 2026-07-14: agents wrote PHP scripts that mined the top 100 GitHub
repositories using Rector and the top 300 Packagist dependents for `skip[]`
entries, classified each as real bug or legitimate exclusion, and compressed a
20–30 minute human investigation to roughly 2 minutes. The agent authored the
extraction scripts; the pipeline then runs without the agent.

**The output contract, every time.** CSV or JSON with a stable schema, one row
per occurrence, `path:line` as the key, plus the tool versions and a timestamp.
Never prose.

**The sampling protocol, every time.** Draw N rows, open each `path:line`, record
agree/disagree, and publish the sample and the disagreement rate next to the
number. Sampling is the step that catches a wrong analyzer, and it is the only
verification that does not consist of asking the model to re-read itself.

**The fixture rule.** An AI-authored analysis rule is syntactically valid and
semantically wrong often enough that it must never ship without a test. For a
Rector rule, `vendor/bin/rector custom-rule` scaffolds the rule, a PHPUnit test
and a before/after fixture; red/green is the gate, never "the diff looks right".
For a Collector, the equivalent is a fixture directory with a known expected
count.

**Name and commit the command.** An analyzer that lives in a chat transcript is
an opinion with extra steps. Registered as a named task — `castor audit:dead-controllers`
(`jolicode/castor` v1.7.0, 2026-08-03), a Makefile target, or a Symfony Console
command — and committed, it becomes something anyone can re-run to get the same
result. It turns "the AI found 43 unused controllers" into "run this and see 43".
The point is that the command is named and versioned, not which runner produced it.
